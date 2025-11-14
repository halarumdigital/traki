import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5010';

async function testReferralsAPI() {
  try {
    // 1. Login
    console.log('🔐 Fazendo login...');
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

    console.log('✅ Login realizado com sucesso');

    // 2. Buscar indicações
    console.log('\n📊 Buscando indicações...');
    const referralsResponse = await fetch(`${BASE_URL}/api/referrals`, {
      headers: { 'Cookie': cookies }
    });

    const referrals = await referralsResponse.json();

    if (!Array.isArray(referrals)) {
      console.error('❌ Resposta não é um array:', referrals);
      return;
    }

    console.log(`\n✅ Total de indicações encontradas: ${referrals.length}\n`);

    // 3. Verificar campos de cada indicação
    if (referrals.length > 0) {
      console.log('🔍 Verificando primeiras indicações:\n');

      referrals.slice(0, 3).forEach((ref, index) => {
        console.log(`--- Indicação ${index + 1} ---`);
        console.log(`ID: ${ref.id}`);
        console.log(`Indicador (referrerName): ${ref.referrerName}`);
        console.log(`Indicado (referredName): ${ref.referredName}`);
        console.log(`Email indicado: ${ref.referredEmail}`);
        console.log(`CPF indicado: ${ref.referredCpf}`);
        console.log(`Cidade indicado: ${ref.referredCity}`);
        console.log(`Entregas: ${ref.deliveriesCompleted}/${ref.deliveriesRequired}`);
        console.log(`Comissão paga: ${ref.commissionPaid}`);
        console.log(`Status: ${ref.status}`);
        console.log('');
      });

      // 4. Verificar se há campos faltando
      const firstRef = referrals[0];
      const requiredFields = [
        'id', 'referrerId', 'referrerName', 'referrerEmail', 'referrerCpf',
        'referredId', 'referredName', 'referredEmail', 'referredCpf',
        'deliveriesCompleted', 'deliveriesRequired', 'commissionPaid', 'commissionAmount'
      ];

      console.log('🔍 Verificando campos obrigatórios:');
      const missingFields = requiredFields.filter(field => !(field in firstRef));

      if (missingFields.length > 0) {
        console.log(`❌ Campos faltando: ${missingFields.join(', ')}`);
      } else {
        console.log('✅ Todos os campos estão presentes');
      }

      // 5. Verificar se referredName tem valor válido
      console.log('\n🔍 Verificando valores de referredName:');
      const invalidNames = referrals.filter(ref =>
        !ref.referredName || ref.referredName === 'N/A' || ref.referredName.trim() === ''
      );

      if (invalidNames.length > 0) {
        console.log(`⚠️  ${invalidNames.length} indicações com referredName inválido ou N/A`);
        console.log('IDs afetados:', invalidNames.map(r => r.id).join(', '));
      } else {
        console.log('✅ Todos os referredName têm valores válidos');
      }

    } else {
      console.log('⚠️  Nenhuma indicação encontrada no banco');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testReferralsAPI();
