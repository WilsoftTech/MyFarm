"use client";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { settleObligationSchema, type SettleObligation } from "@/modules/farm-accounting/contracts/accounting";
import type { ObligationKind } from "@/modules/farm-accounting/domain/accounting";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useProductionSubmit } from "@/components/production/use-production-submit";
import { ProductionFormFeedback } from "@/components/production/form-feedback";
import { formatMoney, outstandingLabels, paymentActionLabels } from "./labels";
import type { CatalogOption } from "./transaction-form";

/** Settles one sale/purchase; the server derives direction, currency and allocation from the record. */
export function PaymentForm({ kind, outstanding, currency, paymentMethods, submit }: { kind: ObligationKind; outstanding: string; currency: string; paymentMethods: CatalogOption[]; submit: CommandSubmit }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof settleObligationSchema>, unknown, SettleObligation>({ resolver: zodResolver(settleObligationSchema), shouldFocusError: false, defaultValues: { requestId: state.initialRequestId, amount: outstanding, paidOn: "", paymentMethodId: "", externalReference: "" } });
  const received = kind === "SALE";
  if (paymentMethods.length === 0) return <p className="leading-7">No payment methods are available to choose. Ask farm support to check the payment method list.</p>;
  return <form ref={form} noValidate aria-busy={isSubmitting || !state.ready} onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    {!state.ready && <p role="status">Loading form…</p>}
    <fieldset disabled={!state.ready} className="min-w-0 space-y-5"><legend className="sr-only">Payment details</legend>
    <p className="leading-7">{outstandingLabels[kind]}: <strong>{formatMoney(outstanding, currency)}</strong>. Enter part of it if only some was {received ? "received" : "paid"}.</p>
    <Field id="paymentAmount" label={(received ? "Amount received" : "Amount paid") + " (" + currency + ")"} hint="Digits only, no commas. It cannot be more than what is still due." error={errors.amount?.message}>{aria => <Input {...aria} inputMode="decimal" autoComplete="off" {...register("amount")} />}</Field>
    <Field id="paymentDate" label={received ? "Date received" : "Date paid"} hint="On or after the date of the record." error={errors.paidOn?.message}>{aria => <Input {...aria} type="date" min="0001-01-01" max="9999-12-31" {...register("paidOn")} />}</Field>
    <Field id="paymentMethod" label={received ? "How it was received" : "How it was paid"} error={errors.paymentMethodId ? "Choose how the money moved." : undefined}>{aria => <Select {...aria} {...register("paymentMethodId")}><option value="">Choose one</option>{paymentMethods.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</Select>}</Field>
    <Field id="paymentReference" label="Reference" optional hint="For example a Mobile Money transaction ID." error={errors.externalReference?.message}>{aria => <Input {...aria} maxLength={120} autoComplete="off" {...register("externalReference")} />}</Field>
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : paymentActionLabels[kind]}</Button>
    </fieldset>
  </form>;
}
