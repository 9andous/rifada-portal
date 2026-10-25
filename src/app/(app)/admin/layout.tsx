import { AppShell } from "@/components/layout/app-shell";

export default function Layout({ children }: LayoutProps<"/admin">) {
  return <AppShell role="SUPER_ADMIN">{children}</AppShell>;
}
