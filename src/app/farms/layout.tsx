import { RegistryNav } from "@/components/farmer-registry/registry-nav";
export default function RegistryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
return <><RegistryNav />{children}</>;
}
