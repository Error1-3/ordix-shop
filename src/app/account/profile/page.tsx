import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { ProfileForm } from "@/components/forms/account-forms";

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { firstName: true, lastName: true, phone: true, email: true } });
  return <ProfileForm v={{ firstName: u.firstName ?? "", lastName: u.lastName ?? "", phone: u.phone ?? "", email: u.email }} />;
}
