import { db } from "./db.js";
import { entregasIntermunicipais, viagemColetas, viagemEntregas, entregasIntermunicipalParadas } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

async function debugUltimaEntrega() {
  console.log("🔍 DEBUG DA ÚLTIMA ENTREGA");
  console.log("=".repeat(80));

  // Buscar última entrega criada
  const [ultimaEntrega] = await db
    .select()
    .from(entregasIntermunicipais)
    .orderBy(desc(entregasIntermunicipais.createdAt))
    .limit(1);

  if (!ultimaEntrega) {
    console.log("❌ Nenhuma entrega encontrada");
    return;
  }

  console.log(`\n📦 ÚLTIMA ENTREGA CRIADA:`);
  console.log(`    ID: ${ultimaEntrega.id}`);
  console.log(`    Número: ${ultimaEntrega.numeroPedido}`);
  console.log(`    Status: ${ultimaEntrega.status}`);
  console.log(`    Viagem ID: ${ultimaEntrega.viagemId || 'Não aceita ainda'}`);
  console.log(`    Pacotes: ${ultimaEntrega.quantidadePacotes}`);
  console.log(`    Criado em: ${ultimaEntrega.createdAt}`);

  // Buscar paradas
  const paradas = await db
    .select()
    .from(entregasIntermunicipalParadas)
    .where(eq(entregasIntermunicipalParadas.entregaId, ultimaEntrega.id))
    .orderBy(entregasIntermunicipalParadas.ordem);

  console.log(`\n📍 PARADAS: ${paradas.length}`);
  paradas.forEach((p, i) => {
    console.log(`    [${i + 1}] ${p.destinatarioNome} - ${p.enderecoCompleto}`);
  });

  // Buscar viagem_coletas
  const coletas = await db
    .select()
    .from(viagemColetas)
    .where(eq(viagemColetas.entregaId, ultimaEntrega.id));

  console.log(`\n🏪 VIAGEM_COLETAS: ${coletas.length}`);
  coletas.forEach((c, i) => {
    console.log(`    [${i + 1}] ID: ${c.id} - Status: ${c.status}`);
  });

  // Buscar viagem_entregas
  const entregas = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.entregaId, ultimaEntrega.id))
    .orderBy(viagemEntregas.ordemEntrega);

  console.log(`\n📍 VIAGEM_ENTREGAS: ${entregas.length}`);
  if (entregas.length > 0) {
    entregas.forEach((e, i) => {
      console.log(`\n    [${i + 1}] ID: ${e.id}`);
      console.log(`        Coleta ID: ${e.coletaId}`);
      console.log(`        Parada ID: ${e.paradaId || 'Nenhuma'}`);
      console.log(`        Destinatário: ${e.destinatarioNome}`);
      console.log(`        Endereço: ${e.enderecoEntrega}`);
      console.log(`        Status: ${e.status}`);
      console.log(`        Ordem: ${e.ordemEntrega}`);
    });
  } else {
    console.log("    Nenhuma viagem_entrega criada (entrega não foi aceita ainda)");
  }

  // Análise
  console.log("\n\n🔍 ANÁLISE:");
  console.log("=".repeat(80));
  console.log(`  Pacotes declarados: ${ultimaEntrega.quantidadePacotes}`);
  console.log(`  Paradas criadas: ${paradas.length}`);
  console.log(`  Viagem_entregas criadas: ${entregas.length}`);

  if (ultimaEntrega.viagemId) {
    if (entregas.length === paradas.length) {
      console.log("\n  ✅ OK: Número de viagem_entregas = número de paradas");
    } else {
      console.log(`\n  ❌ ERRO: Esperado ${paradas.length} viagem_entregas, mas tem ${entregas.length}!`);
    }
  } else {
    console.log("\n  ⏳ Entrega ainda não foi aceita por nenhum motorista");
  }
}

debugUltimaEntrega()
  .then(() => {
    console.log("\n✅ Debug concluído");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
