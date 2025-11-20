import { db } from "./db.js";
import { entregasIntermunicipais, viagemColetas, viagemEntregas } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

async function resetEntrega() {
  console.log("🔄 RESETANDO ÚLTIMA ENTREGA");
  console.log("=".repeat(80));

  // Buscar última entrega
  const [ultimaEntrega] = await db
    .select()
    .from(entregasIntermunicipais)
    .orderBy(desc(entregasIntermunicipais.createdAt))
    .limit(1);

  if (!ultimaEntrega) {
    console.log("❌ Nenhuma entrega encontrada");
    return;
  }

  console.log(`\n📦 ENTREGA: ${ultimaEntrega.numeroPedido}`);
  console.log(`    ID: ${ultimaEntrega.id}`);
  console.log(`    Status atual: ${ultimaEntrega.status}`);

  // Deletar viagem_entregas
  const deletedEntregas = await db
    .delete(viagemEntregas)
    .where(eq(viagemEntregas.entregaId, ultimaEntrega.id))
    .returning();

  console.log(`\n🗑️  Deletadas ${deletedEntregas.length} viagem_entregas`);

  // Deletar viagem_coletas
  const deletedColetas = await db
    .delete(viagemColetas)
    .where(eq(viagemColetas.entregaId, ultimaEntrega.id))
    .returning();

  console.log(`🗑️  Deletadas ${deletedColetas.length} viagem_coletas`);

  // Resetar entrega para aguardando_motorista
  await db
    .update(entregasIntermunicipais)
    .set({
      status: "aguardando_motorista",
      viagemId: null
    })
    .where(eq(entregasIntermunicipais.id, ultimaEntrega.id));

  console.log(`\n✅ Entrega resetada para "aguardando_motorista"`);
  console.log(`\nAgora você pode aceitar a entrega ${ultimaEntrega.numeroPedido} novamente!`);
}

resetEntrega()
  .then(() => {
    console.log("\n✅ Reset concluído");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
