import { db } from "./db.js";
import { entregasIntermunicipais, viagemColetas, viagemEntregas } from "../shared/schema.js";
import { eq } from "drizzle-orm";

async function checkEntregasViagem() {
  const viagemId = "ec42dc4a-a237-4cb1-9785-d2988305bae5";

  console.log("🔍 VERIFICANDO ENTREGAS DA VIAGEM:", viagemId);
  console.log("=".repeat(80));

  // 1. Buscar entregas intermunicipais associadas a esta viagem
  const entregas = await db
    .select()
    .from(entregasIntermunicipais)
    .where(eq(entregasIntermunicipais.viagemId, viagemId));

  console.log(`\n📦 ENTREGAS INTERMUNICIPAIS: ${entregas.length}`);
  entregas.forEach((e, i) => {
    console.log(`  [${i + 1}] ${e.numeroPedido} - Status: ${e.status}`);
  });

  // 2. Buscar coletas da viagem
  const coletas = await db
    .select()
    .from(viagemColetas)
    .where(eq(viagemColetas.viagemId, viagemId));

  console.log(`\n🏪 VIAGEM_COLETAS: ${coletas.length}`);
  coletas.forEach((c, i) => {
    console.log(`  [${i + 1}] Entrega ID: ${c.entregaId} - Status: ${c.status}`);
  });

  // 3. Buscar entregas da viagem
  const viagemEnt = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.viagemId, viagemId));

  console.log(`\n📍 VIAGEM_ENTREGAS: ${viagemEnt.length}`);
  viagemEnt.forEach((e, i) => {
    console.log(`  [${i + 1}] Entrega ID: ${e.entregaId} - Status: ${e.status}`);
  });

  // 4. Verificar se há duplicatas
  console.log("\n🔍 VERIFICANDO DUPLICATAS:");
  const entregasIds = new Set();
  const duplicatas: string[] = [];

  for (const coleta of coletas) {
    if (entregasIds.has(coleta.entregaId)) {
      duplicatas.push(coleta.entregaId);
    } else {
      entregasIds.add(coleta.entregaId);
    }
  }

  if (duplicatas.length > 0) {
    console.log(`\n❌ DUPLICATAS ENCONTRADAS: ${duplicatas.length}`);
    duplicatas.forEach(id => console.log(`  - ${id}`));
  } else {
    console.log(`\n✅ Nenhuma duplicata encontrada`);
  }
}

checkEntregasViagem()
  .then(() => {
    console.log("\n✅ Verificação concluída");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
