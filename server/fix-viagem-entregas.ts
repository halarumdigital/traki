import { db } from "./db.js";
import { viagemEntregas, viagemColetas, entregasIntermunicipalParadas } from "../shared/schema.js";
import { eq } from "drizzle-orm";

async function fixViagemEntregas() {
  const entregaId = "1a926f2c-c1db-4fce-b58b-2c8a71837e5e";
  const viagemId = "ec42dc4a-a237-4cb1-9785-d2988305bae5";

  console.log("🔧 CORRIGINDO VIAGEM_ENTREGAS");
  console.log("=".repeat(80));

  // 1. Buscar a viagem_coleta desta entrega
  console.log("\n🔍 Buscando viagem_coleta...");
  const [coleta] = await db
    .select()
    .from(viagemColetas)
    .where(eq(viagemColetas.entregaId, entregaId));

  if (!coleta) {
    console.log("❌ ERRO: Nenhuma viagem_coleta encontrada para esta entrega!");
    return;
  }

  console.log(`✅ Coleta encontrada: ${coleta.id}`);

  // 2. Deletar viagem_entregas antigas desta entrega
  console.log("\n🗑️  Deletando viagem_entregas antigas...");
  const deleted = await db
    .delete(viagemEntregas)
    .where(eq(viagemEntregas.entregaId, entregaId))
    .returning();

  console.log(`✅ ${deleted.length} registro(s) deletado(s)`);

  // 3. Buscar paradas da entrega
  console.log("\n📍 Buscando paradas da entrega...");
  const paradas = await db
    .select()
    .from(entregasIntermunicipalParadas)
    .where(eq(entregasIntermunicipalParadas.entregaId, entregaId))
    .orderBy(entregasIntermunicipalParadas.ordem);

  console.log(`Encontradas ${paradas.length} parada(s):`);
  paradas.forEach((p, i) => {
    console.log(`  [${i + 1}] ${p.destinatarioNome} - ${p.enderecoCompleto}`);
  });

  // 3. Buscar maior ordem_entrega atual da viagem
  const maxOrdem = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.viagemId, viagemId))
    .orderBy(viagemEntregas.ordemEntrega);

  let ordemEntrega = 1;
  if (maxOrdem.length > 0) {
    const ultimaOrdem = maxOrdem[maxOrdem.length - 1].ordemEntrega;
    ordemEntrega = ultimaOrdem ? ultimaOrdem + 1 : 1;
  }

  console.log(`\n📊 Próxima ordem de entrega: ${ordemEntrega}`);

  // 4. Criar nova viagem_entrega para cada parada
  console.log("\n✨ Criando novas viagem_entregas...");

  for (const parada of paradas) {
    const novaEntrega = {
      viagemId,
      entregaId,
      coletaId: coleta.id,
      paradaId: parada.id,
      ordemEntrega: ordemEntrega++,
      enderecoEntrega: parada.enderecoCompleto || "",
      destinatarioNome: parada.destinatarioNome || "",
      destinatarioTelefone: parada.destinatarioTelefone || "",
      status: "pendente"
    };

    const [criada] = await db
      .insert(viagemEntregas)
      .values(novaEntrega)
      .returning();

    console.log(`✅ Criada viagem_entrega para ${parada.destinatarioNome}`);
    console.log(`   ID: ${criada.id}`);
    console.log(`   Parada ID: ${criada.paradaId}`);
    console.log(`   Ordem: ${criada.ordemEntrega}`);
  }

  // 5. Verificar resultado final
  console.log("\n\n🔍 VERIFICAÇÃO FINAL:");
  console.log("=".repeat(80));

  const verificacao = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.entregaId, entregaId))
    .orderBy(viagemEntregas.ordemEntrega);

  console.log(`\nTotal de viagem_entregas para esta entrega: ${verificacao.length}`);
  verificacao.forEach((e, i) => {
    console.log(`\n[${i + 1}] ${e.destinatarioNome}`);
    console.log(`    ID: ${e.id}`);
    console.log(`    Parada ID: ${e.paradaId}`);
    console.log(`    Status: ${e.status}`);
    console.log(`    Ordem: ${e.ordemEntrega}`);
  });

  if (verificacao.length === paradas.length) {
    console.log("\n✅ SUCESSO! Quantidade de viagem_entregas corresponde ao número de paradas!");
  } else {
    console.log(`\n❌ ERRO! Esperado ${paradas.length}, mas tem ${verificacao.length}`);
  }
}

fixViagemEntregas()
  .then(() => {
    console.log("\n✅ Correção concluída");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
