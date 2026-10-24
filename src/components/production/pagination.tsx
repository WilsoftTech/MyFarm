import Link from "next/link";

export function ProductionPagination({ path, cursor, nextCursor }: { path: string; cursor?: string; nextCursor: string | null }) {
  if (!cursor && !nextCursor) return null;
  return <nav aria-label="List pages" className="mt-6 flex flex-wrap gap-6">
    {cursor && <Link className="inline-flex min-h-12 items-center underline" href={path}>First page</Link>}
    {nextCursor && <Link className="inline-flex min-h-12 items-center underline" href={path + "?cursor=" + encodeURIComponent(nextCursor)}>More records</Link>}
  </nav>;
}
