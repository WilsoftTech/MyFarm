import { SignInForm } from "@/components/sign-in-form";
import { signInAction } from "./actions";
import { authConfiguration } from "@/modules/engineering-foundation/infrastructure/environment";
export const dynamic = "force-dynamic";
export default function SignInPage() {
const configured = !!authConfiguration();
return <section className="mx-auto max-w-md"><p className="mb-3 text-sm font-semibold text-primary">Welcome back</p>
<h1 className="mb-3 text-3xl font-bold">Sign in to MyFarm</h1><p className="mb-8 leading-7 text-foreground/75">Use the email address linked to your account.</p>
<div className="rounded-2xl border border-border bg-white p-6">
{configured ? <SignInForm submit={signInAction} /> : <p role="status" className="leading-7">Sign-in is not available yet. Please contact the MyFarm project owner to configure account access.</p>}
</div><p className="mt-6 text-sm leading-6 text-foreground/65">Need access or account recovery? Contact the MyFarm project owner. Self-registration is not available in this release.</p>
</section>;
}
