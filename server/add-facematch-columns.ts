import { db } from "./db";
import { sql } from "drizzle-orm";

async function addFaceMatchColumns() {
  try {
    console.log("Adicionando colunas de FaceMatch à tabela driver_documents...");

    await db.execute(sql`
      ALTER TABLE driver_documents
      ADD COLUMN IF NOT EXISTS face_match_score real,
      ADD COLUMN IF NOT EXISTS face_match_validated boolean,
      ADD COLUMN IF NOT EXISTS face_match_data json
    `);

    console.log("✅ Colunas adicionadas com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao adicionar colunas:", error);
    process.exit(1);
  }
}

addFaceMatchColumns();
