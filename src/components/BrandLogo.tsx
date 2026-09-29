"use client";
import { useState } from "react";
import Image from "next/image";

// "ANIMAL & CO" -> "animal-co"  (mengikuti pola nama file di public/brands)
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function BrandLogo({ brand, size = 22, className = "" }: {
  brand: string; size?: number; className?: string;
}) {
  const [err, setErr] = useState(false);
  const b = (brand ?? "").trim();

  // Fallback: brand kosong / file logo tidak ada -> huruf awal
  if (!b || err) {
    return (
      <span title={b || "Tanpa brand"}
        className={`inline-flex shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-[10px] font-bold text-indigo-300 ${className}`}
        style={{ width: size, height: size }}>
        {(b[0] ?? "?").toUpperCase()}
      </span>
    );
  }

  return (
    <Image src={`/brands/${slug(b)}.png`} alt={b} title={b}
      width={size} height={size} onError={() => setErr(true)}
      className={`shrink-0 rounded-md object-contain ${className}`}
      style={{ width: size, height: size }} />
  );
}
