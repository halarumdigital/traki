import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function setupWebhookLocal() {
  console.log("========================================");
  console.log("🔗 Configurando Webhook Local da Woovi");
  console.log("========================================\n");

  // URL local usando nip.io para desenvolvimento
  const LOCAL_URL = "http://192.168.3.3.nip.io:5010";
  const webhookUrl = `${LOCAL_URL}/api/webhooks/woovi`;
  const webhookAuth = process.env.WOOVI_WEBHOOK_AUTH || 'woovi_webhook_secret_2024';

  console.log("📊 Configurações:");
  console.log(`   URL Local: ${LOCAL_URL}`);
  console.log(`   URL do Webhook: ${webhookUrl}`);
  console.log(`   Authorization: ${webhookAuth}`);
  console.log(`   Ambiente Woovi: ${process.env.WOOVI_PRODUCTION === 'true' ? 'PRODUÇÃO' : 'SANDBOX'}`);
  console.log("\n💡 Usando nip.io para resolver DNS local");

  try {
    // Listar webhooks existentes
    console.log("\n📋 Verificando webhooks existentes...");
    try {
      const existingWebhooks = await wooviService.listWebhooks();

      if (existingWebhooks.webhooks && existingWebhooks.webhooks.length > 0) {
        console.log(`\n✅ Encontrados ${existingWebhooks.webhooks.length} webhook(s):`);

        existingWebhooks.webhooks.forEach((webhook: any, index: number) => {
          console.log(`\n   ${index + 1}. ${webhook.name}`);
          console.log(`      ID: ${webhook.id}`);
          console.log(`      URL: ${webhook.url}`);
          console.log(`      Ativo: ${webhook.isActive ? '✅ Sim' : '❌ Não'}`);

          // Destacar se é nossa URL local
          if (webhook.url === webhookUrl) {
            console.log(`      ⭐ Este é nosso webhook local!`);
          }
        });

        // Verificar se já existe um webhook para nossa URL
        const existingWebhook = existingWebhooks.webhooks.find(
          (wh: any) => wh.url === webhookUrl
        );

        if (existingWebhook) {
          console.log("\n⚠️  Webhook já existe para esta URL local!");
          console.log("   ID:", existingWebhook.id);
          console.log("   Ativo:", existingWebhook.isActive ? 'Sim' : 'Não');

          if (!existingWebhook.isActive) {
            console.log("\n📝 Webhook está inativo. Ativando seria necessário.");
          }

          console.log("\n✅ Webhook local já configurado!");
          return;
        }
      } else {
        console.log("\n📭 Nenhum webhook encontrado");
      }
    } catch (error) {
      console.log("⚠️  Não foi possível listar webhooks existentes");
    }

    // Registrar novo webhook
    console.log("\n📝 Registrando novo webhook local...");

    const webhookResponse = await wooviService.registerWebhook({
      name: "Fretus Local Dev - Webhook de Teste",
      url: webhookUrl,
      // authorization: webhookAuth, // Removido temporariamente
      isActive: true,
      event: "OPENPIX:CHARGE_COMPLETED" // Apenas um evento por webhook
    });

    console.log("\n✅ Webhook local registrado com sucesso!");
    console.log(`   ID: ${webhookResponse.webhook?.id}`);
    console.log(`   Nome: ${webhookResponse.webhook?.name}`);
    console.log(`   URL: ${webhookResponse.webhook?.url}`);
    console.log(`   Ativo: ${webhookResponse.webhook?.isActive ? 'Sim' : 'Não'}`);

    console.log("\n📋 Configuração Local Completa!");
    console.log("\n🔧 Certifique-se de que:");
    console.log("1. Seu servidor está rodando na porta 5010");
    console.log("2. O IP 192.168.3.3 é acessível externamente");
    console.log("3. O endpoint /api/webhooks/woovi está funcionando");
    console.log("4. O firewall permite acesso à porta 5010");

    console.log("\n💻 Teste o webhook localmente:");
    console.log(`   curl -X POST ${webhookUrl} \\`);
    console.log(`     -H "Authorization: ${webhookAuth}" \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"event":"OPENPIX:CHARGE_COMPLETED","charge":{"correlationID":"test_123"}}'`);

    console.log("\n📝 Adicione ao seu .env local:");
    console.log(`WOOVI_WEBHOOK_AUTH=${webhookAuth}`);

  } catch (error: any) {
    console.error("\n❌ Erro ao configurar webhook:", error?.message || error);

    if (error?.message?.includes('already exists')) {
      console.log("\n💡 O webhook já existe. Verifique no painel da Woovi.");
    } else if (error?.message?.includes('ECONNREFUSED')) {
      console.log("\n❌ Não foi possível conectar à API da Woovi.");
      console.log("   Verifique se WOOVI_APP_ID está correto.");
    }
  }
}

// Executar
console.log("🔑 WOOVI_APP_ID:", process.env.WOOVI_APP_ID ? "Configurado" : "NÃO CONFIGURADO");
console.log("🌍 Servidor local: http://192.168.3.3.nip.io:5010");
console.log("");

if (!process.env.WOOVI_APP_ID) {
  console.error("\n❌ WOOVI_APP_ID não está configurado no .env!");
  process.exit(1);
}

setupWebhookLocal()
  .then(() => {
    console.log("\n✅ Configuração do webhook local finalizada!");
    console.log("\n🎯 Próximo passo: Faça um pagamento PIX de teste para verificar o webhook");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });