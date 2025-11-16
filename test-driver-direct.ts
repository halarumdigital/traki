import { db } from "./server/db.js";
import { drivers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./server/storage.js";

async function testDriverDirectly() {
  try {
    console.log("🔍 Testando diretamente o motorista ze8@gmail.com...\n");

    // 1. Buscar pelo email
    console.log("1️⃣ Buscando por EMAIL:");
    const driverByEmail = await storage.getDriverByEmail("ze8@gmail.com");
    if (driverByEmail) {
      console.log("✅ Motorista encontrado por email:");
      console.log(`   ID: ${driverByEmail.id}`);
      console.log(`   Nome: ${driverByEmail.name}`);
      console.log(`   Email: ${driverByEmail.email}`);
      console.log(`   🎫 Código: ${driverByEmail.referralCode}`);
      console.log(`   Total Entregas: ${driverByEmail.totalDeliveries}`);
    } else {
      console.log("❌ Motorista não encontrado por email");
    }

    // 2. Buscar diretamente no banco
    console.log("\n2️⃣ Buscando DIRETAMENTE no banco:");
    const [directDriver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze8@gmail.com"))
      .limit(1);

    if (directDriver) {
      console.log("✅ Motorista encontrado no banco:");
      console.log(`   ID: ${directDriver.id}`);
      console.log(`   Nome: ${directDriver.name}`);
      console.log(`   Email: ${directDriver.email}`);
      console.log(`   🎫 Código: ${directDriver.referralCode}`);
      console.log(`   Total Entregas: ${directDriver.totalDeliveries}`);
      console.log(`   Referido por: ${directDriver.referredByCode || 'Ninguém'}`);
    }

    // 3. Simular o que o endpoint retornaria
    console.log("\n3️⃣ Simulando resposta do endpoint /api/v1/driver/profile:");
    if (directDriver) {
      const response = {
        success: true,
        data: {
          id: directDriver.id,
          name: directDriver.name,
          mobile: directDriver.mobile,
          email: directDriver.email,
          referralCode: directDriver.referralCode, // <-- ESTE É O CÓDIGO QUE DEVE APARECER NO APP
          totalDeliveries: directDriver.totalDeliveries,
          referredByCode: directDriver.referredByCode,
        }
      };

      console.log("📱 Resposta JSON que deveria ir para o app:");
      console.log(JSON.stringify(response, null, 2));
    }

    // 4. Verificar se o código está único
    console.log("\n4️⃣ Verificando unicidade do código:");
    const driversWithSameCode = await db
      .select()
      .from(drivers)
      .where(eq(drivers.referralCode, "ZE60"));

    console.log(`   Motoristas com código ZE60: ${driversWithSameCode.length}`);
    driversWithSameCode.forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.name} (${d.email})`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

testDriverDirectly();