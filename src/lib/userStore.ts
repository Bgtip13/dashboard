/** Penyimpanan user di file JSON (khusus server). Password di-hash dengan scrypt. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

export type Role = "admin" | "user";
export interface User {
  id: string;
  nama: string;
  role: Role;
  hash: string;
  /** naik tiap password diganti, sesi lama otomatis batal */
  ver: number;
  dibuat: number;
}
export type PublicUser = Omit<User, "hash">;

export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const FILE = path.join(process.cwd(), process.env.USERS_FILE ?? ".data/users.json");
export const MAIN_ID = (process.env.ADMIN_ID ?? "bagus").trim().toLowerCase();

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

/* ---------- penyimpanan file (satu antrean agar tidak saling menimpa) ---------- */
let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}

async function writeAll(users: User[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

async function readAll(): Promise<User[]> {
  try {
    const data: unknown = JSON.parse(await fs.readFile(FILE, "utf8"));
    if (Array.isArray(data)) return data as User[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  // Pertama kali: buat akun utama dari env
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) {
    throw new Error("ADMIN_PASSWORD belum diisi di .env.local untuk membuat akun utama pertama.");
  }
  const admin: User = {
    id: MAIN_ID,
    nama: "Bagus",
    role: "admin",
    hash: await hashPassword(adminPw),
    ver: 1,
    dibuat: Date.now(),
  };
  await writeAll([admin]);
  return [admin];
}

function toPublic(u: User): PublicUser {
  return { id: u.id, nama: u.nama, role: u.role, ver: u.ver, dibuat: u.dibuat };
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

/* ---------- operasi ---------- */
export const listUsers = () =>
  withLock(async () => (await readAll()).map(toPublic).sort((a, b) => a.dibuat - b.dibuat));

export const getUser = (id: string) =>
  withLock(async () => (await readAll()).find((u) => u.id === id.toLowerCase()) ?? null);

export const authenticate = (id: string, password: string) =>
  withLock(async () => {
    const user = (await readAll()).find((u) => u.id === id.trim().toLowerCase());
    if (!user) {
      dummyHash ??= hashPassword("dummy-password");
      await verifyPassword(password, await dummyHash);
      return null;
    }
    return (await verifyPassword(password, user.hash)) ? toPublic(user) : null;
  });

export const createUser = (input: { id: string; nama: string; password: string }) =>
  withLock(async () => {
    const id = cekId(input.id);
    const password = cekPassword(input.password);
    const users = await readAll();
    if (users.some((u) => u.id === id)) throw new UserError("ID sudah dipakai.", 409);
    const baru: User = {
      id,
      nama: cekNama(input.nama, id),
      role: "user",
      hash: await hashPassword(password),
      ver: 1,
      dibuat: Date.now(),
    };
    await writeAll([...users, baru]);
    return toPublic(baru);
  });

export const updateUser = (id: string, patch: { nama?: string; password?: string }) =>
  withLock(async () => {
    const users = await readAll();
    const i = users.findIndex((u) => u.id === id.toLowerCase());
    if (i === -1) throw new UserError("User tidak ditemukan.", 404);
    const cur = users[i];
    const next: User = { ...cur };
    if (typeof patch.nama === "string") next.nama = cekNama(patch.nama, cur.id);
    if (patch.password) {
      next.hash = await hashPassword(cekPassword(patch.password));
      next.ver = cur.ver + 1; // sesi lama user ini otomatis tidak berlaku
    }
    users[i] = next;
    await writeAll(users);
    return toPublic(next);
  });

export const removeUser = (id: string) =>
  withLock(async () => {
    const target = id.toLowerCase();
    if (target === MAIN_ID) throw new UserError("Akun utama tidak bisa dihapus.", 403);
    const users = await readAll();
    if (!users.some((u) => u.id === target)) throw new UserError("User tidak ditemukan.", 404);
    await writeAll(users.filter((u) => u.id !== target));
  });