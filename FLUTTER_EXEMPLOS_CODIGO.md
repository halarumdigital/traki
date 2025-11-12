# 🔧 Exemplos de Código Prontos - Múltiplas Entregas

## 📦 1. Modelo Completo

```dart
// lib/models/delivery.dart

class Delivery {
  final String id;
  final String requestNumber;
  final String? customerName;
  final String? customerWhatsapp;
  final String? deliveryReference;
  final bool isDriverStarted;
  final bool isDriverArrived;
  final bool isTripStart;
  final bool isCompleted;
  final bool needsReturn;
  final String? deliveredAt;
  final String? returningAt;
  final String? returnedAt;
  final String totalDistance; // em km
  final String totalTime; // em minutos (Google Maps)
  final String estimatedTime; // em minutos (Google Maps + 5)
  final String? createdAt;
  final String? acceptedAt;
  final String pickAddress;
  final String dropAddress;
  final String pickLat;
  final String pickLng;
  final String dropLat;
  final String dropLng;
  final String? companyName;
  final String? companyPhone;
  final String? vehicleTypeName;
  final String totalAmount;
  final String adminCommision;
  final String driverAmount;
  final String estimatedAmount; // Valor que o motorista recebe

  Delivery({
    required this.id,
    required this.requestNumber,
    this.customerName,
    this.customerWhatsapp,
    this.deliveryReference,
    required this.isDriverStarted,
    required this.isDriverArrived,
    required this.isTripStart,
    required this.isCompleted,
    required this.needsReturn,
    this.deliveredAt,
    this.returningAt,
    this.returnedAt,
    required this.totalDistance,
    required this.totalTime,
    required this.estimatedTime,
    this.createdAt,
    this.acceptedAt,
    required this.pickAddress,
    required this.dropAddress,
    required this.pickLat,
    required this.pickLng,
    required this.dropLat,
    required this.dropLng,
    this.companyName,
    this.companyPhone,
    this.vehicleTypeName,
    required this.totalAmount,
    required this.adminCommision,
    required this.driverAmount,
    required this.estimatedAmount,
  });

  factory Delivery.fromJson(Map<String, dynamic> json) {
    return Delivery(
      id: json['id'] ?? '',
      requestNumber: json['request_number'] ?? '',
      customerName: json['customer_name'],
      customerWhatsapp: json['customer_whatsapp'],
      deliveryReference: json['delivery_reference'],
      isDriverStarted: json['is_driver_started'] ?? false,
      isDriverArrived: json['is_driver_arrived'] ?? false,
      isTripStart: json['is_trip_start'] ?? false,
      isCompleted: json['is_completed'] ?? false,
      needsReturn: json['needs_return'] ?? false,
      deliveredAt: json['delivered_at'],
      returningAt: json['returning_at'],
      returnedAt: json['returned_at'],
      totalDistance: json['total_distance']?.toString() ?? '0',
      totalTime: json['total_time']?.toString() ?? '0',
      estimatedTime: json['estimated_time']?.toString() ?? '0',
      createdAt: json['created_at'],
      acceptedAt: json['accepted_at'],
      pickAddress: json['pick_address'] ?? '',
      dropAddress: json['drop_address'] ?? '',
      pickLat: json['pick_lat']?.toString() ?? '0',
      pickLng: json['pick_lng']?.toString() ?? '0',
      dropLat: json['drop_lat']?.toString() ?? '0',
      dropLng: json['drop_lng']?.toString() ?? '0',
      companyName: json['company_name'],
      companyPhone: json['company_phone'],
      vehicleTypeName: json['vehicle_type_name'],
      totalAmount: json['total_amount']?.toString() ?? '0',
      adminCommision: json['admin_commision']?.toString() ?? '0',
      driverAmount: json['driver_amount']?.toString() ?? '0',
      estimatedAmount: json['estimated_amount']?.toString() ?? '0',
    );
  }

  // Status da entrega em português
  String get statusText {
    if (isCompleted) return 'Concluída';
    if (deliveredAt != null && needsReturn && returnedAt != null) return 'Finalizada';
    if (deliveredAt != null && needsReturn) return 'Aguardando retorno';
    if (deliveredAt != null) return 'Entregue';
    if (isTripStart) return 'Em rota de entrega';
    if (isDriverArrived) return 'Chegou para retirada';
    if (isDriverStarted) return 'A caminho da retirada';
    return 'Aceita';
  }

  // Cor do status
  Color get statusColor {
    if (isCompleted) return Colors.green;
    if (deliveredAt != null && needsReturn) return Colors.cyan;
    if (deliveredAt != null) return Colors.blue;
    if (isTripStart) return Colors.orange;
    if (isDriverArrived) return Colors.purple;
    return Colors.yellow;
  }
}

class DeliveryResponse {
  final bool success;
  final List<Delivery> data;
  final int count;
  final String? message;

  DeliveryResponse({
    required this.success,
    required this.data,
    required this.count,
    this.message,
  });

  factory DeliveryResponse.fromJson(Map<String, dynamic> json) {
    final dataList = json['data'];
    List<Delivery> deliveries = [];

    if (dataList != null && dataList is List) {
      deliveries = dataList.map((item) => Delivery.fromJson(item)).toList();
    }

    return DeliveryResponse(
      success: json['success'] ?? false,
      data: deliveries,
      count: json['count'] ?? deliveries.length,
      message: json['message'],
    );
  }
}
```

