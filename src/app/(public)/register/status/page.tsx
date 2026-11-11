import type { Metadata } from "next";
import { RegistrationStatusLookup } from "@/components/registration/status-lookup";

export const metadata: Metadata = { title: "متابعة طلب تسجيل جمعية" };

export default function RegistrationStatusPage() {
  return <RegistrationStatusLookup />;
}
