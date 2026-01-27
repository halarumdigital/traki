import "dotenv/config";
import { db } from "./db";
import { settings } from "@shared/schema";

console.log("🔧 Corrigindo Configuração SMTP\n");
console.log("=".repeat(60));

async function fixSMTPConfig() {
  try {
    console.log("\n⏳ Atualizando configuração SMTP...\n");

    // Atualizar configuração para porta 587 com STARTTLS
    const result = await db.update(settings).set({
      smtpPort: 587,
      smtpSecure: false, // IMPORTANTE: false para porta 587 (STARTTLS)
      updatedAt: new Date(),
    });

    console.log("✅ Configuração SMTP corrigida com sucesso!\n");
    console.log("📋 Configuração atualizada:");
    console.log("   Port: 587");
    console.log("   Secure: false (STARTTLS)");
    console.log("");
    console.log("💡 Porta 587 = STARTTLS (secure: false)");
    console.log("💡 Porta 465 = SSL direto (secure: true)");
    console.log("");
    console.log("🧪 Teste o envio novamente com:");
    console.log("   npm run test:email damaceno02@hotmail.com");
    console.log("");

  } catch (error: any) {
    console.error("\n❌ Erro ao corrigir configuração:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

fixSMTPConfig();
