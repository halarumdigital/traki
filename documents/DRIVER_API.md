# API do Motorista - Documentação para App Flutter

## Base URL
```
http://192.168.3.3:5010/api/v1/driver
```

## 🔑 Autenticação (Bearer Token)

**IMPORTANTE:** A API agora usa **autenticação por token Bearer** em vez de sessões com cookies.

### Como funciona:
1. **Login**: Motorista faz login com email e senha
2. **Token retornado**: API retorna um `accessToken` no response
3. **Salvar token**: App Flutter salva o token localmente (SharedPreferences ou SecureStorage)
4. **Usar token**: Todas as requisições subsequentes incluem o token no header `Authorization: Bearer <token>`

### Configuração do Dio (Flutter):

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final dio = Dio(BaseOptions(
  baseUrl: 'http://192.168.3.3:5010',
  connectTimeout: Duration(seconds: 30),
  receiveTimeout: Duration(seconds: 30),
));

final storage = FlutterSecureStorage();

// Interceptor para adicionar token automaticamente
dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) async {
    final token = await storage.read(key: 'access_token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    return handler.next(options);
  },
  onError: (error, handler) async {
    // Se receber 401, token expirou - fazer logout
    if (error.response?.statusCode == 401) {
      await storage.delete(key: 'access_token');
      // Redirecionar para login
    }
    return handler.next(error);
  },
));

// Exemplo de salvar token após login
Future<void> saveToken(String token) async {
  await storage.write(key: 'access_token', value: token);
}

// Exemplo de obter token
Future<String?> getToken() async {
  return await storage.read(key: 'access_token');
}

// Exemplo de remover token (logout)
Future<void> removeToken() async {
  await storage.delete(key: 'access_token');
}
```

---

## Endpoints Disponíveis

### Pré-Cadastro: Obter Dados para Seletores

Antes de realizar o cadastro, o app deve buscar as opções para os seletores:

#### GET /api/v1/driver/service-locations
Lista todas as cidades disponíveis para seleção.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid-cidade-1", "name": "São Paulo" },
    { "id": "uuid-cidade-2", "name": "Rio de Janeiro" }
  ]
}
```

#### GET /api/v1/driver/brands
Lista todas as marcas de veículos cadastradas.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid-marca-1", "name": "Toyota" },
    { "id": "uuid-marca-2", "name": "Honda" }
  ]
}
```

#### GET /api/v1/driver/models/:brandId
Lista os modelos de uma marca específica.

**Exemplo:** `GET /api/v1/driver/models/uuid-marca-1`

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid-modelo-1", "name": "Corolla", "brandId": "uuid-marca-1" },
    { "id": "uuid-modelo-2", "name": "Camry", "brandId": "uuid-marca-1" }
  ]
}
```

#### GET /api/v1/driver/vehicle-types
Lista todos os tipos de veículos disponíveis.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid-tipo-1", "name": "Moto", "icon": "/icons/moto.png", "capacity": 1 },
    { "id": "uuid-tipo-2", "name": "Carro", "icon": "/icons/carro.png", "capacity": 4 }
  ]
}
```

#### GET /api/v1/driver/document-types
Lista todos os documentos obrigatórios que devem ser enviados após o cadastro.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-doc-1",
      "name": "CNH (Carteira de Motorista)",
      "description": "Foto da CNH frente e verso",
      "required": true
    },
    {
      "id": "uuid-doc-2",
      "name": "Documento do Veículo (CRLV)",
      "description": "Foto do CRLV atualizado",
      "required": true
    }
  ]
}
```

---

### 1. Registro de Motorista

**Endpoint:** `POST /api/v1/driver/register`

**Descrição:** Registra um novo motorista no sistema. O motorista será criado com status `approve: false` e precisará aguardar aprovação do administrador.

**⚠️ FLUXO COMPLETO DE CADASTRO:**
1. Motorista preenche todos os dados pessoais e do veículo → Envia cadastro
2. Cadastro é salvo no banco com `approve: false`
3. Motorista pode enviar documentos obrigatórios via `POST /api/v1/driver/documents` (ou depois)
4. **Motorista NÃO pode fazer login** até ser aprovado pelo administrador
5. Ao tentar login, receberá: "Aguardando aprovação do administrador"
6. Administrador aprova o cadastro no painel (`approve: true`)
7. Motorista consegue fazer login e acessar o app

**Request Body:**
```json
{
  "name": "João Silva",
  "cpf": "12345678900",
  "mobile": "11999999999",
  "email": "joao@email.com",
  "password": "senha123",
  "serviceLocationId": "uuid-da-cidade",
  "vehicleTypeId": "uuid-do-tipo",
  "carMake": "uuid-da-marca",
  "carModel": "uuid-do-modelo",
  "carNumber": "ABC-1234",
  "carColor": "Branco",
  "carYear": "2020",
  "deviceToken": "fcm_token_aqui",
  "loginBy": "android"
}
```

**⚠️ TODOS os Campos São Obrigatórios:**
- `name` - Nome completo do motorista
- `cpf` - CPF (apenas números, 11 dígitos)
- `mobile` - Telefone (apenas números, com DDD)
- `email` - Email válido
- `password` - Senha (mínimo 6 caracteres recomendado)
- `serviceLocationId` - ID da cidade (obtido de `/service-locations`)
- `vehicleTypeId` - ID do tipo de veículo (obtido de `/vehicle-types`)
- `carMake` - ID da marca (obtido de `/brands`)
- `carModel` - ID do modelo (obtido de `/models/:brandId`)
- `carNumber` - Placa do veículo (formato ABC-1234)
- `carColor` - Cor do veículo
- `carYear` - Ano do veículo (4 dígitos)
- `deviceToken` - Token FCM para notificações push (opcional)
- `loginBy` - Plataforma: "android" ou "ios" (opcional)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Motorista registrado com sucesso. Aguarde aprovação do administrador.",
  "data": {
    "id": "uuid-do-motorista",
    "name": "João Silva",
    "mobile": "11999999999",
    "email": "joao@email.com",
    "approve": false
  }
}
```

**Response (400 Bad Request):**
```json
{
  "message": "Todos os campos são obrigatórios: nome, CPF, telefone, email, senha, cidade, tipo de veículo, marca, modelo, placa, cor e ano"
}
```

**Response (400 Bad Request):**
```json
{
  "message": "Já existe um motorista cadastrado com este telefone"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<void> registerDriver() async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/register',
      data: {
        'name': 'João Silva',
        'mobile': '11999999999',
        'password': 'senha123',
        'deviceToken': fcmToken,
        'loginBy': 'android',
      },
    );

    if (response.data['success']) {
      print('Registro realizado: ${response.data['message']}');
      // Redirecionar para tela de aguardando aprovação
    }
  } on DioException catch (e) {
    print('Erro: ${e.response?.data['message']}');
  }
}
```

---

### 2. Validar Email do Motorista (Pré-Login)

**Endpoint:** `POST /api/v1/driver/validate-mobile-for-login`

**Descrição:** Valida se um email está cadastrado antes de mostrar a tela de senha. Retorna informações básicas do motorista.

**🔓 Sem autenticação:** Este endpoint não requer token

**Request Body:**
```json
{
  "email": "joao@email.com"
}
```

**Campos Obrigatórios:**
- `email` - Email do motorista

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Motorista encontrado",
  "data": {
    "id": "uuid-do-motorista",
    "name": "João Silva",
    "email": "joao@email.com",
    "mobile": "+5549666666666",
    "profilePicture": "/uploads/foto.jpg",
    "requirePassword": true,
    "active": true,
    "approve": true
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Motorista não encontrado. Verifique o email ou cadastre-se."
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<bool> validateEmail(String email) async {
  try {
    final response = await dio.post(
      'http://192.168.3.3:5010/api/v1/driver/validate-mobile-for-login',
      data: {'email': email},
    );

    if (response.data['success']) {
      // Email válido, mostrar campo de senha
      return true;
    }
  } on DioException catch (e) {
    if (e.response?.statusCode == 404) {
      showError('Email não cadastrado');
    }
  }
  return false;
}
```

---

### 3. Login de Motorista

**Endpoint:** `POST /api/v1/driver/login`

**Descrição:** Autentica o motorista com email e senha. Retorna um `accessToken` para uso em requisições subsequentes.

**🔓 Sem autenticação:** Este endpoint não requer token

**Request Body:**
```json
{
  "email": "joao@email.com",
  "password": "senha123",
  "deviceToken": "fcm_token_aqui"
}
```

**Campos Obrigatórios:**
- `email` - Email do motorista (alterado de `mobile`)
- `password` - Senha

