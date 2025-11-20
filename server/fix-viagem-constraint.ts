import { db } from "./db";
import { sql } from "drizzle-orm";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔧 CORRIGINDO CONSTRAINT DE VIAGENS INTERMUNICIPAIS");
  console.log("================================================================================\n");

  try {
    // 1. Remover a constraint antiga
    console.log("🗑️  Removendo constraint antiga...");
    await db.execute(sql`
      ALTER TABLE viagens_intermunicipais
      DROP CONSTRAINT IF EXISTS viagens_intermunicipais_entregador_id_rota_id_data_viagem_key;
    `);
    console.log("✅ Constraint antiga removida\n");

    // 2. Criar nova constraint que só se aplica a viagens não concluídas/canceladas
    console.log("➕ Criando nova constraint (apenas para viagens ativas)...");
    await db.execute(sql`
      CREATE UNIQUE INDEX viagens_intermunicipais_active_unique
      ON viagens_intermunicipais (entregador_id, rota_id, data_viagem)
      WHERE status NOT IN ('concluida', 'cancelada');
    `);
    console.log("✅ Nova constraint criada\n");

    console.log("================================================================================");
    console.log("\n🎉 SUCESSO!");
    console.log("Agora o motorista pode:");
    console.log("  ✅ Ter apenas 1 viagem ATIVA por rota/data");
    console.log("  ✅ Criar novas viagens após concluir/cancelar a anterior");

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
