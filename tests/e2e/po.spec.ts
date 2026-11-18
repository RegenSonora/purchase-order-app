import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { pdfText } from '../pdfText';

interface SharedFile {
  name: string;
  type: string;
  size: number;
  base64: string;
}

// The phone's clock is fixed at 2:32 pm on November 17, 2026 in Arizona, so PO numbers are known.
const NOW = new Date('2026-11-17T21:32:00Z');
/** The automatic number before a requester is named. */
const BASE = 'RS-20261117-1432';
/** The automatic number once "Pat Requester" is filled in. */
const NUM = `${BASE}-PR`;

/** Replaces the phone's Share sheet with a recorder, so tests can see the file that was shared. */
async function stubShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown[]; __cancelShare?: boolean };
    w.__shared = [];
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data?: ShareData) => Boolean(data?.files?.length),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data?: ShareData) => {
        if (w.__cancelShare) throw new DOMException('Share cancelled', 'AbortError');
        const file = data?.files?.[0];
        if (!file) throw new Error('No file was shared');
        let binary = '';
        new Uint8Array(await file.arrayBuffer()).forEach((b) => (binary += String.fromCharCode(b)));
        w.__shared.push({
          name: file.name,
          type: file.type,
          size: file.size,
          base64: btoa(binary),
        });
      },
    });
  });
}

async function shared(page: Page): Promise<SharedFile[]> {
  return page.evaluate(() => (window as unknown as { __shared: SharedFile[] }).__shared);
}

async function sharedText(file: SharedFile | undefined): Promise<string> {
  if (!file) throw new Error('Nothing was shared');
  return (await pdfText(Buffer.from(file.base64, 'base64'))).text;
}

const item = (page: Page, n: number) => page.getByRole('group', { name: `Item ${n}`, exact: true });

async function fillPo(page: Page, vendor = 'Ace Hardware'): Promise<void> {
  await page.getByLabel('Vendor name').fill(vendor);
  await page.getByLabel('Budget line', { exact: true }).selectOption('Listening sessions');
  await item(page, 1).getByLabel('Description').fill('Folding tables');
  await item(page, 1).getByLabel('Qty').fill('2');
  await item(page, 1).getByLabel('Unit price').fill('49.99');
  await page.getByLabel('Requested by', { exact: true }).fill('Pat Requester');
}

const send = (page: Page) => page.getByRole('button', { name: 'Send PO' }).click();

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await stubShare(page);
  page.on('dialog', (dialog) => void dialog.accept());
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
});

test('fill out a PO and send it as a PDF through the Share sheet', async ({ page }) => {
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(BASE);
  await fillPo(page);
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(NUM);
  await page.getByLabel('Vendor contact').fill('Sam Lee');
  await page.getByLabel('Vendor address').fill('123 Main St\nSuperior, AZ 85173');
  await page.getByLabel('Procurement method').selectOption('Micro-purchase');
  await expect(page.locator('#po-total')).toHaveText('$99.98');
  await expect(page.locator('#threshold')).toHaveText('Micro-purchase');

  await send(page);

  await expect(page.getByRole('status')).toContainText(`PO ${NUM} sent.`);
  const files = await shared(page);
  expect(files).toHaveLength(1);
  expect(files[0]?.name).toBe(`PO-${NUM}-Ace-Hardware.pdf`);
  expect(files[0]?.type).toBe('application/pdf');
  expect(files[0]?.size).toBeGreaterThan(1500);

  const text = await sharedText(files[0]);
  expect(text).toContain(`PO number ${NUM}`);
  expect(text).toContain('Ace Hardware');
  expect(text).toContain('Superior, AZ 85173');
  expect(text).toContain('2 Folding tables $49.99 $99.98');
  expect(text).toContain('PO total $99.98');
  expect(text).toContain('Pat Requester');

  // A fresh form, the requester remembered, and a number that does not repeat the one just sent
  // even though it is still the same minute.
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(`${NUM}-2`);
  await expect(page.getByLabel('Vendor name')).toHaveValue('');
  await expect(page.getByLabel('Requested by', { exact: true })).toHaveValue('Pat Requester');

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: `${NUM} · Ace Hardware` })).toBeVisible();
});

test('says what is missing and shares nothing', async ({ page }) => {
  await send(page);
  await expect(page.getByRole('alert')).toContainText('4 things need fixing');
  await expect(page.getByLabel('Vendor name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Enter the vendor name.')).toBeVisible();
  await expect(page.getByText('Add at least one item')).toBeVisible();
  await expect(page.getByLabel('Vendor name')).toBeFocused();
  expect(await shared(page)).toHaveLength(0);
  await expectAccessible(page);

  await page.getByLabel('Vendor name').fill('Ace');
  await expect(page.getByText('Enter the vendor name.')).toBeHidden();
});

test('cancelling the Share sheet keeps the PO as it was', async ({ page }) => {
  await fillPo(page);
  await page.evaluate(
    () => ((window as unknown as { __cancelShare: boolean }).__cancelShare = true),
  );
  await send(page);
  await expect(page.getByRole('status')).toContainText('Not sent');
  await expect(page.getByLabel('Vendor name')).toHaveValue('Ace Hardware');
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(`${NUM}`);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('No POs yet')).toBeVisible();
});

