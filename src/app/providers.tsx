"use client";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

const KEY = "pcp-theme";

/** store tema kecil: dibaca lewat useSyncExternalStore supaya tidak setState di dalam effect */
let current: boolean | null = null;
const listeners = new Set<() => void>();

const autoDark = () => {
  const h = new Date().getHours();
  return h < 7 || h >= 17; // auto: siang terang, malam gelap
};

function readTheme(): boolean {
  if (current === null) {
    const saved = typeof window === "undefined" ? null : localStorage.getItem(KEY);
    current = saved ? saved === "dark" : autoDark();
  }
  return current;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function writeTheme(v: boolean) {
  current = v;
  localStorage.setItem(KEY, v ? "dark" : "light");
  listeners.forEach((l) => l());
}

const ThemeCtx = createContext<{ isDark: boolean; toggle: () => void }>({ isDark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchInterval: 30_000, staleTime: 20_000, placeholderData: keepPreviousData },
        },
      })
  );

  const isDark = useSyncExternalStore(subscribe, readTheme, () => true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <ThemeCtx.Provider value={{ isDark, toggle: () => writeTheme(!readTheme()) }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeCtx.Provider>
  );
}
