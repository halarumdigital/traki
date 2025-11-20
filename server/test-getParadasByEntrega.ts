import { storage } from "./storage";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔍 TESTANDO storage.getParadasByEntrega()");
  console.log("================================================================================\n");

  // ID de uma entrega que SABEMOS que tem 2 paradas
  const entregaId = "b4dab0a0-33f3-44f1-9a53-c9614f813522"; // INT-1763505822628-4U140KB

  console.log(`📦 Buscando paradas para entrega ID: ${entregaId}\n`);

  const paradas = await storage.getParadasByEntrega(entregaId);

  console.log(`📍 RESULTADO: ${paradas.length} parada(s)\n`);

  if (paradas.length > 0) {
    paradas.forEach((parada, index) => {
      console.log(`  [${index + 1}] ${parada.destinatarioNome}`);
      console.log(`      ID: ${parada.id}`);
      console.log(`      Ordem: ${parada.ordem}`);
      console.log(`      Endereço: ${parada.enderecoCompleto}\n`);
    });
    console.log("✅ Função getParadasByEntrega() está funcionando corretamente!");
  } else {
    console.log("❌ PROBLEMA: Função getParadasByEntrega() NÃO encontrou as paradas!");
    console.log("   Mas sabemos que essa entrega TEM 2 paradas no banco.");
  }

  console.log("\n================================================================================");

  // Testar também com uma entrega recente
  console.log("\n🔍 TESTANDO COM ENTREGA MAIS RECENTE");
  console.log("================================================================================\n");

  const entregaRecenteId = "16265b41-28db-4a8a-a335-a226a5ff6124"; // INT-1763551263911-06X5WHL do log do usuário

  console.log(`📦 Buscando paradas para entrega ID: ${entregaRecenteId}\n`);

  try {
    const paradasRecente = await storage.getParadasByEntrega(entregaRecenteId);

    console.log(`📍 RESULTADO: ${paradasRecente.length} parada(s)\n`);

    if (paradasRecente.length > 0) {
      paradasRecente.forEach((parada, index) => {
        console.log(`  [${index + 1}] ${parada.destinatarioNome}`);
        console.log(`      ID: ${parada.id}`);
        console.log(`      Ordem: ${parada.ordem}`);
        console.log(`      Endereço: ${parada.enderecoCompleto}\n`);
      });
      console.log("✅ Entrega recente TEM paradas!");
    } else {
      console.log("❌ Entrega recente NÃO tem paradas!");
    }
  } catch (error) {
    console.error("❌ Erro ao buscar paradas:", error);
  }
}

main()
  .then(() => {
    console.log("\n✅ Teste concluído");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Erro:", err);
    process.exit(1);
  });
