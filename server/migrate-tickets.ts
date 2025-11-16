import { pool } from "./db";
import fs from "fs";
import path from "path";

async function runMigration() {
  try {
    console.log("🔄 Executando migração de tickets...");

    // Ler o arquivo SQL
    const sqlPath = path.join(process.cwd(), "migrations", "create_tickets.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Executar SQL
    await pool.query(sql);

    console.log("✅ Migração executada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migração:", error);
    process.exit(1);
  }
}

runMigration();
