# 📱 Guia de Implementação - Múltiplas Entregas Simultâneas no Flutter

## 🎯 Problema Resolvido

**Antes:** Quando o motorista aceitava 2 entregas ao mesmo tempo, apenas 1 aparecia no app.

**Causa:** A API tinha um `LIMIT 1` que retornava apenas a entrega mais recente.

**Solução:** A API agora retorna um **array com todas as entregas ativas** do motorista.

---

## 🔄 Mudanças na API

### Endpoint: `GET /api/v1/driver/deliveries/current`

#### ❌ Resposta ANTIGA (incorreta):
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "request_number": "REQ-001",
    "customer_name": "Cliente 1",
    ...
  }
}
```

#### ✅ Resposta NOVA (correta):
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "request_number": "REQ-001",
      "customer_name": "Cliente 1",
      "is_trip_start": false,
      "pick_address": "Rua A, 100",
      "drop_address": "Rua B, 200",
      ...
    },
    {
      "id": "def456",
      "request_number": "REQ-002",
      "customer_name": "Cliente 2",
      "is_trip_start": false,
      "pick_address": "Rua C, 300",
      "drop_address": "Rua D, 400",
      ...
    }
  ],
  "count": 2
}
```

**IMPORTANTE:** `data` agora é um **array**, não um objeto!

---

## 🛠️ Implementação no Flutter

### 1️⃣ Atualizar o Modelo de Dados

```dart
// models/delivery_response.dart

class DeliveryResponse {
  final bool success;
  final List<Delivery> data;  // ✅ Mudou de Delivery? para List<Delivery>
  final int count;
  final String? message;

  DeliveryResponse({
    required this.success,
    required this.data,
    required this.count,
    this.message,
  });

  factory DeliveryResponse.fromJson(Map<String, dynamic> json) {
    return DeliveryResponse(
      success: json['success'] ?? false,
      data: json['data'] != null
          ? (json['data'] as List)
              .map((item) => Delivery.fromJson(item))
              .toList()
          : [],
      count: json['count'] ?? 0,
      message: json['message'],
    );
  }
}
```

### 2️⃣ Atualizar o Service

```dart
// services/delivery_service.dart

class DeliveryService {
  final ApiClient _apiClient;

  Future<DeliveryResponse> getCurrentDeliveries() async {
    try {
      final response = await _apiClient.get('/api/v1/driver/deliveries/current');

      print('📦 Entregas ativas recebidas: ${response.data}');

      return DeliveryResponse.fromJson(response.data);
    } catch (e) {
      print('❌ Erro ao buscar entregas: $e');
      rethrow;
    }
  }
}
```

### 3️⃣ Atualizar o Provider/Controller

```dart
// providers/delivery_provider.dart

class DeliveryProvider extends ChangeNotifier {
  List<Delivery> _activeDeliveries = [];
  bool _isLoading = false;
  String? _error;

  List<Delivery> get activeDeliveries => _activeDeliveries;
  int get deliveryCount => _activeDeliveries.length;
  bool get hasMultipleDeliveries => _activeDeliveries.length > 1;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Pega a entrega atual (primeira não retirada, ou primeira da lista)
  Delivery? get currentDelivery {
    if (_activeDeliveries.isEmpty) return null;

    // Priorizar entregas ainda não retiradas
    final notPickedUp = _activeDeliveries.where((d) => !d.isTripStart).toList();
    if (notPickedUp.isNotEmpty) return notPickedUp.first;

    // Se todas já foram retiradas, retornar a primeira
    return _activeDeliveries.first;
  }

  Future<void> loadActiveDeliveries() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _deliveryService.getCurrentDeliveries();

      _activeDeliveries = response.data;

      print('✅ ${_activeDeliveries.length} entrega(s) ativa(s) carregada(s)');

    } catch (e) {
      _error = e.toString();
      print('❌ Erro ao carregar entregas: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Método auxiliar para verificar se há próximas entregas
  bool hasNextDelivery(String currentDeliveryId) {
    final currentIndex = _activeDeliveries.indexWhere((d) => d.id == currentDeliveryId);
    return currentIndex >= 0 && currentIndex < _activeDeliveries.length - 1;
  }

  // Pegar próxima entrega
  Delivery? getNextDelivery(String currentDeliveryId) {
    final currentIndex = _activeDeliveries.indexWhere((d) => d.id == currentDeliveryId);
    if (currentIndex >= 0 && currentIndex < _activeDeliveries.length - 1) {
      return _activeDeliveries[currentIndex + 1];
    }
    return null;
  }
}
```