**Campos Opcionais:**
- `deviceToken` - Token FCM para notificações push

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "accessToken": "eyJpZCI6ImIwNzVlOTRiLWM1ZjgtNDZkZi05NjBhLWQzZTBhZWVlMTJjNCIsInR5cGUiOiJkcml2ZXIiLCJ0aW1lc3RhbXAiOjE3NjI0NjQ5MDc5MzJ9",
  "data": {
    "id": "uuid-do-motorista",
    "name": "João Silva",
    "mobile": "+5549666666666",
    "email": "joao@email.com",
    "profilePicture": "/uploads/foto.jpg",
    "active": true,
    "approve": true,
    "available": false,
    "rating": "4.8",
    "vehicleTypeId": "uuid-tipo-veiculo",
    "carMake": "Toyota",
    "carModel": "Corolla",
    "carNumber": "ABC-1234",
    "carColor": "Branco",
    "uploadedDocuments": true
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "message": "Telefone ou senha incorretos"
}
```

**Response (403 Forbidden - Aguardando Aprovação):**
```json
{
  "message": "Seu cadastro ainda está aguardando aprovação do administrador. Você receberá uma notificação quando for aprovado.",
  "pendingApproval": true,
  "driverId": "uuid-do-motorista",
  "statusEndpoint": "/api/v1/driver/status/uuid-do-motorista"
}
```

**💡 Ao receber esta resposta**, redirecione o usuário para uma tela que consulte o endpoint `statusEndpoint` para exibir o progresso da aprovação.

**Response (403 Forbidden - Conta Desativada):**
```json
{
  "message": "Sua conta foi desativada. Entre em contato com o suporte."
}
```

**Exemplo em Flutter/Dart:**
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final storage = FlutterSecureStorage();

Future<Map<String, dynamic>?> loginDriver(String email, String password) async {
  try {
    final response = await dio.post(
      'http://192.168.3.3:5010/api/v1/driver/login',
      data: {
        'email': email, // ← Mudou de 'mobile' para 'email'
        'password': password,
        'deviceToken': fcmToken, // Token FCM (opcional)
      },
    );

    if (response.data['success']) {
      // ⭐ IMPORTANTE: Salvar o accessToken
      final accessToken = response.data['accessToken'];
      await storage.write(key: 'access_token', value: accessToken);

      // Salvar dados do motorista localmente
      final driver = response.data['data'];
      await saveDriverData(driver);

      // Navegar para tela principal
      Navigator.pushReplacementNamed(context, '/home');

      return driver;
    }
  } on DioException catch (e) {
    if (e.response?.statusCode == 403) {
      // Verificar se é cadastro pendente
      if (e.response?.data['pendingApproval'] == true) {
        // Mostrar tela de "Aguardando Aprovação"
        showPendingApprovalScreen();
        return null;
      }
      // Conta desativada
      showErrorDialog(e.response?.data['message']);
    } else if (e.response?.statusCode == 401) {
      showErrorDialog('Email ou senha incorretos');
    } else {
      print('Erro no login: ${e.response?.data['message']}');
    }
  }
  return null;
}

// Exemplo completo de fluxo de login
Future<void> performLogin() async {
  // 1. Validar email primeiro
  final emailExists = await validateEmail(emailController.text);

  if (!emailExists) {
    showError('Email não cadastrado');
    return;
  }

  // 2. Fazer login
  final driver = await loginDriver(
    emailController.text,
    passwordController.text,
  );

  if (driver != null) {
    print('Login realizado! Motorista: ${driver['name']}');
  }
}
```

---

### 3. Consultar Status de Aprovação (Timeline)

**Endpoint:** `GET /api/v1/driver/status/:id`

**Descrição:** Retorna o status atual do cadastro do motorista e uma timeline com as etapas de aprovação. Este endpoint **NÃO requer autenticação** e pode ser usado após o registro e quando o login retornar `pendingApproval: true`.

**Parâmetros:**
- `id` - UUID do motorista (retornado no registro ou no login 403)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "driverId": "uuid-do-motorista",
    "driverName": "João Silva",
    "status": "under_review",
    "canLogin": false,
    "timeline": [
      {
        "step": "registration",
        "title": "Cadastro Realizado",
        "description": "Seus dados foram enviados com sucesso",
        "status": "completed",
        "date": "2025-01-06T10:30:00.000Z"
      },
      {
        "step": "data_review",
        "title": "Envio de Documentos",
        "description": "Todos os documentos foram enviados",
        "status": "completed",
        "date": "2025-01-06T10:45:00.000Z"
      },
      {
        "step": "document_review",
        "title": "Análise de Documentos",
        "description": "Documentos em análise pela equipe",
        "status": "in_progress",
        "date": null
      },
      {
        "step": "approved",
        "title": "Cadastro Aprovado",
        "description": "Aguardando aprovação final do administrador",
        "status": "pending",
        "date": null
      }
    ],
    "statistics": {
      "totalDocuments": 4,
      "uploadedDocuments": 4,
      "approvedDocuments": 0,
      "rejectedDocuments": 0,
      "pendingDocuments": 4
    }
  }
}
```

**Campos da Timeline:**

Cada item da timeline contém:
- `step` - Identificador da etapa (`registration`, `data_review`, `document_review`, `approved`)
- `title` - Título da etapa para exibição
- `description` - Descrição detalhada do status atual
- `status` - Status da etapa:
  - `completed` ✅ - Etapa concluída
  - `in_progress` 🔄 - Etapa em andamento
  - `pending` ⏳ - Aguardando etapa anterior
  - `rejected` ❌ - Documentos rejeitados (reenvio necessário)
- `date` - Data de conclusão (null se não concluída)

**Status Geral (`status` no nível raiz):**
- `pending_approval` - Aguardando envio de documentos
- `under_review` - Documentos enviados, em análise
- `approved` - Cadastro aprovado, pode fazer login
- `rejected` - Documentos rejeitados, reenvio necessário

**Exemplo de Implementação Flutter:**

```dart
class ApprovalStatusScreen extends StatefulWidget {
  final String driverId;

  const ApprovalStatusScreen({required this.driverId});

  @override
  State<ApprovalStatusScreen> createState() => _ApprovalStatusScreenState();
}

