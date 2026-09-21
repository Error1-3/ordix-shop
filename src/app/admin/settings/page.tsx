import { requireAdminPage } from "@/lib/authz";
import { can } from "@/lib/rbac";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/t-static";
import { SettingsEditor } from "@/components/settings-editor";

export default async function AdminSettings() {
  const actor = await requireAdminPage("settings.read");
  const s = await getSettings();
  const e = env();
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">{t("admin.settings")}</h1>
      {/* Only booleans about integrations are sent to the client — never key values. */}
      <SettingsEditor
        values={s} canWrite={can(actor.role, "settings.write")}
        integrations={{ liqpay: Boolean(e.LIQPAY_PUBLIC_KEY && e.LIQPAY_PRIVATE_KEY), liqpaySandbox: e.LIQPAY_ALLOW_SANDBOX, np: Boolean(e.NOVA_POSHTA_API_KEY), email: e.EMAIL_PROVIDER, cloudinary: Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET) }}
      />
    </div>
  );
}
