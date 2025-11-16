# FIX: Modal de Entrega Continua Tocando Após Cancelamento

## 🔴 Problema Identificado

Quando a empresa cancela uma entrega no painel web, o **backend está enviando corretamente** as notificações de cancelamento:

✅ Notificação Firebase com `type: "DELIVERY_CANCELLED"`
✅ Evento Socket.IO `delivery-cancelled`
✅ Atualização do banco de dados

**Porém**, o **app móvel do motorista (Flutter) NÃO está fechando o modal** de nova entrega quando recebe essas notificações.

---

## 📍 Onde está o Bug

### Backend (F:\fretus\server\routes.ts - linhas 2891-2910)

```typescript
// ✅ BACKEND ESTÁ CORRETO - Enviando notificação de cancelamento
await sendPushNotification(
  driver.fcm_token,
  "Entrega Cancelada",
  "A entrega foi cancelada pela empresa.",
  {
    type: "DELIVERY_CANCELLED",  // ← Tipo correto
    requestId: id,
    message: cancelReason || "Esta entrega foi cancelada pela empresa"
  }
);

// ✅ Também enviando Socket.IO
io.to(`driver-${driver.driver_id}`).emit('delivery-cancelled', {
  requestId: id,
  requestNumber: request.requestNumber,
  message: cancelReason || "Esta entrega foi cancelada pela empresa"
});
```

### App Flutter (BUG AQUI!)

O arquivo `lib/services/notification_service.dart` tem o método `_handleForegroundMessage` que **APENAS** trata notificações do tipo `new_delivery`:

```dart
// ❌ BUG: Não trata notificação de cancelamento em foreground
void _handleForegroundMessage(RemoteMessage message) {
  print('🔔 Foreground message: ${message.notification?.title}');

  final notification = message.notification;
  final data = message.data;

  // Trata apenas "new_delivery"
  if (data['type'] == 'new_delivery') {
    _showNewDeliveryDialog(data);
  } else {
    // ← PROBLEMA: "DELIVERY_CANCELLED" cai aqui e não faz nada!
    if (notification != null) {
      _showLocalNotification(
        title: notification.title ?? 'Notificação',
        body: notification.body ?? '',
        payload: data.toString(),
      );
    }
  }
}
```

---

## ✅ Solução: Atualizar o App Flutter

### 1. Atualizar `_handleForegroundMessage` em `lib/services/notification_service.dart`

```dart
// Handler de notificações em foreground
void _handleForegroundMessage(RemoteMessage message) {
  print('🔔 Foreground message: ${message.notification?.title}');

  final notification = message.notification;
  final data = message.data;

  // Se for nova entrega, mostrar dialog
  if (data['type'] == 'new_delivery') {
    _showNewDeliveryDialog(data);
  }
  // ✅ ADICIONAR: Se for cancelamento, fechar modal e notificar
  else if (data['type'] == 'DELIVERY_CANCELLED') {
    print('🚫 Entrega cancelada: ${data['requestId']}');

    // Emitir evento para fechar o modal de nova entrega
    _onDeliveryCancelled?.call(data['requestId']);

    // Mostrar notificação local informando o cancelamento
    _showLocalNotification(
      title: 'Entrega Cancelada',
      body: data['message'] ?? 'A entrega foi cancelada pela empresa.',
      payload: data.toString(),
    );
  }
  else {
    // Para outros tipos, mostrar notificação local
    if (notification != null) {
      _showLocalNotification(
        title: notification.title ?? 'Notificação',
        body: notification.body ?? '',
        payload: data.toString(),
      );
    }
  }
}
```

### 2. Adicionar Callback para Fechar o Modal

```dart
class NotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final Dio _dio;

  // ✅ ADICIONAR: Callback para cancelamento
  void Function(String requestId)? _onDeliveryCancelled;

  NotificationService(this._dio);

  // ✅ ADICIONAR: Método para registrar callback
  void setOnDeliveryCancelledCallback(void Function(String requestId) callback) {
    _onDeliveryCancelled = callback;
  }

  // ... resto do código
}
```

### 3. Atualizar o Widget `NewDeliveryDialog`

```dart
// lib/widgets/new_delivery_dialog.dart

class NewDeliveryDialog extends StatefulWidget {
  final Map<String, dynamic> deliveryData;
  final Function(bool accepted) onResponse;

  const NewDeliveryDialog({
    Key? key,
    required this.deliveryData,
    required this.onResponse,
  }) : super(key: key);

  @override
  State<NewDeliveryDialog> createState() => _NewDeliveryDialogState();
}

class _NewDeliveryDialogState extends State<NewDeliveryDialog> {
  late int _secondsRemaining;
  Timer? _timer;

  // ✅ ADICIONAR: Armazenar referência do NotificationService
  late NotificationService _notificationService;

  @override
  void initState() {
    super.initState();

    _secondsRemaining = int.tryParse(
      widget.deliveryData['acceptanceTimeout']?.toString() ?? '30'
    ) ?? 30;

    // ✅ ADICIONAR: Obter NotificationService e registrar callback
    _notificationService = Provider.of<NotificationService>(context, listen: false);
    _notificationService.setOnDeliveryCancelledCallback(_handleDeliveryCancelled);

    _startCountdown();
  }

  // ✅ ADICIONAR: Handler para cancelamento
  void _handleDeliveryCancelled(String requestId) {
    // Verificar se é a entrega atual
    if (requestId == widget.deliveryData['deliveryId']) {
      print('🚫 Esta entrega foi cancelada! Fechando modal...');

      // Cancelar timer
      _timer?.cancel();

      // Fechar modal
      if (mounted) {
        Navigator.of(context).pop();

        // Mostrar snackbar informando
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Esta entrega foi cancelada pela empresa'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 3),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    // ✅ ADICIONAR: Limpar callback ao desmontar
    _notificationService.setOnDeliveryCancelledCallback(null);
    super.dispose();
  }

  // ... resto do código (countdown, build, etc)
}
```

