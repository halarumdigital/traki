# Módulo de Entregas Intermunicipais - Especificação Técnica

## 📋 Visão Geral

Sistema de entregas intermunicipais que permite empresas agendarem entregas entre cidades e entregadores escolherem rotas para realizar coletas e entregas agendadas.

**Características principais:**
- Rotas pré-definidas pela plataforma
- Agendamento de entregas por empresas
- Múltiplas coletas e entregas por viagem
- Precificação automática baseada em distância e paradas
- Sistema de notificações em tempo real

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `rotas_intermunicipais`
Armazena as rotas pré-cadastradas pela plataforma.

```sql
CREATE TABLE rotas_intermunicipais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_rota VARCHAR(255) NOT NULL, -- Ex: "Lages → Florianópolis"
  cidade_origem_id UUID NOT NULL REFERENCES cidades(id),
  cidade_destino_id UUID NOT NULL REFERENCES cidades(id),
  estado VARCHAR(2) NOT NULL,
  distancia_km DECIMAL(10,2) NOT NULL,
  tempo_medio_minutos INTEGER NOT NULL,
  valor_base DECIMAL(10,2) NOT NULL, -- Valor mínimo da rota
  valor_por_km DECIMAL(10,2) NOT NULL,
  valor_por_parada DECIMAL(10,2) NOT NULL,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para otimização
CREATE INDEX idx_rotas_origem ON rotas_intermunicipais(cidade_origem_id);
CREATE INDEX idx_rotas_destino ON rotas_intermunicipais(cidade_destino_id);
CREATE INDEX idx_rotas_estado ON rotas_intermunicipais(estado);
CREATE INDEX idx_rotas_ativas ON rotas_intermunicipais(ativa);
```

### Tabela: `entregador_rotas`
Relaciona quais rotas cada entregador realiza e sua disponibilidade.

```sql
CREATE TABLE entregador_rotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entregador_id UUID NOT NULL REFERENCES users(id),
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id),
  dias_semana INTEGER[] NOT NULL, -- [1,2,3,4,5] = Seg a Sex
  horario_saida TIME,
  horario_chegada TIME,
  capacidade_pacotes INTEGER DEFAULT 50,
  capacidade_peso_kg DECIMAL(10,2) DEFAULT 100,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entregador_id, rota_id)
);

CREATE INDEX idx_entregador_rotas_entregador ON entregador_rotas(entregador_id);
CREATE INDEX idx_entregador_rotas_rota ON entregador_rotas(rota_id);
CREATE INDEX idx_entregador_rotas_ativas ON entregador_rotas(ativa);
```

### Tabela: `entregas_intermunicipais`
Entregas agendadas pelas empresas.

```sql
CREATE TABLE entregas_intermunicipais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_rastreio VARCHAR(50) UNIQUE NOT NULL,
  empresa_id UUID NOT NULL REFERENCES users(id),
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id),
  entregador_id UUID REFERENCES users(id), -- Null até aceite
  viagem_id UUID REFERENCES viagens_intermunicipais(id),
  
  -- Dados de coleta
  endereco_coleta_id UUID NOT NULL REFERENCES enderecos(id),
  data_coleta_agendada DATE NOT NULL,
  horario_coleta_inicio TIME NOT NULL,
  horario_coleta_fim TIME NOT NULL,
  data_coleta_realizada TIMESTAMP,
  
  -- Dados de entrega
  endereco_entrega_id UUID NOT NULL REFERENCES enderecos(id),
  destinatario_nome VARCHAR(255) NOT NULL,
  destinatario_telefone VARCHAR(20) NOT NULL,
  data_entrega_prevista DATE NOT NULL,
  data_entrega_realizada TIMESTAMP,
  
  -- Dados da carga
  quantidade_pacotes INTEGER DEFAULT 1,
  peso_kg DECIMAL(10,2),
  volume_m3 DECIMAL(10,3),
  descricao_carga TEXT,
  valor_mercadoria DECIMAL(10,2),
  
  -- Financeiro
  valor_frete DECIMAL(10,2) NOT NULL,
  taxa_plataforma DECIMAL(10,2) NOT NULL,
  valor_entregador DECIMAL(10,2) NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'aguardando_entregador',
  -- Valores possíveis:
  -- 'aguardando_entregador' - Aguardando aceite
  -- 'aceita' - Aceita por entregador
  -- 'em_coleta' - Entregador a caminho da coleta
  -- 'coletada' - Coletada, em trânsito
  -- 'em_entrega' - A caminho da entrega
  -- 'entregue' - Entrega concluída
  -- 'cancelada' - Cancelada
  -- 'problema' - Problema na entrega
  
  observacoes TEXT,
  foto_coleta TEXT, -- URL da foto
  assinatura_coleta TEXT, -- Base64 ou URL
  foto_entrega TEXT,
  assinatura_entrega TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entregas_inter_empresa ON entregas_intermunicipais(empresa_id);
CREATE INDEX idx_entregas_inter_entregador ON entregas_intermunicipais(entregador_id);
CREATE INDEX idx_entregas_inter_rota ON entregas_intermunicipais(rota_id);
CREATE INDEX idx_entregas_inter_status ON entregas_intermunicipais(status);
CREATE INDEX idx_entregas_inter_data_coleta ON entregas_intermunicipais(data_coleta_agendada);
CREATE INDEX idx_entregas_inter_viagem ON entregas_intermunicipais(viagem_id);
```

