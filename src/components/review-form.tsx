"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReviewAction } from "@/actions/account";
import { initialState } from "@/lib/action-state";
import { useT } from "@/components/i18n-provider";
import { useMe } from "@/components/session-provider";
import { Alert } from "./ui/misc";
import { Button } from "./ui/button";
import { Field } from "./ui/label";
import { Input, Textarea } from "./ui/input";

export function ReviewForm({ productId }: { productId: string }) {
  const t = useT();
  const { me } = useMe();
  const [state, action, pending] = useActionState(submitReviewAction, initialState);
  const [rating, setRating] = useState(5);
  if (!me.loaded) return null;
  if (!me.user) return <p className="text-sm text-muted-foreground"><Link className="underline" href="/login">{t("reviews.loginToReview")}</Link></p>;
  if (state.ok) return <Alert variant="success">{t(state.message ?? "reviews.moderation")}</Alert>;
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-xl border border-border p-5">
      <h3 className="font-semibold">{t("reviews.write")}</h3>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <div role="radiogroup" aria-label={t("reviews.rating")} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} onClick={() => setRating(n)}><Star className={`h-7 w-7 transition-colors ${n <= rating ? "fill-amber-400 text-amber-400" : "text-border"}`} /></button>
        ))}
      </div>
      <Field label={t("reviews.reviewTitle")} error={state.fieldErrors?.title}><Input name="title" required maxLength={100} /></Field>
      <Field label={t("reviews.body")} error={state.fieldErrors?.body}><Textarea name="body" required minLength={10} maxLength={3000} /></Field>
      {state.error && <Alert variant="error">{t(state.error)}</Alert>}
      <Button loading={pending}>{t("reviews.submit")}</Button>
    </form>
  );
}
