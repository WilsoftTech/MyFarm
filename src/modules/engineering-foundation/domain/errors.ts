export class FoundationError extends Error {
constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "UNAVAILABLE" | "CONFLICT" | "RATE_LIMITED") {
super(code); this.name = "FoundationError";
}
}
