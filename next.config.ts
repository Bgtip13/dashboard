import type { NextConfig } from "next";

// Origin tambahan untuk dev server, mis. NEXT_DEV_ALLOWED_ORIGINS="preview.example.dev"
// (dipisah koma). Kosong = hanya localhost, sesuai perilaku bawaan Next.js.
const devOrigins = (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins.length > 0 ? devOrigins : undefined,
};

export default nextConfig;
