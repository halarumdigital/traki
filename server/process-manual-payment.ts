/**
 * Script para processar pagamento de entrega manualmente
 * Usado para entregas que foram concluídas antes do código de pagamento estar implementado
 */

import { db } from './db';
import { requests, requestBills, drivers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { financialService } from './services/financial.service';
import { storage } from './storage';

async function processManualPayment() {
  const requestNumber = process.argv[2] || 'REQ-1764082188896-462';

  console.log('=== Processamento Manual de Pagamento ===\n');
  console.log('Request Number:', requestNumber);

  try {
    // 1. Buscar a entrega
    const [request] = await db
      .select()
      .from(requests)
      .where(eq(requests.requestNumber, requestNumber))
      .limit(1);

    if (!request) {
      console.log('❌ Entrega não encontrada');
      process.exit(1);
    }

    console.log('\n✅ Entrega encontrada:');
    console.log('   ID:', request.id);
    console.log('   Empresa ID:', request.companyId);
    console.log('   Motorista ID:', request.driverId);
    console.log('   Request ETA Amount:', request.requestEtaAmount);
    console.log('   Is Completed:', request.isCompleted);

    if (!request.companyId) {
      console.log('❌ Entrega não possui empresa associada');
      process.exit(1);
    }

    if (!request.driverId) {
      console.log('❌ Entrega não possui motorista associado');
      process.exit(1);
    }

    // 2. Buscar o valor da entrega
    const [bill] = await db
      .select()
      .from(requestBills)
      .where(eq(requestBills.requestId, request.id))
      .limit(1);

    const deliveryAmount = bill?.totalAmount
      ? parseFloat(bill.totalAmount)
      : (request.requestEtaAmount ? parseFloat(request.requestEtaAmount) : 0);

    console.log('\n=== Valores ===');
    console.log('   Bill Total Amount:', bill?.totalAmount || 'N/A');
    console.log('   Request ETA Amount:', request.requestEtaAmount || 'N/A');
    console.log('   Valor a processar: R$', deliveryAmount.toFixed(2));

    if (deliveryAmount <= 0) {
      console.log('❌ Valor da entrega é zero ou negativo');
      process.exit(1);
    }

    // 3. Buscar comissão do motorista
    const commissionPercentage = await storage.getDriverCommissionPercentage(request.driverId);
    console.log('   Taxa de comissão:', commissionPercentage, '%');

    // 4. Processar pagamento
    console.log('\n🔄 Processando pagamento...');

    const paymentResult = await financialService.processDeliveryPayment(
      request.companyId,
      request.driverId,
      deliveryAmount,
      commissionPercentage,
      request.id
    );

    if (paymentResult.success) {
      console.log('\n✅ PAGAMENTO PROCESSADO COM SUCESSO!');
      console.log('   Valor da entrega: R$', deliveryAmount.toFixed(2));
      console.log('   Comissão do app:', paymentResult.appCommission.toFixed(2));
      console.log('   Motorista recebe: R$', paymentResult.driverReceives.toFixed(2));
    } else {
      console.log('\n❌ FALHA NO PAGAMENTO:');
      console.log('   Erro:', paymentResult.error);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  }
}

processManualPayment();
