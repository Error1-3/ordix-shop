import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { t } from "@/lib/t-static";
import { AddressForm, DeleteAddressButton } from "@/components/forms/account-forms";
import { Badge } from "@/components/ui/misc";

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const list = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return (
    <div className="space-y-8">
      {list.length === 0 ? <p className="text-muted-foreground">{t("account.noAddresses")}</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-4 text-sm">
              <div><p className="font-medium">{a.firstName} {a.lastName} {a.isDefault && <Badge variant="accent">{t("account.default")}</Badge>}</p><p className="text-muted-foreground">{a.phone}</p><p>{a.city}{a.warehouseName ? `, ${a.warehouseName}` : ""}</p></div>
              <DeleteAddressButton id={a.id} />
            </li>
          ))}
        </ul>
      )}
      <AddressForm />
    </div>
  );
}
