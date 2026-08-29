// @ts-nocheck
import express, { Request, Response } from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@clerk/backend";

const app = express();

app.use(express.json());
app.use(cors());

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

app.post("/api/signals", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const token = authHeader.split(" ")[1];

    const verifiedToken = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const userId = verifiedToken.sub;
    const { lookingFor, canOffer, location } = req.body || {};

    if (!lookingFor || !canOffer) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("signals")
      .upsert(
        {
          user_id: userId,
          looking_for: lookingFor,
          can_offer: canOffer,
          location: location || "Global",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, signal: data });
  } catch (err: any) {
    console.error("Auth Error:", err);
    return res.status(401).json({ error: "Invalid token or server error" });
  }
});

export default app;
