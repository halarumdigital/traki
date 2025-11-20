import { storage } from "./storage.js";

async function testGetParadas() {
  const entregaId = "bb722a08-877c-471c-a760-7ed9f9dbd83e";

  console.log("🧪 TESTANDO getParadasByEntrega");
  console.log("=".repeat(80));
  console.log(`Entrega ID: ${entregaId}\n`);

  try {
    const paradas = await storage.getParadasByEntrega(entregaId);

    console.log(`✅ Resultado: ${paradas.length} parada(s) encontrada(s)\n`);

    if (paradas.length > 0) {
      paradas.forEach((p, i) => {
        console.log(`[${i + 1}] ${p.destinatarioNome}`);
        console.log(`    ID: ${p.id}`);
        console.log(`    Endereço: ${p.enderecoCompleto}`);
        console.log(`    Ordem: ${p.ordem}`);
        console.log(``);
      });
    } else {
      console.log("❌ NENHUMA PARADA ENCONTRADA!");
      console.log("Isso explica por que o código criou apenas 1 viagem_entrega.");
    }
  } catch (error) {
    console.error("❌ Erro ao buscar paradas:", error);
  }
}

testGetParadas()
  .then(() => {
    console.log("✅ Teste concluído");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
