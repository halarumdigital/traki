# Notificação em Tempo Real - Entrega Aceita por Outro Motorista

## 📋 Resumo da Funcionalidade

Quando um entregador aceita uma entrega, **todos os outros entregadores** que receberam a notificação devem:
1. Receber uma notificação FCM automática
2. Fechar o modal da entrega automaticamente
3. Remover a entrega da lista de pendentes
4. (Opcional) Mostrar um toast informando que a entrega foi aceita

## 🔧 Alterações Realizadas no Backend

### ✅ Endpoint Atualizado: `/api/v1/driver/requests/:id/accept`

Quando um motorista aceita uma entrega, o backend agora:

1. **Envia notificação FCM** para todos os outros motoristas com os dados:
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

2. **Emite evento Socket.IO** `delivery-taken` (para futura integração web):
```json
{
  "requestId": "uuid-da-entrega",
  "requestNumber": "REQ-XXXXXXXX",
  "takenBy": "uuid-do-motorista-que-aceitou",
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

### 📍 Localização no Código Backend
- **Arquivo:** `server/routes.ts`
- **Linhas:** 5556-5581
- **Endpoint:** `POST /api/v1/driver/requests/:id/accept`

---

## 📱 Implementação no App Flutter

### 1. **Handler de Notificações FCM**

Adicione tratamento para o tipo `delivery_taken` no seu listener de notificações FCM:

```dart
// No seu arquivo de configuração do Firebase (ex: firebase_service.dart)

void setupFirebaseMessaging() {
  // Quando o app está em foreground
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    print('📩 Notificação recebida (foreground): ${message.data}');

    if (message.data['type'] == 'delivery_taken') {
      _handleDeliveryTaken(message.data);
    } else if (message.data['type'] == 'new_delivery') {
      _handleNewDelivery(message.data);
    }
  });

  // Quando o app está em background/terminated e usuário clica na notificação
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    print('📩 Notificação clicada (background): ${message.data}');

    if (message.data['type'] == 'delivery_taken') {
      _handleDeliveryTaken(message.data);
    }
  });
}

// Handler específico para quando entrega é aceita por outro motorista
void _handleDeliveryTaken(Map<String, dynamic> data) {
  final requestId = data['requestId'];
  final requestNumber = data['requestNumber'];

  print('🚫 Entrega ${requestNumber} foi aceita por outro motorista');

  // 1. Fechar modal se estiver aberto
  _closeDeliveryModalIfOpen(requestId);

  // 2. Remover da lista de entregas pendentes
  _removeFromPendingDeliveries(requestId);

  // 3. Mostrar feedback ao usuário (opcional)
  _showDeliveryTakenToast(requestNumber);
}
```

### 2. **Fechar Modal Automaticamente**

Existem várias abordagens. Escolha a que melhor se adapta à sua arquitetura:

#### **Opção A: Usando GetX (Recomendado se já usa GetX)**

```dart
// No seu delivery_controller.dart

class DeliveryController extends GetxController {
  // Observable da entrega sendo visualizada
  final Rx<DeliveryNotification?> currentDeliveryModal = Rx<DeliveryNotification?>(null);

  // Lista de entregas pendentes
  final RxList<DeliveryNotification> pendingDeliveries = <DeliveryNotification>[].obs;

  // Mostrar modal de entrega
  void showDeliveryModal(DeliveryNotification delivery) {
    currentDeliveryModal.value = delivery;

    Get.dialog(
      DeliveryModalWidget(delivery: delivery),
      barrierDismissible: false,
    );
  }

  // Fechar modal se for da entrega específica
  void closeModalIfMatches(String requestId) {
    if (currentDeliveryModal.value?.requestId == requestId) {
      print('🚫 Fechando modal da entrega ${requestId}');
      currentDeliveryModal.value = null;
      Get.back(); // Fecha o dialog
    }
  }

  // Remover entrega da lista
  void removeDelivery(String requestId) {
    pendingDeliveries.removeWhere((delivery) => delivery.requestId == requestId);
    print('🗑️ Entrega ${requestId} removida da lista');
  }

  // Handler chamado quando recebe FCM de delivery_taken
  void onDeliveryTaken(String requestId, String requestNumber) {
    closeModalIfMatches(requestId);
    removeDelivery(requestId);

    Get.snackbar(
      'Entrega Aceita',
      'Entrega ${requestNumber} foi aceita por outro motorista',
      snackPosition: SnackPosition.BOTTOM,
      backgroundColor: Colors.orange[100],
      duration: Duration(seconds: 3),
    );
  }
}

