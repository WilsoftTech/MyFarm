export class FoundationError extends Error {
constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "UNAVAILABLE" | "CONFLICT") {
super(code); this.name = "FoundationError";
}
}
