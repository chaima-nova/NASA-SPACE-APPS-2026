/**
 * Turns a chosen image file into a data URL the browser store can hold.
 *
 * There is no upload endpoint in this build: a field-note photo is stored in the
 * same `localStorage` record as the note. That store is a few megabytes and a
 * phone camera JPEG is several before base64 inflates it by a third, so the file
 * is decoded, drawn down to display size and re-encoded as JPEG. A 1400 px
 * quality-0.75 copy lands in the low hundreds of KB — sharp enough to look at,
 * small enough that a dozen notes fit beside the rest of the community store.
 *
 * Transparent pixels are flattened onto the app's panel colour, because JPEG has
 * no alpha channel and black edges would look like a rendering fault.
 */

/** Largest file we will read at all; bigger than any phone JPEG keeps up. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/** Longest data URL we are willing to put in localStorage, in characters. */
const MAX_STORED_CHARS = 900 * 1024;

/** Successive encodes, tried in order until one fits the budget. */
const ATTEMPTS = [
  { edge: 1400, quality: 0.75 },
  { edge: 1000, quality: 0.6 },
] as const;

const PANEL_BACKGROUND = '#0b1118';

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Some browsers refuse a format through createImageBitmap but can still
      // paint it through an <img>; fall through to that path.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('That image could not be read.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Reads `file` and returns a JPEG data URL, or throws with a sentence that can
 * be shown to the researcher as-is.
 */
export async function readPhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file — JPEG, PNG, WebP or GIF.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('That photo is over 25 MB. Pick a smaller one.');
  }

  const source = await decode(file);
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('That image could not be read.');
  }

  try {
    for (const attempt of ATTEMPTS) {
      const scale = Math.min(1, attempt.edge / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot prepare the photo.');

      ctx.fillStyle = PANEL_BACKGROUND;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', attempt.quality);
      if (dataUrl.length <= MAX_STORED_CHARS) return dataUrl;
    }
  } finally {
    if ('close' in source) source.close();
  }

  throw new Error('That photo is too detailed to store in this browser. Try a smaller crop.');
}
