import { redirect } from "next/navigation";
import { listHref } from "@/lib/list-params";

/** «قائمة أعمالي» is now part of «قائمة الطلبات» (owner's review, D-130); old links keep working. */
export default async function QueuePage({ searchParams }: PageProps<"/supervisor/queue">) {
  redirect(listHref("/supervisor/requests", await searchParams, {}));
}
