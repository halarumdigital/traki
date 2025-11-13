import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:@0dJ2m0q82320@206.183.129.145:5432/fretus-dev'
});

async function addDeviceIdColumn() {
  try {
    console.log('📦 Adicionando coluna device_id na tabela drivers...');

    // Adicionar a coluna device_id
    await pool.query(`
      ALTER TABLE drivers
      ADD COLUMN IF NOT EXISTS device_id VARCHAR(255)
    `);

    console.log('✅ Coluna device_id adicionada com sucesso!');

    // Verificar se a coluna foi criada
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'drivers' AND column_name = 'device_id'
    `);

    if (result.rows.length > 0) {
      console.log('📊 Detalhes da coluna:');
      console.log('  - Nome:', result.rows[0].column_name);
      console.log('  - Tipo:', result.rows[0].data_type);
      console.log('  - Tamanho máximo:', result.rows[0].character_maximum_length);
    }

  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error.message);
  } finally {
    await pool.end();
  }
}

addDeviceIdColumn().catch(console.error);