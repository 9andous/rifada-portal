import { redirect } from "next/navigation";
import { REGISTRATION_OPEN } from "@/config/features";
import type { Metadata } from "next";
import { RegistrationStatusLookup } from "@/components/registration/status-lookup";

export const metadata: Metadata = { title: "متابعة طلب تسجيل جمعية" };

export default function RegistrationStatusPage() {
  // Self-registration is closed (D-130).
  if (!REGISTRATION_OPEN) redirect("/");
  return <RegistrationStatusLookup />;
}
