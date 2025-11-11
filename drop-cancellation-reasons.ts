import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:@0dJ2m0q82320@206.183.129.145:5432/fretus-dev',
  ssl: false
});

async function dropTable() {
  try {
    console.log('Conectando ao banco de dados...');

    const result = await pool.query(`
      DROP TABLE IF EXISTS cancellation_reasons CASCADE
    `);

    console.log('✓ Tabela cancellation_reasons removida com sucesso!');

    // Verificar se a tabela foi removida
    const check = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'cancellation_reasons'
    `);

    if (check.rows.length === 0) {
      console.log('✓ Confirmado: tabela cancellation_reasons não existe mais');
    } else {
      console.log('⚠️ Tabela ainda existe:', check.rows);
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await pool.end();
  }
}

dropTable();
