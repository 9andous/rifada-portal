import "server-only";
import { imageUrl } from "@/lib/images";
import type { AssociationProfileInput } from "@/lib/validation/association-profile";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { assertCan, refuse, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import { applyImageChange, checkImageChange, type ImageChange } from "@/server/services/images";

// «ملف الجمعية» (D-101): the officer's own association, its account, programmes and record, and the
// contact details and logo the officer may change. Always the actor's own association, never an id
// from the request.

export async function getOwnAssociationProfile(actor: Actor) {
  assertCan(actor, "associations.profile");
  if (!actor.associationId) return null;
  const association = await db.association.findUnique({
    where: { id: actor.associationId },
    include: {
      officer: { select: { name: true, username: true, email: true, phone: true, lastLoginAt: true, createdAt: true } },
      registration: { select: { referenceNo: true, programNumbers: true, foundedYear: true, website: true, createdAt: true, reviewedAt: true } },
    },
  });
  if (!association) return null;
  const programs = association.registration?.programNumbers.length
    ? await db.program.findMany({
        where: { number: { in: association.registration.programNumbers } },
        orderBy: { number: "asc" },
        select: { number: true, name: true },
      })
    : [];
  return { ...association, logo: imageUrl("association", association.id, association.logoKey), programs };
}

export type OwnAssociationProfile = NonNullable<Awaited<ReturnType<typeof getOwnAssociationProfile>>>;

const snapshot = (a: { contactName: string | null; contactEmail: string | null; contactPhone: string | null }) => ({
  contactName: a.contactName,
  contactEmail: a.contactEmail,
  contactPhone: a.contactPhone,
});

/** Updates the contact details and, when asked, the logo of the officer's own association. */
export async function updateOwnAssociationProfile(actor: Actor, input: AssociationProfileInput, image: ImageChange): Promise<Result> {
  assertCan(actor, "associations.profile");
  const id = actor.associationId;
  if (!id) return refuse("لا ترتبط حسابكم بجمعية.");
  const checked = await checkImageChange(actor, image);
  if (!checked.ok) return checked;

  const current = await db.association.findUnique({ where: { id } });
  if (!current) return refuse("لم يُعثر على الجمعية.");
  if (!current.isActive) return refuse("الجمعية معطلة؛ تواصلوا مع الوحدة الإشرافية.");
  const updated = await db.association.update({ where: { id }, data: input });
  if (JSON.stringify(snapshot(current)) !== JSON.stringify(snapshot(updated))) {
    await audit({ actorId: actor.id, action: "association.profile_updated", entityType: "Association", entityId: id, before: snapshot(current), after: snapshot(updated) });
  }
  return applyImageChange(actor, "association", id, image);
}
