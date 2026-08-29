import { createClient } from "@supabase/supabase-js";
import { env } from "../utils/env.js";

// The backend always uses the service role key. It is never sent to the
// frontend and RLS is bypassed intentionally — authorization is enforced in
// application code (see middleware/auth.ts) based on the verified Clerk
// session, not on anything the client claims about itself.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
