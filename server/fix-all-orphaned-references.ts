import { db } from './db';
import { sql } from 'drizzle-orm';

async function fixAllOrphanedReferences() {
  console.log('🔧 Corrigindo todas as referências órfãs no banco de dados...\n');

  try {
    // 1. Corrigir driver_documents
    console.log('📋 1. Verificando driver_documents...');
    const orphanedDriverDocs = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM driver_documents dd
      LEFT JOIN driver_document_types ddt ON dd.document_type_id = ddt.id
      WHERE ddt.id IS NULL
    `);

    const driverDocsCount = Number(orphanedDriverDocs.rows[0]?.count || 0);
    if (driverDocsCount > 0) {
      await db.execute(sql`
        DELETE FROM driver_documents
        WHERE document_type_id NOT IN (SELECT id FROM driver_document_types)
      `);
      console.log(`   ✅ ${driverDocsCount} driver_documents órfãos deletados`);
    } else {
      console.log('   ✅ Nenhum driver_documents órfão');
    }

    // 2. Corrigir city_prices com service_location_id vazio
    console.log('\n📋 2. Verificando city_prices...');
    const orphanedCityPrices = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM city_prices cp
      WHERE cp.service_location_id IS NULL
         OR cp.service_location_id = ''
         OR cp.service_location_id NOT IN (SELECT id FROM service_locations)
    `);

    const cityPricesCount = Number(orphanedCityPrices.rows[0]?.count || 0);
    if (cityPricesCount > 0) {
      await db.execute(sql`
        DELETE FROM city_prices
        WHERE service_location_id IS NULL
           OR service_location_id = ''
           OR service_location_id NOT IN (SELECT id FROM service_locations)
      `);
      console.log(`   ✅ ${cityPricesCount} city_prices órfãos deletados`);
    } else {
      console.log('   ✅ Nenhum city_prices órfão');
    }

    // 3. Corrigir vehicle_models
    console.log('\n📋 3. Verificando vehicle_models...');
    const orphanedVehicleModels = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM vehicle_models vm
      WHERE vm.brand_id NOT IN (SELECT id FROM brands)
    `);

    const vehicleModelsCount = Number(orphanedVehicleModels.rows[0]?.count || 0);
    if (vehicleModelsCount > 0) {
      await db.execute(sql`
        DELETE FROM vehicle_models
        WHERE brand_id NOT IN (SELECT id FROM brands)
      `);
      console.log(`   ✅ ${vehicleModelsCount} vehicle_models órfãos deletados`);
    } else {
      console.log('   ✅ Nenhum vehicle_models órfão');
    }

    // 4. Corrigir paradas órfãs (sem entrega válida)
    console.log('\n📋 4. Verificando entregas_intermunicipal_paradas órfãs...');
    const orphanedParadas = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM entregas_intermunicipal_paradas eip
      WHERE eip.entrega_id NOT IN (SELECT id FROM entregas_intermunicipais)
    `);

    const paradasCount = Number(orphanedParadas.rows[0]?.count || 0);
    if (paradasCount > 0) {
      console.log(`   ⚠️  Encontradas ${paradasCount} paradas órfãs`);
      await db.execute(sql`
        DELETE FROM entregas_intermunicipal_paradas
        WHERE entrega_id NOT IN (SELECT id FROM entregas_intermunicipais)
      `);
      console.log(`   ✅ ${paradasCount} paradas órfãs deletadas`);
    } else {
      console.log('   ✅ Nenhuma parada órfã');
    }

    // 4b. Corrigir viagem_entregas órfãs (sem entrega válida)
    console.log('\n📋 4b. Verificando viagem_entregas órfãs...');
    const orphanedViagemEntregas = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM viagem_entregas ve
      WHERE ve.entrega_id NOT IN (SELECT id FROM entregas_intermunicipais)
    `);

    const viagemEntregasCount = Number(orphanedViagemEntregas.rows[0]?.count || 0);
    if (viagemEntregasCount > 0) {
      console.log(`   ⚠️  Encontradas ${viagemEntregasCount} viagem_entregas órfãs`);
      await db.execute(sql`
        DELETE FROM viagem_entregas
        WHERE entrega_id NOT IN (SELECT id FROM entregas_intermunicipais)
      `);
      console.log(`   ✅ ${viagemEntregasCount} viagem_entregas órfãs deletadas`);
    } else {
      console.log('   ✅ Nenhuma viagem_entregas órfã');
    }

    // 5. Corrigir entregas_intermunicipais (com todas as tabelas dependentes em cascata)
    console.log('\n📋 5. Verificando entregas_intermunicipais...');
    const orphanedEntregas = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM entregas_intermunicipais ei
      WHERE ei.preco_id NOT IN (SELECT id FROM city_prices)
    `);

    const entregasCount = Number(orphanedEntregas.rows[0]?.count || 0);
    if (entregasCount > 0) {
      console.log(`   ⚠️  Encontradas ${entregasCount} entregas com preço inválido`);

      // Listar as entregas órfãs para o log
      const detailedOrphaned = await db.execute(sql`
        SELECT ei.id, ei.preco_id, ei.status
        FROM entregas_intermunicipais ei
        WHERE ei.preco_id NOT IN (SELECT id FROM city_prices)
      `);

      console.log('   📄 Entregas órfãs:');
      detailedOrphaned.rows.forEach((entrega: any) => {
        console.log(`      - ID: ${entrega.id}, preco_id: ${entrega.preco_id}, status: ${entrega.status}`);
      });

      // Primeiro, deletar viagem_entregas dessas entregas órfãs
      console.log('   🗑️  Deletando viagem_entregas das entregas órfãs...');
      await db.execute(sql`
        DELETE FROM viagem_entregas
        WHERE entrega_id IN (
          SELECT id FROM entregas_intermunicipais
          WHERE preco_id NOT IN (SELECT id FROM city_prices)
        )
      `);
      console.log(`   ✅ viagem_entregas deletadas`);

      // Segundo, deletar as paradas dessas entregas órfãs
      console.log('   🗑️  Deletando paradas das entregas órfãs...');
      await db.execute(sql`
        DELETE FROM entregas_intermunicipal_paradas
        WHERE entrega_id IN (
          SELECT id FROM entregas_intermunicipais
          WHERE preco_id NOT IN (SELECT id FROM city_prices)
        )
      `);
      console.log(`   ✅ Paradas deletadas`);

      // Finalmente, deletar as entregas órfãs
      console.log('   🗑️  Deletando entregas com preços inválidos...');
      await db.execute(sql`
        DELETE FROM entregas_intermunicipais
        WHERE preco_id NOT IN (SELECT id FROM city_prices)
      `);
      console.log(`   ✅ ${entregasCount} entregas órfãs deletadas`);
    } else {
      console.log('   ✅ Nenhuma entrega órfã');
    }

    // 6. Corrigir requests
    console.log('\n📋 6. Verificando requests...');
    const orphanedRequests = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM requests r
      WHERE (r.zone_type_id IS NOT NULL AND r.zone_type_id NOT IN (SELECT id FROM vehicle_types))
    `);

    const requestsCount = Number(orphanedRequests.rows[0]?.count || 0);
    if (requestsCount > 0) {
      // Em vez de deletar, vamos setar para NULL ou para um tipo válido
      const firstVehicleType = await db.execute(sql`SELECT id FROM vehicle_types LIMIT 1`);
      if (firstVehicleType.rows.length > 0 && firstVehicleType.rows[0].id) {
        const validVehicleTypeId = firstVehicleType.rows[0].id;
        await db.execute(sql`
          UPDATE requests
          SET zone_type_id = ${validVehicleTypeId}
          WHERE zone_type_id NOT IN (SELECT id FROM vehicle_types)
        `);
        console.log(`   ✅ ${requestsCount} requests corrigidos com vehicle_type válido`);
      }
    } else {
      console.log('   ✅ Nenhum request órfão');
    }

    console.log('\n✨ Todas as referências órfãs foram corrigidas!');
    console.log('\n🚀 Agora você pode executar: npm run db:push');
  } catch (error) {
    console.error('❌ Erro ao corrigir referências:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixAllOrphanedReferences();
