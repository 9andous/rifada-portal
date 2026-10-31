import { AppShell } from "@/components/layout/app-shell";

export default function Layout({ children }: LayoutProps<"/association">) {
  return (
    <AppShell role="ASSOCIATION_OFFICER" easy>
      {children}
    </AppShell>
  );
}
