# Adicionar Rota de Verificação de Token

Adicione este código no arquivo `server/routes.ts` APÓS a rota `/api/auth/forgot-password` (linha 409) e ANTES da rota `/api/auth/reset-password` (linha 411):

```typescript
  // POST /api/auth/verify-reset-token - Verificar se o token é válido
  app.post("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          message: "Token obrigatório",
          valid: false
        });
      }

      // Buscar token no banco de dados
      const resetToken = await storage.getPasswordResetToken(token);

      if (!resetToken) {
        return res.json({
          message: "Token inválido ou expirado",
          valid: false
        });
      }

      // Verificar se o token já foi usado
      if (resetToken.used) {
        return res.json({
          message: "Este token já foi utilizado",
          valid: false
        });
      }

      // Verificar se o token expirou
      if (new Date() > resetToken.expiresAt) {
        return res.json({
          message: "Token expirado",
          valid: false
        });
      }

      return res.json({
        message: "Token válido",
        valid: true
      });
    } catch (error) {
      console.error("Erro ao verificar token:", error);
      return res.status(500).json({
        message: "Erro interno do servidor",
        valid: false
      });
    }
  });
```

Esta rota permite que o app Flutter verifique se o código/token digitado pelo usuário é válido antes de prosseguir para a tela de redefinição de senha.
