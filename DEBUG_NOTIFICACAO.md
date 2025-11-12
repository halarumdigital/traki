# Debug: Notificação de Entrega Aceita Não Fecha Modal

## 🔴 Problema Relatado

Quando um entregador aceita uma entrega:
- ✅ A notificação FCM chega nos outros entregadores
- ❌ O modal não fecha automaticamente
- ❌ O alerta continua tocando
- ✅ Aparece mensagem "A entrega foi aceita por outro entregador"

## 🔍 Causa do Problema

O **backend está funcionando corretamente** e enviando a notificação FCM com:
```json
{
  "notification": {
    "title": "Entrega Aceita",
    "body": "A entrega foi aceita por outro entregador"
  },
  "data": {
    "type": "delivery_taken",
    "requestId": "uuid-da-entrega",
    "requestNumber": "REQ-XXXXXXXX"
  }
}
```

Porém, o **app Flutter não está tratando** esse tipo de notificação para:
1. Fechar o modal automaticamente
2. Parar o som de alerta
3. Remover a entrega da lista

## ✅ Solução: O que o Time Flutter Precisa Fazer

### 1. Verificar se o Handler FCM Existe

Procure no código Flutter pelo listener de notificações FCM (geralmente em `firebase_service.dart`, `notification_service.dart`, ou `main.dart`):

```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // VERIFICAR SE EXISTE ESTE CÓDIGO:

  if (message.data['type'] == 'delivery_taken') {
    // Handler para fechar modal
  }
});
```

**Se NÃO existir**, adicione:

```dart
void setupFirebaseMessaging() {
  // Quando app está aberto (foreground)
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    print('🔔 Notificação FCM recebida: ${message.data}');

    final type = message.data['type'];

    if (type == 'delivery_taken') {
      _handleDeliveryTaken(message.data);
    } else if (type == 'new_delivery_request' || type == 'new_delivery') {
      _handleNewDelivery(message.data);
    }
  });

  // Quando app está em background e usuário clica na notificação
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    print('🔔 Notificação FCM clicada: ${message.data}');

    if (message.data['type'] == 'delivery_taken') {
      _handleDeliveryTaken(message.data);
    }
  });
}

void _handleDeliveryTaken(Map<String, dynamic> data) {
  final requestId = data['requestId'];
  final requestNumber = data['requestNumber'];

  print('🚫 Entrega $requestNumber foi aceita por outro entregador');

  // 1. Parar som de alerta
  _stopAlertSound();

  // 2. Fechar modal se estiver aberto
  _closeDeliveryModal(requestId);

  // 3. Remover da lista de entregas pendentes
  _removePendingDelivery(requestId);

  // 4. Mostrar toast (opcional - a notificação FCM já aparece)
  // showToast('A entrega foi aceita por outro entregador');
}
```

### 2. Implementar Função para Fechar Modal

Dependendo da arquitetura do app:

#### Se usar **GetX**:

```dart
class DeliveryController extends GetxController {
  Rx<String?> currentModalRequestId = Rx<String?>(null);

  void showDeliveryModal(DeliveryNotification delivery) {
    currentModalRequestId.value = delivery.requestId;
    Get.dialog(
      DeliveryModalWidget(delivery: delivery),
      barrierDismissible: false,
    );
  }

  void closeModalIfMatches(String requestId) {
    if (currentModalRequestId.value == requestId) {
      print('✅ Fechando modal da entrega $requestId');
      currentModalRequestId.value = null;
      Get.back(); // Fecha o dialog
    }
  }
}

// No firebase_service.dart
void _handleDeliveryTaken(Map<String, dynamic> data) {
  final controller = Get.find<DeliveryController>();
  controller.closeModalIfMatches(data['requestId']);
}
```

#### Se usar **Navigator/Routes**:

```dart
// Manter referência ao context ou usar GlobalKey
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void _closeDeliveryModal(String requestId) {
  // Verificar se o modal aberto é da entrega que foi aceita
  if (currentlyShowingDeliveryId == requestId) {
    navigatorKey.currentState?.pop(); // Fecha o dialog
  }
}
```

### 3. Parar Som de Alerta

```dart
import 'package:audioplayers/audioplayers.dart';

AudioPlayer? _alertPlayer;

void _playAlertSound() {
  _alertPlayer = AudioPlayer();
  _alertPlayer?.setReleaseMode(ReleaseMode.loop);
  _alertPlayer?.play(AssetSource('sounds/alert.mp3'));
}

void _stopAlertSound() {
  _alertPlayer?.stop();
  _alertPlayer?.dispose();
  _alertPlayer = null;
}

// Chamar quando recebe delivery_taken
void _handleDeliveryTaken(Map<String, dynamic> data) {
  _stopAlertSound(); // Parar som
  // ... resto do código
}
```

### 4. Remover da Lista de Entregas Pendentes

```dart
class DeliveryController extends GetxController {
  RxList<DeliveryNotification> pendingDeliveries = <DeliveryNotification>[].obs;

  void removePendingDelivery(String requestId) {
    pendingDeliveries.removeWhere((d) => d.requestId == requestId);
    print('🗑️ Entrega $requestId removida da lista');
  }
}

void _handleDeliveryTaken(Map<String, dynamic> data) {
  final controller = Get.find<DeliveryController>();
  controller.removePendingDelivery(data['requestId']);
}
```

## 🧪 Como Testar

### 1. **Adicionar Logs**

Primeiro, adicione logs para verificar se a notificação está chegando:

```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  print('═══════════════════════════════════════');
  print('📩 FCM RECEBIDO:');
  print('Title: ${message.notification?.title}');
  print('Body: ${message.notification?.body}');
  print('Data: ${message.data}');
  print('Type: ${message.data['type']}');
  print('═══════════════════════════════════════');

  // ... resto do handler
});
```

### 2. **Testar o Fluxo Completo**

1. Abra o app no **Motorista A**
2. Abra o app no **Motorista B**
3. Empresa cria entrega
4. **Ambos** recebem notificação
5. **Motorista A** abre o modal
6. **Motorista B** aceita a entrega
7. **Verificar logs no Motorista A:**
   ```
   📩 FCM RECEBIDO:
   Title: Entrega Aceita
   Body: A entrega foi aceita por outro entregador
   Type: delivery_taken
   ```
8. **Verificar se modal fecha automaticamente**

## 📝 Checklist de Verificação

No app Flutter, verifique:

- [ ] Handler de FCM está registrado (`FirebaseMessaging.onMessage.listen`)
- [ ] Handler trata o tipo `delivery_taken`
- [ ] Função `_handleDeliveryTaken` existe e é chamada
- [ ] Modal fecha quando `requestId` corresponde
- [ ] Som de alerta para quando modal fecha
- [ ] Entrega é removida da lista de pendentes
- [ ] Logs aparecem no console quando notificação chega

## 🔗 Arquivos a Verificar

Procure nos seguintes arquivos:

1. `lib/services/firebase_service.dart`
2. `lib/services/notification_service.dart`
3. `lib/controllers/delivery_controller.dart`
4. `lib/main.dart` (onde Firebase é inicializado)

## 📞 Próximos Passos

1. **Adicionar logs** para confirmar que a notificação FCM está chegando
2. **Implementar handler** `delivery_taken` se não existir
3. **Testar** com dois dispositivos reais
4. **Reportar** se continuar sem funcionar com os logs do console

---

**Documentação Completa:** [NOTIFICACAO_ENTREGA_ACEITA.md](NOTIFICACAO_ENTREGA_ACEITA.md)

**Última atualização:** 2025-11-12
