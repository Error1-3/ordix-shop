import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { t } from "@/lib/t-static";

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await requireAdminPage("audit.read");
  const entity = ((await searchParams).entity ?? "").slice(0, 40);
  const logs = await db.auditLog.findMany({ where: entity ? { entity } : {}, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div><h1 className="mb-5 text-2xl font-semibold tracking-tight">{t("admin.audit")}</h1>
      <form className="mb-4"><select name="entity" defaultValue={entity} className="h-10 rounded-md border border-input px-3 text-sm"><option value="">{t("common.all")}</option>{["Product", "Order", "Coupon", "SiteSettings", "User", "Review"].map((e) => <option key={e}>{e}</option>)}</select> <button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">{t("common.apply")}</button></form>
      <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[860px] text-xs"><thead className="bg-muted/60 text-left text-muted-foreground"><tr>{["Час", "Хто", "Дія", "Об'єкт", "Було", "Стало", "IP"].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border align-top">{logs.map((l) => (
          <tr key={l.id}><td className="whitespace-nowrap px-3 py-2.5">{new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Kyiv" }).format(l.createdAt)}</td><td className="px-3 py-2.5">{l.actorEmail ?? "system"}</td><td className="px-3 py-2.5 font-mono">{l.action}</td><td className="px-3 py-2.5">{l.entity}<br /><span className="text-muted-foreground">{l.entityId}</span></td>
            <td className="max-w-[220px] px-3 py-2.5"><pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all text-[11px]">{l.oldValue ? JSON.stringify(l.oldValue) : "—"}</pre></td><td className="max-w-[220px] px-3 py-2.5"><pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all text-[11px]">{l.newValue ? JSON.stringify(l.newValue) : "—"}</pre></td><td className="px-3 py-2.5">{l.ip}</td></tr>))}</tbody></table></div></div>
  );
}
