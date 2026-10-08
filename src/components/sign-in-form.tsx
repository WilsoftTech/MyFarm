"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInInput } from "@/modules/engineering-foundation/contracts/identity";
import type { SignInResult } from "@/modules/engineering-foundation/application/sign-in";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function SignInForm({ submit }: { submit: (input: SignInInput) => Promise<SignInResult | undefined> }) {
const [message, setMessage] = useState("");
const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });
return <form noValidate onSubmit={handleSubmit(async input => {
setMessage("");
try { const result = await submit(input); if (result && !result.ok) setMessage(result.message); }
catch { setMessage("Connection interrupted. Your details are still here. Try again."); }
})} className="space-y-5">
<div><label htmlFor="email" className="field-label">Email address</label>
<Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
{errors.email && <p id="email-error" role="alert" className="field-error">{errors.email.message}</p>}</div>
<div><label htmlFor="password" className="field-label">Password</label>
<Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} />
{errors.password && <p id="password-error" role="alert" className="field-error">{errors.password.message}</p>}</div>
{message && <p role="alert" className="field-error">{message}</p>}
<Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? "Signing in…" : "Sign in"}</Button>
</form>;
}
