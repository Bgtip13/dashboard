"use client";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";

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

  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("pcp-theme");
    if (saved) setIsDark(saved === "dark");
    else { const h = new Date().getHours(); setIsDark(h < 7 || h >= 17); } // auto: siang terang, malam gelap
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("pcp-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <ThemeCtx.Provider value={{ isDark, toggle: () => setIsDark((d) => !d) }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeCtx.Provider>
  );
}
