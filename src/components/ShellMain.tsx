"use client";
import { usePathname } from "next/navigation";

/** Area konten: beri ruang untuk sidebar (kiri di desktop, bawah di mobile) kecuali di halaman login.
 *  Aturan lebar/padding ada di globals.css (.shell-main) supaya seragam di semua menu. */
export default function ShellMain({ children }: { children: React.ReactNode }) {
  const login = usePathname() === "/login";
  return (
    <main className={`shell-main ${login ? "shell-main--login" : "shell-main--app"}`}>
      {children}
    </main>
  );
}
