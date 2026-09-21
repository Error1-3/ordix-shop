/** Input sanitisation helpers. React escapes output; these protect stored data, emails and JSON-LD. */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strip HTML tags and control characters, collapse whitespace. For names, titles, comments. */
export function sanitizeText(input: string, maxLen = 2000): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(CONTROL, "")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Like sanitizeText but keeps line breaks (order comments, reviews). */
export function sanitizeMultiline(input: string, maxLen = 5000): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(CONTROL, "")
    .replace(/[<>]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

/** Escape for HTML e-mail templates. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Safe JSON for <script type="application/ld+json">: prevents </script> breakout. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028|\u2029/g, "");
}

/** Normalise a Ukrainian phone to 380XXXXXXXXX; returns null if not valid. */
export function normalizeUaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("380")) return digits;
  if (digits.length === 11 && digits.startsWith("80")) return `3${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `38${digits}`;
  return null;
}

/** Only allow same-site relative redirect targets (prevents open redirects). */
export function safeRedirectPath(target: string | null | undefined, fallback = "/"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;
  return target;
}

export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", "'": "", "’": "",
  };
  return input
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
