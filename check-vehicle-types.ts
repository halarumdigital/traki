import { db } from "./server/db";
import { vehicleTypes } from "./shared/schema";

async function checkVehicleTypes() {
  try {
    const types = await db.select().from(vehicleTypes);
    console.log("\n=== TIPOS DE VEÍCULOS CADASTRADOS ===");
    console.log(`Total: ${types.length}`);
    types.forEach(type => {
      console.log(`- ${type.name} (ID: ${type.id}, Capacidade: ${type.capacity}, Ativo: ${type.active})`);
    });
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    process.exit(0);
  }
}

checkVehicleTypes();
