import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";
import { ForbiddenError, requirePermission } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * Signed direct-upload parameters for Cloudinary. Only staff with products.write can obtain them; the API secret
 * never leaves the server (only the resulting SHA signature does). Origin is checked by middleware (CSRF).
 */
export async function POST() {
  try {
    await requirePermission("products.write");
  } catch (e) {
    return NextResponse.json({ error: e instanceof ForbiddenError ? "forbidden" : "error" }, { status: 403 });
  }
  const e = env();
  if (!e.CLOUDINARY_CLOUD_NAME || !e.CLOUDINARY_API_KEY || !e.CLOUDINARY_API_SECRET) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp, folder: "idevice/products" };
  const signature = cloudinary.utils.api_sign_request(params, e.CLOUDINARY_API_SECRET);
  return NextResponse.json({ ...params, signature, apiKey: e.CLOUDINARY_API_KEY, cloudName: e.CLOUDINARY_CLOUD_NAME });
}
