// OCR: reads the text in a document photo. Runs fully on our server with Tesseract (open source),
// so document images are NEVER sent to an outside AI service.
import path from "path";
import os from "os";
import { createRequire } from "module";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";

const require_ = createRequire(path.join(process.cwd(), "package.json")); // the server runs from backend/
// English language data ships inside node_modules, so OCR works offline.
const LANG_PATH = path.join(path.dirname(require_.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");

let workerPromise: Promise<Worker> | null = null;
function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker("eng", 1, {
    langPath: LANG_PATH, gzip: true, cachePath: path.join(os.tmpdir(), "udyam-tesseract"),
  });
  return workerPromise;
}

// One OCR at a time (the worker is single-threaded); requests wait in this queue.
let queue: Promise<unknown> = Promise.resolve();

export interface OcrOutput { text: string; confidence: number; rotated: boolean; ms: number }

export class BadImageError extends Error {}

/**
 * Clean up the photo (straighten from EXIF, greyscale, sensible size) and read it.
 * `rotateAuto` straightens slightly tilted scans (sample K02 is tilted about 7°).
 */
export function ocrImage(buf: Buffer): Promise<OcrOutput> {
  const job = queue.then(async () => {
    const t0 = Date.now();
    let png: Buffer;
    try {
      png = await sharp(buf).rotate().greyscale()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        // Tell Tesseract the resolution. Without it the tilt detection guesses wrong (sample K02 stayed crooked).
        .withMetadata({ density: 300 })
        .png().toBuffer();
    } catch {
      throw new BadImageError("This file is not a readable image");
    }
    const w = await getWorker();
    const r = await w.recognize(png, { rotateAuto: true });
    return {
      text: r.data.text ?? "",
      confidence: Math.round(r.data.confidence ?? 0),
      rotated: Math.abs(r.data.rotateRadians ?? 0) > 0.01,
      ms: Date.now() - t0,
    };
  });
  queue = job.catch(() => undefined);
  return job;
}

/** For tests / shutdown. */
export async function closeOcr() {
  if (workerPromise) { const w = await workerPromise; await w.terminate(); workerPromise = null; }
}
