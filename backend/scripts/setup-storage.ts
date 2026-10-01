import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.storage.getBucket("vpo-private");
if (error && !/not found/i.test(error.message)) throw error;
if (!data) {
  const created = await client.storage.createBucket("vpo-private", { public: false, fileSizeLimit: 6 * 1024 * 1024, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "video/mp4"] });
  if (created.error) throw created.error;
} else {
  const updated = await client.storage.updateBucket("vpo-private", { public: false, fileSizeLimit: 6 * 1024 * 1024, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "video/mp4"] });
  if (updated.error) throw updated.error;
}
console.log("Private vpo-private bucket is ready.");
