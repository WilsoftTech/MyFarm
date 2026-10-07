export function GET() { return Response.json({ status: "ok", service: "myfarm" }, { headers: { "Cache-Control": "no-store" } }); }
