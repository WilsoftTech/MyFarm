import type { ReactNode } from "react";
// Label, optional hint and announced error wired to one control id.
export function Field({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: (aria: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode }) {
const described = [hint ? id + "-hint" : "", error ? id + "-error" : ""].filter(Boolean).join(" ") || undefined;
return <div><label htmlFor={id} className="field-label">{label}{optional && <>{" "}<span className="font-normal text-foreground/65">(optional)</span></>}</label>
{hint && <p id={id + "-hint"} className="mb-2 text-sm text-foreground/70">{hint}</p>}
{children({ id, "aria-invalid": !!error, "aria-describedby": described })}
{error && <p id={id + "-error"} role="alert" className="field-error">{error}</p>}</div>;
}

/** Move keyboard focus to the first invalid control in reading order after a rejected submit. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
// Runs after React renders the aria-invalid attributes for the new errors.
requestAnimationFrame(() => form?.querySelector<HTMLElement>("[aria-invalid=\"true\"]")?.focus());
}
