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

O sistema utiliza **3 configurações críticas** na tabela `settings` que controlam todo o fluxo de notificações e atribuição de motoristas:

### 1. Raio de Pesquisa de Motoristas
**Campo**: `driver_search_radius` (km)
**Valor padrão**: 10 km
**Interface**: "Raio de Pesquisa de Motoristas (km)"

**Função**: Define a distância máxima entre o motorista e o ponto de retirada para receber a notificação.

**Como funciona**:
  - Quando uma entrega é criada, o sistema calcula a distância entre cada motorista disponível e o endereço de retirada
  - Usa a fórmula de Haversine para cálculo preciso de distância esférica (considera a curvatura da Terra)
  - **Apenas motoristas dentro do raio** recebem a notificação push via FCM
  - Motoristas fora do raio não são notificados

**Requisito importante**: Motoristas devem ter `latitude` e `longitude` atualizadas no banco de dados (atualizadas a cada 10 segundos quando online).

**Exemplo**: Se configurado como 15 km e a retirada é no centro da cidade, apenas motoristas a até 15 km do centro receberão a notificação.

---

### 2. Tempo de Aceitação do Motorista
**Campo**: `driver_acceptance_timeout` (segundos)
**Valor padrão**: 30 segundos
**Interface**: "Tempo de Aceitação do Motorista (segundos)"

**Função**: Tempo que o motorista tem para aceitar ou rejeitar a entrega após receber a notificação.

**Como funciona**:
  - Backend lê este valor da tabela `settings` ao criar uma nova entrega
  - Enviado dinamicamente no campo `acceptanceTimeout` da notificação FCM
  - App Flutter mostra **countdown timer** no dialog usando o valor recebido
  - Quando o tempo chega a 10 segundos ou menos, o timer fica vermelho (alerta)
  - Após o tempo esgotar, o dialog fecha automaticamente e conta como "rejeitado"

**Configuração**: Admin → Settings → "Tempo de Aceitação do Motorista (segundos)"

**Exemplo**: Se configurado como 45 segundos, o motorista verá "Tempo restante: 45s" e terá 45 segundos para decidir.

---

### 3. Tempo Mínimo para Encontrar Motorista
**Campo**: `min_time_to_find_driver` (segundos)
**Valor padrão**: 120 segundos (2 minutos)
**Interface**: "Tempo Mínimo para Encontrar Motorista (segundos)"

**Função**: Tempo total que o sistema espera/procura por um motorista antes de considerar que não há motoristas disponíveis.

**Como funciona**:
  - Enviado no campo `searchTimeout` da notificação FCM
  - Backend lê este valor da tabela `settings` ao criar uma nova entrega
  - Pode ser usado para implementar lógica de:
    - Re-notificação de motoristas após X segundos
    - Cancelamento automático da entrega se nenhum motorista aceitar
    - Expansão do raio de pesquisa após timeout
    - Notificação para a empresa que não há motoristas disponíveis

**Importante**: Este campo está disponível no sistema mas **ainda não tem lógica automática implementada**. Você pode usá-lo para implementar funcionalidades futuras.

**Exemplo**: Se configurado como 180 segundos (3 minutos) e nenhum motorista aceitar em 3 minutos, o sistema pode re-notificar ou avisar a empresa.

---

### 📊 Resumo dos 3 Campos

| Campo no Banco | Label na Interface | Padrão | Onde é Usado | Impacto |
|----------------|-------------------|--------|--------------|---------|
| `driver_search_radius` | Raio de Pesquisa de Motoristas (km) | 10 km | Filtro de motoristas | Define quem recebe notificação |
| `driver_acceptance_timeout` | Tempo de Aceitação do Motorista (segundos) | 30s | Countdown no app | Tempo para aceitar/rejeitar |
| `min_time_to_find_driver` | Tempo Mínimo para Encontrar Motorista (segundos) | 120s | Timeout geral | Tempo total de busca |

**Como alterar**: Acesse o painel Admin → Settings → Role até a seção de configurações de motoristas

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