test('an unsent PO survives closing and reopening the app', async ({ page }) => {
  await fillPo(page);
  await page
    .getByLabel('Budget line', { exact: true })
    .selectOption({ label: 'Other (type it in)' });
  await page.getByLabel('Type the budget line').fill('Special project');
  await page.reload();
  await expect(page.getByLabel('Vendor name')).toHaveValue('Ace Hardware');
  await expect(item(page, 1).getByLabel('Unit price')).toHaveValue('49.99');
  await expect(page.getByLabel('Type the budget line')).toHaveValue('Special project');
  await expect(page.locator('#po-total')).toHaveText('$99.98');
});

test('a saved vendor fills in the contact and address', async ({ page }) => {
  await fillPo(page);
  await page.getByLabel('Vendor contact').fill('Sam Lee, 520-555-0100');
  await page.getByLabel('Vendor address').fill('123 Main St');
  await send(page);
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(`${NUM}-2`);

  await page.getByLabel('Vendor name').fill('ace hardware');
  await expect(page.getByLabel('Vendor contact')).toHaveValue('Sam Lee, 520-555-0100');
  await expect(page.getByLabel('Vendor address')).toHaveValue('123 Main St');
});

test('a typed-in budget line and funding source print on the PDF and are offered next time', async ({
  page,
}) => {
  await fillPo(page);
  await page
    .getByLabel('Budget line', { exact: true })
    .selectOption({ label: 'Other (type it in)' });
  await page.getByLabel('Type the budget line').fill('Community garden beds');
  await page
    .getByLabel('Funding source / award', { exact: true })
    .selectOption({ label: 'Other (type it in)' });
  await page.getByLabel('Type the funding source').fill('ADHS Heart Nation');
  await send(page);
  await expect.poll(async () => (await shared(page)).length).toBe(1);

  const text = await sharedText((await shared(page))[0]);
  expect(text).toContain('Budget line Community garden beds');
  expect(text).toContain('Funding source / award ADHS Heart Nation');

  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(`${NUM}-2`);
  await page.getByLabel('Budget line', { exact: true }).selectOption('Community garden beds');
  await page
    .getByLabel('Funding source / award', { exact: true })
    .selectOption('ADHS Heart Nation');
  await expect(page.getByLabel('Type the budget line')).toBeHidden();
});

test('history: send again, copy to a new PO, delete', async ({ page }) => {
  await fillPo(page);
  await send(page);
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(`${NUM}-2`);
  await page.getByRole('button', { name: 'History' }).click();
  await expectAccessible(page);

  await page.getByRole('button', { name: `Send again: ${NUM}` }).click();
  await expect.poll(async () => (await shared(page)).length).toBe(2);
  expect((await shared(page))[1]?.name).toBe(`PO-${NUM}-Ace-Hardware.pdf`);

  await page.getByRole('button', { name: `Copy to new PO: ${NUM}` }).click();
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(`${NUM}-2`);
  await expect(page.getByLabel('Vendor name')).toHaveValue('Ace Hardware');
  await expect(item(page, 1).getByLabel('Description')).toHaveValue('Folding tables');

  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: `Delete: ${NUM}` }).click();
  await expect(page.getByText('No POs yet')).toBeVisible();
});

test('items: totals, threshold notes, and a limit of 10', async ({ page }) => {
  await fillPo(page);
  await page.getByRole('button', { name: '+ Add item' }).click();
  await item(page, 2).getByLabel('Description').fill('Shade structure');
  await item(page, 2).getByLabel('Qty').fill('1');
  await item(page, 2).getByLabel('Unit price').fill('15,000');
  await expect(page.locator('#po-total')).toHaveText('$15,099.98');
  await expect(page.locator('#threshold')).toHaveText(
    'Over $15,000: quotes required, termination terms',
  );
  await expect(page.locator('#approval-note')).toBeVisible();

  await page.getByRole('button', { name: 'Remove item 2' }).click();
  await expect(page.locator('#po-total')).toHaveText('$99.98');
  await expect(page.locator('#approval-note')).toBeHidden();

  for (let n = 2; n <= 10; n += 1) await page.getByRole('button', { name: '+ Add item' }).click();
  await expect(item(page, 10)).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add item' })).toBeDisabled();
});

test('a PO number typed by hand is kept as typed', async ({ page }) => {
  await page.getByLabel('PO number', { exact: true }).fill('PO-77');
  await fillPo(page);
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue('PO-77');
  await send(page);
  await expect.poll(async () => (await shared(page))[0]?.name).toBe('PO-77-Ace-Hardware.pdf');
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(NUM);
});

test('settings: name and delivery address', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expectAccessible(page);
  await page.getByLabel('Your name').fill('Jordan Vice');
  await page.getByLabel('Usual delivery address').fill('40 Main St, Superior');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(`${BASE}-JV`);
  await expect(page.getByLabel('Requested by', { exact: true })).toHaveValue('Jordan Vice');
  await expect(page.getByLabel('Deliver to')).toHaveValue('40 Main St, Superior');

  await page.getByLabel('Vendor name').fill('Ace Hardware');
  await page.getByLabel('Budget line', { exact: true }).selectOption('Indirect');
  await item(page, 1).getByLabel('Description').fill('Paper');
  await item(page, 1).getByLabel('Qty').fill('1');
  await item(page, 1).getByLabel('Unit price').fill('5');
  await send(page);
  await expect(page.getByLabel('PO number', { exact: true })).toHaveValue(`${BASE}-JV-2`);
});

test('the form passes WCAG 2.1 AA checks and fits the phone screen', async ({ page }) => {
  await fillPo(page);
  await expectAccessible(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
