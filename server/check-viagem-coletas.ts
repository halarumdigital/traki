import { db } from "./db.js";
import { viagemColetas } from "../shared/schema.js";

async function check() {
  const coletas = await db.select().from(viagemColetas);
  console.log(`\n📊 Total de registros em viagem_coletas: ${coletas.length}\n`);

  if (coletas.length > 0) {
    console.log("Primeiros 5 registros:");
    coletas.slice(0, 5).forEach((c, i) => {
      console.log(`\n[${i + 1}] ID: ${c.id}`);
      console.log(`    Viagem ID: ${c.viagemId}`);
      console.log(`    Entrega ID: ${c.entregaId}`);
      console.log(`    Endereço: ${c.enderecoColeta}`);
      console.log(`    Status: ${c.status}`);
    });
  } else {
    console.log("❌ Tabela viagem_coletas está VAZIA!");
    console.log("\n💡 Isso explica o erro: o app está enviando ID de entrega,");
    console.log("   mas o endpoint espera ID de viagem_coletas (que não existe).");
  }
}

check()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Erro:", err);
    process.exit(1);
  });
