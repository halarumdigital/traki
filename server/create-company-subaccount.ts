import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Configuração da Woovi
const WOOVI_APP_ID = process.env.WOOVI_APP_ID;
const WOOVI_API_URL = process.env.WOOVI_API_URL || 'https://api.woovi.com';

async function createSubaccount() {
  console.log("========================================");
  console.log("🚀 Criação de Subconta para Empresa");
  console.log("========================================\n");

  // Dados da empresa (Diego e Edson Doces & Salgados)
  const companyData = {
    name: "Diego e Edson Doces & Salgados Ltda",
    pixKey: "producao@diegoeedsondocessalgadosltda.com.br",
    pixKeyType: "EMAIL"
  };

  console.log("📊 Dados da empresa:");
  console.log(`   Nome: ${companyData.name}`);
  console.log(`   PIX: ${companyData.pixKey}`);
  console.log(`   Tipo: ${companyData.pixKeyType}\n`);

  if (!WOOVI_APP_ID) {
    console.error("❌ WOOVI_APP_ID não está configurado no arquivo .env");
    process.exit(1);
  }

  console.log("🔑 WOOVI_APP_ID configurado");
  console.log(`📡 API URL: ${WOOVI_API_URL}\n`);

  try {
    // Primeiro, vamos listar as subcontas existentes
    console.log("📋 Listando subcontas existentes...");

    const listResponse = await fetch(`${WOOVI_API_URL}/api/v1/subaccount/list`, {
      method: 'GET',
      headers: {
        'Authorization': WOOVI_APP_ID,
        'Content-Type': 'application/json',
      }
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      console.log(`   Total de subcontas: ${listData.subAccounts?.length || 0}`);

      // Verificar se já existe
      const exists = listData.subAccounts?.some((sub: any) =>
        sub.pixKey === companyData.pixKey
      );

      if (exists) {
        console.log(`   ✅ Subconta já existe para: ${companyData.pixKey}`);
        return;
      }
    }

    // Criar a subconta
    console.log("\n📝 Criando subconta na Woovi...");

    const createPayload = {
      name: companyData.name,
      pixKey: companyData.pixKey,
      pixKeyType: companyData.pixKeyType
    };

    console.log("   Payload:", JSON.stringify(createPayload, null, 2));

    const createResponse = await fetch(`${WOOVI_API_URL}/api/v1/subaccount`, {
      method: 'POST',
      headers: {
        'Authorization': WOOVI_APP_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createPayload)
    });

    const responseText = await createResponse.text();
    console.log(`   Status: ${createResponse.status}`);
    console.log(`   Response: ${responseText}`);

    if (createResponse.ok) {
      const data = JSON.parse(responseText);
      console.log("\n✅ Subconta criada com sucesso!");
      console.log(`   ID: ${data.subAccount?.id || 'N/A'}`);
      console.log(`   Nome: ${data.subAccount?.name}`);
      console.log(`   PIX: ${data.subAccount?.pixKey}`);
    } else {
      console.error("\n❌ Erro ao criar subconta:");
      console.error(`   Status: ${createResponse.status}`);
      console.error(`   Erro: ${responseText}`);

      // Se o erro for que já existe, não é problema
      if (responseText.includes('already exists') || responseText.includes('já existe')) {
        console.log("\n✅ Subconta já existe na Woovi (ignorando erro)");
      }
    }

  } catch (error) {
    console.error("\n❌ Erro durante o processo:", error);
    process.exit(1);
  }
}

// Executar
createSubaccount()
  .then(() => {
    console.log("\n✅ Processo finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });