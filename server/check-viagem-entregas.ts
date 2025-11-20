import { db } from "./db.js";
import { viagemEntregas } from "../shared/schema.js";

async function check() {
  const entregas = await db.select().from(viagemEntregas);
  console.log(`\n📊 Total de registros em viagem_entregas: ${entregas.length}\n`);

  if (entregas.length > 0) {
    console.log("Primeiros 5 registros:");
    entregas.slice(0, 5).forEach((e, i) => {
      console.log(`\n[${i + 1}] ID: ${e.id}`);
      console.log(`    Viagem ID: ${e.viagemId}`);
      console.log(`    Entrega ID: ${e.entregaId}`);
      console.log(`    Parada ID: ${e.paradaId}`);
      console.log(`    Endereço: ${e.enderecoEntrega}`);
      console.log(`    Destinatário: ${e.destinatarioNome}`);
      console.log(`    Status: ${e.status}`);
    });
  } else {
    console.log("❌ Tabela viagem_entregas está VAZIA!");
    console.log("\n💡 As entregas precisam ser criadas na tabela viagem_entregas");
    console.log("   quando a viagem é aceita pelo motorista.");
  }
}

check()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Erro:", err);
    process.exit(1);
  });
