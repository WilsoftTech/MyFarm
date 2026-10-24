export interface CommandFailure { ok: false; message: string }
export type CommandSubmit = (input: unknown) => Promise<CommandFailure | undefined>;