## ✅ STATUS DA IMPLEMENTAÇÃO

### Endpoints Implementados

#### 1. POST /api/v1/driver/location ✅
**Status:** IMPLEMENTADO
**Descrição:** Atualiza a latitude e longitude do motorista no banco de dados
**Autenticação:** Bearer Token ou Session

**Request:**
```json
{
  "latitude": -23.550520,
  "longitude": -46.633309
}
```

**Response:**
```json
{
  "success": true,
  "message": "Localização atualizada com sucesso"
}
```

**Uso no Flutter:**
```dart
await dio.post(
  '/api/v1/driver/location',
  data: {
    'latitude': position.latitude,
    'longitude': position.longitude,
  },
  options: Options(
    headers: {
      'Authorization': 'Bearer $token',
    },
  ),
);
```

#### 2. POST /api/v1/driver/update-fcm-token ✅
**Status:** IMPLEMENTADO
**Descrição:** Registra ou atualiza o token FCM do motorista para receber notificações push
**Autenticação:** Bearer Token ou Session

**Request:**
```json
{
  "fcmToken": "f1a2b3c4d5..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token FCM atualizado com sucesso"
}
```

**Uso no Flutter:**
```dart
// Obter token FCM
final fcmToken = await FirebaseMessaging.instance.getToken();

// Enviar para backend
await dio.post(
  '/api/v1/driver/update-fcm-token',
  data: {
    'fcmToken': fcmToken,
  },
  options: Options(
    headers: {
      'Authorization': 'Bearer $token',
    },
  ),
);
```

**Quando chamar:**
- No login do motorista
- Quando o token FCM é renovado (`FirebaseMessaging.instance.onTokenRefresh`)
- Ao fazer logout (enviar null para limpar)

#### 3. Socket.IO no Frontend (React) ✅
**Status:** IMPLEMENTADO
**Arquivo:** `client/src/hooks/useSocket.ts`
**Página:** `client/src/pages/empresa-entregas.tsx`

**Hook Personalizado:**
```typescript
// Uso na página de entregas da empresa
import { useSocket } from "@/hooks/useSocket";

export default function EmpresaEntregas() {
  const { data: companyData } = useQuery<Company>({
    queryKey: ["/api/empresa/auth/me"],
  });

  // Conectar ao Socket.IO
  const { isConnected, on } = useSocket({
    companyId: companyData?.id,
    autoConnect: !!companyData?.id,
  });

  // Escutar eventos
  useEffect(() => {
    if (!isConnected) return;

    // Motorista aceitou a entrega
    on("delivery-accepted", (data) => {
      toast({
        title: "Entrega aceita!",
        description: `${data.driverName} aceitou a entrega #${data.requestNumber}`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries"] });
    });

    // Status da entrega atualizado
    on("delivery-status-updated", (data) => {
      const statusMessages = {
        arrived: "Motorista chegou no local de retirada",
        picked_up: "Motorista coletou a entrega",
        delivered: "Entrega realizada com sucesso",
        completed: "Entrega finalizada",
      };

      toast({
        title: `Entrega #${data.requestNumber}`,
        description: statusMessages[data.status],
      });

      queryClient.invalidateQueries({ queryKey: ["/api/empresa/deliveries"] });
    });
  }, [isConnected, on]);
}
```

**Recursos:**
- ✅ Conexão automática quando `companyId` está disponível
- ✅ Reconexão automática em caso de queda
- ✅ Auto-join na sala `company-{companyId}`
- ✅ Listeners para eventos `delivery-accepted` e `delivery-status-updated`
- ✅ Toast notifications em tempo real
- ✅ Atualização automática da lista de entregas via TanStack Query
- ✅ Logs detalhados no console para debug

### Checklist de Implementação

- [x] Endpoint de atualização de localização (`POST /api/v1/driver/location`)
- [x] Endpoint de registro de token FCM (`POST /api/v1/driver/update-fcm-token`)
- [x] Socket.IO no frontend React
- [x] Hook `useSocket` personalizado
- [x] Integração na página de entregas da empresa
- [x] Toast notifications em tempo real
- [x] Atualização automática de queries
- [ ] Implementação no app Flutter (pendente)
- [ ] Testes end-to-end completos

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

---

## 📱 IMPLEMENTAÇÃO COMPLETA NO FLUTTER

Esta seção contém exemplos completos e prontos para uso no app Flutter do motorista.

### 📦 Dependências Necessárias

Adicione ao `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter

  # Requisições HTTP
  dio: ^5.4.0

  # Firebase
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9

  # Localização
  geolocator: ^11.0.0
  permission_handler: ^11.1.0

  # Armazenamento local
  shared_preferences: ^2.2.2

  # Gerenciamento de estado (escolha um)
  provider: ^6.1.1
  # ou
  flutter_bloc: ^8.1.3

  # Background tasks
  workmanager: ^0.5.2
