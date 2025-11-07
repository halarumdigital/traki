# Sistema de Notificações e Entregas em Tempo Real

## 📋 Visão Geral

Este documento descreve o sistema completo de notificações push (FCM) e atualizações em tempo real (Socket.IO) para o gerenciamento de entregas entre empresa e motoristas.

---

## 🔔 Tecnologias Utilizadas

### 1. Firebase Cloud Messaging (FCM)
- **Função:** Enviar notificações push para o app do motorista
- **Quando:** Quando uma nova entrega é criada pela empresa
- **Configuração:** Feita no painel do administrador em Settings

### 2. Socket.IO (WebSocket)
- **Função:** Atualizações em tempo real no painel da empresa
- **Quando:** Motorista aceita/atualiza status da entrega
- **Conexão:** `ws://localhost:5000` (ou URL do servidor)

---

## 🔄 Fluxo Completo do Sistema

```
1. EMPRESA CRIA ENTREGA
   ↓
2. BACKEND salva entrega no banco
   ↓
3. BACKEND busca configurações (raio de pesquisa, timeouts)
   ↓
4. BACKEND busca motoristas disponíveis com localização
   ↓
5. BACKEND calcula distância de cada motorista ao ponto de retirada
   ↓
6. BACKEND filtra apenas motoristas DENTRO DO RAIO
   ↓
7. FCM Push → Motoristas filtrados (notificação com timeout)
   ↓
8. MOTORISTA visualiza notificação com countdown timer
   ↓
9. MOTORISTA aceita entrega (dentro do tempo limite)
   ↓
10. BACKEND atualiza banco com motorista
   ↓
11. Socket.IO → Painel da empresa (atualização em tempo real)
   ↓
12. MOTORISTA atualiza status (chegou, retirou, entregou, etc)
   ↓
13. Socket.IO → Painel da empresa (atualização em tempo real)
```

---

## ⚙️ Configurações Importantes

O sistema utiliza três configurações críticas na tabela `settings`:

### 1. Raio de Pesquisa (`driver_search_radius`)
- **Valor padrão**: 10 km
- **Função**: Define a distância máxima do motorista ao ponto de retirada
- **Como funciona**:
  - Quando uma entrega é criada, o sistema calcula a distância entre cada motorista disponível e o endereço de retirada
  - Usa a fórmula de Haversine para cálculo preciso de distância esférica
  - Apenas motoristas dentro do raio recebem a notificação push
- **Requisito**: Motoristas devem ter `latitude` e `longitude` atualizadas no banco

### 2. Tempo de Aceitação (`driver_acceptance_timeout`)
- **Valor padrão**: 30 segundos
- **Função**: Tempo que o motorista tem para aceitar a entrega após receber a notificação
- **Como funciona**:
  - Enviado no campo `acceptanceTimeout` da notificação FCM
  - App Flutter mostra countdown timer no dialog
  - Após o tempo esgotar, o dialog fecha automaticamente

### 3. Tempo de Busca (`min_time_to_find_driver`)
- **Valor padrão**: 120 segundos (2 minutos)
- **Função**: Tempo total que o sistema fica procurando motoristas
- **Como funciona**:
  - Enviado no campo `searchTimeout` da notificação FCM
  - Pode ser usado para lógica de re-notificação ou cancelamento automático

---

## 📍 Atualização de Localização em Tempo Real

**⚠️ CRÍTICO**: Para que o filtro por raio funcione, o app do motorista DEVE atualizar a localização constantemente.

### Implementação no Flutter

```dart
import 'dart:async';
import 'package:geolocator/geolocator.dart';

class LocationService {
  Timer? _locationTimer;

  // Iniciar atualização automática quando motorista ficar online
  void startLocationUpdates() {
    _locationTimer = Timer.periodic(Duration(seconds: 10), (timer) async {
      try {
        // Verificar permissão
        LocationPermission permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }

        // Obter localização atual
        Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );

        // Enviar para backend
        await dio.post(
          '/api/v1/driver/location',
          data: {
            'latitude': position.latitude,
            'longitude': position.longitude,
          },
        );

        print('📍 Localização atualizada: ${position.latitude}, ${position.longitude}');
      } catch (e) {
        print('❌ Erro ao atualizar localização: $e');
      }
    });
  }

  // Parar atualização quando motorista ficar offline
  void stopLocationUpdates() {
    _locationTimer?.cancel();
    _locationTimer = null;
  }
}

// Uso no app
final locationService = LocationService();

// Quando motorista fica online
await toggleOnlineStatus(true);
locationService.startLocationUpdates();

// Quando motorista fica offline
await toggleOnlineStatus(false);
locationService.stopLocationUpdates();
```

