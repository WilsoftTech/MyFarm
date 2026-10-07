import { signInSchema } from "../contracts/identity";
export type SignInResult = { ok: true } | { ok: false; message: string };
export interface CredentialPort { signIn(email: string, password: string): Promise<boolean> }
export async function signIn(input: unknown, credentials: CredentialPort): Promise<SignInResult> {
const parsed = signInSchema.safeParse(input);
if (!parsed.success) return { ok: false, message: "Check your email and password." };
try {
const accepted = await credentials.signIn(parsed.data.email, parsed.data.password);
return accepted ? { ok: true } : { ok: false, message: "Sign-in failed. Check your details and try again." };
} catch { return { ok: false, message: "Sign-in is unavailable. Please try again later." }; }
}
