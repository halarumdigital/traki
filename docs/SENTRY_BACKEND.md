# Sentry Backend Integration

## Configuração

O Sentry foi integrado na API Express do Fretus para monitoramento de erros e performance.

### Instalação

```bash
npm install --save @sentry/node
```

### Variáveis de Ambiente

Configurar no arquivo `.env` ou `server/.env`:

```env
SENTRY_DSN=https://7fef032b2f3406cfd4939726b2e286ba@o4510357593260032.ingest.us.sentry.io/4510357733638144
SENTRY_ENVIRONMENT=development
APP_VERSION=1.0.0
```

Para produção, altere `SENTRY_ENVIRONMENT` para `production`.

## Arquitetura da Integração

### 1. Inicialização (`server/instrument.ts`)

O Sentry é inicializado antes de qualquer outro código da aplicação:
- Configuração de sample rates para performance
- Filtragem de erros comuns (404, auth em dev)
- Auto-descoberta de integrações Node.js

### 2. Import no Servidor (`server/index.ts`)

```typescript
import "./instrument.js";  // IMPORTANTE: Primeira linha do arquivo
import * as Sentry from "@sentry/node";
```

### 3. Error Handler do Express

Configurado após todas as rotas, mas antes do error handler customizado:

```typescript
Sentry.setupExpressErrorHandler(app);
```

### 4. Middleware de Contexto (`server/sentry-middleware.ts`)

Adiciona informações do usuário e breadcrumbs para cada requisição:
- Identifica usuários (admin, empresa, motorista)
- Adiciona breadcrumbs de navegação
- Enriquece erros com contexto da requisição

## Recursos Implementados

### 1. Captura Automática de Erros

- Erros síncronos em rotas
- Promises rejeitadas
- Erros em middleware
- Timeouts e erros de rede

### 2. Identificação de Usuários

O middleware identifica automaticamente:
- **Administradores**: `userId`, `email`, `nome`
- **Empresas**: `companyId`, `companyName`
- **Motoristas**: `driverId`, `driverName`

### 3. Breadcrumbs

Rastreamento automático de:
- Requisições HTTP
- Queries de banco de dados
- Logs do console
- Ações customizadas

### 4. Performance Monitoring

- Rastreamento de transações HTTP
- Métricas de latência de banco de dados
- Identificação de gargalos

### 5. Contexto Enriquecido

Cada erro captura:
- Método HTTP e URL
- Headers da requisição
- Query parameters
- Body da requisição (quando aplicável)
- Sessão do usuário

## Endpoints de Teste (Development)

Disponíveis apenas em desenvolvimento para testar a integração:

### 1. Erro Simples
```bash
curl http://localhost:5010/api/test/sentry-error
```
Lança um erro simples para testar captura básica.

### 2. Mensagem Informativa
```bash
curl http://localhost:5010/api/test/sentry-message
```
Envia uma mensagem de log ao Sentry.

### 3. Erro Assíncrono
```bash
curl http://localhost:5010/api/test/sentry-async-error
```
Testa captura de erros em código assíncrono.

### 4. Erro com Contexto
```bash
curl http://localhost:5010/api/test/sentry-context
```
Envia erro com contexto customizado e nível de severidade.

## Filtragem de Erros

### Erros Ignorados em Desenvolvimento

- Erros 404
- Erros de autenticação
- Erros de rede

### Configuração de Filtragem

No arquivo `instrument.ts`:

```typescript
beforeSend(event, hint) {
  const error = hint.originalException;

  // Adicione suas regras de filtragem aqui
  if (shouldIgnoreError(error)) {
    return null; // Não envia para o Sentry
  }

  return event; // Envia para o Sentry
}
```

## Sample Rates

### Development
- **Traces**: 100% (todas as transações são capturadas)
- **Profiles**: 100%

### Production
- **Traces**: 10% (para economizar cota)
- **Profiles**: 10%

## Resposta de Erro com Sentry ID

Quando um erro é capturado, o ID do Sentry é incluído na resposta:

```json
{
  "message": "Internal Server Error",
  "sentryId": "abc123def456..."
}
```

Esse ID pode ser usado para:
- Buscar o erro específico no dashboard do Sentry
- Fornecer suporte ao cliente com rastreamento preciso

## Dashboard do Sentry

Acesse: https://sentry.io/organizations/fretus/projects/fretus-api/

## Troubleshooting

### Erro não aparece no Sentry

1. Verifique se o DSN está correto no `.env`
2. Confirme que o `instrument.ts` é importado primeiro
3. Verifique se o erro não está sendo filtrado
4. Confira os logs do servidor para erros de inicialização

### Performance lenta

- Reduza `tracesSampleRate` em produção
- Desative profiling se não necessário
- Revise integrações automáticas

### Informações sensíveis

Por padrão, `sendDefaultPii: true` está ativado. Para desativar:

```typescript
Sentry.init({
  sendDefaultPii: false, // Não envia IPs e outras PII
});
```

### Erros de CORS

O Sentry é configurado para funcionar com CORS. Se houver problemas:
1. Verifique as configurações de CORS no Express
2. Confirme que o DSN está correto

## Monitoramento Proativo

### Alertas Recomendados

Configure no dashboard do Sentry:
1. Erro crítico em produção
2. Taxa de erro acima de 1%
3. Performance degradada (P95 > 1s)
4. Novos tipos de erro

### Métricas Importantes

- Taxa de erro por endpoint
- Tempo de resposta P50, P95, P99
- Erros por usuário/empresa
- Tendências de erro ao longo do tempo

## Boas Práticas

1. **Sempre adicione contexto**: Use `Sentry.setContext()` para informações relevantes
2. **Use níveis apropriados**: `error` para crítico, `warning` para importante, `info` para rastreamento
3. **Capture manualmente quando necessário**: Para erros de negócio específicos
4. **Revise regularmente**: Analise padrões de erro semanalmente
5. **Não ignore erros recorrentes**: Corrija a causa raiz