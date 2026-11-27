"use client";
import { usePathname } from "next/navigation";

/** Area konten: beri ruang untuk sidebar (kiri di desktop, bawah di mobile) kecuali di halaman login. */
export default function ShellMain({ children }: { children: React.ReactNode }) {
  const login = usePathname() === "/login";
  return (
    <main className={`mx-auto w-full max-w-none min-w-0 px-4 sm:px-7 lg:px-9 2xl:px-12 ${login ? "pb-16" : "pt-[calc(4.75rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pt-6 sm:pb-16 sm:pl-[var(--side-w,7rem)]"}`}>
      {children}
    </main>
  );
}
