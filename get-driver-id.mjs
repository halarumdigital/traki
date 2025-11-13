import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:@0dJ2m0q82320@206.183.129.145:5432/fretus-dev'
});

async function getFirstDriverId() {
  try {
    const result = await pool.query('SELECT id, name, mobile FROM drivers LIMIT 1');

    if (result.rows.length > 0) {
      const driver = result.rows[0];
      console.log('Motorista encontrado:');
      console.log('  ID:', driver.id);
      console.log('  Nome:', driver.name);
      console.log('  Telefone:', driver.mobile);
      return driver.id;
    } else {
      console.log('Nenhum motorista encontrado no banco de dados');
      return null;
    }
  } catch (error) {
    console.error('Erro ao buscar motorista:', error);
  } finally {
    await pool.end();
  }
}

getFirstDriverId().catch(console.error);