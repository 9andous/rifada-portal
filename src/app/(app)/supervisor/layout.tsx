import { AppShell } from "@/components/layout/app-shell";

export default function Layout({ children }: LayoutProps<"/supervisor">) {
  return <AppShell role="SUPERVISOR">{children}</AppShell>;
}
