import type { NextFunction, Request, Response } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { supabase } from "../services/supabase.js";
import { env } from "../utils/env.js";

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

/**
 * Extracts and verifies the Clerk session token from the Authorization
 * header, resolves the corresponding internal database user, and attaches
 * it to req.authenticatedUser. Never trusts any identity claims sent by the
 * client (userId/email/clerkUserId in the body are ignored for auth).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }
    const token = header.slice("Bearer ".length);

    const verified = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    const clerkUserId = verified.sub;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Invalid session." });
    }

    const { data: dbUser, error } = await supabase
      .from("users")
      .select("id, email, status")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();

    if (error) throw error;

    if (!dbUser) {
      // Defensive fallback: normally the Clerk webhook creates the user row
      // the moment they sign up. If it hasn't landed yet, create it lazily
      // using verified Clerk data (never client-supplied data).
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress;
      if (!email) {
        return res.status(400).json({ error: "No verified email on this account yet." });
      }
      const { data: created, error: createErr } = await supabase
        .from("users")
        .insert({ clerk_user_id: clerkUserId, email, email_verified: true })
        .select("id, email, status")
        .single();
      if (createErr) throw createErr;

      req.authenticatedUser = { clerkUserId, databaseUserId: created.id, email: created.email };
      return next();
    }

    if (dbUser.status !== "active") {
      return res.status(403).json({ error: "This account is not active." });
    }

    req.authenticatedUser = {
      clerkUserId,
      databaseUserId: dbUser.id,
      email: dbUser.email,
    };
    return next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Authentication failed." });
  }
}

/** Same as requireAuth, but does not reject if no session is present. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  return requireAuth(req, _res, next);
}

/** Gate for admin-only routes. Must run after requireAuth. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.authenticatedUser) {
      return res.status(401).json({ error: "Authentication required." });
    }
    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("id, role")
      .eq("clerk_user_id", req.authenticatedUser.clerkUserId)
      .maybeSingle();
    if (error) throw error;
    if (!admin) {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  } catch (err) {
    console.error("Admin check error:", err);
    return res.status(500).json({ error: "Could not verify admin access." });
  }
}
