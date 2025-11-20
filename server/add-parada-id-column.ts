import { db } from "./db";
import { sql } from "drizzle-orm";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔧 ADICIONANDO COLUNA parada_id À TABELA viagem_entregas");
  console.log("================================================================================\n");

  try {
    // Adicionar coluna parada_id
    console.log("➕ Adicionando coluna parada_id...");
    await db.execute(sql`
      ALTER TABLE viagem_entregas
      ADD COLUMN IF NOT EXISTS parada_id VARCHAR
      REFERENCES entregas_intermunicipal_paradas(id) ON DELETE CASCADE;
    `);
    console.log("✅ Coluna adicionada\n");

    console.log("================================================================================");
    console.log("\n🎉 SUCESSO!");
    console.log("Agora as viagem_entregas podem ser vinculadas às paradas!");

  } catch (error: any) {
    console.error("❌ ERRO:", error.message);
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ Script concluído");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Erro:", err);
    process.exit(1);
  });
