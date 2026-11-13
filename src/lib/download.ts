/** Saves a blob as a file via a temporary object URL. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  // Firefox only follows a download click on an anchor that is in the document,
  // and revoking the URL in the same tick can cancel the save in Chrome, so the
  // anchor is attached, clicked, removed, and the URL released once the browser
  // has had time to start reading it.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Saves a string as a file via a temporary object URL. */
export function downloadFile(filename: string, text: string, mime = 'text/plain'): void {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}
