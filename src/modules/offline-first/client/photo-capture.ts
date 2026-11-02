import { OFFLINE_SUPPORT } from "../domain/storage";

const MAX_EDGE = 1600;
/** Shrinks to JPEG within the D-P07-004 limit. Returns null if this browser cannot read the image or get it small enough. */
export async function compressPhoto(file: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { return null; }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.8, 0.6, 0.45, 0.3]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= OFFLINE_SUPPORT.maxPhotoBytes) return blob;
  }
  return null;
}
