// Usando fetch nativo do Node.js 18+

const BASE_URL = 'http://localhost:5010';

// Simular login do motorista ze8@gmail.com
async function testDriverLogin() {
  console.log('🔐 Testando login do motorista ze8@gmail.com...\n');

  try {
    // 1. Fazer login
    const loginResponse = await fetch(`${BASE_URL}/api/v1/driver/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'ze8@gmail.com',
        password: '123456' // Ajuste a senha se necessário
      })
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.error('❌ Erro no login:', loginData.message);
      return;
    }

    console.log('✅ Login realizado com sucesso!');
    console.log('📋 Dados retornados no login:');
    console.log('   Nome:', loginData.data?.name);
    console.log('   Email:', loginData.data?.email);
    console.log('   🎫 Código de Indicação:', loginData.data?.referralCode || 'NÃO RETORNADO');
    console.log('   Total de Entregas:', loginData.data?.totalDeliveries);

    const accessToken = loginData.accessToken;
    console.log('\n🔑 Token de acesso obtido');

    // 2. Buscar perfil
    console.log('\n📱 Testando endpoint /api/v1/driver/profile...');
    const profileResponse = await fetch(`${BASE_URL}/api/v1/driver/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const profileData = await profileResponse.json();

    if (profileData.success) {
      console.log('✅ Perfil obtido com sucesso!');
      console.log('📋 Dados do perfil:');
      console.log('   Nome:', profileData.data?.name);
      console.log('   Email:', profileData.data?.email);
      console.log('   🎫 Código de Indicação:', profileData.data?.referralCode || 'NÃO RETORNADO');
      console.log('   Total de Entregas:', profileData.data?.totalDeliveries);
    } else {
      console.error('❌ Erro ao buscar perfil:', profileData.message);
    }

    // 3. Buscar indicações
    console.log('\n💰 Testando endpoint /api/v1/driver/my-referrals...');
    const referralsResponse = await fetch(`${BASE_URL}/api/v1/driver/my-referrals`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const referralsData = await referralsResponse.json();

    if (referralsData.success) {
      console.log('✅ Indicações obtidas com sucesso!');
      console.log('📋 Dados de indicações:');
      console.log('   🎫 MEU CÓDIGO:', referralsData.data?.myReferralCode || 'NÃO RETORNADO');
      console.log('   Total de Indicações:', referralsData.data?.totals?.totalReferrals || 0);
      console.log('   Configurações:', referralsData.data?.settings);
    } else {
      console.error('❌ Erro ao buscar indicações:', referralsData.message);
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
}

// Executar teste
testDriverLogin();