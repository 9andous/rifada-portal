import { redirect } from "next/navigation";
import { Suspense } from "react";
import { homeFor, requireUser } from "@/server/auth/session";

// The proxy normally redirects /dashboard; this is the server-side fallback.
export default function DashboardRedirect() {
  return (
    <Suspense>
      <Redirector />
    </Suspense>
  );
}

async function Redirector(): Promise<null> {
  const user = await requireUser();
  redirect(homeFor(user));
}
