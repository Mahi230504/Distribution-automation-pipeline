const required = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_AUTH_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

const failures = [];
for (const name of required) {
  const value = process.env[name]?.trim() ?? "";
  if (!value || /^__REQUIRED_|^<.+>$/.test(value)) failures.push(`${name} is missing or still a placeholder`);
}
if (process.env.NEXT_PUBLIC_AUTH_MODE !== "supabase")
  failures.push("NEXT_PUBLIC_AUTH_MODE must be supabase for a production build");
for (const name of ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  const value = process.env[name];
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      failures.push(`${name} must be an HTTPS origin without credentials, path, query or fragment`);
  } catch { failures.push(`${name} must be an absolute HTTPS origin`); }
}
if ((process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.length ?? 0) < 20)
  failures.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a usable browser publishable key");

if (failures.length) {
  console.error("Production frontend configuration is incomplete:");
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Production frontend public configuration is present.");
