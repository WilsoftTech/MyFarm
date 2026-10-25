"use client";
import { useRef } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { recordExpenseSchema, recordSaleSchema, type RecordExpense } from "@/modules/farm-accounting/contracts/accounting";
import type { AccountingRecordKind } from "@/modules/farm-accounting/domain/accounting";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { Field, focusFirstInvalid } from "@/components/farmer-registry/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useProductionSubmit } from "@/components/production/use-production-submit";
import { ProductionFormFeedback } from "@/components/production/form-feedback";
import { counterpartyLabels, recordKindLabels } from "./labels";

export interface CatalogOption { id: string; label: string }
type Values = z.input<typeof recordExpenseSchema>;
const settledWhenRecorded = (kind: AccountingRecordKind) => kind === "EXPENSE" || kind === "INCOME";

/** Expense/income may name how they were paid; sales/purchases are settled later by payments. */
export function TransactionForm({ kind, categories, paymentMethods, submit }: { kind: AccountingRecordKind; categories: CatalogOption[]; paymentMethods: CatalogOption[]; submit: CommandSubmit }) {
  const state = useProductionSubmit(submit), form = useRef<HTMLFormElement>(null), withMethod = settledWhenRecorded(kind);
  const resolver = zodResolver(withMethod ? recordExpenseSchema : recordSaleSchema) as Resolver<Values, unknown, RecordExpense>;
  const defaults: Values = { requestId: state.initialRequestId, categoryId: "", amount: "", currency: "UGX", occurredOn: "", counterparty: "", ...(withMethod ? { paymentMethodId: "" } : {}) };
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values, unknown, RecordExpense>({ resolver, shouldFocusError: false, defaultValues: defaults });
  const label = recordKindLabels[kind].toLowerCase();
  if (categories.length === 0) return <div className="space-y-4 leading-7"><h2 className="text-xl font-semibold">No categories are available</h2><p>There are no {kind === "SALE" || kind === "INCOME" ? "income" : "spending"} categories to choose from. Ask farm support to check the category list.</p></div>;
  return <form ref={form} noValidate aria-busy={isSubmitting || !state.ready} onSubmit={handleSubmit(state.save, () => focusFirstInvalid(form.current))}>
    {!state.ready && <p role="status">Loading form…</p>}
    <fieldset disabled={!state.ready} className="min-w-0 space-y-5"><legend className="sr-only">{recordKindLabels[kind]} details</legend>
    <Field id="recordCategory" label="Category" error={errors.categoryId ? "Choose a category." : undefined}>{aria => <Select {...aria} {...register("categoryId")}><option value="">Choose one</option>{categories.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</Select>}</Field>
    <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
      <Field id="recordAmount" label="Amount" hint="Digits only, for example 150000. Do not type commas." error={errors.amount?.message}>{aria => <Input {...aria} inputMode="decimal" autoComplete="off" {...register("amount")} />}</Field>
      <Field id="recordCurrency" label="Currency" hint="For example UGX." error={errors.currency?.message}>{aria => <Input {...aria} maxLength={3} autoCapitalize="characters" autoComplete="off" {...register("currency")} />}</Field>
    </div>
    <Field id="recordDate" label="Date" hint={withMethod ? "The day the money was " + (kind === "INCOME" ? "received." : "paid.") : "The day of the " + label + "."} error={errors.occurredOn?.message}>{aria => <Input {...aria} type="date" min="0001-01-01" max="9999-12-31" {...register("occurredOn")} />}</Field>
    <Field id="recordCounterparty" label={counterpartyLabels[kind]} optional hint="A name you will recognise, for example ABC Agro." error={errors.counterparty?.message}>{aria => <Input {...aria} maxLength={120} {...register("counterparty")} />}</Field>
    {withMethod && <Field id="recordMethod" label={kind === "INCOME" ? "How it was received" : "How it was paid"} optional error={errors.paymentMethodId ? "Choose how the money moved, or leave it empty." : undefined}>{aria => <Select {...aria} {...register("paymentMethodId")}><option value="">Not recorded</option>{paymentMethods.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</Select>}</Field>}
    <ProductionFormFeedback online={state.online} saving={isSubmitting} message={state.message} />
    <Button type="submit" disabled={isSubmitting || !state.online} className="w-full sm:w-auto">{isSubmitting ? "Saving…" : "Save " + label}</Button>
    </fieldset>
  </form>;
}
