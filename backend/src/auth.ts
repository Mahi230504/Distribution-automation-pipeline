import { createClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { settings } from "./settings.js";

export interface Principal { userId: string; email?: string; }
class AuthenticationError extends Error { status = 401; }
export type TokenVerifier = (token: string) => Promise<Principal>;

const supabase = settings.authMode === "supabase"
  ? createClient(settings.supabaseUrl, settings.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function bearer(req: Request) {
  const value = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1];
}

const verifySupabaseToken: TokenVerifier = async (token) => {
  const { data, error } = await supabase!.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId)
    throw new AuthenticationError("Your session is no longer valid. Sign in again.");
  return {
    userId,
    email: typeof data.claims.email === "string" ? data.claims.email : undefined,
  };
};

export function createAuthenticate(verify: TokenVerifier = verifySupabaseToken) {
  return async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    if (settings.authMode === "local") {
      const token = bearer(req);
      const testIdentity = process.env.NODE_ENV === "test" && token?.startsWith("test-user:")
        ? token.slice("test-user:".length)
        : null;
      req.principal = { userId: testIdentity || "local-user", email: testIdentity ? `${testIdentity}@test.invalid` : "Local fixture" };
      next();
      return;
    }
    const token = bearer(req);
    if (!token) throw new AuthenticationError("Sign in to continue.");
    req.principal = await verify(token);
    next();
  } catch (error) { next(error); }
  };
}

export const authenticate = createAuthenticate();

export function owner(req: Request) {
  if (!req.principal) throw new AuthenticationError("Sign in to continue.");
  return req.principal.userId;
}

declare global {
  namespace Express { interface Request { principal?: Principal; } }
}
