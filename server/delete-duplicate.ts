import { db } from "./db";
import { viagemEntregas } from "../shared/schema";
import { eq } from "drizzle-orm";

const viagemId = "1dc32a2d-4f83-4ee7-8de1-ab7d6c9bdb2d";

async function main() {
  const entregas = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.viagemId, viagemId))
    .orderBy(viagemEntregas.ordemEntrega);

  console.log(`Total: ${entregas.length} entregas\n`);

  entregas.forEach((e, i) => {
    console.log(`[${i + 1}] ${e.destinatarioNome} - paradaId: ${e.paradaId || 'NULL'}`);
    console.log(`    ID: ${e.id}`);
    console.log(`    Criado em: ${e.createdAt}\n`);
  });

  // Deletar a duplicada (ordem 2 - bed6ea66-eaa7-49b8-b087-1dfb187c8985)
  if (entregas.length === 3 && entregas[0].destinatarioNome === entregas[1].destinatarioNome) {
    console.log(`🗑️ Deletando entrega duplicada (${entregas[1].id})...`);
    await db.delete(viagemEntregas).where(eq(viagemEntregas.id, entregas[1].id));
    console.log(`✅ Deletada!`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
