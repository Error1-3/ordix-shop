import { PasswordForm } from "@/components/forms/account-forms";
import { t } from "@/lib/t-static";

export default function SecurityPage() {
  return <div><h2 className="mb-6 text-xl font-semibold">{t("account.security")}</h2><PasswordForm /></div>;
}
