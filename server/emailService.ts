import nodemailer, { type Transporter } from "nodemailer";
import type { IStorage } from "./storage";

export class EmailService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  private async createTransporter(): Promise<Transporter | null> {
    try {
      // Buscar configurações SMTP do banco de dados
      const settings = await this.storage.getSettings();

      if (!settings || !settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
        console.error("❌ [EMAIL] Configurações SMTP não encontradas ou incompletas");
        return null;
      }

      const port = settings.smtpPort || 587;

      // Auto-detectar se deve usar secure baseado na porta
      // Porta 465 = SSL direto (secure: true)
      // Porta 587 = STARTTLS (secure: false)
      const secure = settings.smtpSecure !== undefined
        ? settings.smtpSecure
        : (port === 465);

      console.log(`📧 [EMAIL] Criando transporter SMTP:`);
      console.log(`   Host: ${settings.smtpHost}`);
      console.log(`   Port: ${port}`);
      console.log(`   Secure: ${secure} ${port === 465 ? '(SSL)' : '(STARTTLS)'}`);
      console.log(`   User: ${settings.smtpUser}`);

      // Criar transporter com as configurações do banco
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: port,
        secure: secure,
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPassword,
        },
        tls: {
          // Não falhar em certificados auto-assinados
          rejectUnauthorized: false
        }
      });

      // Verificar conexão
      console.log(`🔌 [EMAIL] Verificando conexão SMTP...`);
      await transporter.verify();
      console.log(`✅ [EMAIL] Conexão SMTP verificada com sucesso`);
      return transporter;
    } catch (error) {
      console.error("❌ [EMAIL] Erro ao criar transporter de email:", error);
      return null;
    }
  }

  async sendPasswordResetEmail(
    userEmail: string,
    userName: string,
    resetToken: string,
    appUrl: string
  ): Promise<boolean> {
    try {
      const transporter = await this.createTransporter();
      if (!transporter) {
        return false;
      }

      const settings = await this.storage.getSettings();
      const fromEmail = settings?.smtpFromEmail || settings?.smtpUser || "noreply@app.com";
      const fromName = settings?.smtpFromName || "Sistema";

      // Template do email em HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 30px;
              border: 1px solid #e0e0e0;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2c3e50;
              margin: 0;
            }
            .content {
              background-color: white;
              padding: 25px;
              border-radius: 6px;
            }
            .code-box {
              background-color: #f0f8ff;
              border: 2px dashed #3498db;
              border-radius: 8px;
              padding: 30px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 42px;
              font-weight: bold;
              color: #2c3e50;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 12px;
              color: #7f8c8d;
              text-align: center;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Recuperação de Senha</h1>
            </div>
            <div class="content">
              <p>Olá <strong>${userName}</strong>,</p>

              <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>

              <p>Use o código abaixo no aplicativo para criar uma nova senha:</p>

              <div class="code-box">
                <div class="code">${resetToken}</div>
              </div>

              <div class="warning">
                <strong>⚠️ Importante:</strong> Este código é válido por <strong>1 hora</strong> e pode ser usado apenas uma vez.
              </div>

              <p>Se você não solicitou a recuperação de senha, ignore este email. Sua senha permanecerá inalterada.</p>
            </div>
            <div class="footer">
              <p>Este é um email automático, por favor não responda.</p>
              <p>&copy; ${new Date().getFullYear()} ${fromName}. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Versão em texto simples (fallback)
      const textContent = `
Olá ${userName},

Recebemos uma solicitação para redefinir a senha da sua conta.

Use o código abaixo no aplicativo para criar uma nova senha:

${resetToken}

IMPORTANTE: Este código é válido por 1 hora e pode ser usado apenas uma vez.

Se você não solicitou a recuperação de senha, ignore este email. Sua senha permanecerá inalterada.

---
Este é um email automático, por favor não responda.
© ${new Date().getFullYear()} ${fromName}. Todos os direitos reservados.
      `;

      // Enviar email
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: userEmail,
        subject: "Recuperação de Senha - " + fromName,
        text: textContent,
        html: htmlContent,
      });

      console.log("Email de recuperação enviado:", info.messageId);
      return true;
    } catch (error) {
      console.error("Erro ao enviar email de recuperação de senha:", error);
      return false;
    }
  }

  async sendTestEmail(toEmail: string): Promise<boolean> {
    try {
      const transporter = await this.createTransporter();
      if (!transporter) {
        return false;
      }

      const settings = await this.storage.getSettings();
      const fromEmail = settings?.smtpFromEmail || settings?.smtpUser || "noreply@app.com";
      const fromName = settings?.smtpFromName || "Sistema";

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: toEmail,
        subject: "Email de Teste - Configuração SMTP",
        text: "Este é um email de teste para verificar a configuração SMTP.",
        html: "<p>Este é um email de teste para verificar a configuração SMTP.</p>",
      });

      return true;
    } catch (error) {
      console.error("Erro ao enviar email de teste:", error);
      return false;
    }
  }
}