class _ApprovalStatusScreenState extends State<ApprovalStatusScreen> {
  Map<String, dynamic>? statusData;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _loadStatus();
    // Atualizar a cada 30 segundos
    _timer = Timer.periodic(Duration(seconds: 30), (_) => _loadStatus());
  }

  Future<void> _loadStatus() async {
    try {
      final response = await dio.get(
        'http://192.168.3.3:5010/api/v1/driver/status/${widget.driverId}',
      );

      if (response.data['success']) {
        setState(() {
          statusData = response.data['data'];
        });

        // Se aprovado, redirecionar para login
        if (statusData?['canLogin'] == true) {
          Navigator.pushReplacementNamed(context, '/login');
        }
      }
    } catch (e) {
      print('Erro ao carregar status: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (statusData == null) {
      return Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final timeline = statusData!['timeline'] as List;
    final statistics = statusData!['statistics'] as Map;

    return Scaffold(
      appBar: AppBar(title: Text('Status do Cadastro')),
      body: Column(
        children: [
          // Header com status geral
          Container(
            padding: EdgeInsets.all(16),
            color: _getStatusColor(statusData!['status']),
            child: Column(
              children: [
                Text(
                  statusData!['driverName'],
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 8),
                Text(_getStatusMessage(statusData!['status'])),
              ],
            ),
          ),

          // Estatísticas de documentos
          Container(
            padding: EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatCard('Total', statistics['totalDocuments']),
                _buildStatCard('Enviados', statistics['uploadedDocuments']),
                _buildStatCard('Aprovados', statistics['approvedDocuments'], Colors.green),
                _buildStatCard('Rejeitados', statistics['rejectedDocuments'], Colors.red),
              ],
            ),
          ),

          // Timeline
          Expanded(
            child: ListView.builder(
              itemCount: timeline.length,
              itemBuilder: (context, index) {
                final step = timeline[index];
                return _buildTimelineItem(step, index == timeline.length - 1);
              },
            ),
          ),

          // Botão de ação (se necessário)
          if (statusData!['status'] == 'rejected')
            Padding(
              padding: EdgeInsets.all(16),
              child: ElevatedButton(
                onPressed: () => Navigator.pushNamed(context, '/upload-documents'),
                child: Text('Reenviar Documentos'),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTimelineItem(Map step, bool isLast) {
    final status = step['status'];
    final icon = _getStatusIcon(status);
    final color = _getStepColor(status);

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: Colors.white, size: 20),
              ),
              if (!isLast)
                Container(
                  width: 2,
                  height: 60,
                  color: Colors.grey[300],
                ),
            ],
          ),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step['title'],
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 4),
                Text(
                  step['description'],
                  style: TextStyle(color: Colors.grey[600]),
                ),
                if (step['date'] != null)
                  Text(
                    _formatDate(step['date']),
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'completed': return Icons.check_circle;
      case 'in_progress': return Icons.hourglass_bottom;
      case 'rejected': return Icons.cancel;
      default: return Icons.radio_button_unchecked;
    }
  }

  Color _getStepColor(String status) {
    switch (status) {
      case 'completed': return Colors.green;
      case 'in_progress': return Colors.blue;
      case 'rejected': return Colors.red;
      default: return Colors.grey;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'approved': return Colors.green[100]!;
      case 'under_review': return Colors.blue[100]!;
      case 'rejected': return Colors.red[100]!;
      default: return Colors.orange[100]!;
    }
  }

  String _getStatusMessage(String status) {
    switch (status) {
      case 'approved': return '🎉 Cadastro aprovado! Você já pode fazer login.';
      case 'under_review': return '⏳ Seu cadastro está em análise.';
      case 'rejected': return '⚠️ Alguns documentos foram rejeitados. Envie novamente.';
      default: return '📝 Aguardando envio de documentos.';
    }
  }

  Widget _buildStatCard(String label, int value, [Color? color]) {
    return Column(
      children: [
        Text(
          value.toString(),
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(label, style: TextStyle(fontSize: 12)),
      ],
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    final date = DateTime.parse(dateStr);
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
```

**📌 Fluxo Recomendado:**

1. **Após Registro**: Redirecionar automaticamente para a tela de status usando o `driverId` retornado
2. **Após Login Negado (403)**: Redirecionar para a tela de status usando o `driverId` retornado
3. **Polling**: Atualizar o status a cada 30 segundos para verificar mudanças
4. **Auto-Login**: Quando `canLogin` for `true`, redirecionar automaticamente para a tela de login
5. **Notificação Push**: Quando o admin aprovar, enviar notificação push para o motorista

---

### 4. Obter Dados do Motorista Logado

**Endpoint:** `GET /api/v1/driver`

**Descrição:** Retorna os dados completos do motorista autenticado via Bearer token.

**🔐 Requer autenticação:** Incluir `Authorization: Bearer <token>` no header

**Headers:**
```
Authorization: Bearer eyJpZCI6ImIwNzVlOTRiLWM1ZjgtNDZkZi05NjBhLWQzZTBhZWVlMTJjNCIsInR5cGUiOiJkcml2ZXIiLCJ0aW1lc3RhbXAiOjE3NjI0NjQ5MDc5MzJ9
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-do-motorista",
    "name": "João Silva",
    "mobile": "11999999999",
    "email": "joao@email.com",
    "cpf": "12345678900",
    "profilePicture": "/uploads/foto.jpg",
    "active": true,
    "approve": true,
    "available": false,
    "rating": "4.8",
    "ratingTotal": "96.0",
    "noOfRatings": 20,
    "serviceLocationId": "uuid-cidade",
    "vehicleTypeId": "uuid-tipo-veiculo",
    "carMake": "Toyota",
    "carModel": "Corolla",
    "carNumber": "ABC-1234",
    "carColor": "Branco",
    "carYear": "2020",
    "uploadedDocuments": true,
    "latitude": "-23.550520",
    "longitude": "-46.633309"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "message": "Não autenticado"
}
```

**Exemplo em Flutter/Dart:**
```dart
// ⭐ Não precisa passar o token manualmente!
// O interceptor configurado no Dio adiciona automaticamente
Future<Map<String, dynamic>?> getDriverProfile() async {
  try {
    final response = await dio.get(
      'http://192.168.3.3:5010/api/v1/driver'
    );

    if (response.data['success']) {
      return response.data['data'];
    }
  } on DioException catch (e) {
    if (e.response?.statusCode == 401) {
      // Token expirou, remover token e redirecionar para login
      await storage.delete(key: 'access_token');
      Navigator.pushReplacementNamed(context, '/login');
    }
  }
  return null;
}

// Caso queira passar o token manualmente (sem interceptor):
Future<Map<String, dynamic>?> getDriverProfileManual() async {
  final token = await storage.read(key: 'access_token');

  if (token == null) {
    // Sem token, redirecionar para login
    return null;
  }

  try {
    final response = await dio.get(
      'http://192.168.3.3:5010/api/v1/driver',
      options: Options(headers: {
        'Authorization': 'Bearer $token',
      }),
    );

    if (response.data['success']) {
      return response.data['data'];
    }
  } on DioException catch (e) {
    if (e.response?.statusCode == 401) {
      // Token inválido/expirado
      await storage.delete(key: 'access_token');
      Navigator.pushReplacementNamed(context, '/login');
    }
  }
  return null;
}
```

---

### 5. Atualizar Perfil do Motorista

**Endpoint:** `POST /api/v1/driver/profile`

**Descrição:** Atualiza os dados do perfil do motorista. Suporta upload de foto de perfil.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `name` (opcional) - Nome
- `email` (opcional) - Email
- `carMake` (opcional) - Marca do veículo
- `carModel` (opcional) - Modelo do veículo
- `carNumber` (opcional) - Placa
- `carColor` (opcional) - Cor
- `carYear` (opcional) - Ano
- `profile_picture` (opcional) - Arquivo de imagem (JPG, PNG, GIF, SVG - max 5MB)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Perfil atualizado com sucesso",
  "data": {
    "id": "uuid-do-motorista",
    "name": "João Silva",
    "email": "joao@email.com",
    "profilePicture": "/uploads/12345-foto.jpg",
    "carMake": "Toyota",
    "carModel": "Corolla",
    "carNumber": "ABC-1234",
    "carColor": "Branco",
    "carYear": "2020"
  }
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<void> updateProfile({
  String? name,
  String? email,
  File? profileImage,
  String? carMake,
  String? carModel,
}) async {
  try {
    final formData = FormData();

    if (name != null) formData.fields.add(MapEntry('name', name));
    if (email != null) formData.fields.add(MapEntry('email', email));
    if (carMake != null) formData.fields.add(MapEntry('carMake', carMake));
    if (carModel != null) formData.fields.add(MapEntry('carModel', carModel));

    if (profileImage != null) {
      formData.files.add(MapEntry(
        'profile_picture',
        await MultipartFile.fromFile(profileImage.path),
      ));
    }

    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/profile',
      data: formData,
    );

    if (response.data['success']) {
      print('Perfil atualizado!');
    }
  } on DioException catch (e) {
    print('Erro: ${e.response?.data['message']}');
  }
}
```

---

### 6. Enviar Documento do Motorista

**Endpoint:** `POST /api/v1/driver/documents`

**Descrição:** Envia um documento do motorista (CNH, CRLV, etc). Cada documento deve ser enviado separadamente. O motorista deve enviar todos os documentos obrigatórios antes de poder ficar online.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `documentTypeId` (obrigatório) - ID do tipo de documento (obtido de `/document-types`)
- `document` (obrigatório) - Arquivo (imagem JPG/PNG ou PDF, máximo 10MB)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Documento enviado com sucesso",
  "data": {
    "id": "uuid-do-documento",
    "documentTypeId": "uuid-tipo-documento",
    "documentUrl": "/uploads/documents_driver/12345-cnh.jpg",
    "status": "pending",
    "allRequiredUploaded": false
  }
}
```

**Observações:**
- O campo `allRequiredUploaded` indica se todos os documentos obrigatórios já foram enviados. Quando `true`, o campo `uploadedDocuments` do motorista é atualizado automaticamente.
- **Selfie como Foto de Perfil**: Quando o documento enviado for do tipo "Selfie", a URL da imagem é automaticamente definida como `profilePicture` do motorista. Esta foto será retornada nos endpoints de login (`POST /api/v1/driver/login`) e perfil (`GET /api/v1/driver`).
- **Reenvio de Documentos**: Se um documento rejeitado for reenviado, o registro existente é atualizado (status volta para `pending`, motivo de rejeição é limpo, e no caso de selfie, a foto de perfil é atualizada).

**Exemplo em Flutter/Dart:**
```dart
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';

Future<void> uploadDocument(String documentTypeId, File imageFile) async {
  try {
    final formData = FormData.fromMap({
      'documentTypeId': documentTypeId,
      'document': await MultipartFile.fromFile(
        imageFile.path,
        filename: 'documento.jpg',
      ),
    });

    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/documents',
      data: formData,
    );

    if (response.data['success']) {
      print('Documento enviado com sucesso');

      if (response.data['data']['allRequiredUploaded']) {
        print('Todos documentos obrigatórios enviados!');
        // Pode habilitar botão para aguardar aprovação
      }
    }
  } on DioException catch (e) {
    print('Erro: ${e.response?.data['message']}');
  }
}

// Exemplo de seleção de imagem
Future<void> pickAndUploadDocument(String documentTypeId) async {
  final ImagePicker picker = ImagePicker();
  final XFile? image = await picker.pickImage(source: ImageSource.camera);

  if (image != null) {
    await uploadDocument(documentTypeId, File(image.path));
  }
}
```

---

### 7. Listar Documentos Enviados

**Endpoint:** `GET /api/v1/driver/documents`

**Descrição:** Lista todos os documentos enviados pelo motorista logado, com status de aprovação.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-doc-1",
      "documentTypeId": "uuid-tipo-1",
      "documentTypeName": "CNH (Carteira de Motorista)",
      "documentUrl": "/uploads/documents_driver/12345-cnh.jpg",
      "status": "approved",
      "rejectionReason": null,
      "createdAt": "2025-01-06T10:30:00.000Z"
    },
    {
      "id": "uuid-doc-2",
      "documentTypeId": "uuid-tipo-2",
      "documentTypeName": "CRLV (Documento do Veículo)",
      "documentUrl": "/uploads/documents_driver/12346-crlv.jpg",
      "status": "pending",
      "rejectionReason": null,
      "createdAt": "2025-01-06T10:35:00.000Z"
    }
  ]
}
```

**Status possíveis:**
- `pending` - Aguardando análise do administrador
- `approved` - Documento aprovado
- `rejected` - Documento rejeitado (ver `rejectionReason`)

---

### 8. Atualizar Localização do Motorista

**Endpoint:** `POST /api/v1/driver/location`

**Descrição:** Atualiza a localização GPS atual do motorista. Deve ser chamado periodicamente enquanto o motorista estiver online.

**Request Body:**
```json
{
  "latitude": -23.550520,
  "longitude": -46.633309
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Localização atualizada com sucesso"
}
```

**Exemplo em Flutter/Dart:**
```dart
import 'package:geolocator/geolocator.dart';

Future<void> updateLocation() async {
  try {
    // Obter localização atual
    final position = await Geolocator.getCurrentPosition();

    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/location',
      data: {
        'latitude': position.latitude,
        'longitude': position.longitude,
      },
    );

    if (response.data['success']) {
      print('Localização atualizada');
    }
  } catch (e) {
    print('Erro ao atualizar localização: $e');
  }
}

// Atualizar localização a cada 10 segundos quando online
Timer.periodic(Duration(seconds: 10), (timer) {
  if (isDriverOnline) {
    updateLocation();
  }
});
```

---

### 9. Toggle Online/Offline

**Endpoint:** `POST /api/v1/driver/online-offline`

**Descrição:** Alterna o status de disponibilidade do motorista (online/offline). O motorista só pode ficar online se estiver aprovado e tiver documentos enviados.

**Request Body:**
```json
{
  "availability": 1
}
```

**Valores:**
- `1` ou `true` - Ficar online
- `0` ou `false` - Ficar offline

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Você está online",
  "data": {
    "available": true
  }
}
```

**Response (403 Forbidden):**
```json
{
  "message": "Você precisa ser aprovado pelo administrador antes de ficar online"
}
```

**Response (403 Forbidden):**
```json
{
  "message": "Você precisa enviar os documentos necessários antes de ficar online"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<bool> toggleOnlineStatus(bool goOnline) async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/online-offline',
      data: {
        'availability': goOnline ? 1 : 0,
      },
    );

    if (response.data['success']) {
      print(response.data['message']);
      return response.data['data']['available'];
    }
  } on DioException catch (e) {
    // Mostrar mensagem de erro ao usuário
    showErrorDialog(e.response?.data['message']);
  }
  return false;
}
```

---

### 10. Logout

**Endpoint:** `POST /api/v1/driver/logout`

**Descrição:** Encerra a sessão do motorista e marca como offline.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<void> logoutDriver() async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/logout',
    );

    if (response.data['success']) {
      // Limpar dados locais
      await clearDriverData();
      // Redirecionar para tela de login
      Navigator.pushReplacementNamed(context, '/login');
    }
  } catch (e) {
    print('Erro ao fazer logout: $e');
  }
}
```