### Tabela: `viagens_intermunicipais`
Agrupa entregas em uma viagem do entregador.

```sql
CREATE TABLE viagens_intermunicipais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_viagem VARCHAR(50) UNIQUE NOT NULL,
  entregador_id UUID NOT NULL REFERENCES users(id),
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id),
  
  data_viagem DATE NOT NULL,
  horario_saida_previsto TIME NOT NULL,
  horario_chegada_previsto TIME NOT NULL,
  
  horario_saida_real TIMESTAMP,
  horario_chegada_real TIMESTAMP,
  
  total_coletas INTEGER DEFAULT 0,
  total_entregas INTEGER DEFAULT 0,
  total_km DECIMAL(10,2),
  
  valor_total DECIMAL(10,2) DEFAULT 0,
  
  status VARCHAR(50) NOT NULL DEFAULT 'planejada',
  -- Valores: 'planejada', 'em_andamento', 'concluida', 'cancelada'
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_viagens_entregador ON viagens_intermunicipais(entregador_id);
CREATE INDEX idx_viagens_rota ON viagens_intermunicipais(rota_id);
CREATE INDEX idx_viagens_data ON viagens_intermunicipais(data_viagem);
CREATE INDEX idx_viagens_status ON viagens_intermunicipais(status);
```

### Tabela: `cidades`
Cadastro de cidades (se ainda não existir).

```sql
CREATE TABLE cidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  estado VARCHAR(2) NOT NULL,
  ibge_code VARCHAR(7) UNIQUE,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cidades_estado ON cidades(estado);
CREATE INDEX idx_cidades_nome ON cidades(nome);
```

---

## 🔄 Fluxos de Trabalho

### 1. Cadastro de Rota (Admin/Plataforma)

```
1. Admin acessa painel de rotas
2. Seleciona cidade origem e destino
3. Sistema calcula distância via Google Maps API
4. Sistema calcula tempo médio estimado
5. Admin define precificação:
   - Valor base
   - Valor por km
   - Valor por parada adicional
6. Sistema salva rota na tabela rotas_intermunicipais
```

**Endpoint:** `POST /api/admin/rotas-intermunicipais`

```json
{
  "cidade_origem_id": "uuid",
  "cidade_destino_id": "uuid",
  "valor_base": 5.00,
  "valor_por_km": 1.50,
  "valor_por_parada": 3.00
}
```

### 2. Entregador Seleciona Rotas

```
1. Entregador acessa "Rotas Intermunicipais" no app
2. Lista todas as rotas disponíveis filtradas por:
   - Estado
   - Distância
   - Cidade origem/destino
3. Seleciona rota(s) de interesse
4. Define disponibilidade:
   - Dias da semana [1-7]
   - Horário de saída
   - Capacidade de carga
5. Sistema salva em entregador_rotas
6. Entregador recebe notificações quando há entregas disponíveis
```

**Endpoint:** `POST /api/entregador/rotas`

```json
{
  "rota_id": "uuid",
  "dias_semana": [1, 2, 3, 4, 5],
  "horario_saida": "08:00",
  "horario_chegada": "12:00",
  "capacidade_pacotes": 50,
  "capacidade_peso_kg": 100
}
```

