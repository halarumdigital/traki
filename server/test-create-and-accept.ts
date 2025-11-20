import { db } from "./db";
import { entregasIntermunicipais, entregasIntermunicipalParadas } from "../shared/schema";
import { eq } from "drizzle-orm";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔍 TESTANDO FLUXO DE CRIAÇÃO E ACEITAÇÃO");
  console.log("================================================================================\n");

  // Buscar a última entrega criada
  const entregas = await db
    .select()
    .from(entregasIntermunicipais)
    .orderBy(entregasIntermunicipais.createdAt)
    .limit(1);

  if (entregas.length === 0) {
    console.log("❌ Nenhuma entrega encontrada");
    return;
  }

  const entrega = entregas[0];
  console.log(`📦 ENTREGA MAIS RECENTE: ${entrega.numeroPedido}`);
  console.log(`   ID: ${entrega.id}`);
  console.log(`   Status: ${entrega.status}`);
  console.log(`   Viagem ID: ${entrega.viagemId || 'Não associada'}`);
  console.log(`   Criada em: ${entrega.createdAt}\n`);

  // Buscar paradas IMEDIATAMENTE após criação
  const paradas = await db
    .select()
    .from(entregasIntermunicipalParadas)
    .where(eq(entregasIntermunicipalParadas.entregaId, entrega.id))
    .orderBy(entregasIntermunicipalParadas.ordem);

  console.log(`📍 PARADAS DESTA ENTREGA: ${paradas.length}\n`);

  if (paradas.length > 0) {
    paradas.forEach((parada, index) => {
      console.log(`  [${index + 1}] Parada ${parada.ordem}`);
      console.log(`      ID: ${parada.id}`);
      console.log(`      Destinatário: ${parada.destinatarioNome}`);
      console.log(`      Endereço: ${parada.enderecoCompleto}`);
      console.log(`      Criada em: ${parada.createdAt}\n`);
    });
  } else {
    console.log("   ⚠️ PROBLEMA: Nenhuma parada foi criada para esta entrega!\n");
  }

  console.log("================================================================================");

  // Verificar diferença de tempo entre criação da entrega e das paradas
  if (paradas.length > 0) {
    const entregaTime = new Date(entrega.createdAt).getTime();
    const paradaTime = new Date(paradas[0].createdAt).getTime();
    const diff = paradaTime - entregaTime;

    console.log(`\n⏱️ TIMING:`);
    console.log(`   Entrega criada em: ${entrega.createdAt}`);
    console.log(`   Parada criada em: ${paradas[0].createdAt}`);
    console.log(`   Diferença: ${diff}ms`);

    if (diff > 1000) {
      console.log(`   ⚠️ AVISO: Paradas foram criadas ${(diff/1000).toFixed(2)}s após a entrega!`);
    } else {
      console.log(`   ✅ Paradas criadas simultaneamente com a entrega`);
    }
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
