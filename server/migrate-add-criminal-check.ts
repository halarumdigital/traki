import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🔄 Adicionando colunas de consulta criminal na tabela drivers...");

  try {
    // Adicionar colunas de consulta criminal
    await db.execute(sql`
      ALTER TABLE drivers
      ADD COLUMN IF NOT EXISTS has_criminal_records BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS criminal_records JSON,
      ADD COLUMN IF NOT EXISTS criminal_check_date TIMESTAMP;
    `);

    console.log("✅ Colunas adicionadas com sucesso!");
    console.log("   - has_criminal_records: BOOLEAN DEFAULT false");
    console.log("   - criminal_records: JSON");
    console.log("   - criminal_check_date: TIMESTAMP");
  } catch (error) {
    console.error("❌ Erro ao adicionar colunas:", error);
    throw error;
  }

  process.exit(0);
}

migrate().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