### 3. Empresa Agenda Entrega

```
1. Empresa acessa "Entregas Intermunicipais"
2. Preenche formulário:
   - Cidade origem/destino
   - Data e horário de coleta
   - Endereço de coleta
   - Endereço de entrega
   - Dados do destinatário
   - Descrição da carga
   - Peso, volume, quantidade
3. Sistema busca rotas disponíveis
4. Sistema calcula preço:
   preço_total = valor_base + (distancia_km * valor_por_km) + (paradas_adicionais * valor_por_parada)
5. Empresa confirma
6. Sistema cria entrega com status 'aguardando_entregador'
7. Sistema notifica entregadores disponíveis naquela rota
```

**Endpoint:** `POST /api/empresa/entregas-intermunicipais`

```json
{
  "cidade_origem_id": "uuid",
  "cidade_destino_id": "uuid",
  "data_coleta_agendada": "2025-11-20",
  "horario_coleta_inicio": "08:00",
  "horario_coleta_fim": "10:00",
  "endereco_coleta_id": "uuid",
  "endereco_entrega": {
    "rua": "Rua Exemplo",
    "numero": "123",
    "bairro": "Centro",
    "cidade": "Florianópolis",
    "estado": "SC",
    "cep": "88000-000",
    "complemento": "Sala 10",
    "referencia": "Próximo ao supermercado"
  },
  "destinatario_nome": "João Silva",
  "destinatario_telefone": "(48) 99999-9999",
  "quantidade_pacotes": 2,
  "peso_kg": 5.5,
  "volume_m3": 0.05,
  "descricao_carga": "Documentos e amostras",
  "valor_mercadoria": 500.00
}
```

### 4. Entregador Aceita Entregas

```
1. Entregador recebe notificação de entregas disponíveis
2. Acessa lista de entregas pendentes na rota
3. Visualiza detalhes:
   - Pontos de coleta
   - Pontos de entrega
   - Valor que irá receber
   - Data/horário
4. Aceita entregas (múltiplas de uma vez)
5. Sistema cria ou atualiza viagem_intermunicipal
6. Sistema atualiza status das entregas para 'aceita'
7. Sistema atualiza entregador_id nas entregas
```

**Endpoint:** `POST /api/entregador/entregas-intermunicipais/aceitar`

```json
{
  "entrega_ids": ["uuid1", "uuid2", "uuid3"],
  "data_viagem": "2025-11-20"
}
```

### 5. Execução da Viagem

```
1. No dia da viagem, entregador acessa "Minhas Viagens"
2. Seleciona viagem do dia
3. Visualiza mapa com todos os pontos:
   - Pontos de coleta (marcadores vermelhos)
   - Pontos de entrega (marcadores verdes)
4. Clica em "Iniciar Viagem"
5. Sistema atualiza status da viagem para 'em_andamento'
6. Para cada coleta:
   - Navega até o ponto (Google Maps)
   - Marca como "Chegou no local"
   - Tira foto do pacote
   - Coleta assinatura
   - Confirma coleta
   - Status da entrega muda para 'coletada'
7. Após todas as coletas, inicia entregas
8. Para cada entrega:
   - Navega até destino
   - Tira foto da entrega
   - Coleta assinatura do destinatário
   - Confirma entrega
   - Status muda para 'entregue'
9. Ao finalizar, marca viagem como 'concluida'
```

**Endpoints:**

```
POST /api/entregador/viagens/{viagem_id}/iniciar
POST /api/entregador/entregas/{entrega_id}/coletar
POST /api/entregador/entregas/{entrega_id}/entregar
POST /api/entregador/viagens/{viagem_id}/concluir
```

---

## 💰 Cálculo de Precificação

### Fórmula Base

```javascript
// Parâmetros da plataforma
const VALOR_BASE_SAIDA = 5.00;
const TAXA_PLATAFORMA_PERCENTUAL = 0.20; // 20%

// Dados da rota
const valorPorKm = rota.valor_por_km;
const distanciaKm = rota.distancia_km;
const valorPorParada = rota.valor_por_parada;

// Cálculo
const valorDistancia = distanciaKm * valorPorKm;
const numeroParadasAdicionais = totalColetas + totalEntregas - 2; // -2 pois origem e destino já estão incluídos
const valorParadas = Math.max(0, numeroParadasAdicionais) * valorPorParada;

const valorTotal = VALOR_BASE_SAIDA + valorDistancia + valorParadas;
const taxaPlataforma = valorTotal * TAXA_PLATAFORMA_PERCENTUAL;
const valorEntregador = valorTotal - taxaPlataforma;
```