// No firebase_service.dart
void _handleDeliveryTaken(Map<String, dynamic> data) {
  final controller = Get.find<DeliveryController>();
  controller.onDeliveryTaken(
    data['requestId'],
    data['requestNumber'],
  );
}
```

#### **Opção B: Usando Provider/Riverpod**

```dart
// delivery_notifier.dart

class DeliveryNotifier extends ChangeNotifier {
  DeliveryNotification? _currentModalDelivery;
  List<DeliveryNotification> _pendingDeliveries = [];

  DeliveryNotification? get currentModalDelivery => _currentModalDelivery;
  List<DeliveryNotification> get pendingDeliveries => _pendingDeliveries;

  void showModal(DeliveryNotification delivery) {
    _currentModalDelivery = delivery;
    notifyListeners();
  }

  void closeModalIfMatches(String requestId) {
    if (_currentModalDelivery?.requestId == requestId) {
      _currentModalDelivery = null;
      notifyListeners();
      // Fechar o dialog programaticamente
      NavigatorKey.currentState?.pop();
    }
  }

  void removeDelivery(String requestId) {
    _pendingDeliveries.removeWhere((d) => d.requestId == requestId);
    notifyListeners();
  }

  void onDeliveryTaken(String requestId, String requestNumber) {
    closeModalIfMatches(requestId);
    removeDelivery(requestId);
  }
}

// No firebase_service.dart
void _handleDeliveryTaken(Map<String, dynamic> data) {
  final notifier = Provider.of<DeliveryNotifier>(context, listen: false);
  notifier.onDeliveryTaken(
    data['requestId'],
    data['requestNumber'],
  );
}
```

#### **Opção C: Usando Stream/EventBus**

```dart
// events.dart
class DeliveryTakenEvent {
  final String requestId;
  final String requestNumber;

  DeliveryTakenEvent(this.requestId, this.requestNumber);
}

// delivery_event_bus.dart
final deliveryEventBus = StreamController<DeliveryTakenEvent>.broadcast();

// No firebase_service.dart
void _handleDeliveryTaken(Map<String, dynamic> data) {
  deliveryEventBus.add(DeliveryTakenEvent(
    data['requestId'],
    data['requestNumber'],
  ));
}

// No widget do modal
class DeliveryModalWidget extends StatefulWidget {
  final DeliveryNotification delivery;

  @override
  _DeliveryModalWidgetState createState() => _DeliveryModalWidgetState();
}

class _DeliveryModalWidgetState extends State<DeliveryModalWidget> {
  late StreamSubscription<DeliveryTakenEvent> _eventSubscription;

