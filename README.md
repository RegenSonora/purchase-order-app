# Purchase Order app

A phone web app for Regenerating Sonora. Fill out a purchase order, get a PDF laid out like the
`Purchase_Order.xlsx` workbook, and send it through the phone's Share sheet (Mail, Messages, Drive
and so on).

Nothing you type leaves the phone until you share the PDF. Drafts, past POs, vendors and your name
are kept in the browser's storage on that phone only.

## Using it

1. Open the page on your phone.
2. Fill in the cards: Order, Vendor, Funding, Items, Sign-off.
   - **Budget line** and **Funding source**: pick from the list, or choose _Other (type it in)_.
     What you type is offered in the list next time.
   - **Vendor name**: a vendor you have used before fills in its contact and address.
   - Up to 10 items. Line totals, the PO total and the threshold note update as you type.
3. Tap **Preview PDF** to check it, then **Send PO** to open the Share sheet.
4. After sending, the PO is listed under **History**, where you can send it again, view the PDF,
   copy it into a new PO, or delete it from the phone.

The PO number is filled in automatically from the date, the time the PO was started and the
requester's initials, for example `RS-20261117-1432-PR`. Nothing is counted, so numbers do not
repeat across phones or after a phone's browser data is cleared. If the same person starts a
second PO in the same minute, it gets `-2` on the end. The number can be changed by hand; after
that it is left as typed.

Numbers are not in sequence, so a missing PO cannot be spotted from a gap. Keep a list of POs
somewhere else if you need to check that none is missing: the History screen only covers one
phone.

**Purchase request #** is for when a Purchase Request was done first. Leave it blank otherwise.

The signature boxes on the PDF are blank. Signing with a finger is planned for phase 2.

### Put it on the home screen

- **iPhone (Safari):** Share button, then **Add to Home Screen**.
- **Android (Chrome):** menu (three dots), then **Add to Home screen** or **Install app**.

Once opened with signal, it also opens without signal.

On a computer, **Send PO** downloads the PDF, because most desktop browsers cannot share files.

## Changing the lists and wording

Everything from the workbook lives in [`src/config.ts`](src/config.ts): suggested budget lines,
funding sources, procurement methods, threshold amounts and notes, the four terms, the sign-off
roles and the PO number prefix. Edit, commit and push; the page updates itself.

## Development

Node 22 or newer and pnpm (`corepack enable`).

```
pnpm install
pnpm dev                 # local page with live reload
pnpm test                # unit tests: money, totals, thresholds, PO numbers, PDF content
pnpm build               # dist/index.html (one self-contained file) + icons, manifest, sw.js
pnpm exec playwright install chromium webkit   # once
pnpm test:e2e            # phone tests (iPhone and Pixel emulation) with WCAG 2.1 AA checks; build first
pnpm lint
pnpm icons               # redraw the app icons
```

| File                          | What it does                                                |
| ----------------------------- | ----------------------------------------------------------- |
| `src/config.ts`               | Lists and wording from the workbook                         |
| `src/money.ts`                | Money as whole cents                                        |
| `src/po.ts`                   | The PO, totals, threshold note, checks before sending       |
| `src/poNumber.ts`             | Next PO number                                              |
| `src/pdf.ts`                  | Draws the PDF (jsPDF). Accepts signature images for phase 2 |
| `src/share.ts`                | Share sheet, with a download fallback                       |
| `src/storage.ts`              | What the phone remembers                                    |
| `src/ui/`                     | Form, history and settings screens                          |
| `public/sw.js`                | Lets the app open without signal                            |
| `.github/workflows/pages.yml` | Tests, builds and publishes to GitHub Pages on push to main |

## Publishing

The workflow publishes `dist/` to GitHub Pages on every push to `main`. In the repository's
**Settings > Pages**, set **Source** to **GitHub Actions** once.