---

## Fluxo Completo de Uso no App Flutter

### 1. Tela de Registro
```dart
1. Motorista preenche formulário
2. App chama POST /api/v1/driver/register
3. Se sucesso, mostrar mensagem "Aguardando aprovação"
4. Motorista aguarda admin aprovar no painel
```

### 2. Tela de Login
```dart
1. Motorista insere telefone e senha
2. App chama POST /api/v1/driver/login
3. Se sucesso, salvar dados do motorista localmente
4. Verificar campo approve:
   - Se approve = false: Mostrar tela "Aguardando aprovação"
   - Se approve = true: Redirecionar para dashboard
```

### 3. Dashboard (Tela Principal)
```dart
1. Mostrar informações do motorista
2. Toggle online/offline
3. Quando ficar online:
   - Iniciar atualização de localização a cada 10s
   - Escutar novas corridas (via Firebase ou WebSocket)
4. Quando ficar offline:
   - Parar atualização de localização
```

### 4. Perfil
```dart
1. Mostrar dados do motorista (GET /api/v1/driver)
2. Permitir edição de nome, email, foto
3. Permitir edição de dados do veículo
4. Salvar alterações (POST /api/v1/driver/profile)
```

---

## Tratamento de Erros

### Erros Comuns

| Status Code | Significado | Ação Recomendada |
|-------------|-------------|-------------------|
| 400 | Bad Request - Dados inválidos | Mostrar mensagem de erro do response |
| 401 | Não autenticado | Redirecionar para login |
| 403 | Não autorizado (conta desativada, não aprovado) | Mostrar mensagem específica |
| 404 | Não encontrado | Mostrar mensagem de erro |
| 500 | Erro no servidor | Mostrar "Erro ao processar. Tente novamente" |

### Exemplo de Interceptor para Erros
```dart
dio.interceptors.add(InterceptorsWrapper(
  onError: (DioException e, handler) async {
    if (e.response?.statusCode == 401) {
      // Sessão expirou, fazer logout
      await logoutDriver();
      Navigator.pushReplacementNamed(context, '/login');
    } else {
      // Mostrar erro genérico
      showErrorSnackbar(e.response?.data['message'] ?? 'Erro desconhecido');
    }
    return handler.next(e);
  },
));
```

---

## 📦 Gerenciamento de Entregas

### 11. Listar Entregas Disponíveis

**Endpoint:** `GET /api/v1/driver/deliveries/available`

**Descrição:** Lista todas as entregas disponíveis (sem motorista atribuído) que o motorista pode aceitar.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-da-entrega",
      "requestNumber": "REQ-1234567890-123",
      "customerName": "João Silva",
      "totalDistance": "5.2",
      "totalTime": "15",
      "requestEtaAmount": "25.50",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "pickAddress": "Rua A, 123 - Bairro X",
      "dropAddress": "Rua B, 456 - Bairro Y",
      "pickLat": "-23.550520",
      "pickLng": "-46.633309",
      "dropLat": "-23.562940",
      "dropLng": "-46.654460",
      "companyName": "Empresa ABC",
      "vehicleTypeName": "Moto"
    }
  ]
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<List<Delivery>> getAvailableDeliveries() async {
  try {
    final response = await dio.get(
      'http://localhost:5000/api/v1/driver/deliveries/available',
    );

    if (response.data['success']) {
      final deliveries = (response.data['data'] as List)
          .map((item) => Delivery.fromJson(item))
          .toList();
      return deliveries;
    }
  } on DioException catch (e) {
    print('Erro ao buscar entregas: ${e.response?.data['message']}');
  }
  return [];
}
```

---

### 12. Obter Entrega Atual

**Endpoint:** `GET /api/v1/driver/deliveries/current`

**Descrição:** Retorna a entrega atualmente em andamento do motorista (se houver).

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-da-entrega",
    "requestNumber": "REQ-123",
    "customerName": "João Silva",
    "isDriverStarted": true,
    "isDriverArrived": true,
    "isTripStart": true,
    "isCompleted": false,
    "totalDistance": "5.2",
    "totalTime": "15",
    "requestEtaAmount": "25.50",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "acceptedAt": "2024-01-15T10:35:00.000Z",
    "pickAddress": "Rua A, 123",
    "dropAddress": "Rua B, 456",
    "pickLat": "-23.550520",
    "pickLng": "-46.633309",
    "dropLat": "-23.562940",
    "dropLng": "-46.654460",
    "companyName": "Empresa ABC",
    "companyPhone": "11988887777",
    "vehicleTypeName": "Moto"
  }
}
```

**Response (404 Not Found):**
```json
{
  "message": "Você não tem nenhuma entrega em andamento"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<Delivery?> getCurrentDelivery() async {
  try {
    final response = await dio.get(
      'http://localhost:5000/api/v1/driver/deliveries/current',
    );

    if (response.data['success']) {
      return Delivery.fromJson(response.data['data']);
    }
  } on DioException catch (e) {
    if (e.response?.statusCode == 404) {
      // Nenhuma entrega em andamento
      return null;
    }
  }
  return null;
}
```

---

### 13. Aceitar Entrega

**Endpoint:** `POST /api/v1/driver/deliveries/:id/accept`

**Descrição:** Motorista aceita uma entrega disponível. A entrega será atribuída ao motorista e a empresa receberá uma notificação em tempo real via Socket.IO.

**Path Parameter:**
- `:id` - UUID da entrega

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Entrega aceita com sucesso",
  "data": {
    "deliveryId": "uuid-da-entrega",
    "status": "accepted"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "message": "Esta entrega já foi aceita por outro motorista"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<bool> acceptDelivery(String deliveryId) async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/deliveries/$deliveryId/accept',
    );

    if (response.data['success']) {
      showSuccessSnackbar('Entrega aceita!');
      return true;
    }
  } on DioException catch (e) {
    showErrorSnackbar(e.response?.data['message'] ?? 'Erro ao aceitar entrega');
  }
  return false;
}
```

---

### 14. Rejeitar Entrega

**Endpoint:** `POST /api/v1/driver/deliveries/:id/reject`

**Descrição:** Motorista rejeita uma entrega disponível.

**Path Parameter:**
- `:id` - UUID da entrega

**Request Body (opcional):**
```json
{
  "reason": "Muito longe"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Entrega rejeitada"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<void> rejectDelivery(String deliveryId, {String? reason}) async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/deliveries/$deliveryId/reject',
      data: reason != null ? {'reason': reason} : null,
    );

    if (response.data['success']) {
      showInfoSnackbar('Entrega rejeitada');
    }
  } on DioException catch (e) {
    print('Erro ao rejeitar: ${e.response?.data['message']}');
  }
}
```

---

### 15. Chegou no Local de Retirada

**Endpoint:** `POST /api/v1/driver/deliveries/:id/arrived-pickup`

**Descrição:** Marca que o motorista chegou no local de retirada. A empresa receberá notificação em tempo real.

**Path Parameter:**
- `:id` - UUID da entrega

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Status atualizado: Chegou para retirada"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<void> markArrivedAtPickup(String deliveryId) async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/deliveries/$deliveryId/arrived-pickup',
    );

    if (response.data['success']) {
      showSuccessSnackbar('Status atualizado!');
    }
  } on DioException catch (e) {
    showErrorSnackbar(e.response?.data['message'] ?? 'Erro ao atualizar status');
  }
}
```

---

### 16. Retirou o Pedido

**Endpoint:** `POST /api/v1/driver/deliveries/:id/picked-up`

**Descrição:** Marca que o motorista retirou o pedido e está indo para o local de entrega.

**Path Parameter:**
- `:id` - UUID da entrega

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Status atualizado: Pedido retirado"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<void> markPickedUp(String deliveryId) async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/deliveries/$deliveryId/picked-up',
    );

    if (response.data['success']) {
      showSuccessSnackbar('Pedido retirado! Indo para entrega...');
    }
  } on DioException catch (e) {
    showErrorSnackbar(e.response?.data['message'] ?? 'Erro ao atualizar status');
  }
}
```

---

### 17. Pedido Entregue

**Endpoint:** `POST /api/v1/driver/deliveries/:id/delivered`

**Descrição:** Marca que o motorista entregou o pedido ao destinatário.

**Path Parameter:**
- `:id` - UUID da entrega

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Status atualizado: Pedido entregue"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<void> markDelivered(String deliveryId) async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/deliveries/$deliveryId/delivered',
    );

    if (response.data['success']) {
      showSuccessSnackbar('Pedido entregue com sucesso!');
    }
  } on DioException catch (e) {
    showErrorSnackbar(e.response?.data['message'] ?? 'Erro ao atualizar status');
  }
}
```

---

### 18. Finalizar Entrega

**Endpoint:** `POST /api/v1/driver/deliveries/:id/complete`

**Descrição:** Finaliza completamente a entrega. Marca como concluída.

