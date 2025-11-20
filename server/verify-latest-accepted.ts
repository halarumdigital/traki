import { db } from "./db";
import { entregasIntermunicipais, viagemEntregas, entregasIntermunicipalParadas } from "../shared/schema";
import { eq, desc, isNotNull } from "drizzle-orm";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔍 VERIFICANDO ENTREGAS ACEITAS RECENTEMENTE");
  console.log("================================================================================\n");

  // Buscar entregas que foram aceitas (tem viagemId)
  const entregas = await db
    .select()
    .from(entregasIntermunicipais)
    .where(isNotNull(entregasIntermunicipais.viagemId))
    .orderBy(desc(entregasIntermunicipais.updatedAt))
    .limit(5);

  console.log(`📦 Total de entregas aceitas: ${entregas.length}\n`);

  for (const entrega of entregas) {
    console.log(`${entrega.numeroPedido}`);
    console.log(`  ID: ${entrega.id}`);
    console.log(`  Status: ${entrega.status}`);
    console.log(`  Aceita em: ${entrega.updatedAt}`);

    // Buscar paradas
    const paradas = await db
      .select()
      .from(entregasIntermunicipalParadas)
      .where(eq(entregasIntermunicipalParadas.entregaId, entrega.id));

    // Buscar viagem_entregas
    const vEntregas = await db
      .select()
      .from(viagemEntregas)
      .where(eq(viagemEntregas.entregaId, entrega.id));

    console.log(`  Paradas: ${paradas.length}`);
    console.log(`  Viagem_entregas: ${vEntregas.length}`);

    if (paradas.length !== vEntregas.length) {
      console.log(`  ❌ PROBLEMA: ${paradas.length} paradas mas ${vEntregas.length} viagem_entregas`);
    } else {
      console.log(`  ✅ Correto!`);
    }

    // Verificar se tem paradaId
    const comParadaId = vEntregas.filter(ve => ve.paradaId !== null).length;
    console.log(`  Viagem_entregas com paradaId: ${comParadaId}/${vEntregas.length}`);

    console.log();
  }

  console.log("================================================================================");
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
