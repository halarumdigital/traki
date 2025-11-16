import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

async function migrateScheduledAt() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Adicionando coluna scheduled_at na tabela requests...");

    await pool.query(`
      ALTER TABLE requests
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;
    `);

    console.log("✅ Coluna scheduled_at adicionada com sucesso!");

    // Verificar se a coluna foi criada
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'requests' AND column_name = 'scheduled_at';
    `);

    if (result.rows.length > 0) {
      console.log("✅ Verificação: Coluna encontrada no banco de dados");
      console.log(`   - Nome: ${result.rows[0].column_name}`);
      console.log(`   - Tipo: ${result.rows[0].data_type}`);
    } else {
      console.log("⚠️ Coluna não encontrada após migração");
    }
  } catch (error) {
    console.error("❌ Erro na migração:", error);
  } finally {
    await pool.end();
  }
}

migrateScheduledAt();
