"use client";
import { usePathname } from "next/navigation";

/** Sembunyikan elemen kerangka (navbar, asisten) di halaman login. */
export default function ShellGate({ children }: { children: React.ReactNode }) {
  return usePathname() === "/login" ? null : <>{children}</>;
}