"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/i18n-provider";
import type { ImageForm } from "@/lib/admin-form";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { SafeImage } from "./safe-image";

async function uploadToCloudinary(file: File): Promise<{ url: string; publicId: string }> {
  const sign = await fetch("/api/upload/sign", { method: "POST" });
  if (sign.status === 501) throw new Error("not_configured");
  if (!sign.ok) throw new Error("forbidden");
  const s = await sign.json();
  const body = new FormData();
  body.append("file", file); body.append("api_key", s.apiKey); body.append("timestamp", String(s.timestamp)); body.append("signature", s.signature); body.append("folder", s.folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: "POST", body });
  if (!res.ok) throw new Error("upload_failed");
  const j = await res.json();
  return { url: j.secure_url as string, publicId: j.public_id as string };
}

/** Drag & drop, preview, reorder, delete, alt text, per-device assignment. Uploads go straight to Cloudinary with a server-signed request. */
export function ImageUploader({ images, onChange, variants }: { images: ImageForm[]; onChange: (i: ImageForm[]) => void; variants: { key: string; label: string }[] }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState("");

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/") && f.size <= 12 * 1024 * 1024);
    if (!list.length) return;
    setBusy((b) => b + list.length);
    const added: ImageForm[] = [];
    for (const f of list) {
      try {
        const r = await uploadToCloudinary(f);
        added.push({ url: r.url, publicId: r.publicId, alt: f.name.replace(/\.[^.]+$/, ""), variantKey: null, isPrimary: false });
      } catch (e) {
        toast.error((e as Error).message === "not_configured" ? t("admin.uploadNotConfigured") : t("common.networkError"));
        break;
      } finally { setBusy((b) => b - 1); }
    }
    if (added.length) onChange([...images, ...added].map((im, i) => ({ ...im, isPrimary: images.length === 0 && i === 0 ? true : im.isPrimary })));
  };
  const move = (i: number, d: -1 | 1) => { const a = [...images]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j]!, a[i]!]; onChange(a); };
  const patch = (i: number, p: Partial<ImageForm>) => onChange(images.map((im, k) => (k === i ? { ...im, ...p } : p.isPrimary ? { ...im, isPrimary: false } : im)));

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files); }}
        className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm transition-colors", drag ? "border-accent bg-accent-soft" : "border-border hover:bg-muted/50")}
        onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      >
        {busy > 0 ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
        <span>{t("admin.uploadDrop")}</span>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && void addFiles(e.target.files)} />
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("admin.imageUrlFallback")} />
        <Button type="button" variant="outline" disabled={!url} onClick={() => { onChange([...images, { url: url.trim(), alt: "", variantKey: null, isPrimary: images.length === 0 }]); setUrl(""); }}>{t("common.add")}</Button>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {images.map((im, i) => (
          <li key={`${im.url}-${i}`} className="flex gap-3 rounded-xl border border-border p-3">
            <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted"><SafeImage src={im.url} alt={im.alt} fill sizes="96px" className="object-contain p-1" /></span>
            <div className="min-w-0 flex-1 space-y-2">
              <Input value={im.alt} onChange={(e) => patch(i, { alt: e.target.value })} placeholder={t("admin.altText")} className="h-9 text-xs" />
              <Select value={im.variantKey ?? ""} onChange={(e) => patch(i, { variantKey: e.target.value || null })} className="h-9 text-xs" aria-label={t("product.yourDevice")}>
                <option value="">Загальне фото товару</option>{variants.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </Select>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant={im.isPrimary ? "accent" : "ghost"} className="h-8 w-8" onClick={() => patch(i, { isPrimary: true })} aria-label={t("admin.makePrimary")}><Star className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} aria-label="up"><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} aria-label="down"><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="ml-auto h-8 w-8 text-destructive" onClick={() => onChange(images.filter((_, k) => k !== i))} aria-label={t("common.delete")}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
