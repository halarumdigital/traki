# Sistema de Retorno ao Ponto de Origem - Documentação Mobile

## 📋 Visão Geral

Quando uma entrega possui a flag `needsReturn = true`, o motorista precisa retornar ao ponto de origem após entregar o produto ao cliente. Durante todo o processo de retorno, o motorista permanece "em entrega" e não pode aceitar novas solicitações.

## 🔄 Fluxo Completo de Entrega com Retorno

### Fluxo Normal (needsReturn = false)
```
1. Motorista aceita entrega
2. Motorista chega no local de retirada
3. Motorista inicia viagem
4. Motorista entrega produto → ✅ ENTREGA FINALIZADA (motorista disponível)
```

### Fluxo com Retorno (needsReturn = true)
```
1. Motorista aceita entrega
2. Motorista chega no local de retirada
3. Motorista inicia viagem
4. Motorista entrega produto → ⚠️ AGUARDANDO RETORNO (motorista ainda em entrega)
5. Motorista inicia retorno → 🔄 RETORNANDO (motorista ainda em entrega)
6. Motorista chega de volta → ✅ ENTREGA FINALIZADA (motorista disponível)
```

## 🎯 Status da Entrega

| Status | Descrição | Motorista Disponível |
|--------|-----------|---------------------|
| `pending` | Aguardando motorista | ✅ Sim |
| `accepted` | Motorista aceitou | ❌ Não |
| `arrived_pickup` | Motorista chegou para retirada | ❌ Não |
| `in_progress` | Em andamento | ❌ Não |
| `delivered_awaiting_return` | **Entregue, aguardando retorno** | ❌ Não |
| `returning` | **Retornando ao ponto de origem** | ❌ Não |
| `completed` | Concluída | ✅ Sim |
| `cancelled` | Cancelada | ✅ Sim |

## 📡 Novos Endpoints

### 1. POST /api/v1/driver/deliveries/:id/delivered
**Marcar produto como entregue ao cliente**

**Comportamento modificado:**
- Se `needsReturn = false`: Finaliza a entrega completamente
- Se `needsReturn = true`: Marca como entregue mas não finaliza (aguarda retorno)

#### Request
```http
POST /api/v1/driver/deliveries/{deliveryId}/delivered
Authorization: Bearer {token}
Content-Type: application/json
```

#### Response - Sem retorno (needsReturn = false)
```json
{
  "success": true,
  "message": "Entrega finalizada com sucesso",
  "data": {
    "status": "completed",
    "needsReturn": false
  }
}
```

#### Response - Com retorno (needsReturn = true)
```json
{
  "success": true,
  "message": "Produto entregue. Retorne ao ponto de origem para finalizar.",
  "data": {
    "status": "delivered_awaiting_return",
    "needsReturn": true
  }
}
```

#### Validações
- ✅ Motorista deve estar autenticado
- ✅ Entrega deve pertencer ao motorista
- ✅ Entrega deve estar em andamento

---

### 2. POST /api/v1/driver/deliveries/:id/start-return (NOVO)
**Iniciar retorno ao ponto de origem**

Este endpoint deve ser chamado quando o motorista começar a voltar para o ponto de retirada.

#### Request
```http
POST /api/v1/driver/deliveries/{deliveryId}/start-return
Authorization: Bearer {token}
Content-Type: application/json
```

#### Response - Sucesso
```json
{
  "success": true,
  "message": "Retorno iniciado",
  "data": {
    "status": "returning"
  }
}
```

#### Response - Erros
```json
// Entrega não requer retorno
{
  "success": false,
  "message": "Esta entrega não requer retorno"
}

// Produto não foi entregue ainda
{
  "success": false,
  "message": "Você precisa entregar o produto primeiro"
}

// Não autenticado
{
  "success": false,
  "message": "Não autenticado"
}

// Entrega não pertence ao motorista
{
  "success": false,
  "message": "Esta entrega não pertence a você"
}
```

#### Validações
- ✅ Motorista deve estar autenticado
- ✅ Entrega deve pertencer ao motorista
- ✅ Entrega deve requerer retorno (`needsReturn = true`)
- ✅ Produto deve ter sido entregue (`deliveredAt` não null)