### Exemplo Prático

```
Rota: Lages → Florianópolis
Distância: 180 km
Valor por km: R$ 1,50
Valor por parada: R$ 3,00

Cenário: 3 coletas em Lages + 3 entregas em Florianópolis

Cálculo:
- Valor base: R$ 5,00
- Valor distância: 180 km × R$ 1,50 = R$ 270,00
- Paradas adicionais: (3 + 3 - 2) = 4 paradas
- Valor paradas: 4 × R$ 3,00 = R$ 12,00

Valor total: R$ 5,00 + R$ 270,00 + R$ 12,00 = R$ 287,00
Taxa plataforma (20%): R$ 57,40
Valor entregador: R$ 229,60
```

---

## 🔔 Sistema de Notificações

### Eventos que Geram Notificações

1. **Para Entregador:**
   - Nova entrega disponível na rota
   - Entrega cancelada pela empresa
   - Lembrete 1 hora antes da viagem
   - Destinatário não encontrado (sugestão do sistema)

2. **Para Empresa:**
   - Entrega aceita por entregador
   - Coleta realizada
   - Entrega concluída
   - Problema na entrega

3. **Para Destinatário (Opcional):**
   - Entrega saiu para destino
   - Entregador a caminho
   - Entrega realizada

### Implementação

```javascript
// Exemplo de payload de notificação
{
  "user_id": "uuid",
  "title": "Nova entrega disponível",
  "body": "Lages → Florianópolis - R$ 229,60",
  "data": {
    "type": "nova_entrega_intermunicipal",
    "entrega_id": "uuid",
    "rota_id": "uuid"
  }
}
```

---

## 📱 Telas do Aplicativo (Entregador)

### 1. Tela: Minhas Rotas
- Lista de rotas que o entregador marcou
- Toggle para ativar/desativar rota
- Badge com número de entregas pendentes
- Botão "Adicionar Nova Rota"

### 2. Tela: Selecionar Rotas
- Busca por cidade origem/destino
- Filtros: Estado, Distância
- Card de cada rota mostrando:
  - Origem → Destino
  - Distância e tempo médio
  - Valor estimado por viagem
- Botão "Selecionar Rota"

### 3. Tela: Configurar Disponibilidade
- Seleção de dias da semana (checkboxes)
- Horário de saída
- Horário de chegada estimado
- Capacidade de carga

### 4. Tela: Entregas Disponíveis
- Lista de entregas aguardando aceite
- Filtro por rota
- Card mostrando:
  - Data de coleta
  - Pontos de coleta/entrega
  - Valor que irá receber
  - Botão "Ver Detalhes"
- Seleção múltipla
- Botão "Aceitar Selecionadas"

### 5. Tela: Minhas Viagens
- Abas: Hoje | Próximas | Concluídas
- Card de cada viagem:
  - Data e horário
  - Rota
  - Número de coletas/entregas
  - Valor total
  - Status
  - Botão "Ver Detalhes" ou "Iniciar Viagem"

### 6. Tela: Detalhes da Viagem
- Mapa com todos os pontos
- Lista de coletas (expandível)
- Lista de entregas (expandível)
- Resumo financeiro
- Botão "Iniciar Viagem"

### 7. Tela: Execução da Viagem
- Mapa em tela cheia
- Card inferior com próximo ponto
- Botões de ação por etapa:
  - "Navegar até o local"
  - "Chegou no local"
  - "Confirmar Coleta/Entrega"

### 8. Tela: Confirmar Coleta
- Dados do remetente
- Descrição da carga
- Tirar foto do pacote
- Capturar assinatura
- Campo de observações
- Botão "Confirmar Coleta"

### 9. Tela: Confirmar Entrega
- Dados do destinatário
- Tirar foto da entrega
- Capturar assinatura
- Campo de observações
- Botão "Confirmar Entrega"
- Botão "Problema na Entrega"

---

## 🖥️ Telas do Painel (Empresa)

