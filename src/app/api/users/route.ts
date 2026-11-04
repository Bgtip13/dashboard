import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { UserError, createUser, listUsers } from "@/lib/userStore";

async function adminOnly() {
  const me = await currentUser();
  if (!me) return { error: NextResponse.json({ error: "Belum login." }, { status: 401 }) };
  if (me.role !== "admin") {
    return { error: NextResponse.json({ error: "Hanya akun utama yang boleh." }, { status: 403 }) };
  }
  return { me };
}

export async function GET() {
  const a = await adminOnly();
  if (a.error) return a.error;
  return NextResponse.json({ users: await listUsers() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const a = await adminOnly();
  if (a.error) return a.error;
  try {
    const b = (await request.json()) as Record<string, unknown>;
    const user = await createUser({
      id: String(b.id ?? ""),
      nama: String(b.nama ?? ""),
      password: String(b.password ?? ""),
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Gagal menambah user." }, { status: 500 });
  }
}