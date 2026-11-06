import { requireTab } from "@/lib/auth";

/** Penjaga akses tab (server): hanya akun yang diberi izin yang bisa membuka halaman ini. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireTab("dap");
  return <>{children}</>;
}