---

## 🌐 2. Service Completo

```dart
// lib/services/delivery_service.dart

import 'package:dio/dio.dart';
import '../models/delivery.dart';
import 'api_client.dart';

class DeliveryService {
  final ApiClient _apiClient;

  DeliveryService(this._apiClient);

  /// Buscar todas as entregas ativas do motorista
  Future<DeliveryResponse> getCurrentDeliveries() async {
    try {
      final response = await _apiClient.get('/api/v1/driver/deliveries/current');

      print('📦 Resposta da API: ${response.data}');

      if (response.data == null) {
        return DeliveryResponse(
          success: false,
          data: [],
          count: 0,
          message: 'Nenhuma entrega encontrada',
        );
      }

      return DeliveryResponse.fromJson(response.data);
    } on DioException catch (e) {
      print('❌ Erro na requisição: ${e.message}');
      if (e.response?.statusCode == 401) {
        throw Exception('Não autenticado');
      }
      throw Exception('Erro ao buscar entregas: ${e.message}');
    } catch (e) {
      print('❌ Erro inesperado: $e');
      throw Exception('Erro ao buscar entregas');
    }
  }

  /// Marcar que chegou para retirada
  Future<void> arrivedAtPickup(String deliveryId) async {
    try {
      await _apiClient.post('/api/v1/driver/deliveries/$deliveryId/arrived-pickup');
      print('✅ Marcado como chegou para retirada');
    } catch (e) {
      print('❌ Erro ao marcar chegada: $e');
      rethrow;
    }
  }

  /// Marcar que retirou o produto
  Future<void> pickedUp(String deliveryId) async {
    try {
      await _apiClient.post('/api/v1/driver/deliveries/$deliveryId/picked-up');
      print('✅ Marcado como retirado');
    } catch (e) {
      print('❌ Erro ao marcar retirada: $e');
      rethrow;
    }
  }

  /// Marcar que entregou o produto
  Future<void> delivered(String deliveryId) async {
    try {
      await _apiClient.post('/api/v1/driver/deliveries/$deliveryId/delivered');
      print('✅ Marcado como entregue');
    } catch (e) {
      print('❌ Erro ao marcar entrega: $e');
      rethrow;
    }
  }

  /// Iniciar retorno ao ponto de origem
  Future<void> startReturn(String deliveryId) async {
    try {
      await _apiClient.post('/api/v1/driver/deliveries/$deliveryId/start-return');
      print('✅ Retorno iniciado');
    } catch (e) {
      print('❌ Erro ao iniciar retorno: $e');
      rethrow;
    }
  }

  /// Completar retorno ao ponto de origem
  Future<void> completeReturn(String deliveryId) async {
    try {
      await _apiClient.post('/api/v1/driver/deliveries/$deliveryId/complete-return');
      print('✅ Retorno completado');
    } catch (e) {
      print('❌ Erro ao completar retorno: $e');
      rethrow;
    }
  }

  /// Completar entrega (quando não precisa retornar)
  Future<void> completeDelivery(String deliveryId) async {
    try {
      await _apiClient.post('/api/v1/driver/deliveries/$deliveryId/complete');
      print('✅ Entrega completada');
    } catch (e) {
      print('❌ Erro ao completar entrega: $e');
      rethrow;
    }
  }
}
```

