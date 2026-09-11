/** Parser CSV tahan tanda kutip (kolom seperti "46,59%" aman) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let inQ = false;
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQ) {
      if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** "Rp 5.800.000.000" -> 5800000000 ; "35,49%" -> 35.49 ; "" -> 0 */
export function parseNum(v: unknown): number {
  let s = String(v ?? "").trim();
  if (!s) return 0;
  s = s.replace(/rp/gi, "").replace(/%/g, "").replace(/\s/g, "");
  const neg = s.startsWith("(") && s.endsWith(")");
  if (neg) s = s.slice(1, -1);
  const hasDot = s.includes("."), hasCom = s.includes(",");
  if (hasDot && hasCom) s = s.lastIndexOf(",") > s.lastIndexOf(".")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/,/g, "");
  else if (hasCom) s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  else if (hasDot && ((s.match(/\./g) || []).length > 1 || /\.\d{3}($|\.)/.test(s))) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isFinite(n) ? (neg ? -n : n) : 0;
}
