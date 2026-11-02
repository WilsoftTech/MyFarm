import type { Metadata } from "next";
import { OfflineApp } from "@/components/offline/offline-app";
export const metadata: Metadata = { title: "Offline work" };
/** Static and free of farm data: all records on this page come from the account's local database in the browser. */
export default function OfflinePage() { return <OfflineApp />; }
