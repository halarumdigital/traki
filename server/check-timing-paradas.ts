import { db } from "./db.js";
import { entregasIntermunicipais, entregasIntermunicipalParadas, viagemColetas } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

async function checkTiming() {
  const entregaId = "bb722a08-877c-471c-a760-7ed9f9dbd83e";

  console.log("⏰ VERIFICANDO TIMING DE CRIAÇÃO");
  console.log("=".repeat(80));

  // Buscar entrega
  const [entrega] = await db
    .select()
    .from(entregasIntermunicipais)
    .where(eq(entregasIntermunicipais.id, entregaId));

  // Buscar paradas
  const paradas = await db
    .select()
    .from(entregasIntermunicipalParadas)
    .where(eq(entregasIntermunicipalParadas.entregaId, entregaId))
    .orderBy(entregasIntermunicipalParadas.ordem);

  // Buscar coleta
  const [coleta] = await db
    .select()
    .from(viagemColetas)
    .where(eq(viagemColetas.entregaId, entregaId));

  console.log("\n📅 TIMESTAMPS:");
  console.log(`  Entrega criada:  ${entrega.createdAt}`);

  if (paradas.length > 0) {
    paradas.forEach((p, i) => {
      console.log(`  Parada ${i + 1} criada: ${p.createdAt}`);
    });
  }

  if (coleta) {
    console.log(`  Coleta criada:   ${coleta.createdAt}`);
  }

  // Análise
  const entregaTime = new Date(entrega.createdAt).getTime();
  const parada1Time = paradas[0] ? new Date(paradas[0].createdAt).getTime() : 0;
  const coletaTime = coleta ? new Date(coleta.createdAt).getTime() : 0;

  console.log("\n🔍 ANÁLISE:");
  if (paradas.length > 0) {
    const diff = parada1Time - entregaTime;
    console.log(`  Diferença entre entrega e paradas: ${diff}ms`);

    if (diff < 1000) {
      console.log("  ✅ Paradas criadas praticamente junto com a entrega");
    } else {
      console.log(`  ⚠️ Paradas criadas ${(diff / 1000).toFixed(2)} segundos DEPOIS da entrega`);
    }
  }

  if (coleta) {
    const diff = coletaTime - parada1Time;
    console.log(`  Diferença entre paradas e coleta: ${diff}ms`);

    if (diff > 0) {
      console.log(`  ✅ Coleta criada ${(diff / 1000).toFixed(2)} segundos DEPOIS das paradas`);
    } else {
      console.log(`  ❌ PROBLEMA: Coleta criada ANTES das paradas! (${(Math.abs(diff) / 1000).toFixed(2)} segundos)`);
    }
  }

  console.log("\n💡 CONCLUSÃO:");
  if (coleta && paradas.length > 0) {
    const coletaBeforeParadas = coletaTime < parada1Time;
    if (coletaBeforeParadas) {
      console.log("  ❌ As paradas foram criadas DEPOIS que o motorista aceitou!");
      console.log("  Isso explica por que o código não encontrou as paradas.");
    } else {
      console.log("  ✅ As paradas existiam quando o motorista aceitou.");
      console.log("  O problema deve estar na query ou na lógica do código.");
    }
  }
}

checkTiming()
  .then(() => {
    console.log("\n✅ Verificação concluída");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
