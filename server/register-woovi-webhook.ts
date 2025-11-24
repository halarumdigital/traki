import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

async function registerWooviWebhook() {
  console.log("========================================");
  console.log("🔗 Registrando Webhook na Woovi");
  console.log("========================================\n");

  const appId = process.env.WOOVI_APP_ID;
  const isProduction = process.env.WOOVI_PRODUCTION === 'true';
  const apiUrl = isProduction
    ? 'https://api.woovi.com'
    : 'https://api.woovi-sandbox.com';

  // URL do webhook - você precisa ajustar isso para sua URL pública
  const webhookUrl = process.env.WEBHOOK_URL || 'https://seu-dominio.com/api/webhooks/woovi';
  const webhookAuth = process.env.WOOVI_WEBHOOK_AUTH || 'woovi_webhook_secret_2024';

  console.log("📊 Configurações:");
  console.log(`   Ambiente: ${isProduction ? "PRODUÇÃO" : "SANDBOX"}`);
  console.log(`   API URL: ${apiUrl}`);
  console.log(`   Webhook URL: ${webhookUrl}`);
  console.log(`   Authorization: ${webhookAuth}`);

  if (!appId) {
    console.error("❌ WOOVI_APP_ID não configurado!");
    return;
  }

  if (webhookUrl === 'https://seu-dominio.com/api/webhooks/woovi') {
    console.error("❌ WEBHOOK_URL não configurado!");
    console.log("\n📝 Configure a variável de ambiente WEBHOOK_URL com sua URL pública:");
    console.log("   Exemplo: WEBHOOK_URL=https://meuapp.com/api/webhooks/woovi");
    console.log("\n💡 Para desenvolvimento local, você pode usar ngrok:");
    console.log("   1. Instale o ngrok: npm install -g ngrok");
    console.log("   2. Execute: ngrok http 3000");
    console.log("   3. Use a URL fornecida pelo ngrok");
    return;
  }

  try {
    // Primeiro, vamos listar os webhooks existentes
    console.log("\n📋 Verificando webhooks existentes...");
    const listResponse = await fetch(`${apiUrl}/api/v1/webhook`, {
      method: 'GET',
      headers: {
        'Authorization': appId,
        'Content-Type': 'application/json',
      },
    });

    if (listResponse.ok) {
      const webhooks = await listResponse.json();
      console.log(`   Total de webhooks: ${webhooks.webhooks?.length || 0}`);

      if (webhooks.webhooks && webhooks.webhooks.length > 0) {
        console.log("\n   Webhooks existentes:");
        webhooks.webhooks.forEach((wh: any, index: number) => {
          console.log(`   ${index + 1}. ${wh.name}`);
          console.log(`      URL: ${wh.url}`);
          console.log(`      Ativo: ${wh.isActive ? 'Sim' : 'Não'}`);
        });
      }
    }

    // Criar novo webhook
    console.log("\n📝 Criando novo webhook...");

    const webhookData = {
      webhook: {
        name: "Fretus - Notificações de Pagamento PIX",
        url: webhookUrl,
        authorization: webhookAuth,
        isActive: true,
        event: [
          "OPENPIX:CHARGE_COMPLETED",
          "OPENPIX:CHARGE_EXPIRED",
          "OPENPIX:CHARGE_CREATED",
          "OPENPIX:TRANSACTION_RECEIVED",
        ]
      }
    };

    console.log("\n📤 Enviando requisição:");
    console.log(JSON.stringify(webhookData, null, 2));

    const response = await fetch(`${apiUrl}/api/v1/webhook`, {
      method: 'POST',
      headers: {
        'Authorization': appId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    const responseText = await response.text();
    console.log(`\n   Status: ${response.status} ${response.statusText}`);
    console.log(`   Resposta: ${responseText}`);

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log("\n✅ Webhook registrado com sucesso!");
      console.log(`   ID: ${result.webhook?.id}`);
      console.log(`   Nome: ${result.webhook?.name}`);
      console.log(`   URL: ${result.webhook?.url}`);

      console.log("\n📋 Próximos passos:");
      console.log("1. Certifique-se de que sua aplicação está rodando");
      console.log("2. O endpoint /api/webhooks/woovi está acessível publicamente");
      console.log("3. Faça um pagamento de teste para verificar o webhook");
    } else {
      console.error("\n❌ Erro ao registrar webhook:");
      try {
        const error = JSON.parse(responseText);
        console.error("   Erro:", error.error || error.message || responseText);
      } catch {
        console.error("   Resposta:", responseText);
      }
    }

  } catch (error) {
    console.error("\n❌ Erro durante o processo:", error);
  }
}

// Adicionar instruções no .env se não existirem
console.log("\n📝 Adicione estas variáveis ao seu arquivo .env:");
console.log("WEBHOOK_URL=https://seu-dominio.com/api/webhooks/woovi");
console.log("WOOVI_WEBHOOK_AUTH=woovi_webhook_secret_2024");
console.log("");

registerWooviWebhook()
  .then(() => {
    console.log("\n✅ Processo finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });