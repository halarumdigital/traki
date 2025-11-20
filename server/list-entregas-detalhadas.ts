import { db } from "./db.js";
import { entregasIntermunicipais } from "../shared/schema.js";
import { eq } from "drizzle-orm";

async function listEntregasDetalhadas() {
  const viagemId = "ec42dc4a-a237-4cb1-9785-d2988305bae5";

  console.log("📋 LISTA DETALHADA DE ENTREGAS DA VIAGEM");
  console.log("=".repeat(80));

  const entregas = await db
    .select()
    .from(entregasIntermunicipais)
    .where(eq(entregasIntermunicipais.viagemId, viagemId));

  entregas.forEach((e, i) => {
    console.log(`\n[${i + 1}] ${e.numeroPedido}`);
    console.log(`    Status: ${e.status}`);
    console.log(`    Destinatário: ${e.destinatarioNome}`);
    console.log(`    Criado em: ${e.createdAt}`);
    console.log(`    Atualizado em: ${e.updatedAt}`);
    console.log(`    ID: ${e.id}`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("\n🤔 QUAL ENTREGA DEVERIA ESTAR ATIVA?");
  console.log("Identifique qual entrega foi cancelada por engano.");
}

listEntregasDetalhadas()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
