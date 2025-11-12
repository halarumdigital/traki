import { pool } from "./server/db";

async function applyMigration() {
  try {
    console.log("Aplicando migração de avaliações de motoristas sobre empresas...");

    // Criar tabela driver_company_ratings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_company_ratings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id VARCHAR NOT NULL REFERENCES requests(id),
        driver_id VARCHAR NOT NULL REFERENCES drivers(id),
        company_id VARCHAR NOT NULL REFERENCES companies(id),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Tabela driver_company_ratings criada");

    // Adicionar campos de rating na tabela companies
    await pool.query(`
      ALTER TABLE companies
      ALTER COLUMN rating TYPE VARCHAR(10),
      ALTER COLUMN rating SET DEFAULT '0';
    `);
    console.log("✓ Coluna rating alterada na tabela companies");

    await pool.query(`
      ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS rating_total VARCHAR(10) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS no_of_ratings INTEGER DEFAULT 0;
    `);
    console.log("✓ Colunas rating_total e no_of_ratings adicionadas à tabela companies");

    console.log("\n✅ Migração aplicada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao aplicar migração:", error);
    process.exit(1);
  }
}

applyMigration();
