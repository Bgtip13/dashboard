/** Data akun yang sedang login (cache react-query ["me"]) — dipakai Navbar & Beranda. */
export type Me = { user: { id: string; nama: string; role: "admin" | "user"; tabs: string[] } };

export class AuthError extends Error {
  status: number;
  constructor(status: number) {
    super("auth");
    this.status = status;
  }
}

export async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) throw new AuthError(res.status);
  return res.json();
}
