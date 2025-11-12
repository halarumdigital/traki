import { db } from "./server/db";
import { drivers, requests } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function checkDriver() {
  try {
    // Buscar motorista
    const driver = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze1@gmail.com"))
      .limit(1);

    if (!driver.length) {
      console.log("❌ Motorista não encontrado");
      return;
    }

    console.log("\n📋 DADOS DO MOTORISTA:");
    console.log("ID:", driver[0].id);
    console.log("Nome:", driver[0].name);
    console.log("Email:", driver[0].email);
    console.log("Mobile:", driver[0].mobile);
    console.log("monthly_delivery_count (contador do app):", driver[0].monthlyDeliveryCount);

    // Contar entregas concluídas reais
    const completedDeliveries = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.driverId, driver[0].id),
          eq(requests.isCompleted, true)
        )
      );

    console.log("\n🚚 ENTREGAS CONCLUÍDAS:");
    console.log("Total de entregas concluídas no banco:", completedDeliveries.length);

    completedDeliveries.forEach((delivery, index) => {
      console.log(`\n${index + 1}. Entrega #${delivery.requestNumber}`);
      console.log("   ID:", delivery.id);
      console.log("   Cliente:", delivery.customerName);
      console.log("   Precisa voltar (needs_return):", delivery.needsReturn);
      console.log("   Criada em:", delivery.createdAt);
      console.log("   Completada em:", delivery.completedAt);
      console.log("   Voltou em (returned_at):", delivery.returnedAt);
    });

    console.log("\n⚠️ DISCREPÂNCIA:");
    console.log("Contador no app (monthly_delivery_count):", driver[0].monthlyDeliveryCount);
    console.log("Entregas realmente concluídas:", completedDeliveries.length);
    console.log("Diferença:", (driver[0].monthlyDeliveryCount || 0) - completedDeliveries.length);

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

checkDriver();
