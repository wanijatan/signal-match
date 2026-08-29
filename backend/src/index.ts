import { createApp } from "./app.js";
import { env } from "./utils/env.js";

// Local/traditional-Node entrypoint. On Vercel, api/index.ts imports
// createApp() directly instead — see that file for the serverless entry.
const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Signal Match API listening on :${env.PORT} (${env.NODE_ENV})`);
  console.log(`AI matching: ${env.AI_MATCHING_ENABLED ? "enabled" : "disabled (deterministic fallback)"}`);
});
