import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5010';

async function testDriverReferralsAPI() {
  try {
    // 1. Login como admin
    console.log('🔐 Fazendo login como admin...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fretus.com',
        password: 'admin123'
      })
    });

    const cookies = loginResponse.headers.get('set-cookie');
    if (!cookies) {
      console.error('❌ Falha no login - sem cookies');
      return;
    }

    console.log('✅ Login realizado com sucesso\n');

    // 2. Buscar ID do motorista ze8
    console.log('🔍 Buscando ID do motorista ze8...');
    const driversResponse = await fetch(`${BASE_URL}/api/drivers`, {
      headers: { 'Cookie': cookies }
    });

    const drivers = await driversResponse.json();
    const ze8Driver = drivers.find(d => d.name === 'ze8');

    if (!ze8Driver) {
      console.error('❌ Motorista ze8 não encontrado');
      return;
    }

    console.log(`✅ Motorista ze8 encontrado: ${ze8Driver.id}\n`);

    // 3. Buscar indicações do motorista ze8 usando o endpoint do app
    console.log('📊 Buscando indicações do motorista ze8 (endpoint do app)...');
    const referralsResponse = await fetch(`${BASE_URL}/api/drivers/${ze8Driver.id}/referrals`, {
      headers: { 'Cookie': cookies }
    });

    const data = await referralsResponse.json();

    if (!data || !data.referrals) {
      console.error('❌ Resposta inválida:', data);
      return;
    }

    const referrals = data.referrals;
    const totals = data.totals;

    console.log(`\n✅ Total de indicações encontradas: ${referrals.length}`);
    console.log(`\n📊 Totais:`);
    console.log(`   - Total ganho: R$ ${totals.totalEarned.toFixed(2)}`);
    console.log(`   - Total pago: R$ ${totals.totalPaid.toFixed(2)}`);
    console.log(`   - Total pendente: R$ ${totals.totalPending.toFixed(2)}`);
    console.log(`   - Contadores: ${JSON.stringify(totals.count, null, 2)}`);

    // 4. Verificar campos de cada indicação
    if (referrals.length > 0) {
      console.log('\n🔍 Verificando indicações:\n');

      referrals.forEach((ref, index) => {
        console.log(`--- Indicação ${index + 1} ---`);
        console.log(`ID: ${ref.id}`);
        console.log(`Indicado (referredName): ${ref.referredName}`);
        console.log(`Telefone indicado: ${ref.referredPhone}`);
        console.log(`Status: ${ref.status}`);
        console.log(`Display Status: ${ref.displayStatus}`);
        console.log(`Entregas: ${ref.deliveriesCompleted}/${ref.minimumDeliveries}`);
        console.log(`Comissão ganho: ${ref.commissionEarned}`);
        console.log(`Comissão paga: ${ref.commissionPaid}`);
        console.log('');
      });

      // 5. Verificar se referredName tem valor válido
      console.log('🔍 Verificando valores de referredName:');
      const invalidNames = referrals.filter(ref =>
        !ref.referredName || ref.referredName === 'N/A' || ref.referredName.trim() === '' || ref.referredName === 'null'
      );

      if (invalidNames.length > 0) {
        console.log(`❌ ${invalidNames.length} indicações com referredName inválido`);
        invalidNames.forEach(ref => {
          console.log(`   - ID: ${ref.id}, referredName: ${ref.referredName}`);
        });
      } else {
        console.log('✅ Todos os referredName têm valores válidos');
      }

    } else {
      console.log('⚠️  Nenhuma indicação encontrada');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  }
}

testDriverReferralsAPI();
