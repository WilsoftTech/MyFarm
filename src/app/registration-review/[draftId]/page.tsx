import { redirect } from "next/navigation";
import { RegistrationReview } from "@/components/officers/registration";
import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ draftId: string }> }) {
  try { return <RegistrationReview view={await officerServices().work.draft((await params).draftId)} />; }
  catch (error) { if (error instanceof FoundationError) redirect(error.code === "UNAUTHENTICATED" ? "/sign-in" : "/forbidden"); throw error; }
}
