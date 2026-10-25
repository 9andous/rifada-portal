import { AppShell } from "@/components/layout/app-shell";

export default function Layout({ children }: LayoutProps<"/manager">) {
  return <AppShell role="UNIT_MANAGER">{children}</AppShell>;
}
