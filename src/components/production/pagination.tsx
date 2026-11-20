import Link from "next/link";

export function ProductionPagination({ path, cursor, nextCursor, cursorKey = "cursor", label = "List pages" }: { path: string; cursor?: string; nextCursor: string | null; cursorKey?: string; label?: string }) {
  if (!cursor && !nextCursor) return null;
  return <nav aria-label={label} className="mt-6 flex flex-wrap gap-6">
    {cursor && <Link className="inline-flex min-h-12 items-center underline" href={path}>First page</Link>}
    {nextCursor && <Link className="inline-flex min-h-12 items-center underline" href={path + (path.includes("?") ? "&" : "?") + encodeURIComponent(cursorKey) + "=" + encodeURIComponent(nextCursor)}>More records</Link>}
  </nav>;
}
