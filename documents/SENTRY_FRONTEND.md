# Sentry Frontend Integration

## Configuração

O Sentry foi integrado no frontend React do Fretus para monitoramento de erros e performance.

### Instalação

```bash
npm install --save @sentry/react
```

### Variáveis de Ambiente

Configurar no arquivo `client/.env`:

```env
VITE_SENTRY_DSN=https://c69c591b1e28b30a238e44a6b585aa91@o4510357593260032.ingest.us.sentry.io/4510357688877056
VITE_SENTRY_ENVIRONMENT=development
VITE_APP_VERSION=1.0.0
```

Para produção, altere `VITE_SENTRY_ENVIRONMENT` para `production`.

## Recursos Implementados

### 1. Captura Automática de Erros

- Erros JavaScript não tratados
- Promises rejeitadas
- Erros de componentes React (via Error Boundary)

### 2. Error Boundary

Componente `ErrorBoundary` que captura erros em toda a árvore de componentes React:

```tsx
import ErrorBoundary from "@/components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      {/* Sua aplicação */}
    </ErrorBoundary>
  );
}
```

### 3. Identificação de Usuário

Quando o usuário faz login, suas informações são enviadas ao Sentry:

```tsx
setUser({
  id: user.id,
  email: user.email,
  username: user.nome,
});
```

### 4. Breadcrumbs

Rastreamento automático de ações do usuário para melhor contexto dos erros:

```tsx
addBreadcrumb({
  message: "User performed action",
  category: "user-action",
  level: "info",
  data: { /* dados adicionais */ }
});
```

### 5. Performance Monitoring

- Rastreamento de transações
- Métricas de Web Vitals
- Tempo de carregamento de páginas

### 6. Session Replay

- 10% das sessões são gravadas
- 100% das sessões com erro são gravadas

## Hook Customizado

Use o hook `useSentry` para interagir com o Sentry:

```tsx
import { useSentry } from "@/hooks/use-sentry";

function MyComponent() {
  const { captureException, captureMessage, setUser, addBreadcrumb } = useSentry();

  // Capturar exceção
  try {
    // código
  } catch (error) {
    captureException(error, {
      component: "MyComponent",
      action: "fetchData"
    });
  }

  // Capturar mensagem
  captureMessage("Something unusual happened", "warning");

  // Adicionar breadcrumb
  addBreadcrumb({
    message: "Button clicked",
    category: "ui",
    level: "info"
  });
}
```

## Filtragem de Erros

No ambiente de desenvolvimento, erros de rede são filtrados para reduzir ruído:

```tsx
beforeSend(event, hint) {
  if (import.meta.env.DEV && error?.message?.includes("Network")) {
    return null; // Não envia o erro
  }
  return event;
}
```

## Sample Rates

- **Development**: 100% das transações são capturadas
- **Production**: 10% das transações são capturadas (para economizar cota)

## Testando a Integração

Para testar se o Sentry está funcionando:

1. Abra o console do navegador
2. Execute: `throw new Error("Test Sentry Error")`
3. Verifique no dashboard do Sentry se o erro foi capturado

## Dashboard do Sentry

Acesse: https://sentry.io/organizations/fretus/projects/fretus-web/

## Troubleshooting

### Erro não aparece no Sentry

1. Verifique se o DSN está correto no `.env`
2. Confirme que o Sentry foi inicializado (verifique o console)
3. Em desenvolvimento, alguns erros são filtrados

### Performance lenta

Ajuste os sample rates:
- Reduza `tracesSampleRate` em produção
- Desative `replaysSessionSampleRate` se necessário

### Informações sensíveis

Por padrão, `sendDefaultPii: true` está ativado. Para desativar:

```tsx
Sentry.init({
  sendDefaultPii: false, // Não envia IPs e outras PII
});
```