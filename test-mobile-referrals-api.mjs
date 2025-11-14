import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5010';
const DRIVER_ID = 'fd4628f2-4c11-4041-b35f-11f542ff3d20'; // ze8

async function testMobileReferralsAPI() {
  try {
    // Criar token Bearer como o app mobile faz
    const token = Buffer.from(JSON.stringify({
      id: DRIVER_ID,
      type: 'driver',
      timestamp: Date.now()
    })).toString('base64');

    console.log('📱 Testando endpoint móvel /api/v1/driver/my-referrals...');
    console.log(`🔑 Token: Bearer ${token.substring(0, 50)}...`);
    console.log('');

    const response = await fetch(`${BASE_URL}/api/v1/driver/my-referrals`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ Erro: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ Resposta indica falha:', data);
      return;
    }

    console.log('✅ Resposta recebida com sucesso\n');

    // Verificar estrutura da resposta
    console.log('📊 Estrutura da resposta:');
    console.log(`   - myReferralCode: ${data.data.myReferralCode}`);
    console.log(`   - settings: ${JSON.stringify(data.data.settings)}`);
    console.log(`   - Total de indicações: ${data.data.referrals.length}`);
    console.log(`   - Totals: ${JSON.stringify(data.data.totals, null, 2)}`);
    console.log('');

    // Verificar cada indicação
    console.log('🔍 Verificando indicações:\n');
    data.data.referrals.forEach((ref, index) => {
      console.log(`--- Indicação ${index + 1} ---`);
      console.log(`ID: ${ref.id}`);
      console.log(`referredDriverId: ${ref.referredDriverId}`);
      console.log(`referredName: ${ref.referredName}`);
      console.log(`referredPhone: ${ref.referredPhone}`);
      console.log(`status: ${ref.status}`);
      console.log(`deliveriesCompleted: ${ref.deliveriesCompleted}`);
      console.log(`commissionEarned: ${ref.commissionEarned}`);
      console.log(`commissionPaid: ${ref.commissionPaid}`);
      console.log('');
    });

    // Verificar se referredName está null
    const nullNames = data.data.referrals.filter(r => !r.referredName || r.referredName === 'null');
    if (nullNames.length > 0) {
      console.log(`❌ PROBLEMA: ${nullNames.length} indicações com referredName null/inválido:`);
      nullNames.forEach(r => {
        console.log(`   - ID: ${r.id}, referredDriverId: ${r.referredDriverId}, referredName: ${r.referredName}`);
      });
    } else {
      console.log('✅ Todos os referredName têm valores válidos!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  }
}

testMobileReferralsAPI();