```

### 🔐 1. Serviço de Autenticação

```dart
// lib/services/auth_service.dart
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  final Dio _dio;
  static const String _tokenKey = 'driver_token';
  static const String _driverIdKey = 'driver_id';

  AuthService(this._dio);

  // Fazer login e registrar token FCM
  Future<Map<String, dynamic>> login({
    required String mobile,
    required String password,
    required String fcmToken,
  }) async {
    try {
      final response = await _dio.post(
        '/api/v1/driver/login',
        data: {
          'mobile': mobile,
          'password': password,
          'deviceToken': fcmToken,
          'loginBy': 'android', // ou 'ios'
        },
      );

      if (response.data['success'] == true) {
        // Salvar token e ID do motorista
        final prefs = await SharedPreferences.getInstance();
        final token = response.data['token'];
        final driverId = response.data['driver']['id'];

        await prefs.setString(_tokenKey, token);
        await prefs.setString(_driverIdKey, driverId);

        // Configurar token no Dio para próximas requisições
        _dio.options.headers['Authorization'] = 'Bearer $token';

        return response.data;
      } else {
        throw Exception(response.data['message'] ?? 'Erro ao fazer login');
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw Exception('Usuário ou senha incorretos');
      }
      throw Exception('Erro de conexão: ${e.message}');
    }
  }

  // Restaurar sessão ao abrir o app
  Future<bool> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_tokenKey);

      if (token != null) {
        _dio.options.headers['Authorization'] = 'Bearer $token';

        // Verificar se token ainda é válido
        final response = await _dio.get('/api/v1/driver/me');
        return response.data['success'] == true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  // Fazer logout
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_driverIdKey);
    _dio.options.headers.remove('Authorization');
  }

  // Obter ID do motorista
  Future<String?> getDriverId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_driverIdKey);
  }

  // Verificar se está logado
  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(_tokenKey);
  }
}
```

### 🔔 2. Serviço de Notificações (FCM)

```dart
// lib/services/notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dio/dio.dart';

// Handler para notificações em background
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print('🔔 Background message: ${message.messageId}');
}

class NotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final Dio _dio;

  NotificationService(this._dio);

  // Inicializar serviço de notificações
  Future<void> initialize() async {
    // Solicitar permissão
    NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      sound: true,
      badge: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('✅ Permissão de notificação concedida');
    } else {
      print('❌ Permissão de notificação negada');
      return;
    }

    // Configurar notificações locais (Android)
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _handleNotificationTap,
    );

    // Registrar handler de background
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Escutar notificações quando app está em foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Escutar quando usuário toca na notificação (app estava em background)
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationOpened);

    // Verificar se app foi aberto por uma notificação
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationOpened(initialMessage);
    }

    // Registrar token no backend
    await registerToken();

    // Escutar quando token é renovado
    _messaging.onTokenRefresh.listen((newToken) {
      _updateTokenOnServer(newToken);
    });
  }

  // Obter e registrar token FCM no servidor
  Future<String?> registerToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        print('📱 FCM Token: $token');
        await _updateTokenOnServer(token);
        return token;
      }
    } catch (e) {
      print('❌ Erro ao obter FCM token: $e');
    }
    return null;
  }

  // Atualizar token no servidor
  Future<void> _updateTokenOnServer(String token) async {
    try {
      final response = await _dio.post(
        '/api/v1/driver/update-fcm-token',
        data: {'fcmToken': token},
      );

      if (response.data['success'] == true) {
        print('✅ Token FCM atualizado no servidor');
      }
    } catch (e) {
      print('❌ Erro ao atualizar token FCM: $e');
    }
  }

  // Handler de notificações em foreground
  void _handleForegroundMessage(RemoteMessage message) {
    print('🔔 Foreground message: ${message.notification?.title}');

    final notification = message.notification;
    final data = message.data;

    // Se for nova entrega, mostrar dialog em vez de notificação local
    if (data['type'] == 'new_delivery') {
      _showNewDeliveryDialog(data);
    } else {
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

  // Handler quando usuário toca na notificação
  void _handleNotificationOpened(RemoteMessage message) {
    print('🔔 Notification opened: ${message.data}');

    final data = message.data;

    if (data['type'] == 'new_delivery') {
      // Navegar para tela de entregas disponíveis
      // navigatorKey.currentState?.pushNamed('/available-deliveries');
    } else if (data['type'] == 'delivery_cancelled') {
      // Navegar para tela inicial
      // navigatorKey.currentState?.pushNamed('/home');
    }
  }

  // Handler quando usuário toca na notificação local
  void _handleNotificationTap(NotificationResponse response) {
    print('🔔 Local notification tapped: ${response.payload}');
  }

  // Mostrar dialog de nova entrega
  void _showNewDeliveryDialog(Map<String, dynamic> data) {
    // Este método deve ser implementado no widget/state manager
    // que tem acesso ao BuildContext
    print('🚨 Nova entrega disponível: ${data['deliveryId']}');
    // Emitir evento para UI mostrar dialog
  }

  // Mostrar notificação local
  Future<void> _showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'delivery_channel',
      'Entregas',
      channelDescription: 'Notificações de entregas',
      importance: Importance.high,
      priority: Priority.high,
      playSound: true,
    );

    const iosDetails = DarwinNotificationDetails();

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      DateTime.now().millisecond,
      title,
      body,
      details,
      payload: payload,
    );
  }
}
```

### 📍 3. Serviço de Localização

```dart
// lib/services/location_service.dart
import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:dio/dio.dart';

class LocationService {
  final Dio _dio;
  Timer? _locationTimer;
  bool _isUpdating = false;

  LocationService(this._dio);

  // Verificar e solicitar permissões
  Future<bool> checkPermissions() async {
    // Verificar se serviços de localização estão habilitados
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      print('❌ Serviços de localização desabilitados');
      return false;
    }

