import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { t } from "@/lib/t-static";
import { ReviewButtons } from "@/components/admin-widgets";
import { Badge } from "@/components/ui/misc";

export default async function AdminReviews() {
  await requireAdminPage("reviews.moderate");
  const reviews = await db.review.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, include: { user: { select: { email: true, firstName: true } }, product: { select: { title: true } } } });
  return (
    <div><h1 className="mb-5 text-2xl font-semibold tracking-tight">{t("admin.reviews")}</h1>
      <ul className="space-y-3">{reviews.length === 0 && <li className="text-muted-foreground">—</li>}{reviews.map((r) => (
        <li key={r.id} className="rounded-xl border border-border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2"><Badge variant={r.status === "APPROVED" ? "accent" : r.status === "REJECTED" ? "destructive" : "warning"}>{r.status}</Badge><span className="font-medium">{r.product.title}</span><span className="text-muted-foreground">★ {r.rating} · {r.user.firstName} ({r.user.email})</span></div>
          <p className="mt-2 font-medium">{r.title}</p><p className="whitespace-pre-line text-muted-foreground">{r.body}</p>
          {r.status === "PENDING" && <div className="mt-3"><ReviewButtons id={r.id} /></div>}
        </li>))}</ul></div>
  );
}