### 4️⃣ Atualizar a UI - Tela Principal

```dart
// screens/home_screen.dart

class HomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<DeliveryProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return Center(child: CircularProgressIndicator());
        }

        if (provider.activeDeliveries.isEmpty) {
          return _buildNoDeliveriesState();
        }

        // ✅ NOVO: Mostrar indicador de múltiplas entregas
        return Column(
          children: [
            if (provider.hasMultipleDeliveries)
              _buildMultipleDeliveriesBanner(provider.deliveryCount),

            Expanded(
              child: _buildCurrentDeliveryCard(provider.currentDelivery!),
            ),

            // ✅ NOVO: Lista de próximas entregas
            if (provider.hasMultipleDeliveries)
              _buildNextDeliveriesList(provider.activeDeliveries),
          ],
        );
      },
    );
  }

  Widget _buildMultipleDeliveriesBanner(int count) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16),
      color: Colors.blue.shade100,
      child: Row(
        children: [
          Icon(Icons.local_shipping, color: Colors.blue.shade700),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Você tem $count entregas em andamento',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.blue.shade700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNextDeliveriesList(List<Delivery> deliveries) {
    // Pular a primeira (que está sendo mostrada acima)
    final nextDeliveries = deliveries.skip(1).toList();

    return Container(
      height: 120,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.all(8),
        itemCount: nextDeliveries.length,
        itemBuilder: (context, index) {
          final delivery = nextDeliveries[index];
          return _buildNextDeliveryCard(delivery, index + 2);
        },
      ),
    );
  }

  Widget _buildNextDeliveryCard(Delivery delivery, int position) {
    return Container(
      width: 200,
      margin: EdgeInsets.only(right: 8),
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: Colors.orange,
                child: Text(
                  '$position',
                  style: TextStyle(fontSize: 12, color: Colors.white),
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  delivery.requestNumber,
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text(
            delivery.customerName ?? 'Sem nome',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12),
          ),
          Spacer(),
          Row(
            children: [
              Icon(Icons.location_on, size: 14, color: Colors.grey),
              SizedBox(width: 4),
              Expanded(
                child: Text(
                  delivery.dropAddress,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
```

### 5️⃣ Atualizar Card de Entrega Atual

```dart
// widgets/delivery_card.dart

Widget _buildCurrentDeliveryCard(Delivery delivery) {
  return Card(
    margin: EdgeInsets.all(16),
    child: Column(
      children: [
        // Header com número da entrega
        Container(
          padding: EdgeInsets.all(16),
          color: Colors.yellow.shade700,
          child: Row(
            children: [
              Icon(Icons.local_shipping, color: Colors.white),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Entrega em Andamento',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    Text(
                      delivery.requestNumber,
                      style: TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                  ],
                ),
              ),
              // ✅ NOVO: Badge indicando posição se houver múltiplas
              if (provider.hasMultipleDeliveries)
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '1/${provider.deliveryCount}',
                    style: TextStyle(
                      color: Colors.yellow.shade700,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ),

        // Informações da entrega
        Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            children: [
              _buildInfoRow(
                icon: Icons.person,
                label: 'Cliente',
                value: delivery.customerName ?? 'Não informado',
              ),
              SizedBox(height: 12),
              _buildInfoRow(
                icon: Icons.location_on,
                label: 'Destino',
                value: delivery.dropAddress,
              ),
              // ... outros campos
            ],
          ),
        ),
      ],
    ),
  );
}
```

### 6️⃣ Atualizar Lógica de Navegação

