import { db } from "./db";
import { drivers, driverDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function checkDriverDocs() {
  try {
    // Buscar motorista
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze12@gmail.com"))
      .limit(1);

    if (!driver) {
      console.log("❌ Motorista não encontrado");
      process.exit(0);
    }

    console.log("✅ Motorista encontrado:", driver.name);
    console.log("   ID:", driver.id);
    console.log("   Profile Picture:", driver.profilePicture);

    // Buscar documentos
    const docs = await db
      .select()
      .from(driverDocuments)
      .where(eq(driverDocuments.driverId, driver.id));

    console.log(`\n📄 Documentos (${docs.length} total):`);
    docs.forEach((doc, index) => {
      console.log(`\n${index + 1}. Documento ID: ${doc.id}`);
      console.log(`   Tipo: ${doc.documentTypeId}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   URL: ${doc.documentUrl}`);

      if (doc.documentUrl?.includes('r2.dev')) {
        console.log(`   ✅ Armazenado no R2`);
      } else if (doc.documentUrl?.startsWith('/uploads/')) {
        console.log(`   ⚠️  Armazenado localmente (antigo)`);
      }
    });

    process.exit(0);
  } catch (error) {
    console.error("Erro:", error);
    process.exit(1);
  }
}

checkDriverDocs();
