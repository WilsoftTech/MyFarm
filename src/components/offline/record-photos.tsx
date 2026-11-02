import type { PhotoView } from "@/modules/offline-first/contracts/photos";
import { ViewPhotoButton } from "./view-photo-button";

/** photos is null when they could not be loaded: the problem stays inside this section, so the record itself always opens. */
export function RecordPhotos({ farmId, photos }: { farmId: string; photos: PhotoView[] | null }) {
  if (photos && photos.length === 0) return null;
  return <section aria-labelledby="photosHeading" className="mt-6 rounded-xl border p-5"><h2 id="photosHeading" className="text-xl font-semibold">Photos</h2>
    {photos === null ? <p role="status" className="mt-2">Photos could not be loaded right now.</p> : <ul className="mt-3 space-y-3">{photos.map((photo, index) => <li key={photo.photoId} className="flex flex-wrap items-center gap-3"><span>Added {photo.createdAt.slice(0, 10)}</span><ViewPhotoButton farmId={farmId} photoId={photo.photoId} label={"View photo " + (index + 1)} /></li>)}</ul>}
  </section>;
}
