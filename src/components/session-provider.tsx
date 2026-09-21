"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Me = { user: { name: string | null; role: "CUSTOMER" | "STAFF" | "ADMIN" } | null; cartCount: number; wishlist: string[]; loaded: boolean };
const empty: Me = { user: null, cartCount: 0, wishlist: [], loaded: false };
const Ctx = createContext<{ me: Me; refresh: () => Promise<void>; setCartCount: (n: number) => void; setWished: (id: string, on: boolean) => void }>({
  me: empty, refresh: async () => {}, setCartCount: () => {}, setWished: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>(empty);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.ok) setMe({ ...(await res.json()), loaded: true });
    } catch { /* offline: keep previous */ }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const setCartCount = useCallback((n: number) => setMe((m) => ({ ...m, cartCount: n })), []);
  const setWished = useCallback((id: string, on: boolean) => setMe((m) => ({ ...m, wishlist: on ? [...new Set([...m.wishlist, id])] : m.wishlist.filter((x) => x !== id) })), []);
  return <Ctx.Provider value={{ me, refresh, setCartCount, setWished }}>{children}</Ctx.Provider>;
}
export const useMe = () => useContext(Ctx);
