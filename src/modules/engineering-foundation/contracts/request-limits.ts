import type { RequestAction } from "../domain/request-limits";

/** Per-person request limits (D-P09-014), counted on the database clock. */
export interface RequestLimitPort {
  /** Counts the request when every window has room and says whether it may go ahead. A known key is a free retry. */
  take(subject: string, action: RequestAction, requestKey: string | null): Promise<boolean>;
  /** Whether a request would be allowed, without counting it. */
  allowed(subject: string, action: RequestAction): Promise<boolean>;
  /** Counts a request after the fact (a refused pilot code); the same key is counted once. */
  note(subject: string, action: RequestAction, requestKey: string | null): Promise<void>;
}