```dart
// screens/delivery_details_screen.dart

class DeliveryDetailsScreen extends StatelessWidget {
  final Delivery delivery;

  @override
  Widget build(BuildContext context) {
    return Consumer<DeliveryProvider>(
      builder: (context, provider, child) {
        final hasNext = provider.hasNextDelivery(delivery.id);
        final nextDelivery = provider.getNextDelivery(delivery.id);

        return Scaffold(
          appBar: AppBar(
            title: Text(delivery.requestNumber),
            // ✅ NOVO: Indicador de múltiplas entregas
            actions: [
              if (provider.hasMultipleDeliveries)
                Center(
                  child: Padding(
                    padding: EdgeInsets.only(right: 16),
                    child: Chip(
                      label: Text(
                        '${_getCurrentPosition(provider, delivery.id)}/${provider.deliveryCount}',
                        style: TextStyle(color: Colors.white),
                      ),
                      backgroundColor: Colors.blue,
                    ),
                  ),
                ),
            ],
          ),
          body: SingleChildScrollView(
            child: Column(
              children: [
                // Detalhes da entrega atual
                _buildDeliveryInfo(delivery),

                // ✅ NOVO: Próxima entrega
                if (hasNext && nextDelivery != null)
                  _buildNextDeliveryPreview(nextDelivery),

                // Botões de ação
                _buildActionButtons(context, delivery, hasNext),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildNextDeliveryPreview(Delivery nextDelivery) {
    return Container(
      margin: EdgeInsets.all(16),
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline, color: Colors.blue.shade700),
              SizedBox(width: 8),
              Text(
                'Próxima Entrega',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.blue.shade700,
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          Text(
            nextDelivery.requestNumber,
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 4),
          Text(nextDelivery.customerName ?? 'Sem nome'),
          SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.location_on, size: 16, color: Colors.grey),
              SizedBox(width: 4),
              Expanded(
                child: Text(
                  nextDelivery.dropAddress,
                  style: TextStyle(color: Colors.grey.shade700),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  int _getCurrentPosition(DeliveryProvider provider, String deliveryId) {
    return provider.activeDeliveries.indexWhere((d) => d.id == deliveryId) + 1;
  }
}
```

### 7️⃣ Atualizar Lógica de Conclusão

```dart
// providers/delivery_provider.dart (continuação)

Future<void> completeDelivery(String deliveryId) async {
  try {
    await _deliveryService.completeDelivery(deliveryId);

    // Remover a entrega concluída da lista local
    _activeDeliveries.removeWhere((d) => d.id == deliveryId);

    print('✅ Entrega concluída. Restam ${_activeDeliveries.length} entrega(s)');

    // Se ainda houver entregas, carregar novamente para garantir sincronia
    if (_activeDeliveries.isNotEmpty) {
      await loadActiveDeliveries();
    }

    notifyListeners();
  } catch (e) {
    print('❌ Erro ao concluir entrega: $e');
    rethrow;
  }
}
```

---

## 🎨 Sugestões de UX

### 1. Badge Numérico
Mostre quantas entregas estão ativas:
```dart
Badge(
  label: Text('${provider.deliveryCount}'),
  child: Icon(Icons.local_shipping),
)
```

### 2. Indicador de Progresso
```dart
Text('Entrega 1 de 3')
LinearProgressIndicator(value: 1 / 3)
```

### 3. Lista Horizontal de Próximas Entregas
Como mostrado no código acima, uma lista horizontal com preview das próximas entregas.

### 4. Alerta ao Concluir
```dart
if (hasNextDelivery) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Entrega Concluída!'),
      content: Text('Você tem mais 1 entrega pendente. Deseja iniciar agora?'),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
          },
          child: Text('Depois'),
        ),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context);
            // Navegar para próxima entrega
          },
          child: Text('Iniciar Próxima'),
        ),
      ],
    ),
  );
}
```

---

## 🔍 Testes Recomendados

### Cenários para Testar:

1. **Motorista sem entregas**
   - Verificar se mostra estado vazio

2. **Motorista com 1 entrega**
   - Não deve mostrar banner de múltiplas entregas
   - Não deve mostrar lista de próximas

3. **Motorista com 2+ entregas**
   - Deve mostrar banner indicando quantidade
   - Deve mostrar lista de próximas entregas
   - Ao concluir primeira, deve avançar para próxima

