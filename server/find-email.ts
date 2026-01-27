import "dotenv/config";
import { db } from "./db";
import { users, drivers, companies } from "@shared/schema";
import { eq, or, ilike } from "drizzle-orm";

const emailToFind = process.argv[2] || "damaceno02@hotmail.com";

console.log(`🔍 Procurando email: ${emailToFind}\n`);

async function findEmail() {
  try {
    // Buscar em users
    console.log("1️⃣ Buscando na tabela USERS...");
    const usersResult = await db
      .select()
      .from(users)
      .where(or(
        eq(users.email, emailToFind),
        ilike(users.email, emailToFind)
      ));

    if (usersResult.length > 0) {
      console.log("✅ Encontrado em USERS:");
      usersResult.forEach(user => {
        console.log(`   ID: ${user.id}`);
        console.log(`   Nome: ${user.nome}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Admin: ${user.isAdmin}`);
      });
    } else {
      console.log("❌ Não encontrado em USERS");
    }

    // Buscar em drivers
    console.log("\n2️⃣ Buscando na tabela DRIVERS...");
    const driversResult = await db
      .select()
      .from(drivers)
      .where(or(
        eq(drivers.email, emailToFind),
        ilike(drivers.email, emailToFind)
      ));

    if (driversResult.length > 0) {
      console.log("✅ Encontrado em DRIVERS:");
      driversResult.forEach(driver => {
        console.log(`   ID: ${driver.id}`);
        console.log(`   Nome: ${driver.nome}`);
        console.log(`   Email: ${driver.email}`);
      });
    } else {
      console.log("❌ Não encontrado em DRIVERS");
    }

    // Buscar em companies
    console.log("\n3️⃣ Buscando na tabela COMPANIES...");
    const companiesResult = await db
      .select()
      .from(companies)
      .where(or(
        eq(companies.email, emailToFind),
        ilike(companies.email, emailToFind)
      ));

    if (companiesResult.length > 0) {
      console.log("✅ Encontrado em COMPANIES:");
      companiesResult.forEach(company => {
        console.log(`   ID: ${company.id}`);
        console.log(`   Nome: ${company.nome}`);
        console.log(`   Email: ${company.email}`);
      });
    } else {
      console.log("❌ Não encontrado em COMPANIES");
    }

    console.log("\n" + "=".repeat(60));

    const totalFound = usersResult.length + driversResult.length + companiesResult.length;

    if (totalFound === 0) {
      console.log("\n❌ Email não encontrado em nenhuma tabela");
      console.log("\n💡 Possíveis causas:");
      console.log("   1. Email digitado incorretamente");
      console.log("   2. Usuário não cadastrado");
      console.log("   3. Email com espaços extras ou caracteres especiais");
    } else {
      console.log(`\n✅ Email encontrado em ${totalFound} tabela(s)`);
    }

  } catch (error: any) {
    console.error("\n❌ Erro:", error);
    console.error(error.stack);
  }
}

findEmail();
