import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkReferrals() {
  try {
    console.log('🔍 Buscando dados da tabela driverReferrals...\n');

    const result = await db.execute(sql`
      SELECT
        id,
        referrer_driver_id,
        referred_driver_id,
        referred_name,
        referred_phone
      FROM driver_referrals
      WHERE referrer_driver_id = 'fd4628f2-4c11-4041-b35f-11f542ff3d20'
    `);

    console.log(`Encontrados ${result.rows.length} registros:\n`);

    result.rows.forEach((row, index) => {
      console.log(`--- Registro ${index + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`referredDriverId: ${row.referred_driver_id}`);
      console.log(`referredName (na tabela): ${row.referred_name}`);
      console.log(`referredPhone: ${row.referred_phone}`);
      console.log('');
    });

    // Buscar dados dos motoristas indicados
    console.log('\n🔍 Buscando nomes dos motoristas na tabela drivers...\n');

    for (const row of result.rows) {
      if (row.referred_driver_id) {
        const driverResult = await db.execute(sql`
          SELECT id, name, email
          FROM drivers
          WHERE id = ${row.referred_driver_id}
        `);

        if (driverResult.rows.length > 0) {
          const driver = driverResult.rows[0];
          console.log(`Motorista ${row.referred_driver_id}:`);
          console.log(`  - Nome: ${driver.name}`);
          console.log(`  - Email: ${driver.email}`);
        } else {
          console.log(`Motorista ${row.referred_driver_id}: NÃO ENCONTRADO`);
        }
      } else {
        console.log(`Registro ${row.id}: SEM referred_driver_id`);
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

checkReferrals();
