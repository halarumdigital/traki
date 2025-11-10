import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:@0dJ2m0q82320@206.183.129.145:5432/fretus-dev',
});

async function checkTimestamps() {
  try {
    console.log('🔍 Verificando timestamps no banco de dados\n');

    // Verificar timezone do servidor PostgreSQL
    const tzResult = await pool.query(`SHOW timezone;`);
    console.log(`⏰ Timezone do PostgreSQL: ${tzResult.rows[0].TimeZone}\n`);

    // Verificar horário atual
    const nowResult = await pool.query(`
      SELECT
        NOW() as utc_now,
        NOW() AT TIME ZONE 'America/Sao_Paulo' as brazil_now,
        CURRENT_TIMESTAMP as current_ts
    `);
    console.log('📅 Horário atual:');
    console.log(`   UTC NOW(): ${nowResult.rows[0].utc_now}`);
    console.log(`   Brazil NOW(): ${nowResult.rows[0].brazil_now}`);
    console.log(`   CURRENT_TIMESTAMP: ${nowResult.rows[0].current_ts}\n`);

    // Verificar tipo da coluna created_at
    const typeResult = await pool.query(`
      SELECT column_name, data_type, datetime_precision
      FROM information_schema.columns
      WHERE table_name = 'requests' AND column_name = 'created_at';
    `);
    console.log('📊 Tipo da coluna created_at:');
    console.log(`   ${JSON.stringify(typeResult.rows[0], null, 2)}\n`);

    // Buscar últimas entregas
    const deliveriesResult = await pool.query(`
      SELECT
        id,
        request_number,
        created_at,
        created_at AT TIME ZONE 'America/Sao_Paulo' as created_at_converted,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_formatted,
        to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') as created_at_sp_formatted,
        to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') as created_at_with_offset
      FROM requests
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('📦 Últimas entregas:');
    deliveriesResult.rows.forEach((row, idx) => {
      console.log(`\n   ${idx + 1}. ${row.request_number}`);
      console.log(`      created_at (raw): ${row.created_at}`);
      console.log(`      created_at AT TZ SP: ${row.created_at_converted}`);
      console.log(`      formatted: ${row.created_at_formatted}`);
      console.log(`      formatted SP: ${row.created_at_sp_formatted}`);
      console.log(`      with offset: ${row.created_at_with_offset}`);
    });

    console.log('\n✅ Verificação concluída');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkTimestamps();
