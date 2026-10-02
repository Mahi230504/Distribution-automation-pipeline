import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const valid={NEXT_PUBLIC_API_URL:"https://backend.example.com",NEXT_PUBLIC_AUTH_MODE:"supabase",NEXT_PUBLIC_SUPABASE_URL:"https://project.supabase.co",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"publishable-browser-key-value"};
function run(overrides:Record<string,string|undefined>={}){const env={...process.env,...valid} as NodeJS.ProcessEnv;for(const[key,value]of Object.entries(overrides))if(value===undefined)delete env[key];else env[key]=value;return spawnSync(process.execPath,["scripts/validate-public-env.mjs"],{cwd:process.cwd(),env,encoding:"utf8"});}

test("production public configuration validator accepts only complete browser-safe values",()=>{assert.equal(run().status,0);const missing=run({NEXT_PUBLIC_API_URL:undefined});assert.notEqual(missing.status,0);assert.match(missing.stderr,/NEXT_PUBLIC_API_URL is missing/);assert.notEqual(run({NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"__REQUIRED_KEY__"}).status,0);assert.notEqual(run({NEXT_PUBLIC_AUTH_MODE:"local"}).status,0);assert.notEqual(run({NEXT_PUBLIC_API_URL:"http://backend.example.com"}).status,0);assert.notEqual(run({NEXT_PUBLIC_SUPABASE_URL:"https://project.supabase.co/path"}).status,0);});
