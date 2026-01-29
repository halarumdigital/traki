import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function testChargeResponse() {
  console.log("========================================");
  console.log("🧪 Teste de Resposta da API de Cobrança");
  console.log("========================================\n");

  try {
    const correlationID = `test_${Date.now()}`;
    const valueInCents = 100; // R$ 1,00 para teste

    console.log("📝 Criando cobrança de teste...");
    console.log(`   Valor: R$ ${(valueInCents / 100).toFixed(2)}`);
    console.log(`   Correlation ID: ${correlationID}`);

    const response = await wooviService.createCharge({
      value: valueInCents,
      correlationID,
      comment: "Teste de estrutura de resposta",
      expiresIn: 3600,
    });

    console.log("\n✅ Resposta completa da API:");
    console.log(JSON.stringify(response, null, 2));

    console.log("\n📊 Análise da resposta:");
    console.log(`   charge existe? ${!!response.charge}`);
    console.log(`   brCode existe? ${!!response.brCode}`);
    console.log(`   qrCode existe? ${!!response.qrCode}`);

    if (response.qrCode) {
      console.log(`   qrCode tipo: ${typeof response.qrCode}`);
      console.log(`   qrCode comprimento: ${response.qrCode.length}`);
      console.log(`   qrCode amostra: ${response.qrCode.substring(0, 50)}...`);
    }

    // Verificar se há outras propriedades
    console.log("\n🔍 Todas as propriedades do objeto:");
    Object.keys(response).forEach(key => {
      const value = (response as any)[key];
      if (typeof value === 'object') {
        console.log(`   ${key}: [objeto]`);
      } else if (typeof value === 'string' && value.length > 100) {
        console.log(`   ${key}: [string com ${value.length} caracteres]`);
      } else {
        console.log(`   ${key}: ${value}`);
      }
    });

  } catch (error) {
    console.error("\n❌ Erro ao criar cobrança:", error);
  }
}

testChargeResponse()
  .then(() => {
    console.log("\n✅ Teste finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });