"use server";
import { redirect } from "next/navigation";
import { signIn } from "@/modules/engineering-foundation/application/sign-in";
import { supabaseServer } from "@/modules/engineering-foundation/infrastructure/supabase";
export async function signInAction(input: unknown) {
const result = await signIn(input, { async signIn(email, password) {
const client = await supabaseServer();
const { error } = await client.auth.signInWithPassword({ email, password });
return !error;
} });
if (result.ok) redirect("/workspace");
return result;
}
export async function signOutAction() {
const client = await supabaseServer();
const { error } = await client.auth.signOut();
if (error) throw new Error("Sign-out unavailable. Please retry.");
redirect("/sign-in");
}
