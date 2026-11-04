import { NextResponse } from "next/server";
import { COOKIE, SESSION_SECONDS, signToken } from "@/lib/authToken";
import { cookieSecure, currentUser } from "@/lib/auth";
import { UserError, removeUser, updateUser } from "@/lib/userStore";

type Ctx = { params: Promise<{ id: string }> };

async function adminOnly() {
  const me = await currentUser();
  if (!me) return { error: NextResponse.json({ error: "Belum login." }, { status: 401 }) };
  if (me.role !== "admin") {
    return { error: NextResponse.json({ error: "Hanya akun utama yang boleh." }, { status: 403 }) };
  }
  return { me };
}

const fail = (e: unknown) =>
  e instanceof UserError
    ? NextResponse.json({ error: e.message }, { status: e.status })
    : NextResponse.json({ error: "Terjadi kesalahan di server." }, { status: 500 });

export async function PATCH(request: Request, { params }: Ctx) {
  const a = await adminOnly();
  if (a.error) return a.error;
  const { id } = await params;
  try {
    const b = (await request.json()) as Record<string, unknown>;
    const newPw = typeof b.password === "string" && b.password ? b.password : undefined;
    const user = await updateUser(id, {
      nama: typeof b.nama === "string" ? b.nama : undefined,
      password: newPw,
    });
    const res = NextResponse.json({ user });
    // Admin mengganti password dirinya sendiri: terbitkan ulang cookie supaya tidak ter-logout
    if (newPw && user.id === a.me.id) {
      res.cookies.set(
        COOKIE,
        await signToken({
          u: user.id,
          v: user.ver,
          exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
        }),
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: cookieSecure(request),
          maxAge: SESSION_SECONDS,
        },
      );
    }
    return res;
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const a = await adminOnly();
  if (a.error) return a.error;
  const { id } = await params;
  if (id.toLowerCase() === a.me.id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri." }, { status: 403 });
  }
  try {
    await removeUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}