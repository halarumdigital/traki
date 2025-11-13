# API de Notificações do Motorista

## Endpoint: GET /api/v1/driver/notifications

Este endpoint retorna todas as notificações enviadas para um motorista específico, incluindo:
- Notificações direcionadas especificamente ao motorista
- Notificações enviadas para todos os motoristas da cidade do motorista

### Autenticação

O endpoint requer autenticação via token do motorista.

**Headers obrigatórios:**
```
Authorization: Bearer {driver_auth_token}
```
ou
```
token: {driver_auth_token}
```

### Resposta

**Sucesso (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-da-notificacao",
      "title": "Nova entrega disponível",
      "body": "Uma nova entrega está disponível em sua região",
      "data": {
        "delivery_id": "123",
        "additional_info": "..."
      },
      "type": "city",
      "date": "2025-11-13T10:30:00.000Z",
      "createdAt": "2025-11-13T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

**Campos da resposta:**
- `id`: ID único da notificação
- `title`: Título da notificação
- `body`: Corpo/mensagem da notificação
- `data`: Dados adicionais em formato JSON (pode ser null)
- `type`: Tipo de notificação ("driver" para individual, "city" para cidade)
- `date`: Data de envio da notificação (ou criação se não enviada)
- `createdAt`: Data de criação da notificação

### Erros

**Token não fornecido (401):**
```json
{
  "success": false,
  "message": "Token não fornecido"
}
```

**Token inválido (401):**
```json
{
  "success": false,
  "message": "Token inválido"
}
```

**Erro interno (500):**
```json
{
  "success": false,
  "message": "Erro ao buscar notificações"
}
```

### Características

- **Limite**: Retorna até 50 notificações mais recentes
- **Ordenação**: Notificações ordenadas por data de criação (mais recentes primeiro)
- **Filtros**: Apenas notificações com status "sent" são retornadas
- **Escopo**: Motorista vê apenas notificações suas ou de sua cidade

### Como testar

#### 1. Usando o script de teste simples:

```bash
# Com um token válido de motorista
node test-driver-notifications-simple.mjs driver_token_xxxxx
```

#### 2. Usando cURL:

```bash
curl -X GET http://localhost:5000/api/v1/driver/notifications \
  -H "Authorization: Bearer driver_token_xxxxx" \
  -H "Content-Type: application/json"
```

#### 3. Usando o script completo (busca token no banco):

```bash
# Usar o primeiro motorista com token válido
node test-driver-notifications.mjs

# Ou especificar um motorista pelo ID
node test-driver-notifications.mjs driver-id-aqui
```

### Integração com o App

No aplicativo móvel, você pode fazer a requisição assim:

```javascript
// React Native / Expo
const fetchNotifications = async () => {
  try {
    const response = await fetch('https://api.exemplo.com/api/v1/driver/notifications', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${driverToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.success) {
      // Processar notificações
      console.log('Notificações:', data.data);
    } else {
      // Tratar erro
      console.error('Erro:', data.message);
    }
  } catch (error) {
    console.error('Erro de rede:', error);
  }
};
```

### Estrutura no Banco de Dados

As notificações são armazenadas na tabela `push_notifications` com os seguintes campos principais:
- `id`: UUID único
- `title`: Título da notificação
- `body`: Corpo da mensagem
- `data`: JSON com dados adicionais
- `targetType`: Tipo de alvo ("driver" ou "city")
- `targetId`: ID do motorista (quando targetType = "driver")
- `targetCityId`: ID da cidade (quando targetType = "city")
- `status`: Status da notificação ("pending", "sent", "failed")
- `createdAt`: Data de criação
- `sentAt`: Data de envio

### Observações

1. **Performance**: O endpoint limita a resposta a 50 notificações para evitar sobrecarga
2. **Segurança**: Cada motorista só pode ver suas próprias notificações ou as da sua cidade
3. **Cache**: Considere implementar cache no app para reduzir requisições
4. **Paginação**: Para apps com muitas notificações, considere adicionar paginação futuramente