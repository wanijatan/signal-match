// Simple migration runner: executes every .sql file in database/migrations
// against SUPABASE_URL's Postgres connection, in filename order.
// Usage: SUPABASE_DB_URL=postgres://... npm run migrate
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "..", "database", "migrations");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Set SUPABASE_DB_URL (Supabase project settings → Database → Connection string).");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    console.log(`Running ${file}...`);
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    await client.query(sql);
  }
  console.log("Migrations complete.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