**Path Parameter:**
- `:id` - UUID da entrega

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Entrega finalizada com sucesso"
}
```

**Exemplo em Flutter/Dart:**
```dart
Future<void> completeDelivery(String deliveryId) async {
  try {
    final response = await dio.post(
      'http://localhost:5000/api/v1/driver/deliveries/$deliveryId/complete',
    );

    if (response.data['success']) {
      showSuccessSnackbar('Entrega concluída!');
      // Redirecionar para tela de entregas disponíveis
      Navigator.pushReplacementNamed(context, '/available-deliveries');
    }
  } on DioException catch (e) {
    showErrorSnackbar(e.response?.data['message'] ?? 'Erro ao finalizar entrega');
  }
}
```

---

## 🔔 Sistema de Notificações Push (FCM)

### Configuração do Firebase Cloud Messaging

O sistema envia notificações push para o app do motorista quando:
- Uma nova entrega está disponível **dentro do raio de pesquisa configurado**
- A empresa cancela uma entrega
- Há atualizações importantes

**⚙️ Raio de Pesquisa e Timeouts:**

O sistema utiliza três configurações importantes que o admin pode ajustar no painel:

1. **Raio de Pesquisa (driver_search_radius)**: Apenas motoristas dentro deste raio (em km) do ponto de retirada recebem a notificação
   - Padrão: 10 km
   - A localização do motorista deve ser atualizada constantemente (endpoint `/location`)

2. **Tempo de Aceitação (driver_acceptance_timeout)**: Tempo que o motorista tem para aceitar a entrega
   - Padrão: 30 segundos
   - Enviado no campo `acceptanceTimeout` da notificação

3. **Tempo de Busca (min_time_to_find_driver)**: Tempo total que o sistema fica procurando motoristas
   - Padrão: 120 segundos
   - Enviado no campo `searchTimeout` da notificação

### Como Configurar Firebase (Passo a Passo)

**📋 Resumo do que você precisa:**
1. Criar projeto no Firebase Console
2. Registrar app Android e iOS
3. Baixar arquivos de configuração
4. Obter credenciais para o backend
5. Configurar no app Flutter

---

#### **Passo 1: Criar Projeto Firebase**

1. Acesse: [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Clique em **"Adicionar projeto"**
3. Nome do projeto: "Fretus Delivery" (ou outro nome)
4. Clique em **"Criar projeto"**
5. Aguarde a criação e clique em **"Continuar"**

---

#### **Passo 2: Registrar App Android**

1. No Firebase Console, clique no ícone **Android** (robot)
2. **Nome do pacote**: `com.seudominio.fretus` (mesmo do seu `build.gradle`)
3. **Apelido**: "Fretus Driver Android"
4. Clique em **"Registrar app"**
5. **Baixe o `google-services.json`** ⬇️
6. Clique em **"Próximo"** até finalizar

**Onde colocar:** `android/app/google-services.json`

---

#### **Passo 3: Registrar App iOS**

1. No Firebase Console, clique no ícone **iOS** (Apple)
2. **Bundle ID**: `com.seudominio.fretus` (mesmo do Info.plist)
3. **Apelido**: "Fretus Driver iOS"
4. Clique em **"Registrar app"**
5. **Baixe o `GoogleService-Info.plist`** ⬇️
6. Clique em **"Próximo"** até finalizar

**Onde colocar:** Adicionar via Xcode ao projeto `ios/Runner`

---

#### **Passo 4: Obter Credenciais do Backend**

Estas credenciais serão usadas no **painel admin** para enviar notificações:

1. Firebase Console → ⚙️ **Configurações do projeto**
2. Aba **"Contas de serviço"** (Service Accounts)
3. Clique em **"Gerar nova chave privada"**
4. Confirme e baixe o arquivo JSON

**Abra o arquivo JSON e copie:**
- `project_id` → Firebase Project ID
- `client_email` → Firebase Client Email
- `private_key` → Firebase Private Key (incluindo BEGIN e END)

**Configure no painel admin** em Settings → Firebase Configuration

---

#### **Passo 5: Configurar Android**

**5.1 - Adicionar google-services.json:**
```
Copie o arquivo para: android/app/google-services.json
```

**5.2 - Editar `android/build.gradle`:**
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'  // ← Adicione
    }
}
```

**5.3 - Editar `android/app/build.gradle` (no FINAL):**
```gradle
apply plugin: 'com.google.gms.google-services'  // ← Adicione
```

**5.4 - Permissões em `android/app/src/main/AndroidManifest.xml`:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

    <application ...>
        <!-- Código existente -->
    </application>
</manifest>
```

---

#### **Passo 6: Configurar iOS**

**6.1 - Adicionar GoogleService-Info.plist:**
1. Abra no Xcode: `ios/Runner.xcworkspace`
2. Clique direito na pasta **Runner**
3. **Add Files to "Runner"...**
4. Selecione o arquivo `GoogleService-Info.plist`
5. Marque **"Copy items if needed"**
6. Clique em **"Add"**

**6.2 - Editar `ios/Runner/Info.plist`:**
```xml
<dict>
    <!-- Código existente... -->

    <key>NSLocationWhenInUseUsageDescription</key>
    <string>Precisamos da sua localização para encontrar entregas próximas</string>

    <key>NSLocationAlwaysUsageDescription</key>
    <string>Precisamos da sua localização em segundo plano para receber entregas</string>

    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
    <string>Precisamos da sua localização para encontrar entregas próximas</string>
</dict>
```

**6.3 - Habilitar Capabilities no Xcode:**
1. Selecione o projeto **Runner**
2. Aba **"Signing & Capabilities"**
3. Clique em **"+ Capability"**
4. Adicione **"Push Notifications"**
5. Adicione **"Background Modes"**
6. Marque **"Remote notifications"**

---

### Configurar FCM no App Flutter

**1. Adicionar dependências no `pubspec.yaml`:**
```yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
```

**2. Inicializar Firebase:**
```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Configurar FCM
  FirebaseMessaging messaging = FirebaseMessaging.instance;

  // Solicitar permissão para notificações
  NotificationSettings settings = await messaging.requestPermission(
    alert: true,
    sound: true,
    badge: true,
  );

  print('Permissão concedida: ${settings.authorizationStatus}');

  runApp(MyApp());
}
```

**3. Obter e enviar FCM Token:**
```dart
Future<String?> getFCMToken() async {
  final fcmToken = await FirebaseMessaging.instance.getToken();
  print('FCM Token: $fcmToken');
  return fcmToken;
}

// Enviar token no login
final fcmToken = await getFCMToken();
await dio.post('/api/v1/driver/login', data: {
  'mobile': mobile,
  'password': password,
  'deviceToken': fcmToken, // ← Token FCM
  'loginBy': Platform.isAndroid ? 'android' : 'ios',
});
```

**4. Escutar notificações:**
```dart
class FCMService {
  static Future<void> initialize() async {
    // Quando app está em foreground (primeiro plano)
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Notificação recebida: ${message.notification?.title}');
      print('Dados: ${message.data}');

      // Se for notificação de nova entrega
      if (message.data['type'] == 'new_delivery') {
        // Timeout de aceitação em segundos
        final acceptanceTimeout = int.tryParse(message.data['acceptanceTimeout'] ?? '30') ?? 30;

        showNewDeliveryDialog(
          deliveryId: message.data['deliveryId'],
          requestNumber: message.data['requestNumber'],
          pickupAddress: message.data['pickupAddress'],
          dropoffAddress: message.data['dropoffAddress'],
          estimatedAmount: message.data['estimatedAmount'],
          distance: message.data['distance'],
          time: message.data['time'],
          acceptanceTimeout: acceptanceTimeout,
        );
      }
    });

    // Quando app está em background e usuário toca na notificação
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Notificação aberta: ${message.notification?.title}');

      // Navegar para tela apropriada
      if (message.data['type'] == 'new_delivery') {
        Navigator.pushNamed(context, '/available-deliveries');
      }
    });

    // Verificar se app foi aberto por notificação (quando estava fechado)
    RemoteMessage? initialMessage =
        await FirebaseMessaging.instance.getInitialMessage();

    if (initialMessage != null) {
      // App foi aberto por notificação
      handleInitialMessage(initialMessage);
    }
  }
}
```

**5. Dialog de Nova Entrega com Countdown Timer:**
```dart
void showNewDeliveryDialog({
  required String deliveryId,
  required String requestNumber,
  required String pickupAddress,
  required String dropoffAddress,
  required String estimatedAmount,
  required String distance,
  required String time,
  required int acceptanceTimeout, // Tempo em segundos
}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => NewDeliveryDialog(
      deliveryId: deliveryId,
      requestNumber: requestNumber,
      pickupAddress: pickupAddress,
      dropoffAddress: dropoffAddress,
      estimatedAmount: estimatedAmount,
      distance: distance,
      time: time,
      acceptanceTimeout: acceptanceTimeout,
    ),
  );
}

// Widget StatefulWidget para o Dialog com Timer
class NewDeliveryDialog extends StatefulWidget {
  final String deliveryId;
  final String requestNumber;
  final String pickupAddress;
  final String dropoffAddress;
  final String estimatedAmount;
  final String distance;
  final String time;
  final int acceptanceTimeout;

  const NewDeliveryDialog({
    required this.deliveryId,
    required this.requestNumber,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.estimatedAmount,
    required this.distance,
    required this.time,
    required this.acceptanceTimeout,
  });

  @override
  _NewDeliveryDialogState createState() => _NewDeliveryDialogState();
}

class _NewDeliveryDialogState extends State<NewDeliveryDialog> {
  late int remainingSeconds;
  Timer? countdownTimer;

  @override
  void initState() {
    super.initState();
    remainingSeconds = widget.acceptanceTimeout;
    startCountdown();
  }

  void startCountdown() {
    countdownTimer = Timer.periodic(Duration(seconds: 1), (timer) {
      setState(() {
        if (remainingSeconds > 0) {
          remainingSeconds--;
        } else {
          timer.cancel();
          // Tempo esgotado, fechar dialog automaticamente
          Navigator.of(context).pop();
        }
      });
    });
  }

