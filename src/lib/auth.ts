import { cookies } from "next/headers";
import { COOKIE, verifyToken } from "./authToken";
import { getUser, type PublicUser } from "./userStore";

/** User dari cookie sesi; null kalau tidak valid, sudah dihapus, atau password sudah diganti. */
export async function currentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const p = await verifyToken(token);
  if (!p) return null;
  const u = await getUser(p.u);
  if (!u || u.ver !== p.v) return null;
  return { id: u.id, nama: u.nama, role: u.role, ver: u.ver, dibuat: u.dibuat };
}

export function cookieSecure(request: Request): boolean {
  return new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
}