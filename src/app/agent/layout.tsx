import { OfflineSetup } from "@/components/offline/offline-setup";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <><OfflineSetup />{children}</>;
}