### 1. Tela: Entregas Intermunicipais
- Abas: Agendar | Minhas Entregas | Histórico
- Botão "Nova Entrega Intermunicipal"

### 2. Tela: Nova Entrega Intermunicipal

**Passo 1: Rota e Data**
- Cidade de origem (dropdown)
- Cidade de destino (dropdown)
- Sistema exibe rotas disponíveis
- Data de coleta (date picker)
- Horário de coleta (time range)

**Passo 2: Endereços**
- Endereço de coleta (ou selecionar salvo)
- Endereço de entrega (ou cadastrar novo)
- Dados do destinatário

**Passo 3: Carga**
- Quantidade de pacotes
- Peso total
- Volume
- Descrição da carga
- Valor da mercadoria (para seguro)

**Passo 4: Confirmação**
- Resumo completo
- Cálculo de preço detalhado:
  - Valor base
  - Valor por distância
  - Valor por paradas adicionais
  - Taxa da plataforma
  - **Total a pagar**
- Botão "Confirmar e Pagar"

### 3. Tela: Minhas Entregas
- Filtros: Status, Data, Rota
- Tabela/cards com:
  - Código de rastreio
  - Origem → Destino
  - Data
  - Status
  - Entregador (se aceita)
  - Ações: Ver detalhes, Cancelar, Rastrear

### 4. Tela: Detalhes da Entrega
- Timeline de status
- Dados completos da entrega
- Informações do entregador (se aceita)
- Botão de rastreamento em tempo real
- Comprovantes (fotos e assinaturas)

---

## 🔌 APIs Principais

### Rotas (Admin/Plataforma)

```
GET    /api/admin/rotas-intermunicipais
POST   /api/admin/rotas-intermunicipais
PUT    /api/admin/rotas-intermunicipais/:id
DELETE /api/admin/rotas-intermunicipais/:id
GET    /api/admin/rotas-intermunicipais/:id/estatisticas
```

### Rotas (Entregador)

```
GET  /api/entregador/rotas-disponiveis
GET  /api/entregador/minhas-rotas
POST /api/entregador/rotas
PUT  /api/entregador/rotas/:id
DELETE /api/entregador/rotas/:id
```

### Entregas (Empresa)

```
GET  /api/empresa/entregas-intermunicipais
POST /api/empresa/entregas-intermunicipais
GET  /api/empresa/entregas-intermunicipais/:id
PUT  /api/empresa/entregas-intermunicipais/:id
DELETE /api/empresa/entregas-intermunicipais/:id (cancelar)
GET  /api/empresa/entregas-intermunicipais/:id/rastreamento
GET  /api/empresa/rotas-disponiveis (para buscar ao agendar)
POST /api/empresa/calcular-frete (para preview do preço)
```

### Entregas (Entregador)

```
GET  /api/entregador/entregas-disponiveis
POST /api/entregador/entregas-intermunicipais/aceitar
GET  /api/entregador/minhas-entregas
GET  /api/entregador/entregas-intermunicipais/:id
```

### Viagens (Entregador)

```
GET  /api/entregador/viagens
GET  /api/entregador/viagens/:id
POST /api/entregador/viagens/:id/iniciar
POST /api/entregador/viagens/:id/concluir
GET  /api/entregador/viagens/:id/rota-otimizada (Google Maps)
```

### Ações de Coleta/Entrega

```
POST /api/entregador/entregas/:id/iniciar-coleta
POST /api/entregador/entregas/:id/confirmar-coleta
POST /api/entregador/entregas/:id/iniciar-entrega
POST /api/entregador/entregas/:id/confirmar-entrega
POST /api/entregador/entregas/:id/reportar-problema
```

---

## 🗺️ Integração Google Maps

### APIs Necessárias

1. **Distance Matrix API**
   - Calcular distância e tempo entre cidades
   - Usado no cadastro de rotas

2. **Directions API**
   - Roteirização de múltiplas paradas
   - Otimizar ordem de coletas/entregas

3. **Maps SDK (Mobile)**
   - Exibir mapa no app
   - Mostrar marcadores de coleta/entrega
   - Navegação turn-by-turn

### Exemplo de Uso

