/**
 * Cloud-free composites, built in the browser.
 *
 * A single daily pass is often spoiled by cloud, and no amount of pixels fixes
 * that: the VIIRS mosaic the comparison pane uses resolves ~375 m, so a cloudy
 * frame is just a blurry cloud. What does fix it is stacking the same box over
 * several days and taking the median of each pixel — a cloudy pixel has to be
 * cloudy on most of the days to survive, which for scattered cumulus it is not.
 *
 * GIBS serves every layer with `Access-Control-Allow-Origin: *`, so the frames
 * can be drawn into a canvas and read back without tainting it. Nothing leaves
 * the browser, and no key is involved.
 *
 * Two limits worth knowing:
 *
 *  - The result is a synthesis, not a photograph taken on one day. Callers must
 *    say which days went into it.
 *  - Where GIBS has no data the JPEG is black rather than transparent, so those
 *    pixels take part in the median like any other dark ground. Frames that fail
 *    to load at all are dropped from the stack instead.
 */

/** The composited frame, and how much of the requested stack is in it. */
export interface CloudFreeComposite {
  /** Object URL of the composited PNG, owned by the caller until revoked. */
  url: string;
  /** How many frames loaded and were medianed together. */
  days: number;
}

const CANVAS_SIZE = 900;

/** Loads one frame, refusing a cross-origin image the canvas cannot read. */
function loadFrame(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Without this the canvas is tainted and `getImageData` throws.
    image.crossOrigin = 'anonymous';
    const done = () => {
      signal?.removeEventListener('abort', abort);
      resolve(image);
    };
    const fail = () => {
      signal?.removeEventListener('abort', abort);
      reject(new Error(`imagery frame did not load: ${url}`));
    };
    const abort = () => {
      // Detach before rejecting: the caller has moved on to another box.
      image.onload = null;
      image.onerror = null;
      reject(new DOMException('composite aborted', 'AbortError'));
    };
    image.onload = done;
    image.onerror = fail;
    signal?.addEventListener('abort', abort, { once: true });
    image.src = url;
  });
}

/**
 * Median of a handful of samples.
 *
 * Insertion sort over an array the caller already owns: one 810k-pixel frame
 * would otherwise allocate a fresh sorted copy per channel per pixel.
 */
function medianOf(values: number[], count: number): number {
  for (let i = 1; i < count; i += 1) {
    const value = values[i];
    let j = i - 1;
    while (j >= 0 && values[j] > value) {
      values[j + 1] = values[j];
      j -= 1;
    }
    values[j + 1] = value;
  }
  return count % 2 === 1
    ? values[(count - 1) / 2]
    : Math.round((values[count / 2 - 1] + values[count / 2]) / 2);
}

/**
 * Median-composites `urls` into one PNG.
 *
 * Frames that fail are skipped; it throws only when nothing loaded, because a
 * composite of one day is not a composite and the caller should say so.
 */
export async function cloudFreeComposite(
  urls: string[],
  size = CANVAS_SIZE,
  signal?: AbortSignal,
): Promise<CloudFreeComposite> {
  const frames = await Promise.all(
    urls.map((url) => loadFrame(url, signal).catch(() => null)),
  );
  const usable = frames.filter((frame): frame is HTMLImageElement => frame !== null);
  if (usable.length === 0) throw new Error('no imagery frames were available to composite');

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('this browser cannot composite imagery');

  const layers = usable.map((frame) => {
    context.clearRect(0, 0, size, size);
    context.drawImage(frame, 0, 0, size, size);
    return context.getImageData(0, 0, size, size).data;
  });

  const out = context.createImageData(size, size);
  const channel: number[] = new Array(usable.length);
  const pixels = size * size;

  for (let index = 0; index < pixels; index += 1) {
    const at = index * 4;
    for (let c = 0; c < 3; c += 1) {
      let count = 0;
      for (let layer = 0; layer < layers.length; layer += 1) {
        const value = layers[layer][at + c];
        if (value === undefined) continue;
        channel[count] = value;
        count += 1;
      }
      if (count === 0) continue;
      out.data[at + c] = count === 1 ? channel[0] : medianOf(channel, count);
    }
    out.data[at + 3] = 255;
  }

  context.putImageData(out, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('the composited image could not be encoded');
  return { url: URL.createObjectURL(blob), days: usable.length };
}
