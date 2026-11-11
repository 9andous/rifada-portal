import { redirect } from "next/navigation";

// Associations register only through the link the unit issues for each of them (D-149); the bare
// address leads to the follow-up page.
export default function RegisterPage() {
  redirect("/register/status");
}
