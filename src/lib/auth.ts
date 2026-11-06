import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, verifyToken } from "./authToken";
import { getUser, toPublic, type PublicUser } from "./userStore";

/** User dari cookie sesi; null kalau tidak valid, sudah dihapus, atau password sudah diganti. */
export async function currentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const p = await verifyToken(token);
  if (!p) return null;
  const u = await getUser(p.u);
  if (!u || u.ver !== p.v) return null;
  return toPublic(u);
}

/**
 * Dipakai di layout tiap tab (server): tidak login → /login, tidak punya akses → beranda.
 * Tab "pengguna" khusus akun utama.
 */
export async function requireTab(key: string): Promise<void> {
  const me = await currentUser();
  if (!me) return redirect("/login");
  const boleh = key === "pengguna" ? me.role === "admin" : me.tabs.includes(key);
  if (!boleh) return redirect("/");
}

export function cookieSecure(request: Request): boolean {
  return new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
}