import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:@0dJ2m0q82320@206.183.129.145:5432/fretus-dev'
});

async function verifyDeviceId() {
  try {
    const result = await pool.query(`
      SELECT id, name, mobile, device_id
      FROM drivers
      WHERE id = 'fdf79e54-71d9-4524-82ce-ed808ea03afb'
    `);

    if (result.rows.length > 0) {
      const driver = result.rows[0];
      console.log('✅ Dados do motorista após atualização:');
      console.log('  - ID:', driver.id);
      console.log('  - Nome:', driver.name);
      console.log('  - Telefone:', driver.mobile);
      console.log('  - Device ID (IMEI):', driver.device_id || '(vazio)');
    }
  } catch (error) {
    console.error('Erro ao verificar device_id:', error);
  } finally {
    await pool.end();
  }
}

verifyDeviceId().catch(console.error);