```javascript
// Calcular distância entre cidades (backend)
const distanceMatrix = await googleMaps.distanceMatrix({
  origins: ['Lages, SC, Brazil'],
  destinations: ['Florianópolis, SC, Brazil'],
  mode: 'driving',
  language: 'pt-BR'
});

const distanciaKm = distanceMatrix.rows[0].elements[0].distance.value / 1000;
const tempoMinutos = distanceMatrix.rows[0].elements[0].duration.value / 60;

// Otimizar rota de múltiplas paradas (backend)
const waypoints = coletas.map(c => ({
  location: `${c.endereco.latitude},${c.endereco.longitude}`,
  stopover: true
}));

const directions = await googleMaps.directions({
  origin: cidadeOrigem,
  destination: cidadeDestino,
  waypoints: waypoints,
  optimize: true, // Otimiza ordem das paradas
  mode: 'driving'
});
```

---

## 📊 Relatórios e Dashboards

### Dashboard Admin

1. **Visão Geral**
   - Total de rotas ativas
   - Total de entregas pendentes
   - Total de entregadores ativos
   - Receita do período

2. **Rotas Mais Usadas**
   - Ranking de rotas por volume
   - Gráfico de entregas por rota

3. **Desempenho de Entregadores**
   - Entregas concluídas
   - Taxa de sucesso
   - Avaliação média

### Dashboard Empresa

1. **Minhas Entregas**
   - Pendentes
   - Em trânsito
   - Concluídas
   - Gastos do mês

2. **Histórico**
   - Filtros por período, rota, status
   - Exportar relatório (CSV, PDF)

### Dashboard Entregador

1. **Meus Ganhos**
   - Ganhos do dia/semana/mês
   - Entregas realizadas
   - Média por entrega

2. **Minhas Estatísticas**
   - Total de km rodados
   - Viagens concluídas
   - Avaliação média

---

## 🔐 Regras de Negócio

### Validações

1. **Entrega:**
   - Data de coleta deve ser futura
   - Horário de coleta deve estar no intervalo de operação
   - Peso não pode exceder capacidade da rota
   - Endereços devem estar nas cidades correspondentes

2. **Entregador:**
   - Só pode aceitar entregas de rotas que selecionou
   - Não pode exceder capacidade de carga na viagem
   - Precisa ter documentos e veículo aprovados

3. **Viagem:**
   - Não pode iniciar antes do horário previsto (com tolerância)
   - Coletas devem ser feitas antes das entregas
   - Todas as coletas devem ser confirmadas antes de finalizar

### Cancelamentos

1. **Empresa pode cancelar:**
   - Até 24h antes: sem custo
   - Entre 24h e 6h: taxa de 50%
   - Menos de 6h: taxa de 100%

2. **Entregador pode recusar:**
   - Antes de aceitar: sem penalidade
   - Após aceitar: penalidade e impacto na reputação

### Problemas na Entrega

1. **Destinatário ausente:**
   - Entregador tenta contato
   - Aguarda 15 minutos
   - Foto do local como comprovante
   - Retorna mercadoria ou deixa em ponto de apoio

2. **Recusa no recebimento:**
   - Registrar motivo
   - Foto e assinatura de recusa
   - Retornar para empresa

---

## 🧪 Casos de Teste

### Teste 1: Empresa Agenda Entrega
```
1. Login como empresa
2. Acessar "Entregas Intermunicipais"
3. Clicar em "Nova Entrega"
4. Selecionar Lages → Florianópolis
5. Definir data: amanhã
6. Preencher endereços e dados da carga
7. Verificar cálculo de preço
8. Confirmar
9. Validar: entrega criada com status 'aguardando_entregador'
10. Validar: notificação enviada para entregadores disponíveis
```

### Teste 2: Entregador Aceita Múltiplas Entregas
```
1. Login como entregador
2. Receber notificação de entregas disponíveis
3. Acessar "Entregas Disponíveis"
4. Filtrar por rota Lages → Florianópolis
5. Selecionar 3 entregas
6. Clicar em "Aceitar Selecionadas"
7. Validar: viagem criada
8. Validar: entregas vinculadas à viagem
9. Validar: status mudou para 'aceita'
10. Validar: empresa recebeu notificação
```