  @override
  void dispose() {
    countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          Icon(Icons.local_shipping, color: Colors.blue),
          SizedBox(width: 10),
          Expanded(child: Text('Nova Entrega!')),
          // Countdown timer
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: remainingSeconds <= 10 ? Colors.red : Colors.orange,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '$remainingSeconds s',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Pedido: ${widget.requestNumber}',
               style: TextStyle(fontWeight: FontWeight.bold)),
          Divider(),
          Text('📍 Retirada:', style: TextStyle(fontWeight: FontWeight.bold)),
          Text(widget.pickupAddress),
          SizedBox(height: 10),
          Text('📍 Entrega:', style: TextStyle(fontWeight: FontWeight.bold)),
          Text(widget.dropoffAddress),
          SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Distância: ${widget.distance} km'),
              Text('Tempo: ${widget.time} min'),
            ],
          ),
          SizedBox(height: 10),
          Text('💰 Valor: R\$ ${widget.estimatedAmount}',
               style: TextStyle(
                 color: Colors.green,
                 fontSize: 20,
                 fontWeight: FontWeight.bold,
               )),
        ],
      ),
      actions: [
        TextButton(
          onPressed: remainingSeconds > 0 ? () async {
            countdownTimer?.cancel();
            await rejectDelivery(widget.deliveryId);
            Navigator.pop(context);
          } : null,
          child: Text('Rejeitar', style: TextStyle(color: Colors.red)),
        ),
        ElevatedButton(
          onPressed: remainingSeconds > 0 ? () async {
            countdownTimer?.cancel();
            final accepted = await acceptDelivery(widget.deliveryId);
            if (accepted) {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/delivery-in-progress');
            }
          } : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.green,
          ),
          child: Text('Aceitar'),
        ),
      ],
    );
  }
}
```

---

## 📱 Fluxo Completo de Entrega no App

### Como Funciona o Raio de Pesquisa

```
1. MOTORISTA FICA ONLINE
   └─> POST /api/v1/driver/online-offline (availability: 1)
   └─> App inicia timer para atualizar localização

2. ATUALIZAÇÃO CONSTANTE DE LOCALIZAÇÃO
   └─> A cada 10 segundos: POST /api/v1/driver/location
   └─> Envia latitude e longitude atuais
   └─> Backend armazena no banco de dados

3. EMPRESA CRIA NOVA ENTREGA
   └─> Sistema calcula distância de cada motorista ao ponto de retirada
   └─> Filtra apenas motoristas dentro do raio configurado
   └─> Exemplo: Raio = 10km
       - Motorista A: 5km do pickup → ✅ Recebe notificação
       - Motorista B: 15km do pickup → ❌ Não recebe notificação

4. NOTIFICAÇÃO ENVIADA
   └─> Apenas motoristas dentro do raio recebem
   └─> Dialog abre com countdown timer (ex: 30 segundos)
   └─> Motorista tem tempo limitado para aceitar
```

### Ciclo de Vida de uma Entrega

```
1. MOTORISTA ONLINE
   └─> Aguardando entregas dentro do raio de pesquisa
   └─> Atualizando localização a cada 10s via POST /location

2. NOVA ENTREGA CRIADA
   └─> Push notification recebida
   └─> Dialog mostrando detalhes
   └─> Motorista decide: Aceitar ou Rejeitar

3. SE ACEITAR
   └─> POST /api/v1/driver/deliveries/:id/accept
   └─> Navegar para tela de entrega em andamento
   └─> Mostrar rota no mapa (pickup → dropoff)

4. CHEGOU NO LOCAL DE RETIRADA
   └─> Botão "Cheguei" disponível
   └─> POST /api/v1/driver/deliveries/:id/arrived-pickup
   └─> Status: "Aguardando retirada do pedido"

5. RETIROU O PEDIDO
   └─> Botão "Retirei o pedido" disponível
   └─> POST /api/v1/driver/deliveries/:id/picked-up
   └─> Status: "Indo para entrega"
   └─> Mostrar rota até destino final

6. CHEGOU NO DESTINO
   └─> Botão "Entreguei" disponível
   └─> POST /api/v1/driver/deliveries/:id/delivered
   └─> Status: "Pedido entregue"

7. FINALIZAR ENTREGA
   └─> Botão "Concluir entrega" disponível
   └─> POST /api/v1/driver/deliveries/:id/complete
   └─> Mostrar resumo (distância, tempo, valor)
   └─> Voltar para tela de entregas disponíveis
```

---

## Próximos Passos

1. ✅ Autenticação e registro implementados
2. ✅ Endpoints de entregas (aceitar, rejeitar, status)
3. ✅ Sistema de notificações push (FCM)
4. 🚧 Endpoints de documentos (upload, status)
5. 🚧 Endpoints de ganhos e histórico
6. 🚧 Chat com empresa/admin

---

## 🔍 Verificação e Troubleshooting

### ✅ Checklist de Configuração

**Firebase:**
- [ ] Projeto Firebase criado
- [ ] App Android registrado
- [ ] App iOS registrado
- [ ] `google-services.json` em `android/app/`
- [ ] `GoogleService-Info.plist` adicionado via Xcode
- [ ] Plugin google-services adicionado no build.gradle
- [ ] Permissões configuradas (Android e iOS)
- [ ] Capabilities habilitadas no Xcode
- [ ] Credenciais configuradas no painel admin

**App Flutter:**
- [ ] Dependências firebase instaladas
- [ ] Firebase inicializado no main.dart
- [ ] FCM Token obtido e impresso no console
- [ ] Token enviado no endpoint de login
- [ ] Listeners de notificação configurados
- [ ] Dialog de nova entrega implementado

**Funcionalidades:**
- [ ] Login funcionando
- [ ] Token FCM sendo enviado
- [ ] Toggle online/offline funcionando
- [ ] Atualização de localização a cada 10s
- [ ] Notificações sendo recebidas
- [ ] Dialog abrindo com countdown
- [ ] Aceitar/rejeitar entrega funcionando
- [ ] Atualizações de status funcionando

---

### 🐛 Problemas Comuns

**❌ "Firebase not initialized"**
```dart
// Solução: Adicione no main.dart ANTES de runApp()
await Firebase.initializeApp();
```

**❌ "google-services.json not found"**
```bash
# Solução:
# 1. Verifique se está em: android/app/google-services.json
# 2. Execute:
flutter clean
flutter pub get
```

**❌ "FCM Token is null"**
```dart
// Solução: Verifique permissões
final settings = await FirebaseMessaging.instance.requestPermission(
  alert: true,
  sound: true,
  badge: true,
);
print('Status: ${settings.authorizationStatus}');
```

**❌ "Notificações não chegam"**
- Verifique se o token foi enviado no login
- Confirme que está online (`available = true`)
- Verifique se está atualizando localização
- Confirme se está dentro do raio de pesquisa
- Teste com notificação manual do Firebase Console

**❌ "Location permission denied"**
```dart
// Solução: Solicite permissão explicitamente
LocationPermission permission = await Geolocator.requestPermission();
if (permission == LocationPermission.denied) {
  // Mostrar dialog explicando porque precisa
}
```

**❌ "Background location not working (iOS)"**
- Verifique Info.plist (todas as 3 chaves de localização)
- Habilite Background Modes no Xcode
- Marque "Location updates" em Background Modes

---

## 📊 Logs Importantes

### No App Flutter

**Logs esperados ao iniciar:**
```
✓ Firebase initialized
✓ FCM Token: dXXXXXXXXXXXXXXX...
✓ Permissão concedida: AuthorizationStatus.authorized
```

**Logs ao fazer login:**
```
✓ Login realizado com sucesso!
✓ Token FCM enviado ao servidor
```

**Logs ao receber notificação:**
```
🔔 Notificação recebida!
Título: Nova Entrega Disponível!
Dados: {type: new_delivery, deliveryId: xxx, ...}
```

**Logs de localização:**
```
📍 Localização atualizada: -23.5505, -46.6333
```

### No Backend (Servidor)

**Logs esperados:**
```
✓ Firebase Admin SDK inicializado com sucesso
✓ 3 de 5 motoristas estão dentro do raio de 10 km
✓ Notificação enviada para 3 motoristas dentro do raio
✓ 3 notificações enviadas de 3
```

---

## 🎯 Endpoints Resumidos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/driver/register` | Registrar novo motorista |
| POST | `/api/v1/driver/login` | Fazer login e enviar FCM token |
| POST | `/api/v1/driver/logout` | Fazer logout |
| GET | `/api/v1/driver` | Obter dados do motorista |
| POST | `/api/v1/driver/profile` | Atualizar perfil |
| POST | `/api/v1/driver/location` | Atualizar localização (a cada 10s) |
| POST | `/api/v1/driver/online-offline` | Ficar online/offline |
| GET | `/api/v1/driver/deliveries/available` | Listar entregas disponíveis |
| GET | `/api/v1/driver/deliveries/current` | Obter entrega atual |
| POST | `/api/v1/driver/deliveries/:id/accept` | Aceitar entrega |
| POST | `/api/v1/driver/deliveries/:id/reject` | Rejeitar entrega |
| POST | `/api/v1/driver/deliveries/:id/arrived-pickup` | Chegou para retirada |
| POST | `/api/v1/driver/deliveries/:id/picked-up` | Retirou pedido |
| POST | `/api/v1/driver/deliveries/:id/delivered` | Entregou pedido |
| POST | `/api/v1/driver/deliveries/:id/complete` | Finalizar entrega |

---

## 📱 Fluxo de Integração Sugerido

**Fase 1 - Setup Básico:**
1. ✅ Criar projeto Flutter
2. ✅ Configurar Firebase (Android + iOS)
3. ✅ Adicionar dependências
4. ✅ Testar FCM Token

**Fase 2 - Autenticação:**
1. ✅ Implementar tela de login
2. ✅ Integrar com API de login
3. ✅ Enviar FCM token no login
4. ✅ Salvar sessão localmente

**Fase 3 - Localização:**
1. ✅ Solicitar permissões de localização
2. ✅ Implementar LocationService
3. ✅ Atualizar localização a cada 10s quando online
4. ✅ Testar se localização está sendo enviada

**Fase 4 - Notificações:**
1. ✅ Configurar listeners FCM
2. ✅ Implementar dialog de nova entrega
3. ✅ Adicionar countdown timer
4. ✅ Testar notificações via Firebase Console

