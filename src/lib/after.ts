import "server-only";
import { after } from "next/server";

/** Run non-critical work (e-mails, analytics) after the response; never let it fail the request. */
export function runAfter(fn: () => Promise<unknown>, label = "after"): void {
  const safe = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[${label}] background task failed`, err);
    }
  };
  try {
    after(safe);
  } catch {
    void safe(); // outside a request scope (cron, scripts)
  }
}