### Teste 3: Execução Completa da Viagem
```
1. No dia da viagem, entregador acessa "Minhas Viagens"
2. Selecionar viagem do dia
3. Clicar em "Iniciar Viagem"
4. Para cada coleta:
   - Navegar até o ponto
   - Marcar chegada
   - Tirar foto
   - Coletar assinatura
   - Confirmar coleta
5. Validar: todas as coletas marcadas como 'coletada'
6. Para cada entrega:
   - Navegar até destino
   - Tirar foto
   - Coletar assinatura
   - Confirmar entrega
7. Validar: todas as entregas marcadas como 'entregue'
8. Marcar viagem como concluída
9. Validar: valor creditado ao entregador
10. Validar: empresas receberam confirmação
```

---

## 🚀 Roadmap de Implementação

### Fase 1: Estrutura Base (2-3 semanas)
- [ ] Criar estrutura de banco de dados
- [ ] Desenvolver API de rotas (CRUD básico)
- [ ] Desenvolver API de cidades
- [ ] Implementar integração Google Maps Distance Matrix
- [ ] Criar painel admin para cadastro de rotas

### Fase 2: Funcionalidades para Entregador (2-3 semanas)
- [ ] Tela de seleção de rotas no app
- [ ] API para entregador selecionar rotas
- [ ] Tela de configuração de disponibilidade
- [ ] Sistema de notificações push
- [ ] Tela de entregas disponíveis

### Fase 3: Funcionalidades para Empresa (2-3 semanas)
- [ ] Tela de agendamento de entregas no painel
- [ ] API de cálculo de frete
- [ ] API de criação de entregas
- [ ] Tela de listagem de entregas
- [ ] Sistema de rastreamento básico

### Fase 4: Execução de Viagens (3-4 semanas)
- [ ] API de viagens (criar, listar, atualizar)
- [ ] Tela de minhas viagens no app
- [ ] Integração Google Maps Directions API
- [ ] Tela de execução da viagem com mapa
- [ ] Funcionalidade de coleta (foto + assinatura)
- [ ] Funcionalidade de entrega (foto + assinatura)
- [ ] Fluxo completo de confirmação

### Fase 5: Financeiro e Pagamentos (2 semanas)
- [ ] Sistema de cálculo de valores
- [ ] Integração com gateway de pagamento
- [ ] Relatórios financeiros para empresas
- [ ] Relatórios de ganhos para entregadores
- [ ] Sistema de repasse automático

### Fase 6: Otimizações e Melhorias (1-2 semanas)
- [ ] Otimização de rotas
- [ ] Sistema de avaliações
- [ ] Chatbot de suporte
- [ ] Relatórios e dashboards avançados
- [ ] Testes de carga e performance

---

## 📝 Notas de Implementação

### Tecnologias Sugeridas

**Backend:**
- Node.js + Express ou NestJS
- PostgreSQL (já em uso)
- Redis (cache e filas)
- Socket.io (atualizações em tempo real)

**Mobile:**
- React Native ou Flutter
- Google Maps SDK
- Firebase Cloud Messaging (notificações)

**Frontend (Painel):**
- React + TypeScript
- Tailwind CSS
- Google Maps JavaScript API

### Considerações de Segurança

1. Autenticação JWT com refresh tokens
2. Validação de permissões por tipo de usuário
3. Rate limiting nas APIs
4. Criptografia de dados sensíveis
5. Logs de auditoria para ações críticas

### Performance

1. Índices adequados no banco de dados
2. Cache de rotas e cidades
3. Paginação em todas as listagens
4. Lazy loading de imagens
5. Compressão de fotos antes do upload

---

## 📞 Suporte e Contato

Para dúvidas sobre a implementação deste módulo, consulte:
- Documentação técnica completa
- Diagramas de arquitetura
- Exemplos de código
- FAQ de desenvolvimento

---

**Documento criado em:** Novembro de 2025
**Versão:** 1.0
**Status:** Em desenvolvimento

---

## 💾 Recursos Específicos do PostgreSQL

### Extensões Necessárias

```sql
-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PostGIS para cálculos geográficos (opcional)
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Triggers para Timestamps Automáticos

```sql
-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar em todas as tabelas relevantes
CREATE TRIGGER update_rotas_intermunicipais_updated_at BEFORE UPDATE
    ON rotas_intermunicipais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entregador_rotas_updated_at BEFORE UPDATE
    ON entregador_rotas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entregas_intermunicipais_updated_at BEFORE UPDATE
    ON entregas_intermunicipais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_viagens_intermunicipais_updated_at BEFORE UPDATE
    ON viagens_intermunicipais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```
