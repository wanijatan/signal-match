import { Router } from "express";
import { Webhook } from "svix";
import { supabase } from "../services/supabase.js";
import { env } from "../utils/env.js";

export const webhooksRouter = Router();

// Mounted with express.raw() in index.ts — svix needs the raw body to verify the signature.
webhooksRouter.post("/clerk", async (req, res) => {
  const payload = req.body as Buffer;
  const headers = {
    "svix-id": req.header("svix-id") ?? "",
    "svix-timestamp": req.header("svix-timestamp") ?? "",
    "svix-signature": req.header("svix-signature") ?? "",
  };

  let event: any;
  try {
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
    event = wh.verify(payload, headers);
  } catch (err) {
    console.error("Clerk webhook signature verification failed:", err);
    return res.status(400).json({ error: "Invalid webhook signature." });
  }

  try {
    switch (event.type) {
      case "user.created": {
        const clerkUserId = event.data.id as string;
        const email =
          event.data.email_addresses?.find(
            (e: any) => e.id === event.data.primary_email_address_id
          )?.email_address ?? event.data.email_addresses?.[0]?.email_address;
        if (!email) break;
        await supabase.from("users").upsert(
          {
            clerk_user_id: clerkUserId,
            email,
            email_verified: true,
            status: "active",
          },
          { onConflict: "clerk_user_id" }
        );
        break;
      }
      case "user.updated": {
        const clerkUserId = event.data.id as string;
        const email =
          event.data.email_addresses?.find(
            (e: any) => e.id === event.data.primary_email_address_id
          )?.email_address ?? event.data.email_addresses?.[0]?.email_address;
        if (!email) break;
        await supabase.from("users").update({ email }).eq("clerk_user_id", clerkUserId);
        break;
      }
      case "user.deleted": {
        const clerkUserId = event.data.id as string;
        // Soft-delete / anonymize per privacy policy, never hard-delete history.
        await supabase
          .from("users")
          .update({ status: "deleted", email: `deleted-${clerkUserId}@signal.local` })
          .eq("clerk_user_id", clerkUserId);
        await supabase
          .from("signals")
          .update({ status: "deleted" })
          .eq(
            "user_id",
            (
              await supabase
                .from("users")
                .select("id")
                .eq("clerk_user_id", clerkUserId)
                .maybeSingle()
            ).data?.id ?? ""
          );
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Error handling Clerk webhook:", err);
    res.status(500).json({ error: "Webhook handling failed." });
  }
});
