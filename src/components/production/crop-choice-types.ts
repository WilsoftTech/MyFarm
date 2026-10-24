import type { AreaUnit } from "@/modules/farmer-registry/domain/rules";
import type { CommandFailure } from "@/modules/engineering-foundation/contracts/command-result";
export type CropChoiceKind = "enterprises" | "seasons" | "plots" | "crops";
export interface CropChoice { id: string; label: string; disabled?: boolean; areaUnit?: AreaUnit }
export interface CropChoicePage { items: CropChoice[]; nextCursor: string | null }
export type CropChoicePages = Record<CropChoiceKind, CropChoicePage>;
export type CropChoiceLoad = (kind: CropChoiceKind, cursor: string) => Promise<{ ok: true; page: CropChoicePage } | CommandFailure>;
