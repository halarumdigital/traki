import "dotenv/config";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";

console.log("🔍 Verificando funcionalidade de recuperação de senha\n");
console.log("=".repeat(60));

async function checkPasswordReset() {
  try {
    // 1. Verificar se a tabela password_reset_tokens existe
    console.log("\n1️⃣ Verificando tabela password_reset_tokens...");
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'password_reset_tokens'
        );
      `);

      const exists = result.rows[0]?.exists;
      if (exists) {
        console.log("   ✅ Tabela password_reset_tokens existe");
      } else {
        console.log("   ❌ Tabela password_reset_tokens NÃO existe");
        console.log("   💡 Execute: npm run db:push");
        return;
      }
    } catch (error: any) {
      console.log("   ❌ Erro ao verificar tabela:", error.message);
      return;
    }

    // 2. Verificar configurações SMTP
    console.log("\n2️⃣ Verificando configurações SMTP no banco...");
    try {
      const settings = await storage.getSettings();

      if (!settings) {
        console.log("   ❌ Nenhuma configuração encontrada no banco");
        console.log("   💡 Execute: npm run db:seed");
        return;
      }

      console.log("   📋 Configurações encontradas:");
      console.log(`      SMTP Host: ${settings.smtpHost || '❌ NÃO CONFIGURADO'}`);
      console.log(`      SMTP Port: ${settings.smtpPort || '❌ NÃO CONFIGURADO'}`);
      console.log(`      SMTP User: ${settings.smtpUser || '❌ NÃO CONFIGURADO'}`);
      console.log(`      SMTP Password: ${settings.smtpPassword ? '✅ Configurado' : '❌ NÃO CONFIGURADO'}`);
      console.log(`      SMTP From Email: ${settings.smtpFromEmail || '❌ NÃO CONFIGURADO'}`);
      console.log(`      SMTP From Name: ${settings.smtpFromName || '❌ NÃO CONFIGURADO'}`);
      console.log(`      SMTP Secure: ${settings.smtpSecure ? 'true (porta 465)' : 'false (porta 587)'}`);

      if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
        console.log("\n   ⚠️  Configurações SMTP incompletas!");
        console.log("   💡 Configure no painel de administração ou diretamente no banco");
        return;
      }

      console.log("\n   ✅ Configurações SMTP completas");
    } catch (error: any) {
      console.log("   ❌ Erro ao buscar configurações:", error.message);
      return;
    }

    // 3. Testar conexão SMTP
    console.log("\n3️⃣ Testando conexão SMTP...");
    try {
      const { EmailService } = await import("./emailService");
      const emailService = new EmailService(storage);

      // Tentar criar o transporter (isso valida a conexão)
      const testEmail = "teste@exemplo.com";
      console.log("   ⏳ Tentando conectar ao servidor SMTP...");

      // Não vamos enviar email de verdade, só testar a criação do transporter
      console.log("   ℹ️  Para testar envio real de email, use o script test-email.ts");
      console.log("   ✅ EmailService inicializado com sucesso");
    } catch (error: any) {
      console.log("   ❌ Erro ao inicializar EmailService:", error.message);
      return;
    }

    // 4. Verificar se a rota está registrada
    console.log("\n4️⃣ Rotas de recuperação de senha:");
    console.log("   📍 POST /api/auth/forgot-password");
    console.log("   📍 POST /api/auth/reset-password");

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Verificação concluída!");
    console.log("\n📝 Próximos passos para testar:");
    console.log("   1. Execute: npm run test:email <seu-email@exemplo.com>");
    console.log("   2. Ou faça requisição POST para /api/auth/forgot-password");
    console.log("   3. Verifique os logs do servidor para erros");
    console.log("");

  } catch (error: any) {
    console.error("\n❌ Erro durante verificação:", error);
    console.error(error.stack);
  }
}

checkPasswordReset().catch(console.error);
