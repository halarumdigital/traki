# Validação de Entregas - Regras para Motoristas

## Resumo das Regras
1. Motorista com entrega em andamento não pode aceitar outra até marcar como "retirado"
2. Somente após marcar como retirado, pode aceitar nova entrega
3. Para abrir a nova entrega aceita, deve finalizar a que está retirada

## Alterações Necessárias

### 1. Endpoint: POST /api/v1/driver/requests/:id/accept (linha ~5395)

Adicionar a seguinte validação APÓS o log de "aceitando solicitação" e ANTES de "Verificar se a solicitação ainda está disponível":

```typescript
// 🔒 NOVA VALIDAÇÃO: Verificar se o motorista já tem uma entrega em andamento
const [activeDelivery] = await db
  .select()
  .from(requests)
  .where(
    and(
      eq(requests.driverId, driverId),
      eq(requests.isCompleted, false),
      eq(requests.isCancelled, false)
    )
  )
  .limit(1);

if (activeDelivery) {
  // Se tiver uma entrega ativa, verificar se já foi retirada
  if (!activeDelivery.isTripStart) {
    console.log(`❌ Motorista ${driverId} tentou aceitar nova entrega sem ter retirado a anterior (${activeDelivery.requestNumber})`);
    return res.status(409).json({
      message: "Você já possui uma entrega em andamento. Retire o pedido antes de aceitar uma nova entrega.",
      code: "DELIVERY_IN_PROGRESS_NOT_PICKED_UP",
      activeDeliveryId: activeDelivery.id,
      activeDeliveryNumber: activeDelivery.requestNumber
    });
  }

  // Se já retirou, pode aceitar nova entrega (mas ainda não pode abrir a nova até finalizar a atual)
  console.log(`⚠️ Motorista ${driverId} já tem entrega retirada (${activeDelivery.requestNumber}), mas pode aceitar nova`);
}
```

### Localização Exata no Arquivo

Procure por:
```typescript
console.log(`✅ Motorista ${driverId} aceitando solicitação ${requestId}`);

// Verificar se a solicitação ainda está disponível
```

E adicione o código de validação entre essas duas linhas.

## Como Funciona

### Cenário 1: Motorista sem entregas
- ✅ Pode aceitar entrega normalmente

### Cenário 2: Motorista com entrega aceita mas não retirada
- ❌ **NÃO** pode aceitar nova entrega
- Recebe mensagem: "Você já possui uma entrega em andamento. Retire o pedido antes de aceitar uma nova entrega."
- Precisa primeiro ir ao local de retirada e marcar como retirado

### Cenário 3: Motorista com entrega retirada (isTripStart = true)
- ✅ **PODE** aceitar nova entrega
- A nova entrega fica "aguardando" até que finalize a atual
- Quando finalizar a atual (completa ou cancela), pode então iniciar a nova

## Fluxo Completo de Entregas

1. **Aceitar** (`/accept`) → `isDriverStarted: true`, `onDelivery: true`
2. **Chegou para retirar** (`/arrived-pickup`) → `isDriverArrived: true`
3. **Retirou pedido** (`/picked-up`) → `isTripStart: true` ⬅️ **LIBERA PARA ACEITAR NOVA**
4. **Entregou** (`/delivered`) → `deliveredAt: timestamp`
5. **Finalizar** (`/complete` ou `/complete-return`) → `isCompleted: true`, `onDelivery: false`

## Status da Entrega no Banco

- `isDriverStarted`: Motorista aceitou
- `isDriverArrived`: Motorista chegou no local de retirada
- `isTripStart`: Motorista retirou o pedido ⬅️ **PONTO CRÍTICO**
- `isCompleted`: Entrega finalizada
- `isCancelled`: Entrega cancelada

## Testando as Regras

### Teste 1: Aceitar sem ter entrega
```bash
POST /api/v1/driver/requests/:id/accept
# Resultado esperado: 200 OK, entrega aceita
```

### Teste 2: Tentar aceitar tendo entrega não retirada
```bash
# Já tem uma entrega aceita (isTripStart = false)
POST /api/v1/driver/requests/:new-id/accept
# Resultado esperado: 409 Conflict
# Mensagem: "Você já possui uma entrega em andamento. Retire o pedido antes de aceitar uma nova entrega."
```

### Teste 3: Aceitar após retirar a anterior
```bash
# 1. Marcar como retirado
POST /api/v1/driver/deliveries/:id/picked-up
# 2. Aceitar nova entrega
POST /api/v1/driver/requests/:new-id/accept
# Resultado esperado: 200 OK, nova entrega aceita
```

## Imports Necessários

Certifique-se de que estes imports estão no topo do arquivo routes.ts:
```typescript
import { and, eq } from "drizzle-orm";
import { requests } from "@shared/schema";
```

## Próximos Passos Opcionais

Pode-se também adicionar validações em:
1. **Sistema de notificações**: Não enviar notificações para motoristas que têm entregas não retiradas
2. **Endpoint de listagem**: Indicar visualmente para o motorista que ele precisa retirar antes de aceitar novas
3. **Dashboard admin**: Mostrar status de motoristas com entregas pendentes de retirada
