import { db } from './db';
import { requestBills } from '@shared/schema';
import { isNull, sql } from 'drizzle-orm';

async function fixRequestBillsNullValues() {
  console.log('🔧 Corrigindo valores nulos em request_bills...\n');

  try {
    // Verificar quantos registros têm valores nulos
    const nullRecords = await db
      .select()
      .from(requestBills)
      .where(isNull(requestBills.basePrice));

    console.log(`📊 Encontrados ${nullRecords.length} registros com base_price nulo\n`);

    if (nullRecords.length > 0) {
      // Atualizar registros com base_price nulo
      await db
        .update(requestBills)
        .set({
          basePrice: '0',
          baseDistance: '0',
          pricePerDistance: '0',
          distancePrice: '0',
          pricePerTime: '0',
          timePrice: '0',
          adminCommision: '0',
          adminCommisionType: 'percentage',
          totalAmount: '0',
        })
        .where(isNull(requestBills.basePrice));

      console.log(`✅ ${nullRecords.length} registros com base_price nulo atualizados`);
    }

    // Verificar e corrigir admin_commision_type nulo
    const nullCommissionType = await db
      .select()
      .from(requestBills)
      .where(isNull(requestBills.adminCommisionType));

    console.log(`\n📊 Encontrados ${nullCommissionType.length} registros com admin_commision_type nulo\n`);

    if (nullCommissionType.length > 0) {
      await db
        .update(requestBills)
        .set({
          adminCommisionType: 'percentage',
        })
        .where(isNull(requestBills.adminCommisionType));

      console.log(`✅ ${nullCommissionType.length} registros com admin_commision_type nulo atualizados`);
    } else {
      console.log('✅ Nenhum registro com admin_commision_type nulo encontrado');
    }

    console.log('\n✨ Correção concluída! Agora você pode executar: npm run db:push');
  } catch (error) {
    console.error('❌ Erro ao corrigir valores nulos:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixRequestBillsNullValues();