---

### 3. POST /api/v1/driver/deliveries/:id/complete-return (NOVO)
**Confirmar chegada de volta ao ponto de origem**

Este endpoint deve ser chamado quando o motorista chegar de volta ao local de retirada.

#### Request
```http
POST /api/v1/driver/deliveries/{deliveryId}/complete-return
Authorization: Bearer {token}
Content-Type: application/json
```

#### Response - Sucesso
```json
{
  "success": true,
  "message": "Entrega finalizada com sucesso",
  "data": {
    "status": "completed"
  }
}
```

#### Response - Erros
```json
// Entrega não requer retorno
{
  "success": false,
  "message": "Esta entrega não requer retorno"
}

// Retorno não foi iniciado
{
  "success": false,
  "message": "Você precisa iniciar o retorno primeiro"
}

// Não autenticado
{
  "success": false,
  "message": "Não autenticado"
}

// Entrega não pertence ao motorista
{
  "success": false,
  "message": "Esta entrega não pertence a você"
}
```

#### Validações
- ✅ Motorista deve estar autenticado
- ✅ Entrega deve pertencer ao motorista
- ✅ Entrega deve requerer retorno (`needsReturn = true`)
- ✅ Retorno deve ter sido iniciado (`returningAt` não null)

---

## 📱 Implementação Recomendada no App Mobile

### 1. Verificar flag needsReturn
Ao buscar os detalhes da entrega, verificar se `needsReturn = true`:

```javascript
// Exemplo de estrutura de dados
{
  "id": "abc123",
  "requestNumber": "REQ001",
  "needsReturn": true,  // ← IMPORTANTE!
  "status": "in_progress",
  "pickupAddress": "Rua A, 123",
  "dropoffAddress": "Rua B, 456",
  // ... outros campos
}
```

### 2. Modal de Notificação - Aviso de Retorno

**⚠️ IMPORTANTE:** Quando `needsReturn = true`, o modal de notificação de nova entrega DEVE exibir um aviso destacado para o motorista.

#### Layout do Modal com Aviso

```
┌─────────────────────────────────────┐
│  🚚 Nova Entrega Disponível!        │
│                                     │
│  Jennifer e Felipe Pizzaria ME      │
│                                     │
│  📍 Retirada:                       │
│  Xv de Novembro, 500, Centro        │
│  Joaçaba - SC, Brasil               │
│                                     │
│  🚩 Entrega:                        │
│  Rua Getúlio Vargas, 200 - centro   │
│                                     │
│  📏 1 km  ⏱ 9 min                   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⚠️  ESTA ENTREGA POSSUI VOLTA   │ │
│ │                                 │ │
│ │ Você precisará retornar ao      │ │
│ │ ponto de retirada após entregar │ │
│ └─────────────────────────────────┘ │
│                                     │
│  💰 R$ 5,60                         │
│                                     │
│  [Rejeitar]  [Aceitar]              │
└─────────────────────────────────────┘
```

#### Especificações do Aviso

**Componente:** Banner/Card de Alerta

