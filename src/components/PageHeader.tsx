import type { ReactNode } from "react";

/** Kepala halaman gaya video: breadcrumb mono kapital, judul besar, tanggal/keterangan, aksi di kanan. */
export default function PageHeader({
  crumb, title, sub, children,
}: {
  crumb: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <p className="lbl">PCP <span className="mx-1 opacity-60">/</span> {crumb}</p>
        <h1 className="mt-1.5 text-[2rem] font-medium leading-none tracking-tight sm:text-[2.6rem]">{title}</h1>
        {sub && <p className="mt-2 text-[0.82rem] text-slate-400">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}
