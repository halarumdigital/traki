import { db } from "./server/db";
import { drivers } from "./shared/schema";
import { eq } from "drizzle-orm";

async function fixCounter() {
  try {
    console.log("🔧 Corrigindo contador do motorista ze1@gmail.com...");

    // Atualizar contador para 2 (valor correto)
    await db
      .update(drivers)
      .set({ monthlyDeliveryCount: 2 })
      .where(eq(drivers.email, "ze1@gmail.com"));

    console.log("✅ Contador corrigido para 2");

    // Verificar
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze1@gmail.com"))
      .limit(1);

    console.log("\n📊 Contador atualizado:", driver?.monthlyDeliveryCount);

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

fixCounter();