  @override
  void initState() {
    super.initState();

    // Escutar eventos de entrega aceita
    _eventSubscription = deliveryEventBus.stream.listen((event) {
      if (event.requestId == widget.delivery.requestId) {
        // Essa entrega foi aceita por outro motorista - fechar modal
        Navigator.of(context).pop();

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Entrega ${event.requestNumber} foi aceita por outro motorista'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _eventSubscription.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Seu modal aqui
  }
}
```

### 3. **Estrutura de Dados Sugerida**

```dart
// models/delivery_notification.dart

class DeliveryNotification {
  final String requestId;
  final String requestNumber;
  final String pickupAddress;
  final String dropoffAddress;
  final String estimatedAmount;
  final String driverAmount;
  final String distance;
  final String estimatedTime;
  final String companyName;
  final String? customerName;
  final int acceptanceTimeout; // segundos - Tempo de Aceitação do Motorista (driverAcceptanceTimeout)
  final int searchTimeout; // segundos - Tempo Mínimo para Encontrar Motorista (minTimeToFindDriver)
  final bool needsReturn;

  DeliveryNotification({
    required this.requestId,
    required this.requestNumber,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.estimatedAmount,
    required this.driverAmount,
    required this.distance,
    required this.estimatedTime,
    required this.companyName,
    this.customerName,
    this.acceptanceTimeout = 30,
    this.searchTimeout = 120,
    this.needsReturn = false,
  });

  factory DeliveryNotification.fromFCM(Map<String, dynamic> data) {
    return DeliveryNotification(
      requestId: data['deliveryId'] ?? data['requestId'] ?? '',
      requestNumber: data['requestNumber'] ?? '',
      pickupAddress: data['pickupAddress'] ?? '',
      dropoffAddress: data['dropoffAddress'] ?? '',
      estimatedAmount: data['estimatedAmount'] ?? '0',
      driverAmount: data['driverAmount'] ?? '0',
      distance: data['distance'] ?? '0',
      estimatedTime: data['estimatedTime'] ?? '0',
      companyName: data['companyName'] ?? '',
      customerName: data['customerName'],
      acceptanceTimeout: int.tryParse(data['acceptanceTimeout'] ?? '30') ?? 30,
      searchTimeout: int.tryParse(data['searchTimeout'] ?? '120') ?? 120,
      needsReturn: data['needs_return'] == 'true',
    );
  }
}
```

### 4. **Widget de Modal Completo (Exemplo)**

```dart
// widgets/delivery_modal_widget.dart

class DeliveryModalWidget extends StatefulWidget {
  final DeliveryNotification delivery;

  const DeliveryModalWidget({Key? key, required this.delivery}) : super(key: key);

  @override
  _DeliveryModalWidgetState createState() => _DeliveryModalWidgetState();
}

class _DeliveryModalWidgetState extends State<DeliveryModalWidget> {
  late StreamSubscription<DeliveryTakenEvent>? _eventSubscription;
  bool _isAccepting = false;

  @override
  void initState() {
    super.initState();
    _setupDeliveryTakenListener();
  }

  void _setupDeliveryTakenListener() {
    // Escutar quando a entrega for aceita por outro motorista
    _eventSubscription = deliveryEventBus.stream.listen((event) {
      if (event.requestId == widget.delivery.requestId && mounted) {
        // Entrega foi aceita por outro - fechar automaticamente
        _closeModalWithMessage(event.requestNumber);
      }
    });
  }

  void _closeModalWithMessage(String requestNumber) {
    Navigator.of(context).pop();

    // Mostrar toast
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(Icons.info_outline, color: Colors.white),
            SizedBox(width: 8),
            Expanded(
              child: Text('Entrega $requestNumber foi aceita por outro motorista'),
            ),
          ],
        ),
        backgroundColor: Colors.orange[700],
        duration: Duration(seconds: 3),
      ),
    );
  }

  Future<void> _acceptDelivery() async {
    setState(() => _isAccepting = true);

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/v1/driver/requests/${widget.delivery.requestId}/accept'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        // Sucesso
        Navigator.of(context).pop();
        // Navegar para tela de entrega aceita

      } else if (response.statusCode == 409) {
        // Erro: Entrega já aceita ou motorista tem entrega pendente
        final error = jsonDecode(response.body);
        _showErrorDialog(error['message']);

      } else {
        _showErrorDialog('Erro ao aceitar entrega');
      }

    } catch (e) {
      print('Erro: $e');
      _showErrorDialog('Erro de conexão');
    } finally {
      if (mounted) {
        setState(() => _isAccepting = false);
      }
    }
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Ops!'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // Fecha dialog de erro
              Navigator.of(context).pop(); // Fecha modal de entrega
            },
            child: Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _eventSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Cabeçalho
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Nova Entrega',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                Text(
                  widget.delivery.requestNumber,
                  style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                ),
              ],
            ),
            SizedBox(height: 16),

            // Empresa
            _buildInfoRow(Icons.business, 'Empresa', widget.delivery.companyName),

            if (widget.delivery.customerName != null)
              _buildInfoRow(Icons.person, 'Cliente', widget.delivery.customerName!),

            // Endereços
            _buildInfoRow(Icons.location_on, 'Retirada', widget.delivery.pickupAddress),
            _buildInfoRow(Icons.location_on, 'Entrega', widget.delivery.dropoffAddress),

            SizedBox(height: 12),

            // Informações
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildStatBox(Icons.route, '${widget.delivery.distance} km', 'Distância'),
                _buildStatBox(Icons.timer, '${widget.delivery.estimatedTime} min', 'Tempo'),
                _buildStatBox(Icons.attach_money, 'R\$ ${widget.delivery.driverAmount}', 'Você recebe'),
              ],
            ),

            if (widget.delivery.needsReturn)
              Padding(
                padding: EdgeInsets.only(top: 12),
                child: Container(
                  padding: EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue[50],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.u_turn_left, size: 16, color: Colors.blue[700]),
                      SizedBox(width: 8),
                      Text('Precisa retornar ao ponto de origem', style: TextStyle(fontSize: 12)),
                    ],
                  ),
                ),
              ),

            SizedBox(height: 20),

            // Botões
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isAccepting ? null : () => Navigator.of(context).pop(),
                    child: Text('Recusar'),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _isAccepting ? null : _acceptDelivery,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      padding: EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: _isAccepting
                        ? SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Text('Aceitar Entrega', style: TextStyle(color: Colors.white)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey[600]),
          SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                Text(value, style: TextStyle(fontSize: 14)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatBox(IconData icon, String value, String label) {
    return Column(
      children: [
        Icon(icon, color: Colors.blue),
        SizedBox(height: 4),
        Text(value, style: TextStyle(fontWeight: FontWeight.bold)),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
      ],
    );
  }
}
```

---

## 🧪 Testes Necessários

### Cenário 1: Entrega Aceita Enquanto Modal Está Aberto
1. ✅ Motorista A recebe notificação de nova entrega
2. ✅ Motorista B recebe a mesma notificação
3. ✅ Motorista A abre o modal
4. ✅ Motorista B aceita a entrega
5. ✅ **Esperado:** Modal do Motorista A fecha automaticamente
6. ✅ **Esperado:** Motorista A vê toast "Entrega foi aceita por outro motorista"

### Cenário 2: Entrega Aceita Quando Modal Não Está Aberto
1. ✅ Motorista A recebe notificação
2. ✅ Motorista B recebe notificação
3. ✅ Motorista B aceita
4. ✅ **Esperado:** Notificação do Motorista A desaparece da lista
5. ✅ **Esperado:** Ao tentar abrir, deve mostrar que foi aceita

### Cenário 3: Múltiplas Entregas Simultâneas
1. ✅ Motorista recebe 3 entregas
2. ✅ Abre modal da Entrega #1
3. ✅ Outro motorista aceita Entrega #2
4. ✅ **Esperado:** Modal da Entrega #1 permanece aberto
5. ✅ **Esperado:** Entrega #2 desaparece da lista

### Cenário 4: App em Background
1. ✅ App está em background
2. ✅ Motorista recebe notificação
3. ✅ Outro motorista aceita
4. ✅ **Esperado:** Ao abrir app, entrega não aparece na lista

---

## 📊 Diagrama de Fluxo

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Motorista  │         │  Motorista  │         │   Backend   │
│      A      │         │      B      │         │             │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │◄──────────────────────┼───────────────────────┤
       │   FCM: new_delivery   │   FCM: new_delivery   │
       │                       │                       │
       ├───────────────────────┼──────────────────────►│
       │      Abre Modal       │                       │
       │                       │                       │
       │                       ├──────────────────────►│
       │                       │  POST /accept         │
       │                       │                       │
       │◄──────────────────────┼───────────────────────┤
       │   FCM: delivery_taken │                       │
       │   (fecha modal auto)  │                       │
       │                       │                       │
       │   [Modal Fecha]       │                       │
       │   [Toast Aparece]     │                       │
       │                       │                       │
```

