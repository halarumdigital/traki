# Alterações Necessárias no App Flutter

## Resumo da Mudança no Backend

O backend agora valida se o motorista já possui uma entrega em andamento antes de aceitar uma nova. A API retorna:

**Erro 409 (Conflict)** quando o motorista tenta aceitar nova entrega sem ter retirado a anterior:
```json
{
  "message": "Você já possui uma entrega em andamento. Retire o pedido antes de aceitar uma nova entrega.",
  "code": "DELIVERY_IN_PROGRESS_NOT_PICKED_UP",
  "activeDeliveryId": "uuid-da-entrega-ativa",
  "activeDeliveryNumber": "número-da-entrega"
}
```

## 🔧 Alterações Necessárias no Flutter

### 1. **Tratamento do Erro 409 no Endpoint de Aceitar Entrega**

Localize onde você faz a chamada para aceitar entrega (provavelmente algo como):
```dart
POST /api/v1/driver/requests/:id/accept
```

Adicione tratamento específico para o status 409:

```dart
// Exemplo de implementação
Future<void> acceptDelivery(String requestId) async {
  try {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/driver/requests/$requestId/accept'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      // Sucesso - entrega aceita
      final data = jsonDecode(response.body);
      // Atualizar UI, navegar para tela de entrega, etc.

    } else if (response.statusCode == 409) {
      // NOVO: Tratamento para entrega já em andamento
      final error = jsonDecode(response.body);

      if (error['code'] == 'DELIVERY_IN_PROGRESS_NOT_PICKED_UP') {
        // Mostrar diálogo específico
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: Text('Entrega em Andamento'),
            content: Text(
              'Você já possui uma entrega em andamento.\n\n'
              'Retire o pedido (Entrega #${error['activeDeliveryNumber']}) '
              'antes de aceitar uma nova entrega.'
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  // Opcional: Navegar para a entrega ativa
                  navigateToActiveDelivery(error['activeDeliveryId']);
                },
                child: Text('Ver Entrega Ativa'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text('OK'),
              ),
            ],
          ),
        );
      } else {
        // Outro tipo de erro 409
        showErrorSnackbar(error['message']);
      }

    } else {
      // Outros erros
      showErrorSnackbar('Erro ao aceitar entrega');
    }

  } catch (e) {
    print('Erro: $e');
    showErrorSnackbar('Erro de conexão');
  }
}
```

### 2. **Validação Preventiva (Opcional mas Recomendado)**

Antes de mostrar a notificação de nova entrega ou permitir aceitar, verifique se o motorista já tem uma entrega ativa:

```dart
// Verificar se existe entrega ativa antes de mostrar notificação
Future<bool> hasActiveDeliveryNotPickedUp() async {
  try {
    // Buscar entregas ativas do motorista
    final response = await http.get(
      Uri.parse('$baseUrl/api/v1/driver/active-delivery'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      final delivery = jsonDecode(response.body);

      // Se tem entrega ativa e NÃO foi retirada
      if (delivery != null &&
          delivery['isCompleted'] == false &&
          delivery['isCancelled'] == false &&
          delivery['isTripStart'] == false) {
        return true; // Tem entrega não retirada
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

// Usar antes de aceitar
void onNotificationReceived(DeliveryNotification notification) async {
  final hasActive = await hasActiveDeliveryNotPickedUp();

  if (hasActive) {
    // Não mostrar a notificação OU mostrar desabilitada
    showSnackbar('Retire o pedido da entrega atual antes de aceitar outra');
    return;
  }

  // Mostrar notificação normalmente
  showDeliveryNotification(notification);
}
```

### 3. **Indicador Visual de Status**

Mostre ao motorista quando ele pode ou não aceitar novas entregas:

```dart
Widget buildDeliveryStatus() {
  return StreamBuilder<Delivery?>(
    stream: activeDeliveryStream,
    builder: (context, snapshot) {
      final delivery = snapshot.data;

      if (delivery != null && !delivery.isCompleted && !delivery.isCancelled) {
        if (!delivery.isTripStart) {
          // Tem entrega não retirada - BLOQUEADO
          return Card(
            color: Colors.orange[100],
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  Icon(Icons.warning, color: Colors.orange),
                  SizedBox(height: 8),
                  Text(
                    'Retire o pedido da Entrega #${delivery.requestNumber}',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'Você não pode aceitar novas entregas até retirar o pedido atual',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12),
                  ),
                  SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () => navigateToDelivery(delivery.id),
                    child: Text('Ir para Entrega'),
                  ),
                ],
              ),
            ),
          );
        } else {
          // Tem entrega retirada - PODE aceitar novas
          return Card(
            color: Colors.blue[100],
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.info, color: Colors.blue),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Entrega #${delivery.requestNumber} em andamento. '
                      'Você pode aceitar novas entregas.',
                      style: TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          );
        }
      }

      // Sem entregas ativas
      return SizedBox.shrink();
    },
  );
}
```

### 4. **Desabilitar Botão de Aceitar (Preventivo)**

