"use client";
import MatrixChart from "@/components/MatrixChart";
import { rpShort } from "@/lib/utils";

export const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

export default function DapChart({ values, loss, selectedMonth }: {
  values: number[]; loss: number[]; selectedMonth: number;
}) {
  const hasLoss = loss.some((v) => v > 0);
  return (
    <MatrixChart
      categories={MONTH_SHORT}
      series={[
        { name: "Aktual", values },
        ...(hasLoss ? [{ name: "Hilang", values: loss, color: "var(--danger)" }] : []),
      ]}
      stacked
      fmt={(v) => rpShort(v)}
      nowIndex={selectedMonth}
      nowLabel="BULAN"
      height={320}
    />
  );
}