### Permissões Necessárias

**Android (`android/app/src/main/AndroidManifest.xml`):**
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

**iOS (`ios/Runner/Info.plist`):**
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Precisamos da sua localização para encontrar entregas próximas</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>Precisamos da sua localização em segundo plano para receber entregas</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Precisamos da sua localização para encontrar entregas próximas</string>
```

### Importante

1. **Frequência de atualização**: Recomendado 10 segundos quando online
2. **Background location**: Configure para funcionar mesmo com app em segundo plano
3. **Bateria**: Considere usar `LocationAccuracy.balanced` para economizar bateria
4. **Erro de localização**: Se GPS não disponível, motorista não receberá notificações
5. **Verificação**: Sempre verificar se localização foi atualizada recentemente antes de ficar online

---

## 📱 Endpoints para o Motorista

### GET /api/v1/driver/deliveries/available
**Descrição:** Lista todas as entregas disponíveis (sem motorista atribuído)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "request_number": "REQ-1234567890-123",
      "customer_name": "João Silva",
      "total_distance": "5.2",
      "total_time": "15",
      "request_eta_amount": "25.50",
      "created_at": "2024-01-15T10:30:00",
      "pick_address": "Rua A, 123 - Bairro X",
      "drop_address": "Rua B, 456 - Bairro Y",
      "pick_lat": "-23.550520",
      "pick_lng": "-46.633309",
      "drop_lat": "-23.562940",
      "drop_lng": "-46.654460",
      "company_name": "Empresa ABC",
      "vehicle_type_name": "Moto"
    }
  ]
}
```

### POST /api/v1/driver/deliveries/:id/accept
**Descrição:** Motorista aceita a entrega

**Response:**
```json
{
  "success": true,
  "message": "Entrega aceita com sucesso",
  "data": {
    "deliveryId": "uuid",
    "status": "accepted"
  }
}
```

**Socket.IO Event emitido:**
```javascript
// Para a empresa que criou a entrega
socket.to(`company-${companyId}`).emit("delivery-accepted", {
  deliveryId: "uuid",
  requestNumber: "REQ-123",
  driverId: "uuid",
  driverName: "João Motorista",
  driverMobile: "11999999999",
  status: "Aceita pelo motorista",
  timestamp: "2024-01-15T10:35:00.000Z"
});
```

### POST /api/v1/driver/deliveries/:id/reject
**Descrição:** Motorista rejeita a entrega

**Body:**
```json
{
  "reason": "Muito longe" // opcional
}
```

### POST /api/v1/driver/deliveries/:id/arrived-pickup
**Descrição:** Motorista chegou no local de retirada

**Socket.IO Event:**
```javascript
{
  deliveryId: "uuid",
  requestNumber: "REQ-123",
  status: "Motorista chegou para retirada",
  timestamp: "2024-01-15T10:40:00.000Z"
}
```

### POST /api/v1/driver/deliveries/:id/picked-up
**Descrição:** Motorista retirou o pedido

**Socket.IO Event:**
```javascript
{
  deliveryId: "uuid",
  requestNumber: "REQ-123",
  status: "Pedido retirado - Indo para entrega",
  timestamp: "2024-01-15T10:45:00.000Z"
}
```

### POST /api/v1/driver/deliveries/:id/delivered
**Descrição:** Motorista entregou o pedido

**Socket.IO Event:**
```javascript
{
  deliveryId: "uuid",
  requestNumber: "REQ-123",
  status: "Pedido entregue",
  timestamp: "2024-01-15T11:00:00.000Z"
}
```

### POST /api/v1/driver/deliveries/:id/complete
**Descrição:** Motorista finaliza a entrega (concluído)

**Socket.IO Event:**
```javascript
{
  deliveryId: "uuid",
  requestNumber: "REQ-123",
  status: "Entrega concluída",
  timestamp: "2024-01-15T11:05:00.000Z"
}
```

### GET /api/v1/driver/deliveries/current
**Descrição:** Obtém a entrega em andamento do motorista

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "request_number": "REQ-123",
    "customer_name": "João Silva",
    "is_driver_started": true,
    "is_driver_arrived": true,
    "is_trip_start": true,
    "is_completed": false,
    "total_distance": "5.2",
    "total_time": "15",
    "request_eta_amount": "25.50",
    "created_at": "2024-01-15T10:30:00",
    "accepted_at": "2024-01-15T10:35:00",
    "pick_address": "Rua A, 123",
    "drop_address": "Rua B, 456",
    "pick_lat": "-23.550520",
    "pick_lng": "-46.633309",
    "drop_lat": "-23.562940",
    "drop_lng": "-46.654460",
    "company_name": "Empresa ABC",
    "company_phone": "11988887777",
    "vehicle_type_name": "Moto"
  }
}
```

---

## 🔥 Configuração do Firebase no App Flutter

### 1. Adicionar Dependências
```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^latest_version
  firebase_messaging: ^latest_version
