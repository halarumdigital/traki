# Sistema de Solicitações de Entrega

## Visão Geral

Sistema completo para empresas solicitarem entregas e motoristas receberem, aceitarem ou rejeitarem essas solicitações via notificações push (Firebase FCM).

## 📋 Fluxo Completo

### 1. Empresa Solicita Entrega
**Endpoint:** `POST /api/company/requests`

**Request Body:**
```json
{
  "zoneTypeId": "uuid-tipo-veiculo",
  "pickupAddress": "Rua A, 123",
  "pickupLat": -23.550520,
  "pickupLng": -46.633308,
  "deliveryAddress": "Rua B, 456",
  "deliveryLat": -23.563210,
  "deliveryLng": -46.654250,
  "customerName": "João Silva",
  "notes": "Fragil"
}
```

### 2. Backend Processa
1. Busca configurações (raio, tempo de aceitação, comissão)
2. Calcula distância e tempo aproximados
3. Calcula valor da entrega e desconta comissão
4. Busca todos os motoristas dentro do raio (Haversine)
5. Filtra apenas motoristas:
   - `active: true`
   - `approve: true`
   - `available: true`
   - Com FCM token
6. Dispara notificação push para todos os motoristas encontrados

### 3. Notificação Push para Motoristas

**Tipo de Notificação:** `new_delivery_request`

**Payload:**
```json
{
  "type": "new_delivery_request",
  "requestId": "uuid-da-solicitacao",
  "requestNumber": "REQ-001",
  "companyName": "Empresa XYZ Ltda",
  "pickupAddress": "Rua A, 123",
  "deliveryAddress": "Rua B, 456",
  "distance": "5.2",
  "estimatedTime": "15",
  "driverAmount": "18.50",
  "expiresAt": "2025-11-06T20:45:30Z"
}
```

**Título:** "🚚 Nova Solicitação de Entrega!"
**Mensagem:** "Empresa XYZ - 5.2km - R$ 18,50"

### 4. Modal no App do Motorista

Quando a notificação chegar, o app Flutter deve mostrar um modal com:

```dart
// Modal de Nova Solicitação
AlertDialog(
  title: Text("🚚 Nova Solicitação de Entrega!"),
  content: Column(
    children: [
      // EMPRESA
      Text("Empresa: ${data['companyName']}"),

      // ENDEREÇOS
      Row(
        children: [
          Icon(Icons.place, color: Colors.green),
          Text(data['pickupAddress']),
        ],
      ),
      Row(
        children: [
          Icon(Icons.flag, color: Colors.red),
          Text(data['deliveryAddress']),
        ],
      ),

      // INFORMAÇÕES
      Text("Distância: ${data['distance']} km"),
      Text("Tempo estimado: ${data['estimatedTime']} min"),
      Text("Valor: R\$ ${data['driverAmount']}",
           style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),

      // CONTADOR REGRESSIVO
      CountdownTimer(expiresAt: data['expiresAt']),
    ],
  ),
  actions: [
    TextButton(
      onPressed: () => rejectRequest(data['requestId']),
      child: Text("Rejeitar"),
    ),
    ElevatedButton(
      onPressed: () => acceptRequest(data['requestId']),
      child: Text("Aceitar"),
    ),
  ],
)
```

### 5. Motorista Aceita

**Endpoint:** `POST /api/v1/driver/requests/:id/accept`

**Ações do Backend:**
1. Verifica se a solicitação ainda está disponível
2. Atualiza `requests.driverId` com o ID do motorista
3. Atualiza `requests.acceptedAt` com timestamp atual
4. Marca todas as outras notificações como `expired`
5. Envia push para outros motoristas: "Esta entrega foi aceita por outro motorista"
6. Retorna detalhes completos da entrega

**Response:**
```json
{
  "success": true,
  "message": "Entrega aceita com sucesso!",
  "data": {
    "requestId": "uuid",
    "requestNumber": "REQ-001",
    "pickupAddress": "Rua A, 123",
    "pickupLat": -23.550520,
    "pickupLng": -46.633308,
    "deliveryAddress": "Rua B, 456",
    "deliveryLat": -23.563210,
    "deliveryLng": -46.654250,
    "distance": "5.2",
    "estimatedTime": "15",
    "driverAmount": "18.50"
  }
}
```