**Estilo:**
- **Background:** Amarelo claro ou laranja claro (#FFF4E6 ou similar)
- **Borda:** 2px sólida laranja/amarelo (#FFB020 ou similar)
- **Ícone:** ⚠️ (warning)
- **Texto:**
  - **Título:** "ESTA ENTREGA POSSUI VOLTA" (maiúsculas, negrito)
  - **Descrição:** "Você precisará retornar ao ponto de retirada após entregar"
- **Posição:** Entre as informações de distância/tempo e o valor
- **Padding:** 12px
- **Border radius:** 8px
- **Margin:** 16px vertical

**Código de exemplo (React Native):**

```jsx
{needsReturn && (
  <View style={styles.returnWarningContainer}>
    <View style={styles.returnWarningHeader}>
      <Text style={styles.warningIcon}>⚠️</Text>
      <Text style={styles.returnWarningTitle}>
        ESTA ENTREGA POSSUI VOLTA
      </Text>
    </View>
    <Text style={styles.returnWarningText}>
      Você precisará retornar ao ponto de retirada após entregar
    </Text>
  </View>
)}
```

**Estilos:**

```javascript
const styles = StyleSheet.create({
  returnWarningContainer: {
    backgroundColor: '#FFF4E6',
    borderWidth: 2,
    borderColor: '#FFB020',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
  },
  returnWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  returnWarningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C77700',
    flex: 1,
  },
  returnWarningText: {
    fontSize: 13,
    color: '#8B5A00',
    lineHeight: 18,
  },
});
```

### 3. Tela de Entrega - Lógica de Botões

#### Estado 1: Em andamento (status = "in_progress")
```
┌─────────────────────────────┐
│  Entregando para o cliente  │
│                             │
│  [Marcar como Entregue]     │
└─────────────────────────────┘
```

**Ação:** Chamar `/delivered`

---

#### Estado 2a: Entregue SEM retorno (needsReturn = false)
```
┌─────────────────────────────┐
│  ✅ Entrega Concluída!      │
│                             │
│  Você está disponível       │
└─────────────────────────────┘
```

**Ação:** Nenhuma - Motorista disponível para novas entregas

---

#### Estado 2b: Entregue COM retorno (status = "delivered_awaiting_return")
```
┌─────────────────────────────┐
│  ✅ Produto Entregue!       │
│                             │
│  ⚠️ Você precisa retornar   │
│  ao ponto de retirada       │
│                             │
│  📍 Endereço de retorno:    │
│  Rua A, 123                 │
│                             │
│  [Iniciar Retorno]          │
└─────────────────────────────┘
```

**Ação:** Chamar `/start-return`

---

#### Estado 3: Retornando (status = "returning")
```
┌─────────────────────────────┐
│  🔄 Retornando...           │
│                             │
│  📍 Volte para:             │
│  Rua A, 123                 │
│                             │
│  [Cheguei no Local]         │
└─────────────────────────────┘
```

**Ação:** Chamar `/complete-return`

---

#### Estado 4: Retorno Concluído (status = "completed")
```
┌─────────────────────────────┐
│  ✅ Entrega Concluída!      │
│                             │
│  Você está disponível       │
└─────────────────────────────┘
```

**Ação:** Nenhuma - Motorista disponível para novas entregas

---

## 💡 Exemplo de Código (Pseudocódigo)

```javascript
// Função para marcar entrega como entregue
async function markAsDelivered(deliveryId) {
  try {
    const response = await api.post(`/api/v1/driver/deliveries/${deliveryId}/delivered`);

    if (response.data.needsReturn) {
      // Mostrar tela de retorno
      showReturnScreen(response.data);
    } else {
      // Entrega finalizada
      showCompletedScreen();
      markDriverAvailable();
    }
  } catch (error) {
    showError(error.message);
  }
}

// Função para iniciar retorno
async function startReturn(deliveryId) {
  try {
    const response = await api.post(`/api/v1/driver/deliveries/${deliveryId}/start-return`);

    // Atualizar UI para mostrar "Retornando"
    showReturningScreen();

    // Iniciar navegação para endereço de retirada
    startNavigation(delivery.pickupAddress);
  } catch (error) {
    showError(error.message);
  }
}

// Função para confirmar chegada no ponto de origem
async function completeReturn(deliveryId) {
  try {
    const response = await api.post(`/api/v1/driver/deliveries/${deliveryId}/complete-return`);

    // Entrega finalizada
    showCompletedScreen();
    markDriverAvailable();

    // Notificar motorista que está disponível para novas entregas
    showNotification("Entrega concluída! Você está disponível para novas entregas.");
  } catch (error) {
    showError(error.message);
  }
}
```

---

## 🎨 Sugestões de UX

### 1. Indicadores Visuais
- **Cor diferente** para entregas com retorno (ex: badge laranja "Requer retorno")
- **Ícone de volta** (🔄) nas entregas com needsReturn = true
- **Mapa mostrando** o ponto de retorno durante o status "returning"

### 2. Notificações
- Ao entregar: "Produto entregue! Retorne ao ponto de retirada"
- Durante retorno: "Navegando para o ponto de retirada"
- Ao concluir: "Entrega finalizada! Você está disponível novamente"

### 3. Prevenção de Erros
- **Desabilitar botão "Cheguei no Local"** até o motorista estar próximo (usar geolocalização)
- **Confirmar ação** antes de marcar como concluído
- **Mostrar distância** até o ponto de retorno

---

## 🔍 Detalhes Técnicos Importantes

### 1. Autenticação
Todos os endpoints requerem autenticação via Bearer Token:
```http
Authorization: Bearer {token_base64}
```

O token é um objeto JSON encodado em Base64:
```javascript
const token = btoa(JSON.stringify({
  type: 'driver',
  id: 'driver_id_here'
}));
```

### 2. Campos Timestamp
Novos campos disponíveis na entrega:
- `deliveredAt`: Data/hora que o produto foi entregue
- `returningAt`: Data/hora que o retorno foi iniciado
- `returnedAt`: Data/hora que chegou de volta
- `needsReturn`: Boolean indicando se precisa retornar

### 3. Socket.IO (Eventos em Tempo Real)
A empresa recebe notificações em tempo real dos novos status:
```javascript
socket.on('delivery-status-updated', (data) => {
  // data.status pode ser:
  // - 'delivered_awaiting_return'
  // - 'returning'
  // - 'completed'
});
```

---

## ⚠️ Pontos de Atenção

1. **Motorista permanece indisponível** durante todo o processo de retorno
2. **Não é possível aceitar novas entregas** até completar o retorno
3. **Validação da sequência** é feita no backend (não pode pular etapas)
4. **Preço da volta** já foi calculado e incluído no valor total da entrega
5. **Status "completed"** só é atingido após o retorno completo

---

## 📊 Fluxograma de Decisão

```
┌─────────────────────────┐
│ Motorista entregou?     │
└────────┬────────────────┘
         │
         ▼
    ┌────────┐
    │ POST   │
    │/delivered
    └────┬───┘
         │
         ▼
  ┌──────────────┐
  │ needsReturn? │
  └──┬────────┬──┘
     │        │
    Sim      Não
     │        │
     ▼        ▼
┌──────┐  ┌──────────┐
│Status│  │ Status   │
│await │  │completed │
│return│  └──────────┘
└──┬───┘  ✅ FIM
   │
   ▼
┌──────────┐
│ POST     │
│/start-   │
│return    │
└────┬─────┘
     │
     ▼
┌──────────┐
│ Status   │
│returning │
└────┬─────┘
     │
     ▼
┌──────────┐
│ POST     │
│/complete-│
│return    │
└────┬─────┘
     │
     ▼
┌──────────┐
│ Status   │
│completed │
└──────────┘
✅ FIM
```

---

## 🧪 Casos de Teste

### Caso 1: Entrega Normal (sem retorno)
1. ✅ Motorista marca como entregue
2. ✅ Status = completed
3. ✅ Motorista fica disponível imediatamente

### Caso 2: Entrega com Retorno (fluxo completo)
1. ✅ Motorista marca como entregue
2. ✅ Status = delivered_awaiting_return
3. ✅ Motorista inicia retorno
4. ✅ Status = returning
5. ✅ Motorista confirma chegada
6. ✅ Status = completed
7. ✅ Motorista fica disponível

### Caso 3: Tentativa de Pular Etapas
1. ✅ Motorista tenta completar retorno sem iniciar
2. ❌ Erro: "Você precisa iniciar o retorno primeiro"

### Caso 4: Tentativa de Iniciar Retorno Sem Entregar
1. ✅ Motorista tenta iniciar retorno sem entregar
2. ❌ Erro: "Você precisa entregar o produto primeiro"

---

## 📞 Suporte

Para dúvidas ou problemas na implementação:
- Backend: Verificar logs no servidor
- API: Testar endpoints via Postman/Insomnia
- Status: Consultar tabela `requests` no banco de dados

**Campos importantes para debug:**
```sql
SELECT
  request_number,
  needs_return,
  delivered_at,
  returning_at,
  returned_at,
  is_completed
FROM requests
WHERE id = 'delivery_id';
```

---

## 📅 Histórico de Versões

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0.0 | 11/11/2025 | Implementação inicial do sistema de retorno |

---

**Desenvolvido por:** Equipe de Backend Fretus
**Data:** 11 de Novembro de 2025