```

### 2. Inicializar Firebase
```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Configurar FCM
  FirebaseMessaging messaging = FirebaseMessaging.instance;

  // Solicitar permissão
  NotificationSettings settings = await messaging.requestPermission(
    alert: true,
    sound: true,
    badge: true,
  );

  runApp(MyApp());
}
```

### 3. Obter Token FCM
```dart
Future<String?> getFCMToken() async {
  final fcmToken = await FirebaseMessaging.instance.getToken();
  print('FCM Token: $fcmToken');
  return fcmToken;
}

// Enviar token no login/registro
final fcmToken = await getFCMToken();
await dio.post('/api/v1/driver/login', data: {
  'mobile': mobile,
  'password': password,
  'deviceToken': fcmToken, // ← Envia o token
  'loginBy': 'android',
});
```

### 4. Escutar Notificações
```dart
class NotificationService {
  static Future<void> initialize() async {
    // Quando app está em foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Notificação recebida: ${message.notification?.title}');

      if (message.data['type'] == 'new_delivery') {
        // Mostrar modal de nova entrega
        showNewDeliveryModal(
          deliveryId: message.data['deliveryId'],
          pickupAddress: message.data['pickupAddress'],
          dropoffAddress: message.data['dropoffAddress'],
          estimatedAmount: message.data['estimatedAmount'],
        );
      }
    });

    // Quando app está em background e usuário clica
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Notificação clicada: ${message.notification?.title}');

      // Navegar para tela de entregas
      if (message.data['type'] == 'new_delivery') {
        Navigator.pushNamed(context, '/deliveries');
      }
    });
  }
}
```

### 5. Exemplo de Modal de Nova Entrega
```dart
void showNewDeliveryModal(Map<String, dynamic> deliveryData) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => AlertDialog(
      title: Text('Nova Entrega Disponível!'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Retirada:'),
          Text(deliveryData['pickupAddress'],
               style: TextStyle(fontWeight: FontWeight.bold)),
          SizedBox(height: 10),
          Text('Entrega:'),
          Text(deliveryData['dropoffAddress'],
               style: TextStyle(fontWeight: FontWeight.bold)),
          SizedBox(height: 10),
          Text('Valor: R\$ ${deliveryData['estimatedAmount']}',
               style: TextStyle(color: Colors.green, fontSize: 18)),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () async {
            // Rejeitar
            await dio.post('/api/v1/driver/deliveries/${deliveryData['deliveryId']}/reject');
            Navigator.pop(context);
          },
          child: Text('Rejeitar'),
        ),
        ElevatedButton(
          onPressed: () async {
            // Aceitar
            final response = await dio.post(
              '/api/v1/driver/deliveries/${deliveryData['deliveryId']}/accept'
            );

            if (response.data['success']) {
              Navigator.pop(context);
              // Navegar para tela de entrega em andamento
              Navigator.pushNamed(context, '/delivery-in-progress');
            }
          },
          child: Text('Aceitar'),
        ),
      ],
    ),
  );
}
```

---

## 🌐 Socket.IO no Painel da Empresa (React)

### 1. Instalar Socket.IO Client
```bash
npm install socket.io-client
```

### 2. Conectar ao Socket.IO
```typescript
// hooks/useSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(companyId: string | undefined) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!companyId) return;

    const newSocket = io('http://localhost:5000', {
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Socket conectado');
      // Entrar na sala da empresa
      newSocket.emit('join-company', companyId);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket desconectado');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [companyId]);

  return socket;
}
```

### 3. Escutar Eventos de Entrega
```typescript
// pages/empresa-entregas.tsx
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export default function EmpresaEntregas() {
  const { data: companyData } = useQuery({ queryKey: ['/api/empresa/auth/me'] });
  const socket = useSocket(companyData?.id);
  const { toast } = useToast();

  useEffect(() => {
    if (!socket) return;

    // Entrega aceita por motorista
    socket.on('delivery-accepted', (data) => {
      console.log('Entrega aceita:', data);

      toast({
        title: 'Entrega Aceita!',
        description: `${data.driverName} aceitou a entrega ${data.requestNumber}`,
      });

      // Atualizar lista de entregas
      queryClient.invalidateQueries({ queryKey: ['/api/empresa/deliveries'] });
    });

    // Status da entrega atualizado
    socket.on('delivery-status-updated', (data) => {
      console.log('Status atualizado:', data);

      toast({
        title: 'Status Atualizado',
        description: `${data.requestNumber}: ${data.status}`,
      });

      // Atualizar lista de entregas
      queryClient.invalidateQueries({ queryKey: ['/api/empresa/deliveries'] });
    });

    return () => {
      socket.off('delivery-accepted');
      socket.off('delivery-status-updated');
    };
  }, [socket]);

  // ... resto do componente
}
```

### 4. Exemplo de Atualização em Tempo Real
```typescript
// Quando o status muda, a lista atualiza automaticamente
// e o toast aparece mostrando a mudança

// Status possíveis:
// - "Aceita pelo motorista"
// - "Motorista chegou para retirada"
// - "Pedido retirado - Indo para entrega"
// - "Pedido entregue"
// - "Entrega concluída"
```

---

## ⚙️ Configuração do Firebase no Painel Admin

### Onde Configurar
Navegue para: **Settings → Firebase Configuration**

### Campos Necessários
1. **Firebase Project ID**: ID do projeto Firebase
2. **Firebase Client Email**: Email da service account
3. **Firebase Private Key**: Chave privada (pode ser base64 ou com `\n`)
4. **Firebase Database URL**: URL do Realtime Database (opcional)

### Como Obter as Credenciais

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Project Settings** → **Service Accounts**
4. Clique em **Generate New Private Key**
5. Será baixado um arquivo JSON com as credenciais:

```json
{
  "type": "service_account",
  "project_id": "seu-projeto-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@seu-projeto-id.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

6. Copie os valores:
   - `project_id` → Firebase Project ID
   - `client_email` → Firebase Client Email
   - `private_key` → Firebase Private Key
   - `databaseURL` (se houver) → Firebase Database URL

---

## 🚀 Testando o Sistema

### 1. Testar Notificação Push

```bash
# 1. Certifique-se que o Firebase está configurado no painel
# 2. Faça login no app como motorista
# 3. Fique online no app
# 4. No painel da empresa, crie uma nova entrega
# 5. O app do motorista deve receber uma notificação push
```

### 2. Testar Socket.IO

```bash
# 1. Abra o painel da empresa no navegador
# 2. Abra o console do navegador (F12)
# 3. Você deve ver "Socket conectado"
# 4. No app, aceite uma entrega
# 5. O painel deve atualizar automaticamente
```

### 3. Testar Fluxo Completo

```
1. Empresa cria entrega → ✅ Motorista recebe push
2. Motorista aceita → ✅ Painel atualiza
3. Motorista "Chegou para retirada" → ✅ Painel atualiza
4. Motorista "Retirou" → ✅ Painel atualiza
5. Motorista "Entregue" → ✅ Painel atualiza
6. Motorista "Concluído" → ✅ Painel atualiza
```

---

## 📊 Mapeamento de Status

| Banco de Dados | Status Exibido | Endpoint |
|----------------|----------------|----------|
| `driver_id IS NULL` | Aguardando motorista | - |
| `is_driver_started = true` | Aceita pelo motorista | /accept |
| `is_driver_arrived = true` | Motorista chegou para retirada | /arrived-pickup |
| `is_trip_start = true` | Pedido retirado - Indo para entrega | /picked-up |
| - | Pedido entregue | /delivered |
| `is_completed = true` | Entrega concluída | /complete |

---

## 🔧 Troubleshooting

### Notificações não chegam

1. Verificar se Firebase está configurado corretamente no painel
2. Verificar se motorista tem FCM token salvo no banco
3. Verificar se motorista está com `available = true` e `approve = true`
4. Verificar logs do servidor: "✓ Notificação enviada para X motoristas"

### Socket.IO não conecta

1. Verificar se servidor está rodando
2. Verificar URL do Socket.IO (deve ser mesma URL da API)
3. Verificar `withCredentials: true` no cliente
4. Verificar logs do navegador e servidor

### Painel não atualiza automaticamente

1. Verificar se Socket está conectado (console do navegador)
2. Verificar se `join-company` foi emitido com `companyId` correto
3. Verificar se listeners estão registrados (`delivery-accepted`, `delivery-status-updated`)

---

## 📝 Próximas Melhorias

- [ ] Sistema de filas para atribuição automática de motoristas
- [ ] Notificação quando entrega não é aceita em X minutos
- [ ] Chat em tempo real entre empresa e motorista
- [ ] Tracking GPS em tempo real da localização do motorista
- [ ] Histórico de entregas e relatórios
- [ ] Sistema de avaliações motorista/empresa

---

## 📚 Referências

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [Flutter Firebase Messaging](https://firebase.flutter.dev/docs/messaging/overview)