    // Verificar permissão
    LocationPermission permission = await Geolocator.checkPermission();

    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        print('❌ Permissão de localização negada');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      print('❌ Permissão de localização negada permanentemente');
      // Abrir configurações
      await openAppSettings();
      return false;
    }

    // Solicitar permissão de localização em background (Android 10+)
    if (await Permission.locationAlways.isDenied) {
      final status = await Permission.locationAlways.request();
      if (!status.isGranted) {
        print('⚠️ Permissão de localização em background não concedida');
      }
    }

    print('✅ Permissões de localização concedidas');
    return true;
  }

  // Obter localização atual uma vez
  Future<Position?> getCurrentLocation() async {
    try {
      if (!await checkPermissions()) {
        return null;
      }

      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      );

      print('📍 Localização atual: ${position.latitude}, ${position.longitude}');
      return position;
    } catch (e) {
      print('❌ Erro ao obter localização: $e');
      return null;
    }
  }

  // Iniciar atualização automática de localização
  Future<void> startLocationUpdates({int intervalSeconds = 10}) async {
    if (_isUpdating) {
      print('⚠️ Atualização de localização já está ativa');
      return;
    }

    if (!await checkPermissions()) {
      print('❌ Sem permissões para atualizar localização');
      return;
    }

    _isUpdating = true;
    print('🚀 Iniciando atualização de localização a cada $intervalSeconds segundos');

    // Atualizar imediatamente
    await _updateLocation();

    // Configurar timer para atualizações periódicas
    _locationTimer = Timer.periodic(
      Duration(seconds: intervalSeconds),
      (_) => _updateLocation(),
    );
  }

  // Parar atualização automática
  void stopLocationUpdates() {
    _locationTimer?.cancel();
    _locationTimer = null;
    _isUpdating = false;
    print('🛑 Atualização de localização parada');
  }

  // Atualizar localização no servidor
  Future<void> _updateLocation() async {
    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      );

      final response = await _dio.post(
        '/api/v1/driver/location',
        data: {
          'latitude': position.latitude,
          'longitude': position.longitude,
        },
      );

      if (response.data['success'] == true) {
        print('📍 Localização atualizada: ${position.latitude}, ${position.longitude}');
      }
    } catch (e) {
      print('❌ Erro ao atualizar localização: $e');
    }
  }

  // Verificar se está atualizando
  bool get isUpdating => _isUpdating;

  // Limpar recursos
  void dispose() {
    stopLocationUpdates();
  }
}
```

### 🚚 4. Serviço de Entregas

```dart
// lib/services/delivery_service.dart
import 'package:dio/dio.dart';

class DeliveryService {
  final Dio _dio;

  DeliveryService(this._dio);

  // Listar entregas disponíveis
  Future<List<Map<String, dynamic>>> getAvailableDeliveries() async {
    try {
      final response = await _dio.get('/api/v1/driver/deliveries/available');

      if (response.data['success'] == true) {
        return List<Map<String, dynamic>>.from(response.data['data']);
      }

      return [];
    } catch (e) {
      print('❌ Erro ao buscar entregas disponíveis: $e');
      return [];
    }
  }

  // Obter entrega em andamento
  Future<Map<String, dynamic>?> getCurrentDelivery() async {
    try {
      final response = await _dio.get('/api/v1/driver/deliveries/current');

      if (response.data['success'] == true && response.data['data'] != null) {
        return response.data['data'];
      }

      return null;
    } catch (e) {
      print('❌ Erro ao buscar entrega atual: $e');
      return null;
    }
  }

  // Aceitar entrega
  Future<bool> acceptDelivery(String deliveryId) async {
    try {
      final response = await _dio.post(
        '/api/v1/driver/deliveries/$deliveryId/accept',
      );

      if (response.data['success'] == true) {
        print('✅ Entrega aceita com sucesso');
        return true;
      }

      return false;
    } catch (e) {
      print('❌ Erro ao aceitar entrega: $e');
      return false;
    }
  }

  // Rejeitar entrega
  Future<bool> rejectDelivery(String deliveryId, {String? reason}) async {
    try {
      final response = await _dio.post(
        '/api/v1/driver/deliveries/$deliveryId/reject',
        data: reason != null ? {'reason': reason} : null,
      );

      if (response.data['success'] == true) {
        print('✅ Entrega rejeitada');
        return true;
      }

      return false;
    } catch (e) {
      print('❌ Erro ao rejeitar entrega: $e');
      return false;
    }
  }

  // Atualizar status: Chegou no local de retirada
  Future<bool> arrivedAtPickup(String deliveryId) async {
    try {
      final response = await _dio.post(
        '/api/v1/driver/deliveries/$deliveryId/arrived-pickup',
      );
      return response.data['success'] == true;
    } catch (e) {
      print('❌ Erro ao marcar chegada: $e');
      return false;
    }
  }

  // Atualizar status: Retirou o pedido
  Future<bool> pickedUp(String deliveryId) async {
    try {
      final response = await _dio.post(
        '/api/v1/driver/deliveries/$deliveryId/picked-up',
      );
      return response.data['success'] == true;
    } catch (e) {
      print('❌ Erro ao marcar retirada: $e');
      return false;
    }
  }

