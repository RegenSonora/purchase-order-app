import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** All the text in a PDF, with runs of white space collapsed, plus the page count. */
export async function pdfText(bytes: ArrayBuffer | Uint8Array): Promise<{
  text: string;
  pages: number;
}> {
  const data = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const task = getDocument({ data, useSystemFonts: true, verbosity: 0 });
  const pdf = await task.promise;
  const parts: string[] = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ('str' in item) parts.push(item.str);
    }
  }
  const pages = pdf.numPages;
  await task.destroy();
  return { text: parts.join(' ').replace(/\s+/g, ' ').trim(), pages };
}
