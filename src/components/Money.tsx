"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { rp, rpShort } from "@/lib/utils";

/**
 * Angka uang adaptif: ditulis LENGKAP (Rp2.021.056.082) selama muat di lebarnya,
 * otomatis jadi ringkas (Rp2 M) saat ruang sempit. `full` memaksa selalu lengkap.
 */
export default function Money({
  value, className, full = false,
}: { value: number; className?: string; full?: boolean }) {
  const n = Number.isFinite(value) ? value : 0;
  const wrap = useRef<HTMLSpanElement | null>(null);
  const ukur = useRef<HTMLSpanElement | null>(null);
  const [ringkas, setRingkas] = useState(false);

  useLayoutEffect(() => {
    if (full) return;
    const w = wrap.current, u = ukur.current;
    if (!w || !u) return;
    const cek = () => setRingkas(u.offsetWidth > w.clientWidth + 1);
    cek();
    const ro = new ResizeObserver(cek);
    ro.observe(w);
    return () => ro.disconnect();
  }, [n, full]);

  if (full) return <span className={className} title={rp(n)}>{rp(n)}</span>;
  return (
    <span ref={wrap} className={`relative block min-w-0 max-w-full whitespace-nowrap ${className ?? ""}`} title={rp(n)}>
      {ringkas ? rpShort(n) : rp(n)}
      {/* pengukur tak terlihat: lebar teks lengkap */}
      <span ref={ukur} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre">{rp(n)}</span>
    </span>
  );
}
