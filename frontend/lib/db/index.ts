import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy frontend/.env.example to frontend/.env.local and fill in your Neon connection string."
  );
}
const sql = neon(databaseUrl);
export const db = drizzle({ client: sql });
