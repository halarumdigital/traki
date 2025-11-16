import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log para debug - verificar qual banco está sendo usado
console.log("\n===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split('/').pop()?.split('?')[0];
console.log("📊 Conectando ao banco:", dbName);
if (dbName !== 'fretus-dev') {
  console.error("⚠️  ERRO: Conectando ao banco ERRADO! Deveria ser 'fretus-dev'");
  console.error("⚠️  Banco atual:", dbName);
}
console.log("===========================================\n");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

export const db = drizzle(pool, { schema });