---

## 🎯 3. Provider Completo

```dart
// lib/providers/delivery_provider.dart

import 'package:flutter/material.dart';
import '../models/delivery.dart';
import '../services/delivery_service.dart';

class DeliveryProvider extends ChangeNotifier {
  final DeliveryService _deliveryService;

  DeliveryProvider(this._deliveryService);

  List<Delivery> _activeDeliveries = [];
  bool _isLoading = false;
  String? _error;

  List<Delivery> get activeDeliveries => _activeDeliveries;
  int get deliveryCount => _activeDeliveries.length;
  bool get hasDeliveries => _activeDeliveries.isNotEmpty;
  bool get hasMultipleDeliveries => _activeDeliveries.length > 1;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Pega a entrega atual (primeira não retirada, ou primeira da lista)
  Delivery? get currentDelivery {
    if (_activeDeliveries.isEmpty) return null;

    // Priorizar entregas ainda não retiradas
    final notPickedUp = _activeDeliveries.where((d) => !d.isTripStart).toList();
    if (notPickedUp.isNotEmpty) return notPickedUp.first;

    // Se todas já foram retiradas, retornar a primeira
    return _activeDeliveries.first;
  }

  /// Carregar entregas ativas
  Future<void> loadActiveDeliveries() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _deliveryService.getCurrentDeliveries();

      _activeDeliveries = response.data;

      _debugPrintDeliveries();

      print('✅ ${_activeDeliveries.length} entrega(s) ativa(s) carregada(s)');
    } catch (e) {
      _error = e.toString();
      print('❌ Erro ao carregar entregas: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Verificar se há próximas entregas
  bool hasNextDelivery(String currentDeliveryId) {
    final currentIndex = _activeDeliveries.indexWhere((d) => d.id == currentDeliveryId);
    return currentIndex >= 0 && currentIndex < _activeDeliveries.length - 1;
  }

  /// Pegar próxima entrega
  Delivery? getNextDelivery(String currentDeliveryId) {
    final currentIndex = _activeDeliveries.indexWhere((d) => d.id == currentDeliveryId);
    if (currentIndex >= 0 && currentIndex < _activeDeliveries.length - 1) {
      return _activeDeliveries[currentIndex + 1];
    }
    return null;
  }

  /// Pegar posição da entrega
  int getDeliveryPosition(String deliveryId) {
    return _activeDeliveries.indexWhere((d) => d.id == deliveryId) + 1;
  }

  /// Marcar chegada para retirada
  Future<void> arrivedAtPickup(String deliveryId) async {
    try {
      await _deliveryService.arrivedAtPickup(deliveryId);
      await loadActiveDeliveries();
    } catch (e) {
      rethrow;
    }
  }

  /// Marcar retirada
  Future<void> pickedUp(String deliveryId) async {
    try {
      await _deliveryService.pickedUp(deliveryId);
      await loadActiveDeliveries();
    } catch (e) {
      rethrow;
    }
  }

  /// Marcar entrega
  Future<void> delivered(String deliveryId) async {
    try {
      await _deliveryService.delivered(deliveryId);
      await loadActiveDeliveries();
    } catch (e) {
      rethrow;
    }
  }

  /// Iniciar retorno
  Future<void> startReturn(String deliveryId) async {
    try {
      await _deliveryService.startReturn(deliveryId);
      await loadActiveDeliveries();
    } catch (e) {
      rethrow;
    }
  }

  /// Completar retorno
  Future<void> completeReturn(String deliveryId) async {
    try {
      await _deliveryService.completeReturn(deliveryId);
      await loadActiveDeliveries();
    } catch (e) {
      rethrow;
    }
  }

  /// Completar entrega
  Future<void> completeDelivery(String deliveryId) async {
    try {
      await _deliveryService.completeDelivery(deliveryId);
      await loadActiveDeliveries();
    } catch (e) {
      rethrow;
    }
  }

  /// Debug: imprimir entregas
  void _debugPrintDeliveries() {
    print('═══════════════════════════════════════');
    print('📦 ENTREGAS ATIVAS: ${_activeDeliveries.length}');
    for (var i = 0; i < _activeDeliveries.length; i++) {
      final d = _activeDeliveries[i];
      print('  [${i + 1}] ${d.requestNumber}');
      print('      Cliente: ${d.customerName ?? "Sem nome"}');
      print('      Status: ${d.statusText}');
      print('      Retirada: ${d.isTripStart ? "SIM" : "NÃO"}');
      print('      Destino: ${d.dropAddress.substring(0, 50)}...');
    }
    print('═══════════════════════════════════════');
  }
}
```

