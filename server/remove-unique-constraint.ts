import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function removeUniqueConstraint() {
  console.log("🔧 REMOVENDO CONSTRAINT ÚNICA");
  console.log("=".repeat(80));

  try {
    // Remover a constraint única viagem_entregas_viagem_id_entrega_id_key
    console.log("\n🗑️  Removendo constraint viagem_entregas_viagem_id_entrega_id_key...");

    await db.execute(sql`
      ALTER TABLE viagem_entregas
      DROP CONSTRAINT IF EXISTS viagem_entregas_viagem_id_entrega_id_key;
    `);

    console.log("✅ Constraint removida com sucesso!");

    // Verificar se foi removida
    console.log("\n🔍 Verificando constraints restantes...");
    const result = await db.execute(sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'viagem_entregas'
      ORDER BY constraint_type, constraint_name;
    `);

    console.log("\nConstraints atuais:");
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
    });

    console.log("\n✅ Operação concluída!");
  } catch (error) {
    console.error("❌ Erro:", error);
    throw error;
  }
}

removeUniqueConstraint()
  .then(() => {
    console.log("\n✅ Script executado com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao executar script:", error);
    process.exit(1);
  });
