import { db } from "./server/db";
import { brands, vehicleModels } from "./shared/schema";

async function checkBrandsAndModels() {
  try {
    const brandsList = await db.select().from(brands);
    console.log("\n=== MARCAS CADASTRADAS ===");
    console.log(`Total: ${brandsList.length}`);
    brandsList.forEach(brand => {
      console.log(`- ${brand.name} (ID: ${brand.id}, Ativa: ${brand.active})`);
    });

    const modelsList = await db.select().from(vehicleModels);
    console.log("\n=== MODELOS CADASTRADOS ===");
    console.log(`Total: ${modelsList.length}`);
    modelsList.forEach(model => {
      console.log(`- ${model.name} (Brand ID: ${model.brandId}, Ativo: ${model.active})`);
    });
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    process.exit(0);
  }
}

checkBrandsAndModels();
