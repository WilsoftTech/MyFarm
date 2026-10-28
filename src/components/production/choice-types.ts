import type { AreaUnit } from "@/modules/farmer-registry/domain/rules";
import type { CommandFailure } from "@/modules/engineering-foundation/contracts/command-result";
export type CropChoiceKind = "enterprises" | "seasons" | "plots" | "crops";
export type PoultryChoiceKind = "enterprises" | "animal-types";
export interface Choice { id: string; label: string; disabled?: boolean; areaUnit?: AreaUnit; unit?: string }
export interface ChoicePage { items: Choice[]; nextCursor: string | null }
export type ChoiceLoad<K extends string> = (kind: K, cursor: string) => Promise<{ ok: true; page: ChoicePage } | CommandFailure>;
export type CropChoicePages = Record<CropChoiceKind, ChoicePage>;
export type CropChoiceLoad = ChoiceLoad<CropChoiceKind>;
export type PoultryChoicePages = Record<PoultryChoiceKind, ChoicePage>;
export type PoultryChoiceLoad = ChoiceLoad<PoultryChoiceKind>;
