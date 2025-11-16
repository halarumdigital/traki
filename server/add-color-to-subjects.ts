import { pool } from "./db";

async function addColorColumn() {
  try {
    console.log("🔄 Adicionando coluna color na tabela ticket_subjects...");

    await pool.query(`
      ALTER TABLE ticket_subjects
      ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '#3b82f6';
    `);

    console.log("✅ Coluna color adicionada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao adicionar coluna:", error);
    process.exit(1);
  }
}

addColorColumn();