### 4. Alternativa: Usar StreamController para Broadcast

Se preferir uma abordagem mais robusta com streams:

```dart
// lib/services/notification_service.dart

import 'dart:async';

class NotificationService {
  // ✅ ADICIONAR: StreamController para eventos de cancelamento
  final _deliveryCancelledController = StreamController<String>.broadcast();

  // ✅ ADICIONAR: Stream pública
  Stream<String> get onDeliveryCancelled => _deliveryCancelledController.stream;

  // Handler de notificações em foreground
  void _handleForegroundMessage(RemoteMessage message) {
    final data = message.data;

    if (data['type'] == 'new_delivery') {
      _showNewDeliveryDialog(data);
    }
    else if (data['type'] == 'DELIVERY_CANCELLED') {
      print('🚫 Entrega cancelada: ${data['requestId']}');

      // ✅ Emitir evento via stream
      _deliveryCancelledController.add(data['requestId']);

      _showLocalNotification(
        title: 'Entrega Cancelada',
        body: data['message'] ?? 'A entrega foi cancelada pela empresa.',
        payload: data.toString(),
      );
    }
  }

  // ✅ ADICIONAR: Dispose para fechar stream
  void dispose() {
    _deliveryCancelledController.close();
  }
}
```

```dart
// lib/widgets/new_delivery_dialog.dart

class _NewDeliveryDialogState extends State<NewDeliveryDialog> {
  StreamSubscription<String>? _cancelSubscription;

  @override
  void initState() {
    super.initState();

    // ✅ Escutar eventos de cancelamento
    final notificationService = Provider.of<NotificationService>(context, listen: false);
    _cancelSubscription = notificationService.onDeliveryCancelled.listen((requestId) {
      if (requestId == widget.deliveryData['deliveryId']) {
        _handleDeliveryCancelled();
      }
    });
  }

  void _handleDeliveryCancelled() {
    _timer?.cancel();

    if (mounted) {
      Navigator.of(context).pop();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Esta entrega foi cancelada pela empresa'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _cancelSubscription?.cancel(); // ✅ Cancelar subscription
    super.dispose();
  }
}
```

---

## 🔍 Teste da Correção

### Cenário de Teste

1. **Motorista**: Abrir app e ficar online
2. **Empresa**: Criar uma nova entrega
3. **Motorista**: Receber notificação e modal aparecer com countdown
4. **Empresa**: Cancelar a entrega ANTES do motorista aceitar
5. **Resultado Esperado**:
   - ✅ Modal fecha automaticamente no app do motorista
   - ✅ Timer cancela
   - ✅ Snackbar aparece: "Esta entrega foi cancelada pela empresa"
   - ✅ Notificação local opcional informando o cancelamento

---

## 📝 Checklist de Implementação

- [ ] Atualizar `_handleForegroundMessage` para detectar `DELIVERY_CANCELLED`
- [ ] Adicionar StreamController ou Callback para comunicar cancelamento
- [ ] Atualizar `NewDeliveryDialog` para escutar eventos de cancelamento
- [ ] Implementar lógica para fechar modal quando cancelamento for detectado
- [ ] Cancelar timer do countdown ao receber cancelamento
- [ ] Mostrar feedback visual (snackbar) ao usuário
- [ ] Testar cenário completo: criar entrega → motorista recebe → empresa cancela → modal fecha
- [ ] Testar com app em foreground
- [ ] Testar com app em background (deve funcionar via `onMessageOpenedApp`)
- [ ] Adicionar logs para debug: `print('🚫 Entrega ${requestId} cancelada')`

---

## 🎯 Arquivos que Precisam ser Modificados no App Flutter

1. `lib/services/notification_service.dart` - Adicionar handler para `DELIVERY_CANCELLED`
2. `lib/widgets/new_delivery_dialog.dart` - Adicionar listener e lógica de fechamento
3. (Opcional) `lib/main.dart` - Se usar Provider para NotificationService

---

## 💡 Observações Importantes

1. **O backend JÁ ESTÁ FUNCIONANDO** corretamente - não precisa mexer no Node.js
2. O problema está **apenas no código Flutter do app móvel**
3. A notificação está sendo enviada como **DATA-ONLY** (sem notification), então o handler `onMessage` será chamado em foreground
4. O tipo da notificação é `"DELIVERY_CANCELLED"` (com underscore e maiúsculas)
5. O `requestId` vem no campo `data['requestId']` da notificação Firebase

---

## 🔗 Referências

- Backend implementado: `F:\fretus\server\routes.ts` linhas 2881-2926
- Documentação do sistema: `F:\fretus\documents\SISTEMA_NOTIFICACOES_ENTREGAS.md`
- Firebase: Notificações DATA-ONLY sempre chamam `onMessage` em foreground
- Socket.IO: Também está sendo emitido como fallback, mas Firebase deve ser suficiente