4. **Aceitar segunda entrega durante primeira**
   - Verificar se lista atualiza em tempo real
   - Verificar se contador aumenta

5. **Cancelar uma das entregas**
   - Verificar se remove da lista
   - Verificar se contador diminui

---

## 📊 Logs de Debug

Adicione logs para facilitar debug:

```dart
void _debugPrintDeliveries(List<Delivery> deliveries) {
  print('═══════════════════════════════════════');
  print('📦 ENTREGAS ATIVAS: ${deliveries.length}');
  for (var i = 0; i < deliveries.length; i++) {
    final d = deliveries[i];
    print('  [$i] ${d.requestNumber}');
    print('      Cliente: ${d.customerName}');
    print('      Status: is_trip_start=${d.isTripStart}');
    print('      Retirada: ${d.isTripStart ? "SIM" : "NÃO"}');
  }
  print('═══════════════════════════════════════');
}
```

---

## ⚠️ Pontos de Atenção

### 1. Ordem das Entregas
A API retorna as entregas ordenadas por `accepted_at ASC` (ordem de aceitação). Respeite essa ordem na UI.

### 2. Sincronização
Após cada ação (aceitar, concluir, cancelar), chame `loadActiveDeliveries()` para garantir sincronia.

### 3. Notificações Push
Quando uma nova entrega for aceita, dispare um evento para atualizar a lista automaticamente.

### 4. Estados Intermediários
Uma entrega pode estar em vários estados:
- Aceita, mas não retirada (`is_trip_start = false`)
- Retirada, mas não entregue (`is_trip_start = true`, `delivered_at = null`)
- Entregue, aguardando retorno (`delivered_at != null`, `needs_return = true`)

Trate cada estado adequadamente na UI.

---

## 🚀 Exemplo Completo de Fluxo

### Cenário: Motorista aceita 2 entregas

1. **Motorista aceita Entrega A**
   - API retorna: `[{id: "A", ...}]`
   - App mostra: "Entrega A em andamento"

2. **Motorista retira produto da Entrega A**
   - Chama `/api/v1/driver/deliveries/:id/picked-up`
   - `is_trip_start = true`

3. **Motorista aceita Entrega B (enquanto ainda não entregou A)**
   - API permite (porque A já foi retirada)
   - API retorna: `[{id: "A", ...}, {id: "B", ...}]`
   - App mostra: "2 entregas em andamento"
   - App destaca Entrega A como atual
   - App mostra Entrega B na lista de próximas

4. **Motorista entrega produto da Entrega A**
   - Chama `/api/v1/driver/deliveries/:id/delivered`
   - Se `needs_return = false`, marca como completa
   - API agora retorna: `[{id: "B", ...}]`
   - App mostra: "Entrega concluída! Você tem 1 entrega pendente"
   - App avança para mostrar Entrega B

5. **Motorista completa Entrega B**
   - API retorna: `[]`
   - App volta ao estado "Nenhuma entrega em andamento"

---

## 📝 Checklist de Implementação

- [ ] Atualizar modelo `DeliveryResponse` para aceitar array
- [ ] Atualizar service para retornar lista
- [ ] Atualizar provider com lógica de múltiplas entregas
- [ ] Adicionar banner de múltiplas entregas na tela principal
- [ ] Adicionar lista horizontal de próximas entregas
- [ ] Adicionar badge numérico indicando posição
- [ ] Implementar preview da próxima entrega nos detalhes
- [ ] Adicionar alerta ao concluir com próximas pendentes
- [ ] Testar fluxo completo com 2+ entregas
- [ ] Adicionar logs de debug
- [ ] Testar sincronização ao aceitar/concluir/cancelar

---

## 🆘 Suporte

Se tiver dúvidas durante a implementação:

1. Verifique os logs do console Flutter
2. Verifique os logs do backend (procure por `📱`)
3. Use os logs de debug sugeridos acima
4. Teste cada cenário individualmente

---

**Data:** ${new Date().toISOString()}
**Versão da API:** 1.0.0
**Status:** ✅ Corrigido e pronto para implementação