Se você tem um botão para aceitar entregas, desabilite-o quando houver entrega não retirada:

```dart
Widget buildAcceptButton(DeliveryNotification notification) {
  return FutureBuilder<bool>(
    future: hasActiveDeliveryNotPickedUp(),
    builder: (context, snapshot) {
      final isBlocked = snapshot.data ?? false;

      return ElevatedButton(
        onPressed: isBlocked
          ? null // Desabilitar botão
          : () => acceptDelivery(notification.requestId),
        style: ElevatedButton.styleFrom(
          backgroundColor: isBlocked ? Colors.grey : Colors.green,
        ),
        child: Text(
          isBlocked
            ? 'Retire o Pedido Atual Primeiro'
            : 'Aceitar Entrega',
        ),
      );
    },
  );
}
```

## 🎯 Prioridades de Implementação

### Obrigatório (Mínimo):
1. ✅ **Tratamento do erro 409** - Para não quebrar o app quando a validação ocorrer
2. ✅ **Mensagem clara ao usuário** - Explicando porque não pode aceitar

### Recomendado (Melhora UX):
3. 🔶 **Validação preventiva** - Evita que o motorista tente aceitar em vão
4. 🔶 **Indicador visual** - Mostra o status atual das entregas
5. 🔶 **Botão de navegação** - Para ir direto à entrega ativa

### Opcional (Nice to Have):
6. ⭐ **Desabilitar notificações** - Não enviar notificações quando bloqueado
7. ⭐ **Badge/indicador** - Mostrar na tela inicial que há entrega aguardando retirada

## 📱 Exemplo de Fluxo Completo

```dart
class DeliveryController extends GetxController {
  // Estado da entrega ativa
  final Rx<Delivery?> activeDelivery = Rx<Delivery?>(null);

  // Verificar se pode aceitar novas entregas
  bool get canAcceptNewDeliveries {
    final delivery = activeDelivery.value;
    if (delivery == null) return true;
    if (delivery.isCompleted || delivery.isCancelled) return true;
    return delivery.isTripStart; // Só pode se já retirou
  }

  // Aceitar entrega com validação
  Future<void> acceptDelivery(String requestId) async {
    if (!canAcceptNewDeliveries) {
      Get.snackbar(
        'Entrega em Andamento',
        'Retire o pedido atual antes de aceitar outra entrega',
        backgroundColor: Colors.orange,
      );
      return;
    }

    try {
      final response = await _apiService.acceptDelivery(requestId);

      if (response.statusCode == 200) {
        activeDelivery.value = Delivery.fromJson(response.data);
        Get.to(() => DeliveryDetailScreen(delivery: activeDelivery.value!));
      } else if (response.statusCode == 409) {
        final error = response.data;
        _handleDeliveryBlockedError(error);
      }
    } catch (e) {
      Get.snackbar('Erro', 'Não foi possível aceitar a entrega');
    }
  }

  void _handleDeliveryBlockedError(Map<String, dynamic> error) {
    Get.dialog(
      AlertDialog(
        title: Text('Entrega em Andamento'),
        content: Text(
          'Você já possui a Entrega #${error['activeDeliveryNumber']} em andamento.\n\n'
          'Retire o pedido antes de aceitar uma nova entrega.'
        ),
        actions: [
          TextButton(
            onPressed: () {
              Get.back();
              Get.to(() => DeliveryDetailScreen(
                deliveryId: error['activeDeliveryId']
              ));
            },
            child: Text('Ver Entrega'),
          ),
          TextButton(
            onPressed: () => Get.back(),
            child: Text('OK'),
          ),
        ],
      ),
    );
  }
}
```

## 🧪 Testes Necessários no App

1. **Aceitar primeira entrega** → Deve funcionar normalmente
2. **Tentar aceitar segunda sem retirar** → Deve mostrar mensagem de erro
3. **Retirar primeira e aceitar segunda** → Deve permitir e funcionar
4. **Finalizar primeira e abrir segunda** → Deve funcionar normalmente
5. **Receber notificação com entrega ativa** → Validar comportamento

## 📝 Checklist de Implementação

- [ ] Adicionar tratamento para erro 409 com código `DELIVERY_IN_PROGRESS_NOT_PICKED_UP`
- [ ] Criar diálogo informativo com botão para ver entrega ativa
- [ ] Implementar validação preventiva (opcional)
- [ ] Adicionar indicador visual de status (opcional)
- [ ] Testar todos os cenários
- [ ] Atualizar documentação do app

## ⚠️ Importante

- O backend **sempre** valida, então o app **deve** tratar o erro 409
- Mesmo que você implemente validação preventiva no app, o erro 409 ainda pode ocorrer (ex: condições de corrida, múltiplas requisições)
- Sempre teste com dados reais para garantir que a sincronização está funcionando

## 🔗 Referências

- Documentação completa: [VALIDACAO_ENTREGAS.md](VALIDACAO_ENTREGAS.md)
- Endpoint modificado: [server/routes.ts:5397](server/routes.ts)
