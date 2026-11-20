// Hook kecil agar import tanpa ekstensi ("./engine") bisa dijalankan di Node untuk pengujian.
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('.') && !/\\.[a-z]+$/.test(spec)) {
    try { return await next(spec + '.ts', ctx); } catch {}
  }
  return next(spec, ctx);
}`), import.meta.url);