---

## 🎯 Checklist de Implementação

### Backend (✅ Concluído)
- [x] Enviar FCM com tipo `delivery_taken` quando entrega é aceita
- [x] Incluir `requestId` e `requestNumber` na notificação FCM
- [x] Emitir evento Socket.IO `delivery-taken`
- [x] Marcar outras notificações como `expired`

### App Flutter (⚠️ Pendente)
- [ ] Configurar listener de FCM para tipo `delivery_taken`
- [ ] Implementar lógica para fechar modal quando `requestId` corresponde
- [ ] Remover entrega da lista de pendentes
- [ ] Mostrar toast/snackbar informando que foi aceita
- [ ] Testar com múltiplos dispositivos simultaneamente
- [ ] Testar com app em foreground, background e terminated
- [ ] Garantir que não há vazamento de memória (dispose dos listeners)

---

## ⚠️ Pontos de Atenção

1. **Listeners de FCM**: Certifique-se de registrar os listeners no início do app (antes de qualquer tela ser mostrada)

2. **Ciclo de Vida**: Trate corretamente os 3 estados do app:
   - **Foreground**: App aberto e em uso
   - **Background**: App minimizado
   - **Terminated**: App fechado completamente

3. **Race Condition**: É possível que a notificação FCM chegue ANTES do modal abrir. Considere verificar se a entrega ainda está disponível antes de mostrar o modal:

```dart
Future<bool> isDeliveryStillAvailable(String requestId) async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/v1/driver/pending-requests'),
    headers: headers,
  );

  if (response.statusCode == 200) {
    final List<dynamic> deliveries = jsonDecode(response.body)['data'];
    return deliveries.any((d) => d['requestId'] == requestId);
  }

  return false;
}

void showDeliveryModal(DeliveryNotification delivery) async {
  // Verificar se ainda está disponível antes de mostrar
  final isAvailable = await isDeliveryStillAvailable(delivery.requestId);

  if (!isAvailable) {
    Get.snackbar(
      'Entrega Indisponível',
      'Esta entrega já foi aceita por outro motorista',
      backgroundColor: Colors.orange[100],
    );
    return;
  }

  // Mostrar modal
  Get.dialog(DeliveryModalWidget(delivery: delivery));
}
```

