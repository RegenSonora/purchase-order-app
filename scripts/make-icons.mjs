// Draws the app icons into public/. Run with `pnpm icons` after changing the design below.
import { chromium } from '@playwright/test';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f6b5c"/>
  <rect x="136" y="96" width="240" height="320" rx="22" fill="#ffffff"/>
  <rect x="172" y="150" width="168" height="20" rx="10" fill="#0f6b5c"/>
  <rect x="172" y="200" width="168" height="14" rx="7" fill="#c9ced3"/>
  <rect x="172" y="236" width="168" height="14" rx="7" fill="#c9ced3"/>
  <rect x="172" y="272" width="112" height="14" rx="7" fill="#c9ced3"/>
  <text x="256" y="372" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-weight="700" font-size="64" fill="#0f6b5c">PO</text>
</svg>`;

const browser = await chromium.launch();
for (const size of [512, 192, 180]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icon-${size}.png` });
  await page.close();
}
await browser.close();
console.log('Wrote public/icon-512.png, icon-192.png and icon-180.png');
