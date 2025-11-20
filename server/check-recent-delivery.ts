import { db } from "./db";
import { entregasIntermunicipais, entregasIntermunicipalParadas } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔍 VERIFICANDO ÚLTIMAS 10 ENTREGAS");
  console.log("================================================================================\n");

  // Buscar as últimas 10 entregas
  const entregas = await db
    .select()
    .from(entregasIntermunicipais)
    .orderBy(desc(entregasIntermunicipais.createdAt))
    .limit(10);

  console.log(`📦 Total de entregas encontradas: ${entregas.length}\n`);

  for (const entrega of entregas) {
    // Buscar paradas para cada entrega
    const paradas = await db
      .select()
      .from(entregasIntermunicipalParadas)
      .where(eq(entregasIntermunicipalParadas.entregaId, entrega.id))
      .orderBy(entregasIntermunicipalParadas.ordem);

    console.log(`${entrega.numeroPedido}`);
    console.log(`  Status: ${entrega.status}`);
    console.log(`  Paradas: ${paradas.length}`);
    console.log(`  Criado em: ${entrega.createdAt}`);
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
