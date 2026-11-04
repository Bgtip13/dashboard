/** Token sesi bertanda tangan HMAC. Hanya memakai Web Crypto, jadi aman dipakai di proxy. */
export const COOKIE = "pcp-session";
export const SESSION_SECONDS = 60 * 60 * 12; // 12 jam

export interface SessionPayload {
  u: string;   // id user
  v: number;   // versi password (naik tiap password diganti, sesi lama batal)
  exp: number; // detik epoch
}

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET belum diisi (minimal 16 karakter).");
  }
  return "dev-only-secret-ganti-di-env-local";
}

function toB64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64u(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function hmacKey() {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

export async function signToken(payload: SessionPayload): Promise<string> {
  const body = toB64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${toB64u(new Uint8Array(sig))}`;
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify(
      "HMAC", await hmacKey(), fromB64u(sig) as BufferSource, enc.encode(body),
    );
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(body))) as SessionPayload;
    if (typeof p.u !== "string" || typeof p.v !== "number" || typeof p.exp !== "number") return null;
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}