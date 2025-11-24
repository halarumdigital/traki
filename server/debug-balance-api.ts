import dotenv from "dotenv";
dotenv.config();

async function debugBalanceApi() {
  console.log("========================================");
  console.log("🔍 Debug da API de Saldo Woovi");
  console.log("========================================\n");

  const appId = process.env.WOOVI_APP_ID;
  const apiUrl = process.env.WOOVI_API_URL || 'https://api.woovi-sandbox.com';
  const pixKey = 'compras@augustoebiancamudancasme.com.br';

  console.log("📊 Configurações:");
  console.log(`   API URL: ${apiUrl}`);
  console.log(`   APP_ID: ${appId ? appId.substring(0, 30) + '...' : 'NÃO CONFIGURADO'}`);
  console.log(`   PIX Key: ${pixKey}`);
  console.log("");

  // 1. Listar subcontas para ver se existe
  console.log("📋 1. Listando subcontas...");
  try {
    const listResponse = await fetch(`${apiUrl}/api/v1/subaccount`, {
      method: 'GET',
      headers: {
        'Authorization': appId!,
        'Content-Type': 'application/json',
      },
    });

    const listData = await listResponse.json();
    console.log(`   Status: ${listResponse.status}`);
    console.log(`   Subcontas encontradas: ${listData.subAccounts?.length || 0}`);

    if (listData.subAccounts && listData.subAccounts.length > 0) {
      listData.subAccounts.forEach((sub: any, i: number) => {
        console.log(`   ${i+1}. ${sub.name} - PIX: ${sub.pixKey} - Saldo: ${sub.balance}`);
      });
    }
  } catch (error: any) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // 2. Buscar saldo da subconta específica
  console.log("\n📊 2. Buscando saldo da subconta específica...");
  try {
    const balanceUrl = `${apiUrl}/api/v1/subaccount/${encodeURIComponent(pixKey)}`;
    console.log(`   URL: ${balanceUrl}`);

    const balanceResponse = await fetch(balanceUrl, {
      method: 'GET',
      headers: {
        'Authorization': appId!,
        'Content-Type': 'application/json',
      },
    });

    console.log(`   Status: ${balanceResponse.status}`);
    const balanceData = await balanceResponse.json();
    console.log(`   Resposta: ${JSON.stringify(balanceData, null, 2)}`);

    if (balanceData.SubAccount) {
      console.log(`\n   ✅ Saldo: R$ ${(balanceData.SubAccount.balance / 100).toFixed(2)}`);
    } else if (balanceData.subAccount) {
      console.log(`\n   ✅ Saldo: R$ ${(balanceData.subAccount.balance / 100).toFixed(2)}`);
    } else {
      console.log(`\n   ⚠️ Formato de resposta inesperado`);
    }
  } catch (error: any) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // 3. Verificar webhooks
  console.log("\n📡 3. Verificando webhooks...");
  try {
    const webhooksResponse = await fetch(`${apiUrl}/api/openpix/v1/webhook`, {
      method: 'GET',
      headers: {
        'Authorization': appId!,
        'Content-Type': 'application/json',
      },
    });

    console.log(`   Status: ${webhooksResponse.status}`);
    const webhooksData = await webhooksResponse.json();

    if (webhooksData.webhooks && webhooksData.webhooks.length > 0) {
      console.log(`   ✅ ${webhooksData.webhooks.length} webhook(s) encontrado(s):`);
      webhooksData.webhooks.forEach((wh: any, i: number) => {
        console.log(`   ${i+1}. ${wh.name}`);
        console.log(`      URL: ${wh.url}`);
        console.log(`      Ativo: ${wh.isActive ? 'Sim' : 'Não'}`);
        console.log(`      Evento: ${wh.event || 'N/A'}`);
      });
    } else {
      console.log(`   ❌ Nenhum webhook encontrado`);
    }
  } catch (error: any) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // 4. Verificar cobranças recentes
  console.log("\n💰 4. Verificando cobranças recentes...");
  try {
    const chargesResponse = await fetch(`${apiUrl}/api/v1/charge?start=2025-11-01&end=2025-11-30`, {
      method: 'GET',
      headers: {
        'Authorization': appId!,
        'Content-Type': 'application/json',
      },
    });

    console.log(`   Status: ${chargesResponse.status}`);
    const chargesData = await chargesResponse.json();

    if (chargesData.charges && chargesData.charges.length > 0) {
      console.log(`   ✅ ${chargesData.charges.length} cobrança(s) encontrada(s):`);
      chargesData.charges.slice(0, 5).forEach((ch: any, i: number) => {
        console.log(`   ${i+1}. ${ch.correlationID}`);
        console.log(`      Valor: R$ ${(ch.value / 100).toFixed(2)}`);
        console.log(`      Status: ${ch.status}`);
      });
    } else {
      console.log(`   ❌ Nenhuma cobrança encontrada`);
    }
  } catch (error: any) {
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

debugBalanceApi()
  .then(() => {
    console.log("\n✅ Debug finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
