import { db } from './db';
import { companies, drivers, wooviSubaccounts, viagensIntermunicipais, entregasIntermunicipais, financialTransactions, viagemEntregas, requests, requestBills } from '@shared/schema';
import { eq, and, desc, or, like } from 'drizzle-orm';

async function checkPaymentDebug() {
  try {
    // Verificar entrega específica na tabela REQUESTS (corridas urbanas)
    const requestNumber = 'REQ-1764082188896-462';
    console.log('=== Buscando Entrega', requestNumber, '===\n');

    // 1. Buscar a entrega na tabela requests pelo requestNumber
    const [request] = await db
      .select()
      .from(requests)
      .where(eq(requests.requestNumber, requestNumber))
      .limit(1);

    if (request) {
      console.log('✅ Entrega encontrada na tabela REQUESTS:');
      console.log('   ID:', request.id);
      console.log('   Request Number:', request.requestNumber);
      console.log('   Motorista ID:', request.driverId);
      console.log('   Empresa ID:', request.companyId);
      console.log('   Request ETA Amount:', request.requestEtaAmount);
      console.log('   Is Completed:', request.isCompleted);
      console.log('   Is Cancelled:', request.isCancelled);
      console.log('   Completed At:', request.completedAt);
      console.log('   Criada:', request.createdAt);

      // Buscar request_bills para ver o valor real
      const [bill] = await db
        .select()
        .from(requestBills)
        .where(eq(requestBills.requestId, request.id))
        .limit(1);

      console.log('\n=== Request Bills ===');
      if (bill) {
        console.log('✅ Bill encontrada:');
        console.log('   Base Price:', bill.basePrice);
        console.log('   Distance Price:', bill.distancePrice);
        console.log('   Time Price:', bill.timePrice);
        console.log('   Total Amount:', bill.totalAmount);
        console.log('   Admin Commission:', bill.adminCommision);
      } else {
        console.log('❌ PROBLEMA: Request Bills NÃO encontrada!');
        console.log('   Isso pode ser o motivo do valor estar undefined');
      }
    } else {
      console.log('❌ Entrega não encontrada na tabela requests');
    }

    // Listar últimas 10 entregas na tabela requests
    console.log('\n=== Últimas 10 entregas (tabela requests) ===');
    const ultimasRequests = await db
      .select()
      .from(requests)
      .orderBy(desc(requests.createdAt))
      .limit(10);

    for (const r of ultimasRequests) {
      console.log(`  ${r.requestNumber} | Status: ${r.status} | Motorista: ${r.driverId} | Empresa: ${r.companyId} | Valor: ${r.totalFare} | Criada: ${r.createdAt}`);
    }

    // Verificar se o motorista ze15 tem entregas
    const driverZe15Id = 'cd4dd85b-9d41-4714-b319-c6615de7b9d7';
    console.log('\n=== Entregas do motorista ze15 (tabela requests) ===');
    const requestsZe15 = await db
      .select()
      .from(requests)
      .where(eq(requests.driverId, driverZe15Id))
      .orderBy(desc(requests.createdAt))
      .limit(10);

    console.log('Total de entregas do ze15:', requestsZe15.length);
    for (const r of requestsZe15) {
      console.log(`  ${r.requestNumber} | Status: ${r.status} | Completed: ${r.isCompleted} | Valor: ${r.totalFare} | Criada: ${r.createdAt}`);
    }

    console.log('\n=== Debug de Pagamento - Halarum + ze15 ===\n');

    // 1. Buscar empresa Halarum
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.name, 'Halarum'))
      .limit(1);

    if (!company) {
      console.log('❌ Empresa Halarum não encontrada');
      process.exit(0);
    }

    console.log('✅ Empresa encontrada:');
    console.log('   ID:', company.id);
    console.log('   Nome:', company.name);
    console.log('   Email:', company.email);

    // 2. Buscar subconta da empresa
    const [companySubaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(and(
        eq(wooviSubaccounts.companyId, company.id),
        eq(wooviSubaccounts.accountType, 'company')
      ))
      .limit(1);

    console.log('\n=== Subconta da Empresa ===');
    if (!companySubaccount) {
      console.log('❌ PROBLEMA: Empresa NÃO tem subconta Woovi configurada!');
    } else {
      console.log('✅ Subconta encontrada:');
      console.log('   ID:', companySubaccount.id);
      console.log('   PixKey:', companySubaccount.pixKey);
      console.log('   Saldo Cache:', companySubaccount.balanceCache);
      console.log('   Ativa:', companySubaccount.active);
    }

    // 3. Buscar motorista ze15
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, 'ze15@gmail.com'))
      .limit(1);

    console.log('\n=== Motorista ze15 ===');
    if (!driver) {
      console.log('❌ Motorista ze15 não encontrado');
      process.exit(0);
    }

    console.log('✅ Motorista encontrado:');
    console.log('   ID:', driver.id);
    console.log('   Nome:', driver.name);
    console.log('   Email:', driver.email);

    // 4. Buscar subconta do motorista
    const [driverSubaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(and(
        eq(wooviSubaccounts.driverId, driver.id),
        eq(wooviSubaccounts.accountType, 'driver')
      ))
      .limit(1);

    console.log('\n=== Subconta do Motorista ===');
    if (!driverSubaccount) {
      console.log('❌ PROBLEMA: Motorista NÃO tem subconta Woovi configurada!');
    } else {
      console.log('✅ Subconta encontrada:');
      console.log('   ID:', driverSubaccount.id);
      console.log('   PixKey:', driverSubaccount.pixKey);
      console.log('   Saldo Cache:', driverSubaccount.balanceCache);
      console.log('   Ativa:', driverSubaccount.active);
    }

    // 5. Buscar transações financeiras relacionadas
    console.log('\n=== Transações Financeiras ===');
    const transactions = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.driverId, driver.id))
      .orderBy(desc(financialTransactions.createdAt))
      .limit(10);

    console.log('Total transações do motorista:', transactions.length);
    for (const t of transactions) {
      console.log('\n  Transação:', t.id);
      console.log('    Tipo:', t.type);
      console.log('    Status:', t.status);
      console.log('    Valor:', t.amount);
      console.log('    Descrição:', t.description);
      console.log('    Data:', t.createdAt);
      if (t.errorMessage) {
        console.log('    ❌ ERRO:', t.errorMessage);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkPaymentDebug();