---

## 🎨 4. Widget de Banner de Múltiplas Entregas

```dart
// lib/widgets/multiple_deliveries_banner.dart

import 'package:flutter/material.dart';

class MultipleDeliveriesBanner extends StatelessWidget {
  final int deliveryCount;
  final int currentPosition;
  final VoidCallback? onViewAll;

  const MultipleDeliveriesBanner({
    Key? key,
    required this.deliveryCount,
    this.currentPosition = 1,
    this.onViewAll,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.blue.shade700, Colors.blue.shade500],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.blue.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.local_shipping,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Você tem $deliveryCount entregas ativas',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Mostrando entrega $currentPosition de $deliveryCount',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
          if (onViewAll != null)
            IconButton(
              onPressed: onViewAll,
              icon: const Icon(
                Icons.list,
                color: Colors.white,
              ),
              tooltip: 'Ver todas',
            ),
        ],
      ),
    );
  }
}
```

---

## 📋 5. Widget de Lista de Próximas Entregas

```dart
// lib/widgets/next_deliveries_list.dart

import 'package:flutter/material.dart';
import '../models/delivery.dart';

class NextDeliveriesList extends StatelessWidget {
  final List<Delivery> deliveries;
  final Function(Delivery) onDeliveryTap;

  const NextDeliveriesList({
    Key? key,
    required this.deliveries,
    required this.onDeliveryTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (deliveries.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.queue, size: 20, color: Colors.grey),
              const SizedBox(width: 8),
              Text(
                'Próximas Entregas (${deliveries.length})',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 140,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: deliveries.length,
            itemBuilder: (context, index) {
              final delivery = deliveries[index];
              final position = index + 2; // +2 porque é "próximas" (após a atual)

              return _NextDeliveryCard(
                delivery: delivery,
                position: position,
                onTap: () => onDeliveryTap(delivery),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _NextDeliveryCard extends StatelessWidget {
  final Delivery delivery;
  final int position;
  final VoidCallback onTap;

  const _NextDeliveryCard({
    Key? key,
    required this.delivery,
    required this.position,
    required this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 220,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.1),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  topRight: Radius.circular(12),
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: Colors.orange,
                    child: Text(
                      '$position',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      delivery.requestNumber,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
                ],
              ),
            ),

            // Conteúdo
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.person, size: 14, color: Colors.grey),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            delivery.customerName ?? 'Sem nome',
                            style: const TextStyle(fontSize: 13),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.location_on, size: 14, color: Colors.red.shade400),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            delivery.dropAddress,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade700,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Footer
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(12),
                  bottomRight: Radius.circular(12),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.route, size: 12, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(
                        '${delivery.totalDistance} km',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Icon(Icons.attach_money, size: 12, color: Colors.green.shade600),
                      Text(
                        'R\$ ${delivery.estimatedAmount}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.green.shade600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 📱 6. Tela Principal Completa

```dart
// lib/screens/home_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/delivery_provider.dart';
import '../models/delivery.dart';
import '../widgets/multiple_deliveries_banner.dart';
import '../widgets/next_deliveries_list.dart';
import 'delivery_details_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // Carregar entregas ao abrir a tela
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DeliveryProvider>().loadActiveDeliveries();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Entregas'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              context.read<DeliveryProvider>().loadActiveDeliveries();
            },
          ),
        ],
      ),
      body: Consumer<DeliveryProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }

          if (provider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    'Erro ao carregar entregas',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    provider.error!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => provider.loadActiveDeliveries(),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Tentar Novamente'),
                  ),
                ],
              ),
            );
          }

          if (!provider.hasDeliveries) {
            return _buildNoDeliveriesState();
          }

          final currentDelivery = provider.currentDelivery!;
          final nextDeliveries = provider.activeDeliveries
              .where((d) => d.id != currentDelivery.id)
              .toList();

          return RefreshIndicator(
            onRefresh: () => provider.loadActiveDeliveries(),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                children: [
                  // Banner de múltiplas entregas
                  if (provider.hasMultipleDeliveries)
                    MultipleDeliveriesBanner(
                      deliveryCount: provider.deliveryCount,
                      currentPosition: provider.getDeliveryPosition(currentDelivery.id),
                    ),

                  // Entrega atual
                  _buildCurrentDeliveryCard(context, currentDelivery),

                  // Lista de próximas entregas
                  if (nextDeliveries.isNotEmpty)
                    NextDeliveriesList(
                      deliveries: nextDeliveries,
                      onDeliveryTap: (delivery) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => DeliveryDetailsScreen(delivery: delivery),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildNoDeliveriesState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.inbox, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text(
            'Nenhuma entrega em andamento',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Aceite uma entrega para começar',
            style: TextStyle(color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentDeliveryCard(BuildContext context, Delivery delivery) {
    return Card(
      margin: const EdgeInsets.all(16),
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: delivery.statusColor,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.local_shipping, color: Colors.white, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        delivery.statusText,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        delivery.requestNumber,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                Consumer<DeliveryProvider>(
                  builder: (context, provider, child) {
                    if (!provider.hasMultipleDeliveries) return const SizedBox();

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${provider.getDeliveryPosition(delivery.id)}/${provider.deliveryCount}',
                        style: TextStyle(
                          color: delivery.statusColor,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

          // Conteúdo
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildInfoRow(
                  icon: Icons.person,
                  label: 'Cliente',
                  value: delivery.customerName ?? 'Não informado',
                ),
                const SizedBox(height: 12),
                _buildInfoRow(
                  icon: Icons.business,
                  label: 'Empresa',
                  value: delivery.companyName ?? 'Não informado',
                ),
                const SizedBox(height: 12),
                _buildInfoRow(
                  icon: Icons.location_on,
                  label: 'Destino',
                  value: delivery.dropAddress,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildInfoRow(
                        icon: Icons.route,
                        label: 'Distância',
                        value: '${delivery.totalDistance} km',
                      ),
                    ),
                    Expanded(
                      child: _buildInfoRow(
                        icon: Icons.attach_money,
                        label: 'Ganho',
                        value: 'R\$ ${delivery.estimatedAmount}',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Botão de ação
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => DeliveryDetailsScreen(delivery: delivery),
                    ),
                  );
                },
                icon: const Icon(Icons.arrow_forward),
                label: const Text('Ver Detalhes'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
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
        Icon(icon, size: 20, color: Colors.grey.shade600),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
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

---

## ✅ Checklist Final

Copie este checklist no seu projeto:

```dart
// TODO: Implementação de Múltiplas Entregas
// [ ] 1. Atualizar modelo Delivery com todos os campos
// [ ] 2. Atualizar modelo DeliveryResponse para aceitar array
// [ ] 3. Criar DeliveryService com todos os métodos
// [ ] 4. Criar DeliveryProvider com lógica de múltiplas entregas
// [ ] 5. Criar widget MultipleDeliveriesBanner
// [ ] 6. Criar widget NextDeliveriesList
// [ ] 7. Atualizar HomeScreen com nova estrutura
// [ ] 8. Atualizar DeliveryDetailsScreen com preview de próxima entrega
// [ ] 9. Testar fluxo com 1 entrega
// [ ] 10. Testar fluxo com 2+ entregas
// [ ] 11. Testar aceitar segunda entrega durante primeira
// [ ] 12. Testar conclusão de entrega com próximas pendentes
// [ ] 13. Adicionar logs de debug
// [ ] 14. Testar sincronização em tempo real
```

---

**Pronto! Todos os códigos necessários estão aqui. Basta copiar e adaptar ao seu projeto.** 🚀
