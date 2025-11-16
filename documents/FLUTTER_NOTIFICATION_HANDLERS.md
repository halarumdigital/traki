# Flutter: Handlers de Notificações Push

## Problema
As notificações aparecem na tela bloqueada, mas quando o usuário toca nelas, o modal não abre no app.

## Solução
O app Flutter precisa de 3 handlers diferentes para cobrir todos os cenários:

### 1. App em Foreground (EXISTE)
```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // Já implementado - mostra o modal quando app está aberto
  if (message.data['type'] == 'new_delivery') {
    _showNewDeliveryDialog(message.data);
  }
});
```

### 2. App em Background - Usuário Toca na Notificação (FALTANDO)
```dart
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  // ADICIONAR: Este handler é chamado quando usuário toca na notificação
  // com o app em background
  print('📱 Notificação tocada (app em background)');

  if (message.data['type'] == 'new_delivery') {
    // Abrir modal de nova entrega
    _showNewDeliveryDialog(message.data);
  }
});
```

### 3. App Terminado - Usuário Toca na Notificação (FALTANDO)
```dart
// No initState() ou main():
FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
  if (message != null) {
    print('📱 App aberto através de notificação');

    if (message.data['type'] == 'new_delivery') {
      // Aguardar app inicializar e abrir modal
      Future.delayed(Duration(seconds: 1), () {
        _showNewDeliveryDialog(message.data);
      });
    }
  }
});
```

## Implementação Completa no NotificationService

**Arquivo:** `lib/services/notification_service.dart`

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

class NotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  // Callback para mostrar modal
  void Function(Map<String, dynamic>)? _onNewDelivery;

  void setOnNewDeliveryCallback(void Function(Map<String, dynamic>) callback) {
    _onNewDelivery = callback;
  }

  Future<void> initialize() async {
    // 1. Pedir permissão
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // 2. Handler: App em FOREGROUND
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('🔔 Notificação recebida em foreground');
      print('   Title: ${message.notification?.title}');
      print('   Body: ${message.notification?.body}');
      print('   Data: ${message.data}');

      if (message.data['type'] == 'new_delivery') {
        _onNewDelivery?.call(message.data);
      }
    });

    // 3. Handler: App em BACKGROUND - Usuário TOCOU na notificação
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('📱 Usuário tocou na notificação (app estava em background)');
      print('   Data: ${message.data}');

      if (message.data['type'] == 'new_delivery') {
        _onNewDelivery?.call(message.data);
      }
    });

    // 4. Handler: App TERMINADO - Usuário abriu app através da notificação
    FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        print('📱 App aberto através de notificação');
        print('   Data: ${message.data}');

        if (message.data['type'] == 'new_delivery') {
          // Aguardar app inicializar
          Future.delayed(Duration(seconds: 1), () {
            _onNewDelivery?.call(message.data);
          });
        }
      }
    });

    // Obter token FCM
    String? token = await _messaging.getToken();
    print('🔑 FCM Token: $token');
  }
}
```

## Uso no Main Widget

**Arquivo:** `lib/main.dart` ou `lib/screens/driver_home.dart`

```dart
class DriverHomeScreen extends StatefulWidget {
  @override
  _DriverHomeScreenState createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  late NotificationService _notificationService;

  @override
  void initState() {
    super.initState();

    _notificationService = NotificationService();

    // Registrar callback para abrir modal
    _notificationService.setOnNewDeliveryCallback(_handleNewDelivery);

    // Inicializar handlers
    _notificationService.initialize();
  }

  void _handleNewDelivery(Map<String, dynamic> data) {
    print('🎯 Abrindo modal de nova entrega...');

    // Verificar se o widget ainda está montado
    if (!mounted) return;

    // Abrir modal
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => NewDeliveryDialog(
        deliveryData: data,
        onResponse: (bool accepted) {
          Navigator.of(context).pop();
          // ... resto da lógica
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // ... seu layout
    );
  }
}
```

## Estrutura dos Dados da Notificação

O backend está enviando:

```json
{
  "notification": {
    "title": "Nova Entrega Disponível!",
    "body": "Uma nova entrega está aguardando aceitação"
  },
  "data": {
    "type": "new_delivery",
    "title": "Nova Entrega Disponível!",
    "body": "Uma nova entrega está aguardando aceitação",
    "deliveryId": "886eab7a-813b-44f7-88b3-34b...",
    "requestNumber": "REQ-1762816615375-820",
    "customerName": "João Silva",
    "pickupAddress": "Rua ABC, 123",
    "deliveryAddress": "Rua XYZ, 456",
    "distance": "5.2",
    "estimatedTime": "15",
    "price": "25.00",
    "acceptanceTimeout": "30"
  }
}
```

## Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js)                          │
│  Envia notificação com `notification` + `data`              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               FIREBASE CLOUD MESSAGING                       │
│  Entrega notificação para o dispositivo                     │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬──────────────┐
        ▼                         ▼              ▼
┌──────────────┐      ┌───────────────┐    ┌──────────────┐
│ App ABERTO   │      │ App BACKGROUND│    │ App FECHADO  │
│              │      │               │    │              │
│ onMessage    │      │ Notificação   │    │ Notificação  │
│ ↓            │      │ na bandeja    │    │ na bandeja   │
│ Abre modal   │      │ ↓             │    │ ↓            │
│ diretamente  │      │ Usuário toca  │    │ Usuário toca │
│              │      │ ↓             │    │ ↓            │
│              │      │onMessageOpened│    │getInitial    │
│              │      │App            │    │Message       │
│              │      │ ↓             │    │ ↓            │
│              │      │ Abre modal    │    │ Abre modal   │
└──────────────┘      └───────────────┘    └──────────────┘
```

## Checklist de Implementação

- [ ] Adicionar `onMessageOpenedApp` listener no `NotificationService`
- [ ] Adicionar `getInitialMessage()` check no startup
- [ ] Criar callback `_onNewDelivery` para centralizar abertura do modal
- [ ] Testar com app em foreground (já funciona)
- [ ] Testar com app em background + toque na notificação
- [ ] Testar com app terminado + toque na notificação
- [ ] Verificar se modal abre corretamente em todos os casos
- [ ] Adicionar logs para debug

## Observações Importantes

1. **Timing**: Quando o app é aberto através de uma notificação (estava terminado), pode ser necessário aguardar a inicialização completa do app antes de abrir o modal. Use `Future.delayed()` se necessário.

2. **Context**: Certifique-se de que o `BuildContext` está disponível quando tentar abrir o modal. Use `mounted` check.

3. **NavigatorKey**: Para abrir modais de qualquer lugar, considere usar um `GlobalKey<NavigatorState>`:

```dart
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

// Em MaterialApp:
MaterialApp(
  navigatorKey: navigatorKey,
  // ...
);

// Para usar:
navigatorKey.currentState?.push(...)
```

4. **Background Handler**: O handler de background (`@pragma('vm:entry-point')`) continua funcionando para notificações data-only quando o app está terminado. Mas não é necessário para o seu caso, pois o FCM vai chamar `getInitialMessage()`.

## Testando

1. **App aberto**: Criar entrega → Modal abre ✓
2. **App em background**: Criar entrega → Notificação aparece → Tocar → Modal abre ✓
3. **App terminado**: Criar entrega → Notificação aparece → Tocar → App abre → Modal abre ✓
4. **Tela bloqueada**: Criar entrega → Notificação aparece → Desbloquear → Tocar → App abre → Modal abre ✓