**Fase 5 - Entregas:**
1. ✅ Implementar tela de entregas disponíveis
2. ✅ Implementar aceitar/rejeitar
3. ✅ Implementar tela de entrega em andamento
4. ✅ Implementar botões de status
5. ✅ Testar fluxo completo

---

## 🔗 Links Úteis

- **Firebase Console**: https://console.firebase.google.com/
- **Flutter Firebase**: https://firebase.flutter.dev/
- **FCM Documentation**: https://firebase.google.com/docs/cloud-messaging
- **Geolocator Plugin**: https://pub.dev/packages/geolocator
- **Dio HTTP Client**: https://pub.dev/packages/dio

---

## 🔔 Notificações Push Automáticas

O sistema envia notificações push automáticas para o motorista nos seguintes eventos:

### 1. Cadastro Aprovado
**Quando**: O administrador aprova o cadastro do motorista no painel admin
**Título**: "🎉 Cadastro Aprovado!"
**Mensagem**: "Parabéns! Seu cadastro foi aprovado pelo administrador. Agora você pode fazer login e começar a trabalhar."
**Dados**:
```json
{
  "type": "driver_approved",
  "driverId": "uuid-do-motorista"
}
```

### 2. Cadastro Rejeitado
**Quando**: O administrador rejeita o cadastro do motorista
**Título**: "❌ Cadastro Rejeitado"
**Mensagem**: "Seu cadastro foi rejeitado pelo administrador. Entre em contato com o suporte para mais informações."
**Dados**:
```json
{
  "type": "driver_rejected",
  "driverId": "uuid-do-motorista"
}
```

### 3. Documento Aprovado
**Quando**: O administrador aprova um documento enviado
**Título**: "✅ Documento Aprovado"
**Mensagem**: "Seu documento 'CNH' foi aprovado! 3/4 documentos aprovados. Continue aguardando a análise final."
**Dados**:
```json
{
  "type": "document_approved",
  "driverId": "uuid-do-motorista",
  "documentId": "uuid-do-documento",
  "documentType": "CNH",
  "approvedCount": "3",
  "totalCount": "4"
}
```

### 4. Documento Rejeitado
**Quando**: O administrador rejeita um documento enviado
**Título**: "📄 Documento Rejeitado"
**Mensagem**: "Seu documento 'CNH' foi rejeitado. Motivo: Foto está desfocada. Por favor, envie novamente."
**Dados**:
```json
{
  "type": "document_rejected",
  "driverId": "uuid-do-motorista",
  "documentId": "uuid-do-documento",
  "documentType": "CNH",
  "rejectionReason": "Foto está desfocada"
}
```

### Implementação Flutter

```dart
// Configurar listener de notificações
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  final notification = message.notification;
  final data = message.data;

  if (notification != null) {
    // Exibir notificação local ou dialog
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(notification.title ?? ''),
        content: Text(notification.body ?? ''),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              // Navegar conforme o tipo
              if (data['type'] == 'driver_approved') {
                // Ir para tela de login
                Navigator.pushReplacementNamed(context, '/login');
              } else if (data['type'] == 'document_rejected') {
                // Ir para tela de upload de documentos
                Navigator.pushNamed(context, '/upload-documents');
              }
            },
            child: Text('OK'),
          ),
        ],
      ),
    );
  }
});

// Notificação quando app está em background
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  final data = message.data;

  // Navegar conforme o tipo
  if (data['type'] == 'driver_approved') {
    Navigator.pushReplacementNamed(context, '/login');
  } else if (data['type'] == 'document_rejected') {
    Navigator.pushNamed(context, '/upload-documents');
  }
});
```

---

---

# 🚚 Solicitações de Entrega

## GET /api/v1/driver/pending-requests - Listar Solicitações Pendentes

Lista todas as solicitações de entrega que o motorista recebeu e ainda estão aguardando resposta.

**Auth:** Requer sessão de motorista

### Response

```json
{
  "success": true,
  "data": [
    {
      "notificationId": "uuid-notificacao",
      "requestId": "uuid-solicitacao",
      "requestNumber": "REQ-1699999999999",
      "companyName": "Empresa XYZ Ltda",
      "customerName": "João Silva",
      "pickupAddress": "Rua A, 123, Centro",
      "pickupLat": -23.550520,
      "pickupLng": -46.633308,
      "deliveryAddress": "Rua B, 456, Vila Nova",
      "deliveryLat": -23.563210,
      "deliveryLng": -46.654250,
      "distance": "5.20",
      "estimatedTime": "8",
      "driverAmount": "14.80",
      "notes": "Frágil",
      "expiresAt": "2025-11-06T20:45:30.000Z",
      "status": "notified"
    }
  ]
}
```

### Campos

- **notificationId**: ID da notificação (para tracking interno)
- **requestId**: ID da solicitação (usar nos endpoints de aceitar/rejeitar)
- **requestNumber**: Número legível da solicitação (ex: REQ-001)
- **companyName**: Nome da empresa solicitante
- **customerName**: Nome do cliente final (pode ser null)
- **pickupAddress**: Endereço de retirada completo
- **pickupLat/pickupLng**: Coordenadas de retirada
- **deliveryAddress**: Endereço de entrega completo
- **deliveryLat/deliveryLng**: Coordenadas de entrega
- **distance**: Distância em km (string formatada com 2 casas decimais)
- **estimatedTime**: Tempo estimado em minutos (string)
- **driverAmount**: Valor que o motorista receberá (já com desconto da comissão)
- **notes**: Observações da entrega (pode ser null)
- **expiresAt**: Data/hora de expiração da notificação (ISO 8601)
- **status**: Status da notificação (sempre "notified" nesta lista)

### Exemplo Flutter

```dart
Future<List<DeliveryRequest>> fetchPendingRequests() async {
  try {
    final response = await dio.get('/api/v1/driver/pending-requests');

    if (response.data['success']) {
      final List<dynamic> data = response.data['data'];
      return data.map((json) => DeliveryRequest.fromJson(json)).toList();
    }

    return [];
  } catch (e) {
    print('Erro ao buscar solicitações: $e');
    return [];
  }
}

class DeliveryRequest {
  final String notificationId;
  final String requestId;
  final String requestNumber;
  final String companyName;
  final String? customerName;
  final String pickupAddress;
  final double pickupLat;
  final double pickupLng;
  final String deliveryAddress;
  final double deliveryLat;
  final double deliveryLng;
  final String distance;
  final String estimatedTime;
  final String driverAmount;
  final String? notes;
  final DateTime expiresAt;
  final String status;

  DeliveryRequest.fromJson(Map<String, dynamic> json)
      : notificationId = json['notificationId'],
        requestId = json['requestId'],
        requestNumber = json['requestNumber'],
        companyName = json['companyName'],
        customerName = json['customerName'],
        pickupAddress = json['pickupAddress'],
        pickupLat = json['pickupLat'],
        pickupLng = json['pickupLng'],
        deliveryAddress = json['deliveryAddress'],
        deliveryLat = json['deliveryLat'],
        deliveryLng = json['deliveryLng'],
        distance = json['distance'],
        estimatedTime = json['estimatedTime'],
        driverAmount = json['driverAmount'],
        notes = json['notes'],
        expiresAt = DateTime.parse(json['expiresAt']),
        status = json['status'];
}
```

---

## POST /api/v1/driver/requests/:id/accept - Aceitar Solicitação

Aceita uma solicitação de entrega. Apenas um motorista pode aceitar cada solicitação.

**Auth:** Requer sessão de motorista

### URL Parameters

- **id**: ID da solicitação (requestId recebido na notificação push ou no endpoint pending-requests)

### Response (Sucesso)

```json
{
  "success": true,
  "message": "Entrega aceita com sucesso!",
  "data": {
    "requestId": "uuid-solicitacao",
    "requestNumber": "REQ-1699999999999",
    "pickupAddress": "Rua A, 123, Centro",
    "pickupLat": -23.550520,
    "pickupLng": -46.633308,
    "deliveryAddress": "Rua B, 456, Vila Nova",
    "deliveryLat": -23.563210,
    "deliveryLng": -46.654250,
    "distance": "5.20",
    "estimatedTime": "8",
    "driverAmount": "14.80"
  }
}
```

### Response (Erro - Já aceita)

```json
{
  "message": "Esta solicitação já foi aceita por outro motorista"
}
```
**Status:** 409 Conflict

### Response (Erro - Expirada)

```json
{
  "message": "Esta solicitação expirou"
}
```
**Status:** 410 Gone

### Exemplo Flutter

```dart
Future<void> acceptRequest(String requestId) async {
  try {
    final response = await dio.post('/api/v1/driver/requests/$requestId/accept');

    if (response.data['success']) {
      final data = response.data['data'];

      // Mostrar opções de navegação
      showNavigationDialog(
        pickupLat: data['pickupLat'],
        pickupLng: data['pickupLng'],
      );
    }
  } on DioException catch (e) {
    if (e.response?.statusCode == 409) {
      showSnackbar('Esta entrega já foi aceita por outro motorista');
    } else if (e.response?.statusCode == 410) {
      showSnackbar('Esta solicitação expirou');
    } else {
      showSnackbar('Erro ao aceitar entrega');
    }
  }
}

void showNavigationDialog({required double pickupLat, required double pickupLng}) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Traçar Rota'),
      content: Text('Escolha o aplicativo de navegação:'),
      actions: [
        TextButton(
          onPressed: () {
            final url = 'https://www.google.com/maps/dir/?api=1&destination=$pickupLat,$pickupLng';
            launchUrl(Uri.parse(url));
            Navigator.pop(context);
          },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.map),
              SizedBox(width: 8),
              Text('Google Maps'),
            ],
          ),
        ),
        TextButton(
          onPressed: () {
            final url = 'https://waze.com/ul?ll=$pickupLat,$pickupLng&navigate=yes';
            launchUrl(Uri.parse(url));
            Navigator.pop(context);
          },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset('assets/waze.png', width: 24),
              SizedBox(width: 8),
              Text('Waze'),
            ],
          ),
        ),
      ],
    ),
  );
}
```

