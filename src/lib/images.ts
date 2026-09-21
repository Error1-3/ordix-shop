import "server-only";
import { env } from "./env";

/** Accept only images hosted on OUR Cloudinary account (or same-site /images paths). Stops arbitrary-URL injection by staff typos or compromised forms. */
export function isAllowedImageUrl(url: string): boolean {
  if (url.startsWith("/images/")) return true;
  try {
    const u = new URL(url);
    const cloud = env().CLOUDINARY_CLOUD_NAME;
    return u.protocol === "https:" && u.hostname === "res.cloudinary.com" && (!cloud || u.pathname.startsWith(`/${cloud}/`));
  } catch {
    return false;
  }
}