**Flutter - Após Aceitar:**
```dart
// Mostrar opções de navegação
showDialog(
  context: context,
  builder: (context) => AlertDialog(
    title: Text("Traçar Rota"),
    content: Text("Escolha o aplicativo de navegação:"),
    actions: [
      TextButton(
        onPressed: () => openGoogleMaps(pickupLat, pickupLng),
        child: Row(
          children: [
            Icon(Icons.map),
            Text("Google Maps"),
          ],
        ),
      ),
      TextButton(
        onPressed: () => openWaze(pickupLat, pickupLng),
        child: Row(
          children: [
            Image.asset('assets/waze_icon.png', width: 24),
            Text("Waze"),
          ],
        ),
      ),
    ],
  ),
);

// Abrir Google Maps
void openGoogleMaps(double lat, double lng) {
  final url = 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng';
  launchUrl(Uri.parse(url));
}

// Abrir Waze
void openWaze(double lat, double lng) {
  final url = 'https://waze.com/ul?ll=$lat,$lng&navigate=yes';
  launchUrl(Uri.parse(url));
}
```

### 6. Motorista Rejeita

**Endpoint:** `POST /api/v1/driver/requests/:id/reject`

**Ações do Backend:**
1. Marca a notificação do motorista como `rejected`
2. Para de enviar notificações para esse motorista

**Response:**
```json
{
  "success": true,
  "message": "Solicitação rejeitada"
}
```

## 🔧 Configurações (Tabela Settings)

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| `driverSearchRadius` | Raio de busca em km | 10 |
| `minTimeToFindDriver` | Tempo mínimo para encontrar motorista (segundos) | 120 |
| `driverAcceptanceTimeout` | Tempo para o motorista aceitar (segundos) | 30 |
| `adminCommissionPercentage` | Comissão do admin (%) | 20 |

## 📊 Tabela driver_notifications

Rastreia todas as notificações enviadas aos motoristas:

```sql
CREATE TABLE driver_notifications (
  id UUID PRIMARY KEY,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'notified', -- notified, accepted, rejected, expired
  notified_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 Algoritmo de Busca de Motoristas (Haversine)

```typescript
function findDriversInRadius(
  pickupLat: number,
  pickupLng: number,
  radius: number
): Driver[] {
  const sql = `
    SELECT *,
      (6371 * acos(
        cos(radians(${pickupLat})) *
        cos(radians(latitude)) *
        cos(radians(longitude) - radians(${pickupLng})) +
        sin(radians(${pickupLat})) *
        sin(radians(latitude))
      )) AS distance
    FROM drivers
    WHERE active = true
      AND approve = true
      AND available = true
      AND fcm_token IS NOT NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    HAVING distance <= ${radius}
    ORDER BY distance ASC
  `;

  return db.execute(sql);
}
```

## 💰 Cálculo de Valores

```typescript
// Valor base (implementar lógica de precificação)
const totalAmount = calculatePrice(distance, estimatedTime, zoneType);

// Comissão do admin
const adminCommission = totalAmount * (adminCommissionPercentage / 100);

// Valor que o motorista recebe
const driverAmount = totalAmount - adminCommission;
```

## 🔔 Implementação Firebase (Flutter)

### 1. Configurar Firebase Messaging

```dart
// main.dart
import 'package:firebase_messaging/firebase_messaging.dart';

Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print("Handling background message: ${message.messageId}");
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(MyApp());
}
```

### 2. Listener de Mensagens

```dart
class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();

    // Mensagem em foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final data = message.data;

      if (data['type'] == 'new_delivery_request') {
        _showDeliveryRequestDialog(data);
      }
    });

    // App foi aberto via notificação
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      final data = message.data;
      Navigator.pushNamed(context, '/pending-requests');
    });
  }

  void _showDeliveryRequestDialog(Map<String, dynamic> data) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => DeliveryRequestDialog(data: data),
    );
  }
}
```

### 3. Widget do Dialog com Countdown

```dart
class DeliveryRequestDialog extends StatefulWidget {
  final Map<String, dynamic> data;

