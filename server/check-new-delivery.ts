import { db } from './db';
import { requests, requestBills, drivers, wooviSubaccounts, financialTransactions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

async function checkDelivery() {
  const requestNumber = 'REQ-1764086699771-57';

  console.log('=== Verificando Entrega', requestNumber, '===\n');

  // 1. Buscar a entrega
  const [request] = await db
    .select()
    .from(requests)
    .where(eq(requests.requestNumber, requestNumber))
    .limit(1);

  if (!request) {
    console.log('❌ Entrega não encontrada');
    process.exit(0);
  }

  console.log('✅ Entrega encontrada:');
  console.log('   ID:', request.id);
  console.log('   Motorista ID:', request.driverId);
  console.log('   Empresa ID:', request.companyId);
  console.log('   Is Completed:', request.isCompleted);
  console.log('   Completed At:', request.completedAt);

  // 2. Buscar bill
  const [bill] = await db
    .select()
    .from(requestBills)
    .where(eq(requestBills.requestId, request.id))
    .limit(1);

  console.log('\n=== Bill ===');
  if (bill) {
    console.log('✅ Bill encontrada:');
    console.log('   Total Amount:', bill.totalAmount);
  } else {
    console.log('❌ Bill NÃO encontrada');
  }

  // 3. Verificar transações financeiras para esta entrega
  console.log('\n=== Transações Financeiras ===');
  const transactions = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.requestId, request.id))
    .orderBy(desc(financialTransactions.createdAt));

  if (transactions.length === 0) {
    console.log('❌ Nenhuma transação encontrada para esta entrega');
  } else {
    console.log('Total:', transactions.length, 'transações');
    for (const t of transactions) {
      console.log('  -', t.type, '|', t.status, '| R$', t.amount, '|', t.description);
      if (t.errorMessage) {
        console.log('    ERRO:', t.errorMessage);
      }
    }
  }

  // 4. Verificar subconta do motorista
  if (request.driverId) {
    const [driverSub] = await db
      .select()
      .from(wooviSubaccounts)
      .where(eq(wooviSubaccounts.driverId, request.driverId))
      .limit(1);

    console.log('\n=== Subconta Motorista ===');
    if (driverSub) {
      console.log('✅ Subconta:', driverSub.pixKey);
      console.log('   Saldo:', driverSub.balanceCache, 'centavos');
    } else {
      console.log('❌ Motorista não tem subconta');
    }
  }

  process.exit(0);
}

checkDelivery();
