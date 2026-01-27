import "dotenv/config";
import { db } from "./db";
import { settings } from "@shared/schema";
import { sql } from "drizzle-orm";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

console.log("🔧 Configuração de SMTP para Recuperação de Senha\n");
console.log("=".repeat(60));

async function setupSMTP() {
  try {
    console.log("\n📋 Exemplos de configuração:\n");
    console.log("Gmail:");
    console.log("  Host: smtp.gmail.com");
    console.log("  Port: 587");
    console.log("  Secure: false");
    console.log("  User: seu-email@gmail.com");
    console.log("  Password: senha-de-app (gere em: https://myaccount.google.com/apppasswords)\n");

    console.log("Outlook/Hotmail:");
    console.log("  Host: smtp-mail.outlook.com");
    console.log("  Port: 587");
    console.log("  Secure: false");
    console.log("  User: seu-email@outlook.com");
    console.log("  Password: sua-senha\n");

    console.log("=".repeat(60));

    // Perguntar configurações
    const smtpHost = await question("\n📮 SMTP Host (ex: smtp.gmail.com): ");
    const smtpPortStr = await question("📮 SMTP Port (587 ou 465): ");
    const smtpPort = parseInt(smtpPortStr) || 587;
    const smtpSecureStr = await question("🔒 SMTP Secure? (true para porta 465, false para 587) [false]: ");
    const smtpSecure = smtpSecureStr.toLowerCase() === 'true';
    const smtpUser = await question("👤 SMTP User (email): ");
    const smtpPassword = await question("🔑 SMTP Password: ");
    const smtpFromEmail = await question("📧 Email remetente [" + smtpUser + "]: ") || smtpUser;
    const smtpFromName = await question("✍️  Nome remetente [Traki]: ") || "Traki";

    console.log("\n⏳ Salvando configurações no banco de dados...\n");

    // Verificar se já existe configuração
    const existingSettings = await db.select().from(settings).limit(1);

    if (existingSettings.length > 0) {
      // Atualizar
      await db.update(settings).set({
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPassword,
        smtpFromEmail,
        smtpFromName,
        updatedAt: new Date(),
      });
      console.log("✅ Configurações SMTP atualizadas com sucesso!");
    } else {
      // Criar
      await db.insert(settings).values({
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPassword,
        smtpFromEmail,
        smtpFromName,
      });
      console.log("✅ Configurações SMTP criadas com sucesso!");
    }

    console.log("\n📋 Configurações salvas:");
    console.log(`   Host: ${smtpHost}`);
    console.log(`   Port: ${smtpPort}`);
    console.log(`   Secure: ${smtpSecure}`);
    console.log(`   User: ${smtpUser}`);
    console.log(`   From: ${smtpFromName} <${smtpFromEmail}>`);

    console.log("\n🧪 Deseja testar o envio de email agora? (s/n): ");
    const testResponse = await question("");

    if (testResponse.toLowerCase() === 's' || testResponse.toLowerCase() === 'sim') {
      const testEmail = await question("\n📧 Digite o email de destino para teste: ");

      console.log("\n⏳ Enviando email de teste...\n");

      const { EmailService } = await import("./emailService");
      const { storage } = await import("./storage");
      const crypto = await import("crypto");

      const emailService = new EmailService(storage);
      const resetToken = crypto.randomBytes(32).toString('hex');
      const appUrl = process.env.CLIENT_URL || "http://localhost:5173";

      const emailSent = await emailService.sendPasswordResetEmail(
        testEmail,
        "Usuário Teste",
        resetToken,
        appUrl
      );

      if (emailSent) {
        console.log("✅ Email de teste enviado com sucesso!");
        console.log(`📧 Verifique a caixa de entrada de ${testEmail}`);
      } else {
        console.log("❌ Falha ao enviar email de teste");
        console.log("💡 Verifique as credenciais e tente novamente");
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Configuração concluída!\n");

    rl.close();
  } catch (error: any) {
    console.error("\n❌ Erro ao configurar SMTP:", error);
    console.error(error.stack);
    rl.close();
    process.exit(1);
  }
}

setupSMTP();
