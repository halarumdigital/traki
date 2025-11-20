import { db } from "./db.js";
import { viagemEntregas, entregasIntermunicipais, entregasIntermunicipalParadas } from "../shared/schema.js";
import { eq } from "drizzle-orm";

async function checkViagemEntregas() {
  const viagemId = "ec42dc4a-a237-4cb1-9785-d2988305bae5";
  const entregaId = "1a926f2c-c1db-4fce-b58b-2c8a71837e5e"; // Entrega mais recente

  console.log("📋 VERIFICANDO VIAGEM_ENTREGAS");
  console.log("=".repeat(80));

  // Buscar paradas da entrega
  const paradas = await db
    .select()
    .from(entregasIntermunicipalParadas)
    .where(eq(entregasIntermunicipalParadas.entregaId, entregaId))
    .orderBy(entregasIntermunicipalParadas.ordem);

  console.log(`\n📍 PARADAS DA ENTREGA ${entregaId}:`);
  console.log(`Total: ${paradas.length}`);
  paradas.forEach((p, i) => {
    console.log(`  [${i + 1}] ${p.destinatarioNome} - ID: ${p.id}`);
  });

  // Buscar viagem_entregas para essa entrega específica
  const viagemEnt = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.entregaId, entregaId))
    .orderBy(viagemEntregas.ordemEntrega);

  console.log(`\n📦 VIAGEM_ENTREGAS CRIADAS PARA ESSA ENTREGA:`);
  console.log(`Total: ${viagemEnt.length}`);

  if (viagemEnt.length > 0) {
    viagemEnt.forEach((e, i) => {
      console.log(`\n  [${i + 1}] ID: ${e.id}`);
      console.log(`      Viagem ID: ${e.viagemId}`);
      console.log(`      Entrega ID: ${e.entregaId}`);
      console.log(`      Parada ID: ${e.paradaId}`);
      console.log(`      Destinatário: ${e.destinatarioNome}`);
      console.log(`      Endereço: ${e.enderecoEntrega}`);
      console.log(`      Status: ${e.status}`);
      console.log(`      Ordem: ${e.ordemEntrega}`);
    });
  } else {
    console.log("  ❌ Nenhuma viagem_entrega criada!");
  }

  // Verificar se há correspondência
  console.log("\n🔍 ANÁLISE:");
  console.log(`  Paradas esperadas: ${paradas.length}`);
  console.log(`  Viagem_entregas criadas: ${viagemEnt.length}`);

  if (paradas.length === viagemEnt.length) {
    console.log("  ✅ Quantidade correta!");
  } else {
    console.log(`  ❌ ERRO: Deveria ter ${paradas.length} viagem_entregas, mas tem apenas ${viagemEnt.length}!`);
  }

  // Buscar todas as viagem_entregas da viagem
  console.log("\n\n📊 TODAS AS VIAGEM_ENTREGAS DA VIAGEM:");
  console.log("=".repeat(80));

  const todasEntregas = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.viagemId, viagemId))
    .orderBy(viagemEntregas.ordemEntrega);

  console.log(`Total: ${todasEntregas.length}\n`);

  todasEntregas.forEach((e, i) => {
    console.log(`[${i + 1}] ${e.destinatarioNome}`);
    console.log(`    Entrega ID: ${e.entregaId}`);
    console.log(`    Parada ID: ${e.paradaId}`);
    console.log(`    Status: ${e.status}`);
    console.log(`    Ordem: ${e.ordemEntrega}`);
    console.log("");
  });
}

checkViagemEntregas()
  .then(() => {
    console.log("✅ Verificação concluída");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
