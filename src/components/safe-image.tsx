import Image, { type ImageProps } from "next/image";

/** next/image wrapper: SVGs (seed placeholders) skip the optimizer; missing src renders a neutral block. */
export function SafeImage({ src, alt, ...rest }: Omit<ImageProps, "src"> & { src?: string | null }) {
  if (!src) return <div className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground" aria-hidden><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18.5h2" /></svg></div>;
  return <Image src={src} alt={alt} unoptimized={src.endsWith(".svg")} {...rest} />;
}
