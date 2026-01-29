import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function setupWebhookProduction() {
  console.log("========================================");
  console.log("🔗 Configurando Webhook da Woovi");
  console.log("========================================\n");

  // URL com o domínio correto
  const PRODUCTION_URL = "http://fretus.ddnsking.com:5010";
  const webhookUrl = `${PRODUCTION_URL}/api/webhooks/woovi`;
  const webhookAuth = process.env.WOOVI_WEBHOOK_AUTH || 'woovi_webhook_secret_2024';

  console.log("📊 Configurações:");
  console.log(`   URL do Webhook: ${webhookUrl}`);
  console.log(`   Authorization: ${webhookAuth}`);
  console.log(`   Ambiente Woovi: ${process.env.WOOVI_PRODUCTION === 'true' ? 'PRODUÇÃO' : 'SANDBOX'}`);

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
        });

        // Verificar se já existe
        const existingWebhook = existingWebhooks.webhooks.find(
          (wh: any) => wh.url === webhookUrl
        );

        if (existingWebhook) {
          console.log("\n⚠️  Webhook já existe para esta URL!");
          console.log("   ID:", existingWebhook.id);
          console.log("   Ativo:", existingWebhook.isActive ? 'Sim' : 'Não');
          return;
        }
      } else {
        console.log("\n📭 Nenhum webhook encontrado");
      }
    } catch (error) {
      console.log("⚠️  Não foi possível listar webhooks existentes");
    }

    // Registrar novo webhook
    console.log("\n📝 Registrando novo webhook...");

    const webhookResponse = await wooviService.registerWebhook({
      name: "Fretus - Notificações de Pagamento PIX",
      url: webhookUrl,
      authorization: webhookAuth,
      isActive: true,
    });

    console.log("\n✅ Webhook registrado com sucesso!");
    console.log(`   ID: ${webhookResponse.webhook?.id}`);
    console.log(`   Nome: ${webhookResponse.webhook?.name}`);
    console.log(`   URL: ${webhookResponse.webhook?.url}`);
    console.log(`   Ativo: ${webhookResponse.webhook?.isActive ? 'Sim' : 'Não'}`);

    console.log("\n📋 Configuração Completa!");
    console.log("\n🔧 Certifique-se de que:");
    console.log("1. Seu servidor está rodando em http://fretus.ddnsking.com:5010");
    console.log("2. O endpoint /api/webhooks/woovi está acessível");
    console.log("3. A porta 5010 está liberada no firewall");

  } catch (error: any) {
    console.error("\n❌ Erro ao configurar webhook:", error?.message || error);

    if (error?.message?.includes('appID inválido')) {
      console.log("\n💡 O WOOVI_APP_ID está inválido ou expirado.");
      console.log("   Verifique se você copiou as credenciais corretas do painel da Woovi.");
    }
  }
}

console.log("🔑 WOOVI_APP_ID:", process.env.WOOVI_APP_ID ? "Configurado" : "NÃO CONFIGURADO");
console.log("");

if (!process.env.WOOVI_APP_ID) {
  console.error("\n❌ WOOVI_APP_ID não está configurado no .env!");
  process.exit(1);
}

setupWebhookProduction()
  .then(() => {
    console.log("\n✅ Configuração finalizada!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });