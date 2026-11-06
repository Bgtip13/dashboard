import { NextResponse } from "next/server";
import { COOKIE, SESSION_SECONDS, signToken } from "@/lib/authToken";
import { cookieSecure, currentUser } from "@/lib/auth";
import { UserError, authenticate, updateUser } from "@/lib/userStore";

// Batasi tebak password lama: 5 gagal / 10 menit per user
const WINDOW = 10 * 60_000;
const MAX_FAIL = 5;
const fails = new Map<string, { n: number; reset: number }>();

/** Ubah password milik sendiri (semua akun, termasuk akun utama). */
export async function POST(request: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* body kosong */
  }
  const lama = String(body.passwordLama ?? "").slice(0, 100);
  const baru = String(body.passwordBaru ?? "").slice(0, 100);
  if (!lama || !baru) {
    return NextResponse.json({ error: "Password lama dan baru wajib diisi." }, { status: 400 });
  }
  if (lama === baru) {
    return NextResponse.json({ error: "Password baru harus berbeda dari yang lama." }, { status: 400 });
  }

  const now = Date.now();
  if (fails.size > 500) {
    for (const [k, v] of fails) if (now > v.reset) fails.delete(k);
  }
  const f = fails.get(me.id);
  if (f && now < f.reset && f.n >= MAX_FAIL) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." },
      { status: 429 },
    );
  }

  // Pastikan yang mengetik memang pemilik akun (bukan sekadar sesi yang tertinggal di perangkat)
  const ok = await authenticate(me.id, lama);
  if (!ok) {
    const cur = f && now < f.reset ? f : { n: 0, reset: now + WINDOW };
    cur.n += 1;
    fails.set(me.id, cur);
    return NextResponse.json({ error: "Password lama salah." }, { status: 401 });
  }
  fails.delete(me.id);

  try {
    const user = await updateUser(me.id, { password: baru });
    const res = NextResponse.json({ ok: true });
    // Versi password naik → sesi lama (termasuk di perangkat lain) batal; terbitkan cookie baru untuk sesi ini
    res.cookies.set(
      COOKIE,
      await signToken({ u: user.id, v: user.ver, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }),
      { httpOnly: true, sameSite: "lax", path: "/", secure: cookieSecure(request), maxAge: SESSION_SECONDS },
    );
    return res;
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Gagal mengganti password." }, { status: 500 });
  }
}
