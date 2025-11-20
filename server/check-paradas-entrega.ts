import { db } from "./db.js";
import { entregasIntermunicipais, entregasIntermunicipalParadas } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

async function checkParadas() {
  const entregaId = "1a926f2c-c1db-4fce-b58b-2c8a71837e5e"; // Entrega mais recente

  console.log("📋 VERIFICANDO PARADAS DA ENTREGA");
  console.log("=".repeat(80));

  // Buscar entrega
  const [entrega] = await db
    .select()
    .from(entregasIntermunicipais)
    .where(eq(entregasIntermunicipais.id, entregaId));

  if (!entrega) {
    console.log("❌ Entrega não encontrada!");
    return;
  }

  console.log(`\n📦 ENTREGA: ${entrega.numeroPedido}`);
  console.log(`    Status: ${entrega.status}`);
  console.log(`    Destinatário Principal: ${entrega.destinatarioNome}`);
  console.log(`    Endereço Principal: ${entrega.enderecoEntregaCompleto}`);

  // Buscar paradas
  const paradas = await db
    .select()
    .from(entregasIntermunicipalParadas)
    .where(eq(entregasIntermunicipalParadas.entregaId, entregaId))
    .orderBy(entregasIntermunicipalParadas.ordem);

  console.log(`\n📍 PARADAS: ${paradas.length}`);

  if (paradas.length > 0) {
    paradas.forEach((p, i) => {
      console.log(`\n  [${i + 1}] Parada ${p.ordem}`);
      console.log(`      ID: ${p.id}`);
      console.log(`      Destinatário: ${p.destinatarioNome}`);
      console.log(`      Endereço: ${p.enderecoCompleto}`);
      console.log(`      Telefone: ${p.destinatarioTelefone}`);
    });
  } else {
    console.log("  Nenhuma parada adicional encontrada.");
  }

  // Buscar últimas 5 entregas da empresa
  console.log("\n\n📊 ÚLTIMAS 5 ENTREGAS DA MESMA EMPRESA:");
  console.log("=".repeat(80));

  const ultimasEntregas = await db
    .select()
    .from(entregasIntermunicipais)
    .where(eq(entregasIntermunicipais.empresaId, entrega.empresaId))
    .orderBy(desc(entregasIntermunicipais.createdAt))
    .limit(5);

  for (const e of ultimasEntregas) {
    const paradasCount = await db
      .select()
      .from(entregasIntermunicipalParadas)
      .where(eq(entregasIntermunicipalParadas.entregaId, e.id));

    console.log(`\n${e.numeroPedido}`);
    console.log(`  Status: ${e.status}`);
    console.log(`  Paradas: ${paradasCount.length}`);
    console.log(`  Criado em: ${e.createdAt}`);
  }
}

checkParadas()
  .then(() => {
    console.log("\n✅ Verificação concluída");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