4. **Timeout de Aceitação**: O backend usa as configurações do administrador para definir os timeouts:
   - **`driverAcceptanceTimeout`** (Tempo de Aceitação do Motorista): Tempo que cada motorista tem para aceitar a entrega antes da notificação expirar (padrão: 30s)
   - **`minTimeToFindDriver`** (Tempo Mínimo para Encontrar Motorista): Tempo total que o sistema continua buscando motoristas (padrão: 120s)

   O app deve mostrar um countdown baseado no `acceptanceTimeout` recebido na notificação FCM e fechar o modal automaticamente quando expirar.

5. **Dispose**: Sempre cancele subscriptions de Stream/EventBus no `dispose()` para evitar vazamento de memória.

---

## ⚙️ Configurações de Timeout (Administrador)

O sistema usa duas configurações importantes que são definidas pelo administrador:

### 1. **Tempo de Aceitação do Motorista** (`driverAcceptanceTimeout`)

**O que é:** Tempo que CADA motorista tem para aceitar a entrega antes da sua notificação expirar.

**Valor padrão:** 30 segundos

**Como funciona:**
- Empresa cria entrega às 10:00:00
- Motoristas A, B e C recebem notificação
- Cada um tem 30s para aceitar (até 10:00:30)
- Se ninguém aceitar, as notificações expiram e o sistema pode tentar novamente

**Enviado ao app como:** `acceptanceTimeout` na notificação FCM

**Uso no app:**
```dart
// Exemplo: Mostrar countdown no modal
int timeLeft = int.parse(delivery.acceptanceTimeout); // 30
Timer.periodic(Duration(seconds: 1), (timer) {
  if (timeLeft <= 0) {
    timer.cancel();
    Navigator.pop(context); // Fechar modal
    showSnackbar('Tempo expirado');
  } else {
    setState(() => timeLeft--);
  }
});
```

### 2. **Tempo Mínimo para Encontrar Motorista** (`minTimeToFindDriver`)

**O que é:** Tempo TOTAL que o sistema continua tentando encontrar motoristas disponíveis.

**Valor padrão:** 120 segundos (2 minutos)

**Como funciona:**
- Se nenhum motorista aceitar nos primeiros 30s, o sistema pode:
  - Expandir o raio de busca
  - Reenviar notificações para motoristas que não responderam
  - Continuar tentando até completar 120s

**Enviado ao app como:** `searchTimeout` na notificação FCM

**Uso no app:**
```dart
// Informativo: Mostrar quanto tempo a entrega ainda estará disponível
final searchTimeout = int.parse(delivery.searchTimeout); // 120
Text('Entrega disponível por mais ${searchTimeout}s');
```

### Exemplo Visual

```
Tempo = 0s
  ↓ Entrega criada
  ↓ Notificação enviada para Motoristas A, B, C
  ↓ Cada um tem 30s (driverAcceptanceTimeout)

Tempo = 30s
  ↓ Notificações expiram
  ↓ Sistema busca novos motoristas no raio expandido
  ↓ Envia para Motoristas D, E

Tempo = 60s
  ↓ Notificações expiram novamente
  ↓ Sistema tenta mais uma vez

Tempo = 120s (minTimeToFindDriver)
  ↓ Sistema para de buscar
  ↓ Entrega fica como "não atendida"
```

### Como o Administrador Configura

**Caminho:** Painel Admin → Configurações → Configurações de Entrega

**Campos:**
- **Tempo de Aceitação do Motorista (segundos):** `driverAcceptanceTimeout`
- **Tempo Mínimo para Encontrar Motorista (segundos):** `minTimeToFindDriver`

**Validação:** Recomenda-se que `minTimeToFindDriver` seja múltiplo de `driverAcceptanceTimeout` para permitir várias tentativas.

---

## 📚 Documentação Relacionada

- [ALTERACOES_FLUTTER.md](ALTERACOES_FLUTTER.md) - Validação de entrega em andamento
- [VALIDACAO_ENTREGAS.md](VALIDACAO_ENTREGAS.md) - Documentação completa da validação
- Backend: [server/routes.ts:5370-5634](server/routes.ts#L5370-L5634)

---

## 🆘 Suporte

Se tiver dúvidas sobre a implementação:
1. Verifique os logs do backend (console) para confirmar que a notificação FCM está sendo enviada
2. Use o Firebase Console > Cloud Messaging para testar notificações manualmente
3. Verifique se o `fcmToken` do motorista está atualizado no banco de dados
4. Teste com dispositivos reais (emuladores podem ter problemas com FCM)

---

**Última atualização:** 2025-11-12
