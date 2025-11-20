import { db } from "./db";
import { entregasIntermunicipais, entregasIntermunicipalParadas, viagemEntregas } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔍 VERIFICANDO DETALHES DE VIAGEM_ENTREGAS");
  console.log("================================================================================\n");

  // Buscar uma entrega concluída recente
  const [entrega] = await db
    .select()
    .from(entregasIntermunicipais)
    .where(eq(entregasIntermunicipais.status, "concluida"))
    .orderBy(desc(entregasIntermunicipais.createdAt))
    .limit(1);

  if (!entrega) {
    console.log("❌ Nenhuma entrega concluída encontrada");
    return;
  }

  console.log(`📦 ENTREGA: ${entrega.numeroPedido}`);
  console.log(`   ID: ${entrega.id}`);
  console.log(`   Status: ${entrega.status}`);
  console.log(`   Viagem ID: ${entrega.viagemId}\n`);

  // Buscar paradas desta entrega
  const paradas = await db
    .select()
    .from(entregasIntermunicipalParadas)
    .where(eq(entregasIntermunicipalParadas.entregaId, entrega.id))
    .orderBy(entregasIntermunicipalParadas.ordem);

  console.log(`📍 PARADAS: ${paradas.length}\n`);
  paradas.forEach((parada, index) => {
    console.log(`  [${index + 1}] ${parada.destinatarioNome}`);
    console.log(`      ID: ${parada.id}`);
    console.log(`      Endereço: ${parada.enderecoCompleto}\n`);
  });

  // Buscar viagem_entregas para esta entrega
  const viagemEntregasData = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.entregaId, entrega.id));

  console.log(`🚚 VIAGEM_ENTREGAS CRIADAS: ${viagemEntregasData.length}\n`);
  viagemEntregasData.forEach((ve, index) => {
    console.log(`  [${index + 1}] ${ve.destinatarioNome}`);
    console.log(`      ID: ${ve.id}`);
    console.log(`      Parada ID: ${ve.paradaId || 'NENHUMA'}`);
    console.log(`      Ordem: ${ve.ordemEntrega}`);
    console.log(`      Status: ${ve.status}`);
    console.log(`      Endereço: ${ve.enderecoEntrega}\n`);
  });

  // Comparação
  console.log("================================================================================");
  console.log(`\n📊 RESUMO:`);
  console.log(`   Paradas criadas: ${paradas.length}`);
  console.log(`   Viagem_entregas criadas: ${viagemEntregasData.length}`);

  if (paradas.length === viagemEntregasData.length) {
    console.log(`   ✅ CORRETO: Uma viagem_entrega foi criada para cada parada`);
  } else {
    console.log(`   ❌ PROBLEMA: Número de viagem_entregas não corresponde ao número de paradas!`);
    console.log(`   ⚠️ Esperado: ${paradas.length} viagem_entregas`);
    console.log(`   ⚠️ Encontrado: ${viagemEntregasData.length} viagem_entregas`);
  }

  // Verificar se os paradaIds estão corretos
  const paradaIds = paradas.map(p => p.id);
  const viagemParadaIds = viagemEntregasData.map(ve => ve.paradaId).filter(Boolean);

  console.log(`\n🔗 VERIFICANDO LIGAÇÕES:`);
  console.log(`   Parada IDs: ${paradaIds.join(', ')}`);
  console.log(`   Viagem_entregas.paradaId: ${viagemParadaIds.join(', ')}`);

  const todasLigadas = paradaIds.every(id => viagemParadaIds.includes(id));
  if (todasLigadas) {
    console.log(`   ✅ Todas as paradas estão ligadas a viagem_entregas`);
  } else {
    console.log(`   ❌ Algumas paradas NÃO estão ligadas a viagem_entregas`);
  }
}

main()
  .then(() => {
    console.log("\n✅ Verificação concluída");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Erro:", err);
    process.exit(1);
  });
