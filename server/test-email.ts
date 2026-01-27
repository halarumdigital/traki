import "dotenv/config";
import { storage } from "./storage";
import { EmailService } from "./emailService";
import crypto from "crypto";

const testEmail = process.argv[2];

if (!testEmail) {
  console.error("❌ Erro: Email não fornecido");
  console.log("\n📖 Uso: npm run test:email <seu-email@exemplo.com>");
  console.log("Exemplo: npm run test:email usuario@gmail.com\n");
  process.exit(1);
}

// Validar formato de email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(testEmail)) {
  console.error("❌ Erro: Email inválido");
  process.exit(1);
}

console.log("📧 Testando envio de email de recuperação de senha\n");
console.log("=".repeat(60));
console.log(`\n📮 Email de destino: ${testEmail}`);

async function testPasswordResetEmail() {
  try {
    // 1. Verificar configurações SMTP
    console.log("\n1️⃣ Verificando configurações SMTP...");
    const settings = await storage.getSettings();

    if (!settings || !settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      console.log("   ❌ Configurações SMTP não encontradas ou incompletas");
      console.log("\n   Configurações atuais:");
      console.log(`      SMTP Host: ${settings?.smtpHost || 'NÃO CONFIGURADO'}`);
      console.log(`      SMTP Port: ${settings?.smtpPort || 'NÃO CONFIGURADO'}`);
      console.log(`      SMTP User: ${settings?.smtpUser || 'NÃO CONFIGURADO'}`);
      console.log(`      SMTP Password: ${settings?.smtpPassword ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
      console.log(`      SMTP From Email: ${settings?.smtpFromEmail || 'NÃO CONFIGURADO'}`);
      console.log(`      SMTP From Name: ${settings?.smtpFromName || 'NÃO CONFIGURADO'}`);
      console.log("\n   💡 Configure as credenciais SMTP no banco de dados");
      process.exit(1);
    }

    console.log("   ✅ Configurações SMTP encontradas");
    console.log(`      Host: ${settings.smtpHost}`);
    console.log(`      Port: ${settings.smtpPort}`);
    console.log(`      User: ${settings.smtpUser}`);
    console.log(`      From: ${settings.smtpFromEmail || settings.smtpUser}`);

    // 2. Inicializar EmailService
    console.log("\n2️⃣ Inicializando EmailService...");
    const emailService = new EmailService(storage);
    console.log("   ✅ EmailService inicializado");

    // 3. Gerar token de teste
    console.log("\n3️⃣ Gerando token de teste...");
    const resetToken = crypto.randomBytes(32).toString('hex');
    console.log(`   ✅ Token gerado: ${resetToken.substring(0, 16)}...`);

    // 4. Enviar email
    console.log("\n4️⃣ Enviando email de recuperação de senha...");
    console.log("   ⏳ Aguarde...");

    const appUrl = process.env.CLIENT_URL || "http://localhost:5173";

    const emailSent = await emailService.sendPasswordResetEmail(
      testEmail,
      "Usuário Teste",
      resetToken,
      appUrl
    );

    if (emailSent) {
      console.log("\n✅ Email enviado com sucesso!");
      console.log("\n📋 Detalhes:");
      console.log(`   Para: ${testEmail}`);
      console.log(`   De: ${settings.smtpFromEmail || settings.smtpUser}`);
      console.log(`   Link de recuperação: ${appUrl}/redefinir-senha?token=${resetToken}`);
      console.log("\n💡 Verifique sua caixa de entrada (e spam) do email fornecido");
    } else {
      console.log("\n❌ Falha ao enviar email");
      console.log("\n🔍 Possíveis causas:");
      console.log("   1. Credenciais SMTP incorretas");
      console.log("   2. Servidor SMTP bloqueando conexão");
      console.log("   3. Porta SMTP bloqueada no firewall");
      console.log("   4. Email 'De' não autorizado pelo servidor SMTP");
      console.log("\n💡 Verifique os logs detalhados acima para mais informações");
    }

    console.log("\n" + "=".repeat(60));

  } catch (error: any) {
    console.error("\n❌ Erro ao testar envio de email:", error);
    console.error("\nDetalhes do erro:");
    console.error(error.stack);

    console.log("\n🔍 Possíveis soluções:");
    console.log("   1. Verifique se as configurações SMTP estão corretas");
    console.log("   2. Teste as credenciais em um cliente de email");
    console.log("   3. Verifique se o servidor SMTP permite conexões de apps externos");
    console.log("   4. Para Gmail, ative 'Senhas de app' se usar 2FA");
    console.log("");

    process.exit(1);
  }
}

testPasswordResetEmail();
