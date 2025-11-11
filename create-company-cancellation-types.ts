import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:@0dJ2m0q82320@206.183.129.145:5432/fretus-dev',
  ssl: false
});

async function createTable() {
  try {
    console.log('Conectando ao banco de dados...');

    const result = await pool.query(`
      CREATE TABLE IF NOT EXISTS company_cancellation_types (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    console.log('✓ Tabela company_cancellation_types criada com sucesso!');

    // Verificar se a tabela foi criada
    const check = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'company_cancellation_types'
    `);

    console.log('Verificação:', check.rows);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

createTable();
