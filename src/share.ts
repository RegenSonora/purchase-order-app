export type ShareResult = 'shared' | 'cancelled' | 'downloaded';

function pdfFile(bytes: ArrayBuffer, fileName: string): File {
  return new File([bytes], fileName, { type: 'application/pdf' });
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Opens the phone's Share sheet with the PDF attached. Where the browser cannot share files
 * (most desktop browsers), the PDF is downloaded instead.
 *
 * Call this straight from a tap: browsers only allow sharing in response to a user action.
 */
export async function sharePdf(bytes: ArrayBuffer, fileName: string): Promise<ShareResult> {
  const file = pdfFile(bytes, fileName);
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      // Only the file is shared: some apps drop the attachment when text is sent with it.
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Anything else (for example the browser refusing to share): fall back to a download.
    }
  }
  download(file);
  return 'downloaded';
}

/** Opens the PDF in a new tab so it can be checked before sending. */
export function previewPdf(bytes: ArrayBuffer, fileName: string): void {
  const file = pdfFile(bytes, fileName);
  const url = URL.createObjectURL(file);
  const opened = window.open(url, '_blank');
  if (!opened) download(file);
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}
