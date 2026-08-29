import { supabase } from "./supabase.js";

export async function trackEvent(
  eventName: string,
  userId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from("analytics_events")
    .insert({ event_name: eventName, user_id: userId, metadata });
  if (error) console.error(`Failed to track event "${eventName}":`, error.message);
}
