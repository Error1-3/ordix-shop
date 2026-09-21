"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveProductAction } from "@/actions/admin-products";
import { useT } from "@/components/i18n-provider";
import { emptyUsed, emptySecret, emptyVariant, toPayload, type ProductForm, type UsedForm, type VariantForm } from "@/lib/admin-form";
import { Alert } from "./ui/misc";
import { Button } from "./ui/button";
import { Field } from "./ui/label";
import { Input, Select, Textarea } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ImageUploader } from "./image-uploader";

const CONDITIONS = ["NEW", "LIKE_NEW", "EXCELLENT", "GOOD", "FAIR"] as const;
const FUNCS: [keyof UsedForm, string][] = [["cameraCondition", "cameras"], ["faceIdStatus", "faceId"], ["touchIdStatus", "touchId"], ["trueToneStatus", "trueTone"], ["speakerStatus", "speaker"], ["microphoneStatus", "microphone"], ["chargingPortStatus", "chargingPort"], ["wifiStatus", "wifi"], ["bluetoothStatus", "bluetooth"], ["simStatus", "sim"]];
const STATUSES = ["DRAFT", "IN_TESTING", "READY", "RESERVED", "SOLD", "RETURNED"];

export function ProductEditor({ initial, categories, canSecrets }: { initial: ProductForm; categories: { id: string; name: string }[]; canSecrets: boolean }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState<ProductForm>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const up = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setF((s) => ({ ...s, [k]: v }));
  const upV = (i: number, p: Partial<VariantForm>) => setF((s) => ({ ...s, variants: s.variants.map((v, k) => (k === i ? { ...v, ...p } : v)) }));
  const upUsed = (i: number, p: Partial<UsedForm>) => setF((s) => ({ ...s, variants: s.variants.map((v, k) => (k === i ? { ...v, used: { ...v.used, ...p } } : v)) }));
  const upSecret = (i: number, p: Partial<VariantForm["secret"]>) => setF((s) => ({ ...s, variants: s.variants.map((v, k) => (k === i ? { ...v, secret: { ...v.secret, ...p } } : v)) }));

  const save = () => start(async () => {
    setMsg(null);
    const r = await saveProductAction(JSON.stringify(toPayload(f)));
    if (r.ok && r.data) { toast.success(t("common.saved")); setErrors({}); if (!f.id) router.replace(`/admin/products/${r.data.id}`); else router.refresh(); }
    else { setErrors(r.fieldErrors ?? {}); setMsg(r.error ? (r.error.includes(".") && !r.error.includes(" ") ? t(r.error) : r.error) : t("common.genericError")); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  const variantLabels = f.variants.map((v, i) => ({ key: v.key, label: `${v.sku || `Варіант ${i + 1}`} · ${[v.storage, v.color, v.condition].filter(Boolean).join(" ")}` }));
  const fe = (p: string) => errors[p];

  return (
    <div className="space-y-6">
      {msg && <Alert variant="error">{msg}</Alert>}
      {Object.keys(errors).length > 0 && <Alert variant="error"><ul className="list-disc pl-4">{Object.entries(errors).slice(0, 6).map(([k, v]) => <li key={k}><code>{k}</code>: {v}</li>)}</ul></Alert>}
      <Tabs defaultValue="general">
        <TabsList>{[["general", "admin.general"], ["variants", "admin.variants"], ["images", "admin.images"], ["specs", "product.specs"], ["seo", "admin.seo"]].map(([v, l]) => <TabsTrigger key={v} value={v!}>{t(l!)}</TabsTrigger>)}</TabsList>

        <TabsContent value="general" className="grid gap-4 sm:grid-cols-2">
          <Field label="Назва" error={fe("title")} className="sm:col-span-2"><Input value={f.title} onChange={(e) => up("title", e.target.value)} /></Field>
          <Field label="Slug (порожньо = з назви)" error={fe("slug")}><Input value={f.slug} onChange={(e) => up("slug", e.target.value)} /></Field>
          <Field label="Категорія" error={fe("categoryId")}><Select value={f.categoryId} onChange={(e) => up("categoryId", e.target.value)}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Бренд" error={fe("brand")}><Input value={f.brand} onChange={(e) => up("brand", e.target.value)} /></Field>
          <Field label="Модель (для фільтра, напр. «iPhone 15 Pro»)" error={fe("model")}><Input value={f.model} onChange={(e) => up("model", e.target.value)} /></Field>
          <Field label="Артикул товару (SKU)" error={fe("sku")}><Input value={f.sku} onChange={(e) => up("sku", e.target.value)} /></Field>
          <Field label="Штрихкод"><Input value={f.barcode} onChange={(e) => up("barcode", e.target.value)} /></Field>
          <Field label="Короткий опис" className="sm:col-span-2"><Input value={f.shortDescription} maxLength={300} onChange={(e) => up("shortDescription", e.target.value)} /></Field>
          <Field label={t("product.description")} className="sm:col-span-2"><Textarea rows={8} value={f.description} onChange={(e) => up("description", e.target.value)} /></Field>
          <div className="flex flex-wrap gap-6 sm:col-span-2">
            {([["isActive", "Активний (видно в магазині)"], ["isFeatured", "Рекомендований"], ["isNew", "Позначка «Новинка»"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f[k]} onChange={(e) => up(k, e.target.checked)} className="h-4 w-4 accent-[hsl(var(--accent))]" />{l}</label>)}
          </div>
        </TabsContent>

        <TabsContent value="variants" className="space-y-6">
          {f.variants.map((v, i) => {
            const used = v.condition !== "NEW";
            const p = (k: string) => fe(`variants.${i}.${k}`);
            return (
              <fieldset key={v.key} className="space-y-5 rounded-2xl border border-border p-5">
                <legend className="px-2 text-sm font-semibold">Варіант {i + 1}{v.sku && ` · ${v.sku}`}</legend>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label={t("admin.sku")} error={p("sku")}><Input value={v.sku} onChange={(e) => upV(i, { sku: e.target.value })} /></Field>
                  <Field label={t("product.condition")}><Select value={v.condition} onChange={(e) => upV(i, { condition: e.target.value as VariantForm["condition"], warrantyMonths: e.target.value === "NEW" ? 12 : 3 })}>{CONDITIONS.map((c) => <option key={c} value={c}>{t(`condition.${c}`)}</option>)}</Select></Field>
                  <Field label={t("product.storage")}><Input value={v.storage} onChange={(e) => upV(i, { storage: e.target.value })} placeholder="256 GB" /></Field>
                  <Field label={t("product.color")}><div className="flex gap-2"><Input value={v.color} onChange={(e) => upV(i, { color: e.target.value })} /><input type="color" aria-label="hex" value={v.colorHex || "#cccccc"} onChange={(e) => upV(i, { colorHex: e.target.value })} className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-input" /></div></Field>
                  <Field label="SIM"><Input value={v.simType} onChange={(e) => upV(i, { simType: e.target.value })} placeholder="nano-SIM + eSIM" /></Field>
                  <Field label={t("product.connectivity")}><Input value={v.connectivity} onChange={(e) => upV(i, { connectivity: e.target.value })} /></Field>
                  <Field label={t("admin.price")} error={p("price")}><Input inputMode="decimal" value={v.price} onChange={(e) => upV(i, { price: e.target.value })} /></Field>
                  <Field label={t("admin.compareAt")} error={p("compareAtPrice")}><Input inputMode="decimal" value={v.compareAtPrice} onChange={(e) => upV(i, { compareAtPrice: e.target.value })} /></Field>
                  <Field label={t("admin.cost")}><Input inputMode="decimal" value={v.costPrice} onChange={(e) => upV(i, { costPrice: e.target.value })} /></Field>
                  <Field label={`${t("admin.stock")} (${t("admin.reserved")}: ${v.reserved})`} error={p("stock")}><Input type="number" min={v.reserved} value={v.stock} onChange={(e) => upV(i, { stock: Number(e.target.value) })} /></Field>
                  <Field label="Поріг «мало»"><Input type="number" min={0} value={v.lowStockThreshold} onChange={(e) => upV(i, { lowStockThreshold: Number(e.target.value) })} /></Field>
                  <Field label="Гарантія, міс."><Input type="number" min={0} value={v.warrantyMonths} onChange={(e) => upV(i, { warrantyMonths: Number(e.target.value) })} /></Field>
                  <Field label="Вага, г"><Input type="number" min={10} value={v.weightGrams} onChange={(e) => upV(i, { weightGrams: Number(e.target.value) })} /></Field>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={v.isActive} onChange={(e) => upV(i, { isActive: e.target.checked })} className="accent-[hsl(var(--accent))]" />Активний</label>
                </div>

                {used && (
                  <div className="space-y-5 rounded-xl bg-muted/50 p-4">
                    <h3 className="font-semibold">{t("admin.usedDevice")}</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label={t("admin.status")}><Select value={v.used.status} onChange={(e) => upUsed(i, { status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
                      <Field label="Батарея, %" error={p("used.batteryHealth")}><Input type="number" min={0} max={100} value={v.used.batteryHealth} onChange={(e) => upUsed(i, { batteryHealth: e.target.value })} /></Field>
                      <Field label="Циклів"><Input type="number" min={0} value={v.used.cycleCount} onChange={(e) => upUsed(i, { cycleCount: e.target.value })} /></Field>
                      <Field label="Клас"><Select value={v.used.deviceGrade} onChange={(e) => upUsed(i, { deviceGrade: e.target.value })}><option value="">—</option>{["A_PLUS", "A", "B", "C"].map((g) => <option key={g} value={g}>{t(`grade.${g}`)}</option>)}</Select></Field>
                      <Field label="Корпус"><Select value={v.used.physicalCondition} onChange={(e) => upUsed(i, { physicalCondition: e.target.value })}><option value="">—</option>{["PERFECT", "MINOR_WEAR", "VISIBLE_WEAR", "HEAVY_WEAR"].map((g) => <option key={g} value={g}>{t(`physical.${g}`)}</option>)}</Select></Field>
                      <Field label="Екран"><Select value={v.used.screenCondition} onChange={(e) => upUsed(i, { screenCondition: e.target.value })}><option value="">—</option>{["PERFECT", "MINOR_WEAR", "VISIBLE_WEAR", "HEAVY_WEAR"].map((g) => <option key={g} value={g}>{t(`physical.${g}`)}</option>)}</Select></Field>
                      <Field label="Гарантія на пристрій, міс."><Input type="number" min={0} value={v.used.warrantyMonths} onChange={(e) => upUsed(i, { warrantyMonths: Number(e.target.value) })} /></Field>
                      <Field label="Комплектація (через кому)"><Input value={v.used.accessoriesIncluded} onChange={(e) => upUsed(i, { accessoriesIncluded: e.target.value })} placeholder="Кабель, коробка" /></Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {FUNCS.map(([k, l]) => <Field key={k} label={t(`product.used.${l}`)}><Select value={String(v.used[k])} onChange={(e) => upUsed(i, { [k]: e.target.value } as Partial<UsedForm>)} className="h-10 text-xs">{["OK", "DEFECT", "NOT_TESTED", "NOT_APPLICABLE"].map((s) => <option key={s} value={s}>{t(`functional.${s}`)}</option>)}</Select></Field>)}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Недоліки (бачать клієнти)"><Textarea rows={3} value={v.used.defects} onChange={(e) => upUsed(i, { defects: e.target.value })} /></Field>
                      <Field label="Коментар майстра (бачать клієнти)"><Textarea rows={3} value={v.used.inspectionNotes} onChange={(e) => upUsed(i, { inspectionNotes: e.target.value })} /></Field>
                    </div>

                    {canSecrets && v.hasSecretPermission && (
                      <div className="space-y-4 rounded-xl border border-amber-300 bg-amber-50/60 p-4">
                        <h4 className="flex items-center gap-2 font-semibold text-warning"><ShieldAlert className="h-4 w-4" />{t("admin.secrets")}</h4>
                        <p className="text-xs text-muted-foreground">{t("admin.secretsHint")}</p>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <Field label={t("admin.imei")} error={p("secret.imei")}><Input inputMode="numeric" maxLength={15} value={v.secret.imei} onChange={(e) => upSecret(i, { imei: e.target.value })} autoComplete="off" /></Field>
                          <Field label={t("admin.serial")}><Input value={v.secret.serial} onChange={(e) => upSecret(i, { serial: e.target.value })} autoComplete="off" /></Field>
                          <Field label={t("admin.purchaseCost")}><Input inputMode="decimal" value={v.secret.purchaseCost} onChange={(e) => upSecret(i, { purchaseCost: e.target.value })} /></Field>
                          <Field label={t("admin.supplier")}><Input value={v.secret.supplier} onChange={(e) => upSecret(i, { supplier: e.target.value })} /></Field>
                          <Field label={t("admin.purchaseSource")}><Input value={v.secret.purchaseSource} onChange={(e) => upSecret(i, { purchaseSource: e.target.value })} /></Field>
                          <Field label={t("admin.internalNotes")}><Input value={v.secret.internalNotes} onChange={(e) => upSecret(i, { internalNotes: e.target.value })} /></Field>
                        </div>
                        <div><p className="mb-2 text-sm font-medium">{t("admin.checklist")}</p>
                          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{v.secret.checklist.map((c, ci) => <li key={ci}><label className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={c.passed} onChange={(e) => upSecret(i, { checklist: v.secret.checklist.map((x, k) => (k === ci ? { ...x, passed: e.target.checked } : x)) })} className="accent-[hsl(var(--accent))]" />{c.item}</label></li>)}</ul></div>
                      </div>
                    )}
                  </div>
                )}
                {f.variants.length > 1 && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setF((s) => ({ ...s, variants: s.variants.filter((_, k) => k !== i) }))}><Trash2 className="h-4 w-4" />Видалити варіант</Button>}
              </fieldset>
            );
          })}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setF((s) => ({ ...s, variants: [...s.variants, emptyVariant()] }))}><Plus className="h-4 w-4" />Додати варіант</Button>
            <Button type="button" variant="outline" onClick={() => setF((s) => { const last = s.variants[s.variants.length - 1]; return { ...s, variants: [...s.variants, { ...(last ?? emptyVariant()), key: emptyVariant().key, id: undefined, sku: "", stock: 0, reserved: 0, used: { ...emptyUsed(), ...(last?.used ?? {}) }, secret: emptySecret() }] }; })}><Copy className="h-4 w-4" />Копіювати останній</Button>
          </div>
        </TabsContent>

        <TabsContent value="images"><ImageUploader images={f.images} onChange={(i) => up("images", i)} variants={variantLabels} /></TabsContent>

        <TabsContent value="specs" className="space-y-8">
          <div className="space-y-4"><h3 className="font-semibold">{t("product.specs")}</h3>
            {f.specifications.map((g, gi) => (
              <div key={gi} className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex gap-2"><Input value={g.group} placeholder="Група (Дисплей, Камера…)" onChange={(e) => up("specifications", f.specifications.map((x, k) => (k === gi ? { ...x, group: e.target.value } : x)))} /><Button type="button" variant="ghost" size="icon" onClick={() => up("specifications", f.specifications.filter((_, k) => k !== gi))}><Trash2 className="h-4 w-4" /></Button></div>
                {g.items.map((it, ii) => (
                  <div key={ii} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Input value={it.label} placeholder="Параметр" onChange={(e) => up("specifications", f.specifications.map((x, k) => (k === gi ? { ...x, items: x.items.map((y, j) => (j === ii ? { ...y, label: e.target.value } : y)) } : x)))} /><Input value={it.value} placeholder="Значення" onChange={(e) => up("specifications", f.specifications.map((x, k) => (k === gi ? { ...x, items: x.items.map((y, j) => (j === ii ? { ...y, value: e.target.value } : y)) } : x)))} /><Button type="button" variant="ghost" size="icon" onClick={() => up("specifications", f.specifications.map((x, k) => (k === gi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)))}><Trash2 className="h-4 w-4" /></Button></div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => up("specifications", f.specifications.map((x, k) => (k === gi ? { ...x, items: [...x.items, { label: "", value: "" }] } : x)))}><Plus className="h-4 w-4" />Параметр</Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => up("specifications", [...f.specifications, { group: "", items: [{ label: "", value: "" }] }])}><Plus className="h-4 w-4" />Група</Button></div>
          <div className="space-y-3"><h3 className="font-semibold">{t("product.faq")}</h3>
            {f.faq.map((q, qi) => (<div key={qi} className="space-y-2 rounded-xl border border-border p-4"><div className="flex gap-2"><Input value={q.q} placeholder="Питання" onChange={(e) => up("faq", f.faq.map((x, k) => (k === qi ? { ...x, q: e.target.value } : x)))} /><Button type="button" variant="ghost" size="icon" onClick={() => up("faq", f.faq.filter((_, k) => k !== qi))}><Trash2 className="h-4 w-4" /></Button></div><Textarea rows={2} value={q.a} placeholder="Відповідь" onChange={(e) => up("faq", f.faq.map((x, k) => (k === qi ? { ...x, a: e.target.value } : x)))} /></div>))}
            <Button type="button" variant="outline" onClick={() => up("faq", [...f.faq, { q: "", a: "" }])}><Plus className="h-4 w-4" />Питання</Button></div>
        </TabsContent>

        <TabsContent value="seo" className="max-w-2xl space-y-4">
          <Field label="SEO title" hint={`${f.seoTitle.length}/120`}><Input value={f.seoTitle} maxLength={120} onChange={(e) => up("seoTitle", e.target.value)} /></Field>
          <Field label="SEO description" hint={`${f.seoDescription.length}/300`}><Textarea rows={3} value={f.seoDescription} maxLength={300} onChange={(e) => up("seoDescription", e.target.value)} /></Field>
        </TabsContent>
      </Tabs>
      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-4 backdrop-blur"><Button variant="outline" onClick={() => router.push("/admin/products")}>{t("common.cancel")}</Button><Button size="lg" loading={pending} onClick={save}>{t("common.save")}</Button></div>
    </div>
  );
}
