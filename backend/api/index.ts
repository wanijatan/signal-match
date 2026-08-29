// @ts-expect-error
import { createApp } from "../dist/app.js";

// Vercel serverless entrypoint. Imports the pre-compiled output (built by
// `npm run build`, which vercel.json's buildCommand runs before functions
// are packaged) rather than the .ts source directly — this avoids relying
// on the platform's TS bundler to correctly resolve NodeNext-style ".js"
// specifiers against sibling .ts files, which isn't guaranteed everywhere.
// vercel.json rewrites every request path to this function while
// preserving the original req.url, so the Express app's own /api/* route
// mounting still works unchanged.
const app = createApp();

export default app;
