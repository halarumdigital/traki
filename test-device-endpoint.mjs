import fetch from 'node-fetch';

async function testDeviceEndpoint() {
  console.log('🔧 Testando endpoint de device_id...\n');

  // Configurações do teste
  const API_URL = 'http://localhost:5010/api';
  const driverId = 'fdf79e54-71d9-4524-82ce-ed808ea03afb'; // ID real do motorista Silva silva
  const deviceId = 'IMEI_TEST_123456789'; // IMEI de teste

  try {
    // Teste 1: Enviar device_id
    console.log('📱 Enviando device_id para o motorista...');
    const response = await fetch(`${API_URL}/drivers/${driverId}/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: deviceId
      })
    });

    const result = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Device ID salvo com sucesso!');
      console.log(`   Driver ID: ${result.data?.driverId}`);
      console.log(`   Device ID: ${result.data?.deviceId}`);
    } else {
      console.log('❌ Erro ao salvar device ID:', result.message);
    }

    // Teste 2: Enviar sem device_id (deve retornar erro)
    console.log('\n📱 Testando sem device_id (deve falhar)...');
    const errorResponse = await fetch(`${API_URL}/drivers/${driverId}/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    const errorResult = await errorResponse.json();
    console.log('Status:', errorResponse.status);
    console.log('Response:', JSON.stringify(errorResult, null, 2));

    if (errorResponse.status === 400) {
      console.log('✅ Validação funcionando corretamente!');
    }

    // Teste 3: Enviar para motorista inexistente
    console.log('\n📱 Testando com motorista inexistente...');
    const notFoundResponse = await fetch(`${API_URL}/drivers/motorista-inexistente/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: 'IMEI_TEST_999'
      })
    });

    const notFoundResult = await notFoundResponse.json();
    console.log('Status:', notFoundResponse.status);
    console.log('Response:', JSON.stringify(notFoundResult, null, 2));

    if (notFoundResponse.status === 404) {
      console.log('✅ Tratamento de motorista não encontrado funcionando!');
    }

  } catch (error) {
    console.error('❌ Erro ao testar endpoint:', error);
  }
}

// Executar teste
testDeviceEndpoint().catch(console.error);