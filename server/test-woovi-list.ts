import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

async function testWooviList() {
  const appId = process.env.WOOVI_APP_ID;
  const isProduction = process.env.WOOVI_PRODUCTION === 'true';
  const apiUrl = isProduction
    ? 'https://api.woovi.com'
    : 'https://api.woovi-sandbox.com';

  console.log("========================================");
  console.log("🔍 Testando API Woovi - Listar Subcontas");
  console.log("========================================\n");
  console.log("🌍 Ambiente:", isProduction ? "PRODUÇÃO" : "SANDBOX");
  console.log("🔑 APP ID:", appId ? "Configurado" : "NÃO CONFIGURADO");
  console.log("🌐 URL:", apiUrl);

  if (!appId) {
    console.error("❌ WOOVI_APP_ID não configurado!");
    return;
  }

  try {
    // Testar listagem de subcontas
    console.log("\n📋 Listando subcontas...");
    const url = `${apiUrl}/api/v1/subaccount/list?skip=0&limit=100`;
    console.log("   URL:", url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': appId,
        'Content-Type': 'application/json',
      },
    });

    console.log("   Status:", response.status, response.statusText);

    const text = await response.text();
    console.log("\n📝 Resposta bruta:", text);

    try {
      const data = JSON.parse(text);

      if (data.subAccounts) {
        console.log(`\n✅ Encontradas ${data.subAccounts.length} subcontas:\n`);
        data.subAccounts.forEach((sub: any, index: number) => {
          console.log(`${index + 1}. ${sub.name}`);
          console.log(`   PIX: ${sub.pixKey}`);
          console.log(`   Saldo: R$ ${(sub.balance / 100).toFixed(2)}`);
        });
      } else if (data.error) {
        console.log("\n⚠️ Erro retornado pela API:", data.error);
      } else {
        console.log("\n📊 Resposta:", JSON.stringify(data, null, 2));
      }
    } catch (parseError) {
      console.log("\n❌ Erro ao fazer parse do JSON");
    }
  } catch (error) {
    console.error("\n❌ Erro na requisição:", error);
  }
}

testWooviList()
  .then(() => {
    console.log("\n✅ Teste finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });