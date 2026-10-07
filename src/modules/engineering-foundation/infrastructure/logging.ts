export interface SafeLog { event: "request_failed" | "health_check" | "client_error"; requestId: string; code: string; durationMs?: number }
// Explicit allowlist. Never serialize raw Error, request, tokens, URLs, email or payload.
export function serializeLog(input: SafeLog): string {
return JSON.stringify({ event: input.event, requestId: input.requestId, code: /^[A-Z0-9_]{1,48}$/.test(input.code) ? input.code : "UNKNOWN", ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }) });
}
export function logSafe(input: SafeLog) { console.error(serializeLog(input)); }
