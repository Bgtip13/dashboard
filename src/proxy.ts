import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken } from "@/lib/authToken";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Endpoint login/logout harus bisa diakses tanpa sesi
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE)?.value;
  const valid = token ? !!(await verifyToken(token)) : false;

  if (pathname === "/login") {
    return valid ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Belum login." }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$).*)"],
};