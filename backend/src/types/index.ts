export type SignalStatus = "pending_moderation" | "active" | "paused" | "flagged" | "deleted" | "expired";
export type ModerationStatus = "pending" | "approved" | "flagged" | "rejected";
export type MatchType = "direct" | "reciprocal" | "one_way";
export type Confidence = "strong" | "good" | "potential";
export type MatchStatus =
  | "pending"
  | "viewed"
  | "interested_a"
  | "interested_b"
  | "mutual"
  | "rejected"
  | "expired";

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  email_verified: boolean;
  status: "active" | "suspended" | "deleted";
  created_at: string;
  last_active_at: string;
  updated_at: string;
}

export interface Signal {
  id: string;
  user_id: string;
  looking_for: string;
  can_offer: string;
  location: string | null;
  normalized_looking_for: string | null;
  normalized_can_offer: string | null;
  looking_embedding: number[] | null;
  offer_embedding: number[] | null;
  status: SignalStatus;
  moderation_status: ModerationStatus;
  referral_code: string | null;
  looking_for_expires_at: string;
  can_offer_expires_at: string;
  looking_for_active: boolean;
  can_offer_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  signal_a_id: string;
  signal_b_id: string;
  forward_score: number;
  reverse_score: number | null;
  location_score: number;
  overall_score: number;
  match_type: MatchType;
  confidence: Confidence;
  explanation: string;
  token: string;
  status: MatchStatus;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedUser {
  clerkUserId: string;
  databaseUserId: string;
  email: string;
}

// Extends Express's Request via declaration merging (see middleware/auth.ts)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}
