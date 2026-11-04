import { NextResponse } from "next/server";
import { COOKIE, SESSION_SECONDS, signToken } from "@/lib/authToken";
import { cookieSecure } from "@/lib/auth";
import { authenticate } from "@/lib/userStore";

// Batasi tebak password: 5 gagal / 10 menit per IP + ID
const WINDOW = 10 * 60_000;
const MAX_FAIL = 5;
const fails = new Map<string, { n: number; reset: number }>();

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* body kosong */
  }
  const id = String(body.id ?? "").trim().toLowerCase().slice(0, 40);
  const password = String(body.password ?? "").slice(0, 100);
  if (!id || !password) {
    return NextResponse.json({ error: "ID dan password wajib diisi." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "lokal";
  const key = `${ip}|${id}`;
  const now = Date.now();

  if (fails.size > 500) {
    for (const [k, v] of fails) if (now > v.reset) fails.delete(k);
  }

  const f = fails.get(key);
  if (f && now < f.reset && f.n >= MAX_FAIL) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." },
      { status: 429 },
    );
  }

  const user = await authenticate(id, password);
  if (!user) {
    const cur = f && now < f.reset ? f : { n: 0, reset: now + WINDOW };
    cur.n += 1;
    fails.set(key, cur);
    return NextResponse.json({ error: "ID atau password salah." }, { status: 401 });
  }
  fails.delete(key);

  const token = await signToken({
    u: user.id,
    v: user.ver,
    exp: Math.floor(now / 1000) + SESSION_SECONDS,
  });
  const res = NextResponse.json({ user });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: cookieSecure(request),
    maxAge: SESSION_SECONDS,
  });
  return res;
}