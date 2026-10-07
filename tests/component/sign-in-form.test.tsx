import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInForm } from "@/components/sign-in-form";
it("invalid input is accessible and does not submit", async () => {
const submit = vi.fn(); render(<SignInForm submit={submit} />);
await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
expect(await screen.findByText("Enter a valid email address.")).toBeVisible();
expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true"); expect(submit).not.toHaveBeenCalled();
});
it("keeps input and displays safe provider failure", async () => {
const submit = vi.fn(async () => ({ ok: false as const, message: "Sign-in failed. Check your details and try again." }));
render(<SignInForm submit={submit} />);
await userEvent.type(screen.getByLabelText("Email address"), "a@example.com");
await userEvent.type(screen.getByLabelText("Password"), "secret");
await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed");
expect(screen.getByLabelText("Email address")).toHaveValue("a@example.com");
expect(submit).toHaveBeenCalledWith({ email: "a@example.com", password: "secret" });
});
it("prevents concurrent submissions", async () => {
let resolve!: (value: { ok: false; message: string }) => void;
const pending = new Promise<{ ok: false; message: string }>(r => { resolve = r; });
const submit = vi.fn(() => pending); render(<SignInForm submit={submit} />);
await userEvent.type(screen.getByLabelText("Email address"), "a@example.com");
await userEvent.type(screen.getByLabelText("Password"), "secret");
await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
expect(screen.getByRole("button", { name: "Signing inâ€¦" })).toBeDisabled(); expect(submit).toHaveBeenCalledTimes(1);
resolve({ ok: false, message: "Try again" }); expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
});