  // Atualizar status: Entregou o pedido
  Future<bool> delivered(String deliveryId) async {
    try {
      final response = await _dio.post(
        '/api/v1/driver/deliveries/$deliveryId/delivered',
      );
      return response.data['success'] == true;
    } catch (e) {
      print('❌ Erro ao marcar entrega: $e');
      return false;
    }
  }

  // Atualizar status: Completou a entrega
  Future<bool> complete(String deliveryId) async {
    try {
      final response = await _dio.post(
        '/api/v1/driver/deliveries/$deliveryId/complete',
      );
      return response.data['success'] == true;
    } catch (e) {
      print('❌ Erro ao completar entrega: $e');
      return false;
    }
  }
}
```

### 🎯 5. Setup Principal (main.dart)

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:dio/dio.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'services/notification_service.dart';
import 'services/location_service.dart';
import 'services/delivery_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializar Firebase
  await Firebase.initializeApp();

  // Configurar Dio
  final dio = Dio(BaseOptions(
    baseUrl: 'https://api.seuapp.com', // URL do backend
    connectTimeout: Duration(seconds: 30),
    receiveTimeout: Duration(seconds: 30),
    headers: {
      'Content-Type': 'application/json',
    },
  ));

  // Adicionar interceptor para logs
  dio.interceptors.add(LogInterceptor(
    requestBody: true,
    responseBody: true,
  ));

  // Criar serviços
  final authService = AuthService(dio);
  final notificationService = NotificationService(dio);
  final locationService = LocationService(dio);
  final deliveryService = DeliveryService(dio);

  // Inicializar notificações
  await notificationService.initialize();

  runApp(
    MultiProvider(
      providers: [
        Provider<AuthService>.value(value: authService),
        Provider<NotificationService>.value(value: notificationService),
        Provider<LocationService>.value(value: locationService),
        Provider<DeliveryService>.value(value: deliveryService),
      ],
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Motorista App',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: SplashScreen(),
    );
  }
}
```

### 🔄 6. Tela de Login