### Comportamento do Sistema

Quando um motorista aceita uma solicitação:

1. A solicitação é associada ao motorista (`requests.driverId` é atualizado)
2. A notificação do motorista é marcada como "accepted"
3. Todas as outras notificações da mesma solicitação são marcadas como "expired"
4. Os outros motoristas recebem uma notificação push informando que a entrega foi aceita

**Push para outros motoristas:**
```json
{
  "type": "delivery_taken",
  "requestId": "uuid-solicitacao"
}
```
**Título:** "Entrega Aceita"
**Mensagem:** "Esta entrega foi aceita por outro motorista"

---

## POST /api/v1/driver/requests/:id/reject - Rejeitar Solicitação

Rejeita uma solicitação de entrega. O motorista deixa de receber notificações desta solicitação.

**Auth:** Requer sessão de motorista

### URL Parameters

- **id**: ID da solicitação (requestId recebido na notificação push ou no endpoint pending-requests)

### Response (Sucesso)

```json
{
  "success": true,
  "message": "Solicitação rejeitada"
}
```

### Response (Erro - Já respondida)

```json
{
  "message": "Esta notificação já foi respondida"
}
```
**Status:** 409 Conflict

### Exemplo Flutter

```dart
Future<void> rejectRequest(String requestId) async {
  try {
    final response = await dio.post('/api/v1/driver/requests/$requestId/reject');

    if (response.data['success']) {
      showSnackbar('Solicitação rejeitada');
      // Fechar modal e remover da lista
    }
  } on DioException catch (e) {
    if (e.response?.statusCode == 409) {
      showSnackbar('Esta notificação já foi respondida');
    } else {
      showSnackbar('Erro ao rejeitar entrega');
    }
  }
}
```

### Comportamento do Sistema

Quando um motorista rejeita uma solicitação:

1. A notificação do motorista é marcada como "rejected"
2. O motorista não recebe mais notificações sobre esta solicitação
3. Outros motoristas continuam recebendo notificações normalmente

---

## Notas Importantes

1. **Cookies**: Certifique-se de que o Dio está configurado para manter cookies de sessão
2. **HTTPS**: Em produção, sempre use HTTPS
3. **Timeout**: Configure timeouts adequados (30s para requisições normais)
4. **Retry**: Implemente retry logic para falhas de rede
5. **Localização**: Sempre pedir permissão antes de acessar GPS
6. **Background**: Considerar usar background services para atualização de localização
7. **Bateria**: Use `LocationAccuracy.balanced` para economizar bateria em produção
8. **Raio de pesquisa**: Motoristas só recebem notificações dentro do raio configurado
9. **Timeout de aceitação**: Dialog fecha automaticamente após o tempo configurado
10. **Logs**: Sempre monitore os logs para debugar problemas

---

## 📞 Suporte

Para dúvidas ou problemas:
- Consulte a seção de **Troubleshooting** acima
- Verifique os **logs** do app e do servidor
- Revise o **checklist de configuração**
- Consulte `SISTEMA_NOTIFICACOES_ENTREGAS.md` para detalhes do sistema de notificações

---

## 📝 Changelog - Novembro 2025

### ⚠️ BREAKING CHANGES - 06/11/2025

#### 1. 🔑 Mudança de Autenticação: Cookies → Bearer Token

**Antes:** Sessões baseadas em cookies
```dart
// ❌ Não funciona mais
final cookieJar = CookieJar();
dio.interceptors.add(CookieManager(cookieJar));
```

**Agora:** Autenticação via Bearer Token
```dart
// ✅ Implementação atual
dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) async {
    final token = await storage.read(key: 'access_token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    return handler.next(options);
  },
));
```

**Por quê?** Apps mobile não mantêm cookies automaticamente como navegadores web. Bearer tokens são mais adequados para aplicações mobile.

---

#### 2. 📧 Login agora usa EMAIL em vez de MOBILE

**Antes:**
```json
POST /api/v1/driver/login
{
  "mobile": "11999999999",
  "password": "senha123"
}
```

**Agora:**
```json
POST /api/v1/driver/login
{
  "email": "motorista@email.com",
  "password": "senha123"
}
```

**Impacto:** Todas as telas de login no app Flutter devem ser atualizadas para usar campo de email.

---

#### 3. 🆕 Novo Endpoint: Validação de Email

Adicionado endpoint para validar email antes do login (fluxo de 2 etapas):

```
POST /api/v1/driver/validate-mobile-for-login
Body: { "email": "motorista@email.com" }
```

**Uso recomendado:**
1. Usuário digita email
2. App chama `validate-mobile-for-login`
3. Se válido, mostrar campo de senha
4. Usuário digita senha
5. App chama `login`

---

#### 4. 🎫 Login agora retorna `accessToken`

**Response do login:**
```json
{
  "success": true,
  "accessToken": "eyJpZCI6Ii4uLiJ9",  ← NOVO CAMPO
  "data": { ... }
}
```

**Ação necessária:** Salvar o token após login:
```dart
final token = response.data['accessToken'];
await storage.write(key: 'access_token', value: token);
```

---

#### 5. 🔐 GET /api/v1/driver aceita Bearer Token

**Antes:** Usava cookie de sessão automaticamente

**Agora:** Requer header `Authorization: Bearer <token>`

```dart
// Com interceptor configurado, não precisa fazer nada
final response = await dio.get('/api/v1/driver');

// Sem interceptor, passar manualmente
final response = await dio.get(
  '/api/v1/driver',
  options: Options(headers: {
    'Authorization': 'Bearer $token',
  }),
);
```

---

#### 6. 🌐 URL Base atualizada

**Antes:** `http://localhost:5000`

**Agora:** `http://192.168.3.3:5010` (rede local)

---

### 📋 Checklist de Migração para Apps Existentes

Se você já tem um app Flutter conectado à API antiga, siga estes passos:

- [ ] **Remover** `cookie_jar` e `dio_cookie_manager` do pubspec.yaml
- [ ] **Adicionar** `flutter_secure_storage` ao pubspec.yaml
- [ ] **Configurar** interceptor do Dio para adicionar Bearer token
- [ ] **Atualizar** URL base de `localhost:5000` para `192.168.3.3:5010`
- [ ] **Mudar** campo de login de `mobile` para `email`
- [ ] **Implementar** validação de email antes do login (opcional mas recomendado)
- [ ] **Salvar** `accessToken` após login bem-sucedido
- [ ] **Remover** token ao fazer logout
- [ ] **Testar** fluxo completo: validar email → login → buscar perfil → logout

---

### 🛠️ Código de Migração Completo

```dart
// 1. Adicionar ao pubspec.yaml
dependencies:
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0

// 2. Configurar Dio e Storage
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  static final dio = Dio(BaseOptions(
    baseUrl: 'http://192.168.3.3:5010',
    connectTimeout: Duration(seconds: 30),
    receiveTimeout: Duration(seconds: 30),
  ));

  static final storage = FlutterSecureStorage();

  static void initialize() {
    // Interceptor para adicionar token automaticamente
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Token expirou, limpar e redirecionar
          await storage.delete(key: 'access_token');
          // navigatorKey.currentState?.pushReplacementNamed('/login');
        }
        return handler.next(error);
      },
    ));
  }
}

// 3. Atualizar função de login
Future<bool> login(String email, String password) async {
  try {
    final response = await ApiClient.dio.post(
      '/api/v1/driver/login',
      data: {
        'email': email,        // ← Mudou de 'mobile'
        'password': password,
      },
    );

    if (response.data['success']) {
      // Salvar token
      final token = response.data['accessToken'];
      await ApiClient.storage.write(key: 'access_token', value: token);

      return true;
    }
  } catch (e) {
    print('Erro no login: $e');
  }
  return false;
}

// 4. Atualizar função de logout
Future<void> logout() async {
  await ApiClient.storage.delete(key: 'access_token');
  // Navegar para tela de login
}

// 5. Usar em qualquer endpoint
Future<Map<String, dynamic>?> getProfile() async {
  try {
    final response = await ApiClient.dio.get('/api/v1/driver');
    // Token é adicionado automaticamente pelo interceptor
    return response.data['data'];
  } catch (e) {
    print('Erro: $e');
    return null;
  }
}
```

---

### 🧪 Testando as Mudanças

**Teste 1: Validar Email**
```bash
curl -X POST http://192.168.3.3:5010/api/v1/driver/validate-mobile-for-login \
  -H "Content-Type: application/json" \
  -d '{"email":"ze1@gmail.com"}'

# Esperado: 200 OK com dados do motorista
```

**Teste 2: Login com Email**
```bash
curl -X POST http://192.168.3.3:5010/api/v1/driver/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ze1@gmail.com","password":"12345678"}'

# Esperado: 200 OK com accessToken
```

**Teste 3: Buscar Perfil com Token**
```bash
curl -X GET http://192.168.3.3:5010/api/v1/driver \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Esperado: 200 OK com dados completos do motorista
```

---

### ⚡ Melhorias de Performance

1. **Tokens são mais leves** que cookies de sessão
2. **Sem necessidade de gerenciar cookies** no cliente
3. **Melhor suporte para apps mobile** nativos
4. **Stateless** - servidor não precisa manter sessões

---

### 🔒 Segurança

- Tokens são codificados em Base64 (não criptografados)
- Em produção, considere usar JWT com assinatura
- Sempre use HTTPS em produção
- Tokens não expiram automaticamente (implementar expiração futura)

---

### 📞 Suporte

Se encontrar problemas após a migração:
1. Verifique se está usando a URL correta (`192.168.3.3:5010`)
2. Confirme que o token está sendo salvo após login
3. Verifique se o interceptor está configurado corretamente
4. Teste os endpoints via Postman primeiro
5. Revise os logs do servidor e do app

---

**Data da última atualização:** 06/11/2025
**Versão da API:** 2.0
**Breaking Changes:** Sim
