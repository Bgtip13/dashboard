/** Penyimpanan user di Supabase (khusus server). Password di-hash dengan scrypt. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { ALL_TAB_KEYS, resolveTabs } from "./tabs";

export type Role = "admin" | "user";
export interface User {
  id: string;
  nama: string;
  role: Role;
  hash: string;
  /** naik tiap password diganti, sesi lama otomatis batal */
  ver: number;
  dibuat: number;
  /** tab yang boleh dibuka (kunci dari lib/tabs.ts); akun utama selalu semua */
  tabs: string[];
}
export type PublicUser = Omit<User, "hash">;

export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const MAIN_ID = (process.env.ADMIN_ID ?? "bagus").trim().toLowerCase();
const TABLE = "app_users";

/* ---------- koneksi ---------- */
let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/* ---------- hash password ---------- */
const scrypt = (pw: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scryptCb(pw, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(pw, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// supaya waktu respons tetap sama walau ID tidak ada
let dummyHash: Promise<string> | null = null;

/* ---------- baris <-> objek ---------- */
type Row = { id: string; nama: string; role: string; hash: string; ver: number; dibuat: number | string; tabs?: unknown };

const toUser = (r: Row): User => {
  const role: Role = r.role === "admin" ? "admin" : "user";
  return {
    id: r.id,
    nama: r.nama,
    role,
    hash: r.hash,
    ver: Number(r.ver),
    dibuat: Number(r.dibuat),
    tabs: resolveTabs(role, r.tabs),
  };
};

export function toPublic(u: User): PublicUser {
  return { id: u.id, nama: u.nama, role: u.role, ver: u.ver, dibuat: u.dibuat, tabs: u.tabs };
}

function fail(message: string, error: { message: string }): never {
  // Kolom `tabs` baru ditambahkan — beri petunjuk jelas kalau migrasinya belum dijalankan
  if (/\btabs\b/i.test(error.message)) {
    throw new UserError(
      "Kolom `tabs` belum ada di tabel app_users. Jalankan supabase/add_tabs.sql di Supabase SQL Editor.",
      500,
    );
  }
  throw new Error(`${message}: ${error.message}`);
}

/* ---------- akun utama dibuat otomatis sekali ---------- */
let seeded: Promise<void> | null = null;
function ensureAdmin(): Promise<void> {
  seeded ??= (async () => {
    const { data, error } = await db().from(TABLE).select("id").eq("id", MAIN_ID).maybeSingle();
    if (error) fail("Gagal membaca tabel app_users", error);
    if (data) return;

    const adminPw = process.env.ADMIN_PASSWORD;
    if (!adminPw) {
      throw new Error("ADMIN_PASSWORD belum diisi untuk membuat akun utama pertama.");
    }
    const { error: insErr } = await db().from(TABLE).insert({
      id: MAIN_ID,
      nama: "Bagus",
      role: "admin",
      hash: await hashPassword(adminPw),
      ver: 1,
      dibuat: Date.now(),
    });
    // 23505 = sudah ada (dibuat bersamaan oleh instance lain), aman diabaikan
    if (insErr && (insErr as { code?: string }).code !== "23505") fail("Gagal membuat akun utama", insErr);
  })().catch((e) => {
    seeded = null; // coba lagi di permintaan berikutnya
    throw e;
  });
  return seeded;
}

/* ---------- validasi ---------- */
export function cekId(id: string): string {
  const v = id.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,24}$/.test(v)) {
    throw new UserError("ID 3–24 karakter: huruf kecil, angka, titik, strip, atau garis bawah.");
  }
  return v;
}

export function cekPassword(pw: string): string {
  if (pw.length < 6 || pw.length > 100) throw new UserError("Password minimal 6 karakter.");
  return pw;
}

const cekNama = (n: string, fallback: string) => n.trim().slice(0, 40) || fallback;

/** Saring daftar tab dari input: hanya kunci yang dikenal, tanpa duplikat. */
export function cekTabs(input: unknown): string[] {
  if (!Array.isArray(input)) throw new UserError("Daftar tab tidak valid.");
  return ALL_TAB_KEYS.filter((k) => input.includes(k));
}

/* ---------- operasi ---------- */
async function findRow(id: string): Promise<User | null> {
  await ensureAdmin();
  const { data, error } = await db().from(TABLE).select("*").eq("id", id.trim().toLowerCase()).maybeSingle();
  if (error) fail("Gagal membaca user", error);
  return data ? toUser(data as Row) : null;
}

export async function listUsers(): Promise<PublicUser[]> {
  await ensureAdmin();
  const { data, error } = await db().from(TABLE).select("*").order("dibuat", { ascending: true });
  if (error) fail("Gagal membaca daftar user", error);
  return ((data ?? []) as Row[]).map((r) => toPublic(toUser(r)));
}

export const getUser = (id: string) => findRow(id);

export async function authenticate(id: string, password: string): Promise<PublicUser | null> {
  const user = await findRow(id);
  if (!user) {
    dummyHash ??= hashPassword("dummy-password");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, user.hash)) ? toPublic(user) : null;
}

export async function createUser(
  input: { id: string; nama: string; password: string; tabs?: unknown },
): Promise<PublicUser> {
  const id = cekId(input.id);
  const password = cekPassword(input.password);
  const tabs = input.tabs === undefined ? [...ALL_TAB_KEYS] : cekTabs(input.tabs);
  await ensureAdmin();

  const baru: User = {
    id,
    nama: cekNama(input.nama, id),
    role: "user",
    hash: await hashPassword(password),
    ver: 1,
    dibuat: Date.now(),
    tabs,
  };
  const { error } = await db().from(TABLE).insert(baru);
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new UserError("ID sudah dipakai.", 409);
    fail("Gagal menambah user", error);
  }
  return toPublic(baru);
}

export async function updateUser(
  id: string,
  patch: { nama?: string; password?: string; tabs?: unknown },
): Promise<PublicUser> {
  const cur = await findRow(id);
  if (!cur) throw new UserError("User tidak ditemukan.", 404);

  const next: User = { ...cur };
  const kolom: Record<string, unknown> = {};
  if (typeof patch.nama === "string") next.nama = cekNama(patch.nama, cur.id);
  if (patch.password) {
    next.hash = await hashPassword(cekPassword(patch.password));
    next.ver = cur.ver + 1; // sesi lama user ini otomatis tidak berlaku
  }
  if (patch.tabs !== undefined) {
    if (cur.role === "admin") throw new UserError("Akun utama selalu bisa membuka semua tab.", 403);
    next.tabs = cekTabs(patch.tabs);
    kolom.tabs = next.tabs; // hanya ditulis bila memang diubah
  }

  const { error } = await db()
    .from(TABLE)
    .update({ nama: next.nama, hash: next.hash, ver: next.ver, ...kolom })
    .eq("id", cur.id);
  if (error) fail("Gagal memperbarui user", error);
  return toPublic(next);
}

export async function removeUser(id: string): Promise<void> {
  const target = id.trim().toLowerCase();
  if (target === MAIN_ID) throw new UserError("Akun utama tidak bisa dihapus.", 403);
  const cur = await findRow(target);
  if (!cur) throw new UserError("User tidak ditemukan.", 404);

  const { error } = await db().from(TABLE).delete().eq("id", target);
  if (error) fail("Gagal menghapus user", error);
}
