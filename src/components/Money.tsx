import { rp, rpShort } from "@/lib/utils";

/**
 * Angka uang standar dashboard:
 * tampil ringkas (Rp5,8 M) supaya kolom & kartu tidak melebar,
 * nilai penuh muncul saat di-hover lewat title.
 */
export default function Money({
  value, className, full = false,
}: { value: number; className?: string; full?: boolean }) {
  const n = Number.isFinite(value) ? value : 0;
  return (
    <span className={className} title={rp(n)}>
      {full ? rp(n) : rpShort(n)}
    </span>
  );
}
