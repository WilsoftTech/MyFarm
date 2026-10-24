import Link from "next/link";
import type { EnterpriseCapability } from "@/modules/enterprises-seasons/contracts/catalog";
import type { EnterpriseView } from "@/modules/enterprises-seasons/contracts/production";
import { Button } from "@/components/ui/button";

const workflowPresentation: Record<NonNullable<EnterpriseCapability["workflow"]>, { description: string; path: string; start: string; view: string }> = {
  CROP_CYCLE: { description: "Record each planting as a crop cycle on one plot and season.", path: "crop-cycles", start: "Start crop cycle", view: "View farm crop cycles" },
  POULTRY_BATCH: { description: "Record each group of birds as a poultry batch.", path: "poultry-batches", start: "Add poultry batch", view: "View farm poultry batches" },
};

export function EnterpriseWorkflow({ farmId, enterprise }: {
  farmId: string;
  enterprise: Pick<EnterpriseView, "enterpriseId" | "status"> & Pick<EnterpriseCapability, "workflow">;
}) {
  if (enterprise.workflow === null) return <p className="mt-6 leading-7">Production records for this enterprise type are not available yet. Your enterprise name and type are saved here.</p>;
  const presentation = workflowPresentation[enterprise.workflow], path = "/farms/" + farmId + "/" + presentation.path;
  return <div className="mt-6 space-y-4">
    <p className="leading-7">{presentation.description}</p>
    <div className="flex flex-wrap gap-3">
      {enterprise.status === "ACTIVE" && <Button asChild><Link href={path + "/new?enterpriseId=" + enterprise.enterpriseId}>{presentation.start}</Link></Button>}
      <Button asChild variant="outline"><Link href={path}>{presentation.view}</Link></Button>
    </div>
  </div>;
}