  DeliveryRequestDialog({required this.data});

  @override
  _DeliveryRequestDialogState createState() => _DeliveryRequestDialogState();
}

class _DeliveryRequestDialogState extends State<DeliveryRequestDialog> {
  late Timer _timer;
  late Duration _timeLeft;

  @override
  void initState() {
    super.initState();

    final expiresAt = DateTime.parse(widget.data['expiresAt']);
    _timeLeft = expiresAt.difference(DateTime.now());

    _timer = Timer.periodic(Duration(seconds: 1), (timer) {
      setState(() {
        _timeLeft = expiresAt.difference(DateTime.now());

        if (_timeLeft.isNegative) {
          timer.cancel();
          Navigator.pop(context);
        }
      });
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text("🚚 Nova Solicitação!"),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text("Empresa: ${widget.data['companyName']}"),
          SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.place, color: Colors.green, size: 16),
              Expanded(child: Text(widget.data['pickupAddress'])),
            ],
          ),
          Row(
            children: [
              Icon(Icons.flag, color: Colors.red, size: 16),
              Expanded(child: Text(widget.data['deliveryAddress'])),
            ],
          ),
          Divider(),
          Text("${widget.data['distance']} km • ${widget.data['estimatedTime']} min"),
          Text(
            "R\$ ${widget.data['driverAmount']}",
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.green),
          ),
          Divider(),
          Text(
            "Tempo restante: ${_timeLeft.inSeconds}s",
            style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => _rejectRequest(),
          child: Text("Rejeitar"),
        ),
        ElevatedButton(
          onPressed: () => _acceptRequest(),
          child: Text("Aceitar"),
        ),
      ],
    );
  }

  Future<void> _acceptRequest() async {
    final response = await dio.post(
      '/api/v1/driver/requests/${widget.data['requestId']}/accept',
    );

    Navigator.pop(context);

    if (response.data['success']) {
      _showNavigationOptions(response.data['data']);
    }
  }

  Future<void> _rejectRequest() async {
    await dio.post(
      '/api/v1/driver/requests/${widget.data['requestId']}/reject',
    );

    Navigator.pop(context);
  }

  void _showNavigationOptions(Map<String, dynamic> delivery) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Traçar Rota"),
        content: Text("Ir para o local de retirada:"),
        actions: [
          TextButton(
            onPressed: () {
              final url = 'https://www.google.com/maps/dir/?api=1&destination=${delivery['pickupLat']},${delivery['pickupLng']}';
              launchUrl(Uri.parse(url));
              Navigator.pop(context);
            },
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.map),
                SizedBox(width: 8),
                Text("Google Maps"),
              ],
            ),
          ),
          TextButton(
            onPressed: () {
              final url = 'https://waze.com/ul?ll=${delivery['pickupLat']},${delivery['pickupLng']}&navigate=yes';
              launchUrl(Uri.parse(url));
              Navigator.pop(context);
            },
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset('assets/waze.png', width: 24),
                SizedBox(width: 8),
                Text("Waze"),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

## 🚀 Próximos Passos de Implementação

1. ✅ Tabela `driver_notifications` criada no schema
2. ⏳ Aplicar schema ao banco (`npm run db:push`)
3. ⏳ Criar endpoint `POST /api/company/requests`
4. ⏳ Implementar busca de motoristas com Haversine
5. ⏳ Implementar envio de notificações FCM
6. ⏳ Criar endpoint `POST /api/v1/driver/requests/:id/accept`
7. ⏳ Criar endpoint `POST /api/v1/driver/requests/:id/reject`
8. ⏳ Criar endpoint `GET /api/v1/driver/pending-requests`
9. ⏳ Implementar Flutter conforme especificação acima
10. ⏳ Testar fluxo completo

---

**Documento gerado em:** 2025-11-06
**Versão:** 1.0