```dart
// lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';

class LoginScreen extends StatefulWidget {
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _mobileController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _mobileController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isLoading = true);

    try {
      final authService = context.read<AuthService>();
      final notificationService = context.read<NotificationService>();

      // Obter token FCM
      final fcmToken = await notificationService.registerToken();

      if (fcmToken == null) {
        throw Exception('Não foi possível obter token de notificação');
      }

      // Fazer login
      final result = await authService.login(
        mobile: _mobileController.text.trim(),
        password: _passwordController.text,
        fcmToken: fcmToken,
      );

      // Login bem-sucedido
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo
                Icon(Icons.local_shipping, size: 80, color: Colors.blue),
                SizedBox(height: 32),

                Text(
                  'Motorista App',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 48),

                // Campo de telefone
                TextFormField(
                  controller: _mobileController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: 'Telefone',
                    prefixIcon: Icon(Icons.phone),
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Digite seu telefone';
                    }
                    return null;
                  },
                ),
                SizedBox(height: 16),

                // Campo de senha
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Senha',
                    prefixIcon: Icon(Icons.lock),
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Digite sua senha';
                    }
                    return null;
                  },
                ),
                SizedBox(height: 24),

                // Botão de login
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isLoading
                      ? CircularProgressIndicator(color: Colors.white)
                      : Text('Entrar', style: TextStyle(fontSize: 16)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

### 🚨 7. Dialog de Nova Entrega

```dart
// lib/widgets/new_delivery_dialog.dart
import 'package:flutter/material.dart';
import 'dart:async';

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

  @override
  void initState() {
    super.initState();

    // Obter timeout da notificação
    // Este valor vem da tabela 'settings' (campo driver_acceptance_timeout)
    // e é enviado dinamicamente pelo backend via FCM
    _secondsRemaining = int.tryParse(
      widget.deliveryData['acceptanceTimeout']?.toString() ?? '30'
    ) ?? 30; // Fallback 30 segundos se não vier na notificação

    // Iniciar countdown
    _startCountdown();
  }

  void _startCountdown() {
    _timer = Timer.periodic(Duration(seconds: 1), (timer) {
      if (_secondsRemaining > 0) {
        setState(() => _secondsRemaining--);
      } else {
        // Tempo esgotado
        timer.cancel();
        Navigator.of(context).pop();
        widget.onResponse(false);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async => false, // Não permitir fechar sem responder
      child: AlertDialog(
        title: Row(
          children: [
            Icon(Icons.notifications_active, color: Colors.orange, size: 28),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Nova Entrega Disponível!',
                style: TextStyle(fontSize: 18),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Countdown timer
            Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _secondsRemaining <= 10 ? Colors.red[50] : Colors.blue[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.timer,
                    color: _secondsRemaining <= 10 ? Colors.red : Colors.blue,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Tempo restante: $_secondsRemaining s',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: _secondsRemaining <= 10 ? Colors.red : Colors.blue,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 16),

            // Cliente
            _buildInfoRow(
              icon: Icons.person,
              label: 'Cliente',
              value: widget.deliveryData['customerName'] ?? 'N/A',
            ),
            SizedBox(height: 12),

            // Endereço de retirada
            _buildInfoRow(
              icon: Icons.location_on,
              label: 'Retirada',
              value: widget.deliveryData['pickupAddress'] ?? 'N/A',
            ),
            SizedBox(height: 12),

            // Endereço de entrega
            _buildInfoRow(
              icon: Icons.flag,
              label: 'Entrega',
              value: widget.deliveryData['dropoffAddress'] ?? 'N/A',
            ),
            SizedBox(height: 12),

            // Distância e tempo
            Row(
              children: [
                Expanded(
                  child: _buildInfoRow(
                    icon: Icons.straighten,
                    label: 'Distância',
                    value: '${widget.deliveryData['totalDistance'] ?? 0} km',
                  ),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: _buildInfoRow(
                    icon: Icons.access_time,
                    label: 'Tempo',
                    value: '${widget.deliveryData['totalTime'] ?? 0} min',
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),

            // Valor
            Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.green),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.attach_money, color: Colors.green, size: 28),
                  Text(
                    'R\$ ${widget.deliveryData['estimatedAmount'] ?? '0.00'}',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.green[700],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Botão Rejeitar
          TextButton(
            onPressed: () {
              _timer?.cancel();
              Navigator.of(context).pop();
              widget.onResponse(false);
            },
            style: TextButton.styleFrom(
              foregroundColor: Colors.red,
            ),
            child: Text('REJEITAR', style: TextStyle(fontSize: 16)),
          ),

          // Botão Aceitar
          ElevatedButton(
            onPressed: () {
              _timer?.cancel();
              Navigator.of(context).pop();
              widget.onResponse(true);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
            child: Text(
              'ACEITAR',
              style: TextStyle(fontSize: 16, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: Colors.grey[600]),
        SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
```

### 🏠 8. Tela Principal com Status Online/Offline

```dart
// lib/screens/home_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/location_service.dart';
import '../services/delivery_service.dart';
import '../widgets/new_delivery_dialog.dart';

class HomeScreen extends StatefulWidget {
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isOnline = false;
  bool _isLoading = false;
  Map<String, dynamic>? _currentDelivery;

  @override
  void initState() {
    super.initState();
    _checkCurrentDelivery();
  }

  Future<void> _checkCurrentDelivery() async {
    final deliveryService = context.read<DeliveryService>();
    final delivery = await deliveryService.getCurrentDelivery();

    if (mounted) {
      setState(() => _currentDelivery = delivery);
    }
  }

  Future<void> _toggleOnlineStatus() async {
    setState(() => _isLoading = true);

    try {
      final locationService = context.read<LocationService>();

      if (!_isOnline) {
        // Ficar ONLINE
        // 1. Verificar permissões
        bool hasPermission = await locationService.checkPermissions();
        if (!hasPermission) {
          throw Exception('Permissão de localização necessária');
        }

        // 2. Obter localização atual
        final position = await locationService.getCurrentLocation();
        if (position == null) {
          throw Exception('Não foi possível obter sua localização');
        }

        // 3. Iniciar atualizações automáticas
        await locationService.startLocationUpdates(intervalSeconds: 10);

        setState(() => _isOnline = true);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✅ Você está online e disponível para entregas'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        // Ficar OFFLINE
        locationService.stopLocationUpdates();
        setState(() => _isOnline = false);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('🔴 Você está offline'),
              backgroundColor: Colors.orange,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showNewDeliveryDialog(Map<String, dynamic> data) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => NewDeliveryDialog(
        deliveryData: data,
        onResponse: (accepted) async {
          if (accepted) {
            await _handleAcceptDelivery(data['deliveryId']);
          } else {
            await _handleRejectDelivery(data['deliveryId']);
          }
        },
      ),
    );
  }

  Future<void> _handleAcceptDelivery(String deliveryId) async {
    final deliveryService = context.read<DeliveryService>();
    final success = await deliveryService.acceptDelivery(deliveryId);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✅ Entrega aceita com sucesso!'),
          backgroundColor: Colors.green,
        ),
      );

      // Navegar para tela de entrega em andamento
      Navigator.pushNamed(context, '/delivery-in-progress');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('❌ Erro ao aceitar entrega'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _handleRejectDelivery(String deliveryId) async {
    final deliveryService = context.read<DeliveryService>();
    await deliveryService.rejectDelivery(deliveryId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Motorista App'),
        actions: [
          // Indicador de status
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: Row(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: _isOnline ? Colors.green : Colors.grey,
                    shape: BoxShape.circle,
                  ),
                ),
                SizedBox(width: 8),
                Text(_isOnline ? 'Online' : 'Offline'),
              ],
            ),
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Botão Online/Offline
            Container(
              width: 200,
              height: 200,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _toggleOnlineStatus,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isOnline ? Colors.green : Colors.grey,
                  shape: CircleBorder(),
                  padding: EdgeInsets.all(40),
                ),
                child: _isLoading
                    ? CircularProgressIndicator(color: Colors.white)
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isOnline ? Icons.check_circle : Icons.power_settings_new,
                            size: 60,
                            color: Colors.white,
                          ),
                          SizedBox(height: 8),
                          Text(
                            _isOnline ? 'ONLINE' : 'OFFLINE',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            SizedBox(height: 32),

            // Status da entrega atual
            if (_currentDelivery != null)
              Card(
                margin: EdgeInsets.symmetric(horizontal: 24),
                child: ListTile(
                  leading: Icon(Icons.local_shipping, color: Colors.blue),
                  title: Text('Entrega em Andamento'),
                  subtitle: Text('${_currentDelivery!['request_number']}'),
                  trailing: ElevatedButton(
                    onPressed: () {
                      Navigator.pushNamed(context, '/delivery-in-progress');
                    },
                    child: Text('Ver'),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
```

### ✅ Checklist de Implementação Flutter

- [ ] Adicionar dependências ao `pubspec.yaml`
- [ ] Configurar Firebase (google-services.json / GoogleService-Info.plist)
- [ ] Criar classes de serviço (Auth, Notification, Location, Delivery)
- [ ] Implementar tela de login com registro de FCM token
- [ ] Implementar tela principal com botão Online/Offline
- [ ] Implementar dialog de nova entrega com countdown
- [ ] Configurar permissões de localização (AndroidManifest.xml / Info.plist)
- [ ] Testar notificações push em foreground e background
- [ ] Testar fluxo completo de entrega (aceitar → retirar → entregar → completar)
- [ ] Implementar background location updates para manter localização atualizada
- [ ] Adicionar tratamento de erros e casos extremos
- [ ] Testar com diferentes estados de conectividade de rede
