# Documento Consolidado - Módulo de Entregas Intermunicipais

## 📋 Índice

1. [Banco de Dados](#banco-de-dados)
2. [Painel Admin](#painel-admin)
3. [App Entregador](#app-entregador)
4. [Painel Empresa](#painel-empresa)
5. [Integrações e APIs](#integracoes-e-apis)

---

# 🗄️ BANCO DE DADOS

## Tabelas Novas a Serem Criadas

### 1. Tabela: `cidades`

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

-- Inserir cidades principais de Santa Catarina (exemplo)
INSERT INTO cidades (nome, estado, ibge_code, latitude, longitude) VALUES
('Lages', 'SC', '4209102', -27.8160, -50.3263),
('Florianópolis', 'SC', '4205407', -27.5969, -48.5495),
('Joinville', 'SC', '4209102', -26.3045, -48.8487),
('Blumenau', 'SC', '4202404', -26.9194, -49.0661),
('São José', 'SC', '4216602', -27.6108, -48.6352),
('Criciúma', 'SC', '4204608', -28.6773, -49.3697),
('Chapecó', 'SC', '4204202', -27.0965, -52.6158),
('Itajaí', 'SC', '4208203', -26.9077, -48.6619),
('Jaraguá do Sul', 'SC', '4208906', -26.4869, -49.0664),
('Palhoça', 'SC', '4211900', -27.6451, -48.6704);
```

### 2. Tabela: `rotas_intermunicipais`

```sql
CREATE TABLE rotas_intermunicipais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_rota VARCHAR(255) NOT NULL,
  cidade_origem_id UUID NOT NULL REFERENCES cidades(id),
  cidade_destino_id UUID NOT NULL REFERENCES cidades(id),
  estado VARCHAR(2) NOT NULL,
  distancia_km DECIMAL(10,2) NOT NULL,
  tempo_medio_minutos INTEGER NOT NULL,
  valor_base DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  valor_por_km DECIMAL(10,2) NOT NULL DEFAULT 1.50,
  valor_por_parada DECIMAL(10,2) NOT NULL DEFAULT 3.00,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rotas_origem ON rotas_intermunicipais(cidade_origem_id);
CREATE INDEX idx_rotas_destino ON rotas_intermunicipais(cidade_destino_id);
CREATE INDEX idx_rotas_estado ON rotas_intermunicipais(estado);
CREATE INDEX idx_rotas_ativas ON rotas_intermunicipais(ativa);
```

### 3. Tabela: `entregador_rotas`

```sql
CREATE TABLE entregador_rotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entregador_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id) ON DELETE CASCADE,
  
  -- Disponibilidade
  dias_semana INTEGER[] NOT NULL, -- [1,2,3,4,5] = Seg a Sex
  horario_saida TIME NOT NULL,
  horario_chegada TIME,
  
  -- Capacidades (DEFINIDAS PELO ENTREGADOR)
  capacidade_pacotes INTEGER NOT NULL,
  capacidade_peso_kg DECIMAL(10,2) NOT NULL,
  capacidade_volume_m3 DECIMAL(10,3),
  
  -- Configurações
  aceita_multiplas_coletas BOOLEAN DEFAULT true,
  aceita_multiplas_entregas BOOLEAN DEFAULT true,
  raio_coleta_km DECIMAL(10,2),
  
  -- Status
  ativa BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(entregador_id, rota_id),
  CHECK (capacidade_pacotes > 0),
  CHECK (capacidade_peso_kg > 0)
);

CREATE INDEX idx_entregador_rotas_entregador ON entregador_rotas(entregador_id);
CREATE INDEX idx_entregador_rotas_rota ON entregador_rotas(rota_id);
CREATE INDEX idx_entregador_rotas_ativas ON entregador_rotas(ativa);
CREATE INDEX idx_entregador_rotas_dias ON entregador_rotas USING GIN(dias_semana);
```

### 4. Tabela: `viagens_intermunicipais`

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
  
  -- Contadores
  coletas_pendentes INTEGER DEFAULT 0,
  coletas_concluidas INTEGER DEFAULT 0,
  entregas_pendentes INTEGER DEFAULT 0,
  entregas_concluidas INTEGER DEFAULT 0,
  
  -- Métricas
  total_km DECIMAL(10,2),
  distancia_percorrida_km DECIMAL(10,2) DEFAULT 0,
  tempo_total_minutos INTEGER DEFAULT 0,
  
  valor_total DECIMAL(10,2) DEFAULT 0,
  
  status VARCHAR(50) NOT NULL DEFAULT 'agendada',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada'))
);

CREATE INDEX idx_viagens_entregador ON viagens_intermunicipais(entregador_id);
CREATE INDEX idx_viagens_rota ON viagens_intermunicipais(rota_id);
CREATE INDEX idx_viagens_data ON viagens_intermunicipais(data_viagem);
CREATE INDEX idx_viagens_status ON viagens_intermunicipais(status);
```

### 5. Tabela: `entregas_intermunicipais`

```sql
CREATE TABLE entregas_intermunicipais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_rastreio VARCHAR(50) UNIQUE NOT NULL,
  empresa_id UUID NOT NULL REFERENCES users(id),
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id),
  entregador_id UUID REFERENCES users(id),
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
  
  -- Comprovantes gerais
  observacoes TEXT,
  foto_coleta TEXT,
  assinatura_coleta TEXT,
  foto_entrega TEXT,
  assinatura_entrega TEXT,
  
  -- Prazos e notificações
  prazo_aceite_ate TIMESTAMP,
  modo_aceite VARCHAR(20) DEFAULT 'normal',
  valor_original DECIMAL(10,2),
  percentual_urgente DECIMAL(5,2) DEFAULT 0,
  notificacoes_enviadas INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CHECK (status IN (
    'aguardando_entregador',
    'aceita',
    'em_coleta',
    'coletada',
    'em_entrega',
    'entregue',
    'cancelada',
    'problema'
  )),
  CHECK (modo_aceite IN ('normal', 'urgente'))
);

CREATE INDEX idx_entregas_inter_empresa ON entregas_intermunicipais(empresa_id);
CREATE INDEX idx_entregas_inter_entregador ON entregas_intermunicipais(entregador_id);
CREATE INDEX idx_entregas_inter_rota ON entregas_intermunicipais(rota_id);
CREATE INDEX idx_entregas_inter_status ON entregas_intermunicipais(status);
CREATE INDEX idx_entregas_inter_data_coleta ON entregas_intermunicipais(data_coleta_agendada);
CREATE INDEX idx_entregas_inter_viagem ON entregas_intermunicipais(viagem_id);
CREATE INDEX idx_entregas_inter_prazo ON entregas_intermunicipais(prazo_aceite_ate, status);
```

### 6. Tabela: `viagem_coletas` (Status Individual de Coletas)

```sql
CREATE TABLE viagem_coletas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viagem_id UUID NOT NULL REFERENCES viagens_intermunicipais(id) ON DELETE CASCADE,
  entrega_id UUID NOT NULL REFERENCES entregas_intermunicipais(id) ON DELETE CASCADE,
  
  -- Dados do ponto de coleta
  endereco_id UUID NOT NULL REFERENCES enderecos(id),
  empresa_id UUID NOT NULL REFERENCES users(id),
  ordem_coleta INTEGER NOT NULL,
  
  -- Status da coleta
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  
  -- Horários
  horario_previsto TIME NOT NULL,
  horario_chegada TIMESTAMP,
  horario_coleta TIMESTAMP,
  
  -- Dados da carga
  quantidade_pacotes INTEGER NOT NULL,
  peso_kg DECIMAL(10,2),
  descricao_carga TEXT,
  
  -- Comprovantes
  foto_chegada TEXT,
  foto_pacotes TEXT,
  assinatura_remetente TEXT,
  observacoes TEXT,
  problema_descricao TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(viagem_id, entrega_id),
  CHECK (status IN ('pendente', 'a_caminho', 'chegou', 'coletada', 'problema'))
);

CREATE INDEX idx_viagem_coletas_viagem ON viagem_coletas(viagem_id);
CREATE INDEX idx_viagem_coletas_status ON viagem_coletas(status);
CREATE INDEX idx_viagem_coletas_ordem ON viagem_coletas(viagem_id, ordem_coleta);
```

### 7. Tabela: `viagem_entregas` (Status Individual de Entregas)

```sql
CREATE TABLE viagem_entregas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viagem_id UUID NOT NULL REFERENCES viagens_intermunicipais(id) ON DELETE CASCADE,
  entrega_id UUID NOT NULL REFERENCES entregas_intermunicipais(id) ON DELETE CASCADE,
  
  -- Dados do ponto de entrega
  endereco_id UUID NOT NULL REFERENCES enderecos(id),
  destinatario_nome VARCHAR(255) NOT NULL,
  destinatario_telefone VARCHAR(20) NOT NULL,
  ordem_entrega INTEGER NOT NULL,
  
  -- Status da entrega
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  
  -- Horários
  horario_previsto TIME,
  horario_chegada TIMESTAMP,
  horario_entrega TIMESTAMP,
  
  -- Dados da carga
  quantidade_pacotes INTEGER NOT NULL,
  peso_kg DECIMAL(10,2),
  
  -- Comprovantes
  foto_chegada TEXT,
  foto_entrega TEXT,
  assinatura_destinatario TEXT,
  nome_quem_recebeu VARCHAR(255),
  documento_quem_recebeu VARCHAR(20),
  observacoes TEXT,
  motivo_nao_entregue TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(viagem_id, entrega_id),
  CHECK (status IN ('pendente', 'a_caminho', 'chegou', 'entregue', 'recusada', 'ausente'))
);

CREATE INDEX idx_viagem_entregas_viagem ON viagem_entregas(viagem_id);
CREATE INDEX idx_viagem_entregas_status ON viagem_entregas(status);
CREATE INDEX idx_viagem_entregas_ordem ON viagem_entregas(viagem_id, ordem_entrega);
```

### 8. Tabela: `entregador_capacidade_diaria`

```sql
CREATE TABLE entregador_capacidade_diaria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entregador_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  
  -- Capacidade total (da tabela entregador_rotas)
  capacidade_total_pacotes INTEGER NOT NULL,
  capacidade_total_peso_kg DECIMAL(10,2) NOT NULL,
  
  -- Já aceito/usado
  pacotes_aceitos INTEGER DEFAULT 0,
  peso_aceito_kg DECIMAL(10,2) DEFAULT 0,
  volume_aceito_m3 DECIMAL(10,3) DEFAULT 0,
  
  -- Disponível (colunas geradas automaticamente)
  pacotes_disponiveis INTEGER GENERATED ALWAYS AS (capacidade_total_pacotes - pacotes_aceitos) STORED,
  peso_disponivel_kg DECIMAL(10,2) GENERATED ALWAYS AS (capacidade_total_peso_kg - peso_aceito_kg) STORED,
  
  -- Contador de entregas
  entregas_aceitas INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(entregador_id, rota_id, data),
  CHECK (pacotes_aceitos <= capacidade_total_pacotes),
  CHECK (peso_aceito_kg <= capacidade_total_peso_kg)
);

CREATE INDEX idx_capacidade_diaria_entregador ON entregador_capacidade_diaria(entregador_id);
CREATE INDEX idx_capacidade_diaria_data ON entregador_capacidade_diaria(data);
CREATE INDEX idx_capacidade_diaria_rota ON entregador_capacidade_diaria(rota_id);
```

## Triggers e Funções

### 1. Trigger para Updated_at Automático

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rotas_intermunicipais_updated_at 
  BEFORE UPDATE ON rotas_intermunicipais 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entregador_rotas_updated_at 
  BEFORE UPDATE ON entregador_rotas 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entregas_intermunicipais_updated_at 
  BEFORE UPDATE ON entregas_intermunicipais 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_viagens_intermunicipais_updated_at 
  BEFORE UPDATE ON viagens_intermunicipais 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_viagem_coletas_updated_at 
  BEFORE UPDATE ON viagem_coletas 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_viagem_entregas_updated_at 
  BEFORE UPDATE ON viagem_entregas 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Trigger para Atualizar Contadores da Viagem

```sql
CREATE OR REPLACE FUNCTION atualizar_contadores_viagem()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE viagens_intermunicipais v
  SET 
    coletas_pendentes = (
      SELECT COUNT(*) FROM viagem_coletas 
      WHERE viagem_id = v.id AND status NOT IN ('coletada', 'problema')
    ),
    coletas_concluidas = (
      SELECT COUNT(*) FROM viagem_coletas 
      WHERE viagem_id = v.id AND status = 'coletada'
    ),
    entregas_pendentes = (
      SELECT COUNT(*) FROM viagem_entregas 
      WHERE viagem_id = v.id AND status NOT IN ('entregue', 'recusada', 'ausente')
    ),
    entregas_concluidas = (
      SELECT COUNT(*) FROM viagem_entregas 
      WHERE viagem_id = v.id AND status = 'entregue'
    )
  WHERE v.id = COALESCE(NEW.viagem_id, OLD.viagem_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_contadores_coletas
AFTER INSERT OR UPDATE OR DELETE ON viagem_coletas
FOR EACH ROW EXECUTE FUNCTION atualizar_contadores_viagem();

CREATE TRIGGER trigger_atualizar_contadores_entregas
AFTER INSERT OR UPDATE OR DELETE ON viagem_entregas
FOR EACH ROW EXECUTE FUNCTION atualizar_contadores_viagem();
```

### 3. Trigger para Liberar Capacidade ao Cancelar

```sql
CREATE OR REPLACE FUNCTION liberar_capacidade_cancelamento()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('aceita', 'em_coleta', 'coletada') AND NEW.status = 'cancelada' THEN
    UPDATE entregador_capacidade_diaria
    SET 
      pacotes_aceitos = pacotes_aceitos - OLD.quantidade_pacotes,
      peso_aceito_kg = peso_aceito_kg - OLD.peso_kg,
      entregas_aceitas = entregas_aceitas - 1
    WHERE 
      entregador_id = OLD.entregador_id
      AND rota_id = OLD.rota_id
      AND data = DATE(OLD.data_coleta_agendada);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_liberar_capacidade
AFTER UPDATE ON entregas_intermunicipais
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION liberar_capacidade_cancelamento();
```

---

# 👨‍💼 PAINEL ADMIN

## Funcionalidades Novas

### 1. Menu: Rotas Intermunicipais

Adicionar novo item no menu lateral do admin:
```
📍 Rotas Intermunicipais
  ├─ Listar Rotas
  ├─ Cadastrar Rota
  ├─ Cidades Cadastradas
  └─ Relatórios
```

### 2. Tela: Listar Rotas

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Rotas Intermunicipais                    [+ Nova Rota]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Buscar...] [Filtro: Estado ▼] [Status ▼]                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Lages → Florianópolis                                 │ │
│  │ 180 km • ~2h30min                                     │ │
│  │ Valores: Base R$ 5 | Km R$ 1,50 | Parada R$ 3,00    │ │
│  │ Status: ● Ativa  •  15 entregadores  •  45 entregas  │ │
│  │ [Editar] [Desativar] [Ver Estatísticas]              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Lages → São Joaquim                                   │ │
│  │ 75 km • ~1h15min                                      │ │
│  │ Valores: Base R$ 5 | Km R$ 1,50 | Parada R$ 3,00    │ │
│  │ Status: ● Ativa  •  8 entregadores  •  23 entregas   │ │
│  │ [Editar] [Desativar] [Ver Estatísticas]              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoint:**
```
GET /api/admin/rotas-intermunicipais
Query params: ?estado=SC&status=ativa&search=lages
```

### 3. Tela: Cadastrar/Editar Rota

**Formulário:**
```
┌─────────────────────────────────────────────┐
│  Nova Rota Intermunicipal                   │
├─────────────────────────────────────────────┤
│                                             │
│  Cidade Origem *                            │
│  [Lages - SC                           ▼]   │
│                                             │
│  Cidade Destino *                           │
│  [Florianópolis - SC                   ▼]   │
│                                             │
│  ─────────────────────────────────────────  │
│  Dados Automáticos (Google Maps)            │
│  ─────────────────────────────────────────  │
│                                             │
│  Distância: 180 km  (calculado)             │
│  Tempo médio: 150 min  (calculado)          │
│  [Recalcular via Google Maps]               │
│                                             │
│  ─────────────────────────────────────────  │
│  Precificação                               │
│  ─────────────────────────────────────────  │
│                                             │
│  Valor Base (fixo por viagem)               │
│  R$ [5.00]                                  │
│                                             │
│  Valor por KM                               │
│  R$ [1.50]                                  │
│                                             │
│  Valor por Parada Adicional                 │
│  R$ [3.00]                                  │
│                                             │
│  💡 Exemplo de cálculo:                     │
│  • 1 coleta + 1 entrega = R$ 275,00        │
│  • 2 coletas + 2 entregas = R$ 281,00      │
│  • 3 coletas + 3 entregas = R$ 287,00      │
│                                             │
│  [Cancelar]  [Salvar Rota]                 │
│                                             │
└─────────────────────────────────────────────┘
```

**API Endpoint:**
```javascript
POST /api/admin/rotas-intermunicipais

{
  "cidade_origem_id": "uuid",
  "cidade_destino_id": "uuid",
  "valor_base": 5.00,
  "valor_por_km": 1.50,
  "valor_por_parada": 3.00
}

// Sistema automaticamente:
// 1. Chama Google Maps Distance Matrix API
// 2. Calcula distância e tempo
// 3. Gera nome_rota automaticamente
// 4. Salva no banco
```

### 4. Tela: Estatísticas da Rota

```
┌─────────────────────────────────────────────┐
│  Estatísticas: Lages → Florianópolis       │
├─────────────────────────────────────────────┤
│                                             │
│  📊 Últimos 30 dias                         │
│                                             │
│  Total de Entregas: 245                     │
│  Entregas Concluídas: 238 (97%)            │
│  Entregas Canceladas: 7 (3%)               │
│                                             │
│  Entregadores Ativos: 15                    │
│  Empresas Usuárias: 42                      │
│                                             │
│  Receita Total: R$ 12.450,00               │
│  Taxa Plataforma: R$ 2.490,00 (20%)        │
│                                             │
│  ─────────────────────────────────────────  │
│  Métricas de Performance                    │
│  ─────────────────────────────────────────  │
│                                             │
│  Taxa de Aceite: 98%                        │
│  Tempo Médio de Aceite: 4h 30min           │
│  Ticket Médio: R$ 50,82                    │
│                                             │
│  [Exportar Relatório] [Ver Gráficos]       │
│                                             │
└─────────────────────────────────────────────┘
```

### 5. Tela: Gerenciar Cidades

```
┌─────────────────────────────────────────────┐
│  Cidades Cadastradas                        │
├─────────────────────────────────────────────┤
│                                             │
│  [+ Adicionar Cidade]  [Estado: SC ▼]       │
│                                             │
│  Tabela:                                    │
│  ┌───────────────────────────────────────┐ │
│  │ Nome          │ Estado │ Ações        │ │
│  ├───────────────────────────────────────┤ │
│  │ Lages         │ SC     │ [Editar]     │ │
│  │ Florianópolis │ SC     │ [Editar]     │ │
│  │ Joinville     │ SC     │ [Editar]     │ │
│  │ Blumenau      │ SC     │ [Editar]     │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

## APIs do Admin

```javascript
// Listar rotas
GET /api/admin/rotas-intermunicipais

// Criar rota
POST /api/admin/rotas-intermunicipais

// Editar rota
PUT /api/admin/rotas-intermunicipais/:id

// Desativar rota
DELETE /api/admin/rotas-intermunicipais/:id

// Estatísticas
GET /api/admin/rotas-intermunicipais/:id/estatisticas

// Cidades
GET /api/admin/cidades
POST /api/admin/cidades
PUT /api/admin/cidades/:id

// Calcular distância (Google Maps)
POST /api/admin/calcular-distancia
{
  "origem": "Lages, SC",
  "destino": "Florianópolis, SC"
}
```

---

# 📱 APP ENTREGADOR

## Novas Telas e Funcionalidades

### 1. Menu Principal (Adicionar Item)

```
☰ Menu
├─ Início
├─ Entregas Rápidas (urbanas)
├─ 🆕 Rotas Intermunicipais ⭐
│   ├─ Minhas Rotas
│   ├─ Selecionar Rotas
│   ├─ Entregas Disponíveis
│   └─ Minha Agenda
├─ Histórico
└─ Perfil
```

### 2. Tela: Minhas Rotas

```
┌─────────────────────────────────────┐
│  ← Minhas Rotas                     │
├─────────────────────────────────────┤
│                                     │
│  [+ Adicionar Nova Rota]            │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  ✅ Lages → Florianópolis           │
│  ┌───────────────────────────────┐ │
│  │ 🚗 180 km • ~2h30min          │ │
│  │                               │ │
│  │ 📅 Dias: Seg, Qua, Sex        │ │
│  │ 🕐 Saída: 08:00               │ │
│  │                               │ │
│  │ 📦 Capacidade: 50 pacotes     │ │
│  │ ⚖️  Peso máx: 100kg           │ │
│  │                               │ │
│  │ 💰 Média: R$ 50/entrega       │ │
│  │                               │ │
│  │ 🔔 3 entregas disponíveis     │ │
│  │                               │ │
│  │ Toggle: ● ATIVA               │ │
│  │                               │ │
│  │ [Editar] [Ver Disponíveis]    │ │
│  └───────────────────────────────┘ │
│                                     │
│  ✅ Lages → São Joaquim             │
│  ┌───────────────────────────────┐ │
│  │ 🚗 75 km • ~1h15min           │ │
│  │                               │ │
│  │ 📅 Dias: Ter, Qui, Sáb        │ │
│  │ 🕐 Saída: 09:00               │ │
│  │                               │ │
│  │ 📦 Capacidade: 30 pacotes     │ │
│  │ ⚖️  Peso máx: 60kg            │ │
│  │                               │ │
│  │ 💰 Média: R$ 35/entrega       │ │
│  │                               │ │
│  │ 🔔 Nenhuma disponível          │ │
│  │                               │ │
│  │ Toggle: ● ATIVA               │ │
│  │                               │ │
│  │ [Editar] [Ver Disponíveis]    │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**API:**
```
GET /api/entregador/minhas-rotas
```

### 3. Tela: Selecionar/Adicionar Rota

```
┌─────────────────────────────────────┐
│  ← Selecionar Rota                  │
├─────────────────────────────────────┤
│                                     │
│  [Buscar...] [Estado: SC ▼]         │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  📍 Lages → Florianópolis           │
│  🚗 180 km • ~2h30min               │
│  💰 Valor médio: R$ 50/entrega      │
│  [Selecionar]                       │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  📍 Lages → São Joaquim             │
│  🚗 75 km • ~1h15min                │
│  💰 Valor médio: R$ 35/entrega      │
│  [Selecionar]                       │
│                                     │
└─────────────────────────────────────┘
```

**API:**
```
GET /api/entregador/rotas-disponiveis?estado=SC
```

### 4. Tela: Configurar Rota (Ao Selecionar)

```
┌─────────────────────────────────────┐
│  ← Configurar Rota                  │
│  Lages → Florianópolis              │
├─────────────────────────────────────┤
│                                     │
│  📅 Dias da Semana *                │
│  ☑ Segunda    ☑ Terça               │
│  ☑ Quarta     ☐ Quinta              │
│  ☑ Sexta      ☐ Sábado              │
│  ☐ Domingo                          │
│                                     │
│  🕐 Horário de Saída *              │
│  [08:00] ⏰                          │
│                                     │
│  🕐 Horário de Chegada (estimado)   │
│  [11:00] ⏰                          │
│                                     │
│  ──────────────────────────────────  │
│  ⭐ CAPACIDADE DO SEU VEÍCULO       │
│  ──────────────────────────────────  │
│                                     │
│  📦 Quantos pacotes pode levar? *   │
│  [  50  ] pacotes                   │
│                                     │
│  💡 Dica: Carro pequeno 20-30,      │
│  Van 50-70, Caminhão 100+           │
│                                     │
│  ⚖️  Peso máximo suportado *        │
│  [  100  ] kg                       │
│                                     │
│  📐 Volume do veículo (opcional)    │
│  [  2.5  ] m³                       │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  ☑ Aceito múltiplas coletas         │
│  ☑ Aceito múltiplas entregas        │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  [Cancelar]  [Salvar e Ativar]     │
│                                     │
└─────────────────────────────────────┘
```

**API:**
```javascript
POST /api/entregador/rotas

{
  "rota_id": "uuid",
  "dias_semana": [1, 2, 3, 5], // 1=Seg, 2=Ter, etc
  "horario_saida": "08:00",
  "horario_chegada": "11:00",
  "capacidade_pacotes": 50,
  "capacidade_peso_kg": 100,
  "capacidade_volume_m3": 2.5,
  "aceita_multiplas_coletas": true,
  "aceita_multiplas_entregas": true
}
```

### 5. Tela: Entregas Disponíveis

```
┌─────────────────────────────────────┐
│  ← Entregas Disponíveis             │
│  Quarta-feira, 20/11                │
├─────────────────────────────────────┤
│  📊 Sua Capacidade:                 │
│  📦 45/50 pacotes disponíveis       │
│  ⚖️  88/100kg disponíveis           │
│                                     │
│  ☑ 2 entregas já aceitas hoje       │
├─────────────────────────────────────┤
│                                     │
│  [Rota: Todas ▼] [Data: Hoje ▼]    │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  ✅ INTER-20251118-001              │
│  ┌───────────────────────────────┐ │
│  │ ☐ Lages → Florianópolis       │ │
│  │ 📅 Qua 08:00                  │ │
│  │ 📦 3 pacotes • 4kg            │ │
│  │ 💰 R$ 35,00                   │ │
│  │ ✅ Você pode aceitar           │ │
│  │                               │ │
│  │ Empresa ABC Ltda              │ │
│  │ Coleta: Rua A, 100            │ │
│  │ Entrega: Av. B, 200           │ │
│  │                               │ │
│  │ [Ver Detalhes]                │ │
│  └───────────────────────────────┘ │
│                                     │
│  ✅ INTER-20251118-002              │
│  ┌───────────────────────────────┐ │
│  │ ☐ Lages → Florianópolis       │ │
│  │ 📅 Qua 08:30                  │ │
│  │ 📦 2 pacotes • 3kg            │ │
│  │ 💰 R$ 32,00                   │ │
│  │ ✅ Você pode aceitar           │ │
│  │ [Ver Detalhes]                │ │
│  └───────────────────────────────┘ │
│                                     │
│  ❌ INTER-20251118-003              │
│  ┌───────────────────────────────┐ │
│  │ ☐ Lages → Florianópolis       │ │
│  │ 📅 Qua 09:00                  │ │
│  │ 📦 50 pacotes • 45kg          │ │
│  │ 💰 R$ 120,00                  │ │
│  │ ⚠️ EXCEDE SUA CAPACIDADE      │ │
│  │    (você tem 45 pacotes       │ │
│  │     disponíveis)              │ │
│  │ [Ver Detalhes]                │ │
│  └───────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│  2 selecionadas • R$ 67,00          │
│  [Aceitar Selecionadas]             │
└─────────────────────────────────────┘
```

**API:**
```
GET /api/entregador/entregas-disponiveis?rota_id=uuid&data=2025-11-20

POST /api/entregador/entregas-intermunicipais/aceitar
{
  "entrega_ids": ["uuid1", "uuid2"],
  "data_viagem": "2025-11-20"
}
```

### 6. Tela: Minha Agenda

```
┌─────────────────────────────────────┐
│  📅 Minha Agenda                    │
├─────────────────────────────────────┤
│  [Hoje] [Amanhã] [►Quarta] [Quinta] │
├─────────────────────────────────────┤
│                                     │
│  🚚 Entregas Urbanas (Hoje)        │
│  └─ 3 entregas pendentes            │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  🛣️  VIAGEM INTERMUNICIPAL         │
│  ┌─────────────────────────────┐   │
│  │ Quarta-feira, 20/11         │   │
│  │ Lages → Florianópolis       │   │
│  │                             │   │
│  │ 🕐 Início: 08:00            │   │
│  │ 📍 3 coletas                │   │
│  │ 📦 6 pacotes • 16kg         │   │
│  │ 🎯 3 entregas               │   │
│  │ 💰 R$ 150,00                │   │
│  │                             │   │
│  │ Status: ⏰ Agendada          │   │
│  │                             │   │
│  │ [Ver Detalhes da Viagem]    │   │
│  └─────────────────────────────┘   │
│                                     │
│  🚚 Entregas Urbanas (Quarta)      │
│  └─ 5 entregas para o dia           │
│                                     │
└─────────────────────────────────────┘
```

**API:**
```
GET /api/entregador/agenda?data=2025-11-20
```

### 7. Tela: Detalhes da Viagem (Antes de Iniciar)

```
┌─────────────────────────────────────┐
│  ← Viagem Lages → Florianópolis    │
│  Quarta-feira, 20/11/2025           │
├─────────────────────────────────────┤
│                                     │
│  [  MAPA INTERATIVO COM PINS  ]    │
│  📍 3 Pins Vermelhos (Coletas)      │
│  📍 3 Pins Verdes (Entregas)        │
│                                     │
├─────────────────────────────────────┤
│  [Coletas ▼] [Entregas]             │
├─────────────────────────────────────┤
│                                     │
│  📦 COLETAS (3)                     │
│                                     │
│  ⏰ 1. Empresa ABC - Rua A, 100     │
│     └─ 2 pacotes • 5kg              │
│     └─ Status: ⏰ Pendente           │
│     └─ Horário: 08:00               │
│     └─ Tel: (49) 3333-4444          │
│                                     │
│  ⏰ 2. Empresa XYZ - Rua C, 300     │
│     └─ 1 pacote • 3kg               │
│     └─ Status: ⏰ Pendente           │
│     └─ Horário: 08:30               │
│     └─ Tel: (49) 3333-5555          │
│                                     │
│  ⏰ 3. Loja 123 - Rua E, 500        │
│     └─ 3 pacotes • 8kg              │
│     └─ Status: ⏰ Pendente           │
│     └─ Horário: 09:00               │
│     └─ Tel: (49) 3333-6666          │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  🎯 ENTREGAS (3)                    │
│                                     │
│  🔒 1. Maria Silva - Av. B, 200     │
│     └─ 2 pacotes • 5kg              │
│     └─ Status: Aguardando coleta    │
│     └─ Tel: (48) 99999-1111         │
│                                     │
│  🔒 2. João Santos - Rua D, 400     │
│     └─ 1 pacote • 3kg               │
│     └─ Status: Aguardando coleta    │
│     └─ Tel: (48) 99999-2222         │
│                                     │
│  🔒 3. Ana Costa - Av. F, 600       │
│     └─ 3 pacotes • 8kg              │
│     └─ Status: Aguardando coleta    │
│     └─ Tel: (48) 99999-3333         │
│                                     │
├─────────────────────────────────────┤
│  💰 Valor Total: R$ 150,00          │
│  📏 Distância: 187 km               │
│  ⏱️  Tempo estimado: 2h30 + paradas │
│                                     │
│  [   🚀 INICIAR VIAGEM   ]         │
│                                     │
└─────────────────────────────────────┘
```

**API:**
```
GET /api/entregador/viagens/:id

POST /api/entregador/viagens/:id/iniciar
```

### 8. Tela: Viagem em Andamento

```
┌─────────────────────────────────────┐
│  🚗 Viagem em Andamento             │
│  Lages → Florianópolis              │
├─────────────────────────────────────┤
│                                     │
│  Progresso: ▓▓▓░░░ 1/3 coletas     │
│                                     │
│  ──────────────────────────────────  │
│  🚗 PRÓXIMA COLETA                  │
│  ──────────────────────────────────  │
│                                     │
│  📍 Empresa XYZ                     │
│  Rua C, 300 - Centro               │
│                                     │
│  📦 1 pacote • 3kg                  │
│  🕐 Previsto: 08:30                 │
│  📞 (49) 3333-5555                  │
│                                     │
│  Distância: 2.5 km                  │
│  Tempo estimado: 8 min              │
│                                     │
│  [  📍 NAVEGAR ATÉ O LOCAL  ]      │
│                                     │
│  [  ✅ CHEGUEI NO LOCAL  ]         │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  📦 Coletas:                        │
│  ✅ 1. Empresa ABC (coletada)       │
│  🚗 2. Empresa XYZ (a caminho)      │
│  ⏰ 3. Loja 123 (pendente)          │
│                                     │
│  🎯 Entregas:                       │
│  🔒 Aguardando coletas              │
│                                     │
│  [Ver Mapa Completo]                │
│                                     │
└─────────────────────────────────────┘
```

### 9. Tela: Confirmar Coleta

```
┌─────────────────────────────────────┐
│  ← 📦 Coleta - Empresa XYZ          │
├─────────────────────────────────────┤
│                                     │
│  Remetente: Empresa XYZ Ltda        │
│  Contato: (49) 3333-5555            │
│  [  📞 Ligar  ]                     │
│                                     │
│  Endereço:                          │
│  Rua C, 300 - Sala 201              │
│  Centro - Lages/SC                  │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  📦 Itens para coletar:             │
│  • 1 pacote                         │
│  • Peso total: 3kg                  │
│  • Descrição: Eletrônicos           │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  📸 Tirar foto dos pacotes *        │
│  [  📷 Capturar Foto  ]             │
│  [Foto capturada ✓]                 │
│                                     │
│  ✍️ Assinatura do remetente *       │
│  [  ✍️  Coletar Assinatura  ]       │
│  [Assinatura coletada ✓]            │
│                                     │
│  💬 Observações (opcional)          │
│  [________________________]         │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  [  ❌ Reportar Problema  ]         │
│                                     │
│  [  ✅ CONFIRMAR COLETA  ]         │
│                                     │
└─────────────────────────────────────┘
```

**API:**
```javascript
POST /api/entregador/viagem-coletas/:id/chegar

POST /api/entregador/viagem-coletas/:id/coletar
{
  "foto_pacotes": "base64...",
  "assinatura_remetente": "base64...",
  "observacoes": "Tudo ok"
}

POST /api/entregador/viagem-coletas/:id/problema
{
  "problema_descricao": "Empresa fechada"
}
```

### 10. Tela: Confirmar Entrega

```
┌─────────────────────────────────────┐
│  ← 🎯 Entrega - Maria Silva         │
├─────────────────────────────────────┤
│                                     │
│  Destinatário: Maria Silva          │
│  Telefone: (48) 99999-1111          │
│  [  📞 Ligar  ]                     │
│                                     │
│  Endereço:                          │
│  Av. B, 200 - Apto 501              │
│  Centro - Florianópolis/SC          │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  📦 Itens para entregar:            │
│  • 2 pacotes                        │
│  • Peso: 5kg                        │
│  • Origem: Empresa ABC              │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  📸 Tirar foto da entrega *         │
│  [  📷 Capturar Foto  ]             │
│                                     │
│  ✍️ Assinatura do destinatário *    │
│  [  ✍️  Coletar Assinatura  ]       │
│                                     │
│  👤 Quem recebeu? *                 │
│  (●) Maria Silva (destinatário)     │
│  ( ) Outra pessoa                   │
│                                     │
│  [Se outra pessoa:]                 │
│  Nome: [______________]             │
│  CPF:  [___.___.___-__]             │
│                                     │
│  💬 Observações (opcional)          │
│  [________________________]         │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  [  ❌ Destinatário Ausente  ]      │
│  [  🚫 Recusou Recebimento  ]       │
│                                     │
│  [  ✅ CONFIRMAR ENTREGA  ]        │
│                                     │
└─────────────────────────────────────┘
```

**API:**
```javascript
POST /api/entregador/viagem-entregas/:id/chegar

POST /api/entregador/viagem-entregas/:id/entregar
{
  "foto_entrega": "base64...",
  "assinatura_destinatario": "base64...",
  "nome_quem_recebeu": "Maria Silva",
  "documento_quem_recebeu": "123.456.789-00",
  "observacoes": "Entregue"
}

POST /api/entregador/viagem-entregas/:id/ausente
{
  "motivo_nao_entregue": "Ninguém atendeu"
}

POST /api/entregador/viagem-entregas/:id/recusada
{
  "motivo_nao_entregue": "Destinatário recusou"
}
```

### 11. Tela: Finalizar Viagem

```
┌─────────────────────────────────────┐
│  🎉 Viagem Concluída!               │
│  Lages → Florianópolis              │
├─────────────────────────────────────┤
│                                     │
│  ✅ 3 coletas realizadas            │
│  ✅ 3 entregas concluídas           │
│                                     │
│  ──────────────────────────────────  │
│  📊 Resumo da viagem                │
│  ──────────────────────────────────  │
│                                     │
│  📏 Distância: 187 km               │
│  ⏱️  Tempo total: 4h 30min          │
│  🕐 Início: 08:00                   │
│  🕐 Término: 12:30                  │
│                                     │
│  💰 Valor ganho: R$ 150,00          │
│                                     │
│  ──────────────────────────────────  │
│                                     │
│  Como foi sua viagem?               │
│  ⭐⭐⭐⭐⭐                         │
│                                     │
│  Comentários (opcional):            │
│  [________________________]         │
│                                     │
│  [  ✅ FINALIZAR VIAGEM  ]         │
│                                     │
└─────────────────────────────────────┘
```

**API:**
```
POST /api/entregador/viagens/:id/concluir
{
  "avaliacao": 5,
  "comentario": "Tudo certo"
}
```

---

# 🏢 PAINEL EMPRESA

## Novas Funcionalidades

### 1. Menu: Adicionar Item

```
☰ Menu
├─ Dashboard
├─ Entregas Rápidas
├─ 🆕 Entregas Intermunicipais ⭐
│   ├─ Agendar Entrega
│   ├─ Minhas Entregas
│   └─ Histórico
├─ Financeiro
└─ Configurações
```

### 2. Tela: Agendar Nova Entrega Intermunicipal

**Passo 1: Rota e Data**
```
┌─────────────────────────────────────────────┐
│  Nova Entrega Intermunicipal         [1/4]  │
├─────────────────────────────────────────────┤
│                                             │
│  📍 Rota                                    │
│                                             │
│  Cidade de Origem *                         │
│  [Lages - SC                           ▼]   │
│                                             │
│  Cidade de Destino *                        │
│  [Florianópolis - SC                   ▼]   │
│                                             │
│  💡 Rotas disponíveis encontradas: 1        │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ● Lages → Florianópolis             │   │
│  │   180 km • ~2h30min                 │   │
│  │   15 entregadores disponíveis       │   │
│  │   [Selecionar esta rota]            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  📅 Quando?                                 │
│                                             │
│  Data da Coleta *                           │
│  [20/11/2025]  📅                           │
│  (mínimo 24h de antecedência)               │
│                                             │
│  Horário da Coleta *                        │
│  De: [08:00] ⏰  Até: [10:00] ⏰            │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  [Cancelar]  [Próximo →]                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Passo 2: Endereços**
```
┌─────────────────────────────────────────────┐
│  Nova Entrega Intermunicipal         [2/4]  │
├─────────────────────────────────────────────┤
│                                             │
│  📍 Endereço de Coleta                      │
│                                             │
│  ( ) Usar endereço cadastrado               │
│    [Selecionar endereço           ▼]        │
│                                             │
│  (●) Novo endereço                          │
│                                             │
│  CEP: [88000-000]  [Buscar]                 │
│                                             │
│  Rua: [Rua Exemplo]                         │
│  Número: [100]  Complemento: [Sala 10]      │
│  Bairro: [Centro]                           │
│  Cidade: [Lages]  Estado: [SC]              │
│                                             │
│  Referência (opcional):                     │
│  [Próximo ao supermercado ABC]              │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  🎯 Endereço de Entrega                     │
│                                             │
│  ( ) Usar endereço cadastrado               │
│  (●) Novo endereço                          │
│                                             │
│  CEP: [88010-000]  [Buscar]                 │
│                                             │
│  Rua: [Avenida Exemplo]                     │
│  Número: [200]  Complemento: [Apto 501]     │
│  Bairro: [Centro]                           │
│  Cidade: [Florianópolis]  Estado: [SC]      │
│                                             │
│  Referência (opcional):                     │
│  [Edifício azul com portaria 24h]           │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  👤 Dados do Destinatário                   │
│                                             │
│  Nome Completo: [Maria Silva]               │
│  Telefone: [(48) 99999-1111]                │
│  Email (opcional): [maria@email.com]        │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  [← Voltar]  [Próximo →]                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Passo 3: Dados da Carga**
```
┌─────────────────────────────────────────────┐
│  Nova Entrega Intermunicipal         [3/4]  │
├─────────────────────────────────────────────┤
│                                             │
│  📦 Informações da Carga                    │
│                                             │
│  Quantidade de Pacotes *                    │
│  [  2  ] pacotes                            │
│                                             │
│  Peso Total *                               │
│  [  5.5  ] kg                               │
│                                             │
│  Volume (opcional)                          │
│  [  0.05  ] m³                              │
│                                             │
│  Descrição da Carga *                       │
│  [________________________________]         │
│  [________________________________]         │
│  Ex: Documentos, roupas, eletrônicos        │
│                                             │
│  Valor da Mercadoria (para seguro)          │
│  R$ [  500.00  ]                            │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  📋 Instruções Especiais (opcional)         │
│  [________________________________]         │
│  [________________________________]         │
│  [________________________________]         │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  [← Voltar]  [Próximo →]                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Passo 4: Confirmação e Pagamento**
```
┌─────────────────────────────────────────────┐
│  Nova Entrega Intermunicipal         [4/4]  │
├─────────────────────────────────────────────┤
│                                             │
│  ✅ Resumo da Entrega                       │
│                                             │
│  📍 Rota: Lages → Florianópolis             │
│  📅 Data: 20/11/2025 às 08:00              │
│  📦 Carga: 2 pacotes • 5.5kg                │
│                                             │
│  ──────────────────────────────────────────  │
│  💰 Cálculo do Frete                        │
│  ──────────────────────────────────────────  │
│                                             │
│  Valor base (saída)       R$    5,00        │
│  Distância (180km x 1,50) R$  270,00        │
│  Paradas (0 adicionais)   R$    0,00        │
│  ──────────────────────────────────────────  │
│  Subtotal                 R$  275,00        │
│  Taxa plataforma (20%)    R$   55,00        │
│  ──────────────────────────────────────────  │
│  TOTAL A PAGAR           R$  275,00         │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  💡 Observações:                            │
│  • Entrega agendada para 20/11/2025         │
│  • Você será notificado quando um           │
│    entregador aceitar a entrega             │
│  • Prazo de aceite: até 19/11 às 18h        │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  Forma de Pagamento                         │
│  (●) Cartão de crédito terminado em ****    │
│  ( ) Boleto bancário                        │
│  ( ) Pix                                    │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  ☑ Li e concordo com os termos              │
│                                             │
│  [← Voltar]  [Confirmar e Pagar]           │
│                                             │
└─────────────────────────────────────────────┘
```

**API:**
```javascript
POST /api/empresa/rotas-disponiveis
{
  "cidade_origem_id": "uuid",
  "cidade_destino_id": "uuid"
}

POST /api/empresa/calcular-frete
{
  "rota_id": "uuid",
  "quantidade_pacotes": 2,
  "peso_kg": 5.5
}

POST /api/empresa/entregas-intermunicipais
{
  "rota_id": "uuid",
  "data_coleta_agendada": "2025-11-20",
  "horario_coleta_inicio": "08:00",
  "horario_coleta_fim": "10:00",
  "endereco_coleta": {...},
  "endereco_entrega": {...},
  "destinatario_nome": "Maria Silva",
  "destinatario_telefone": "(48) 99999-1111",
  "quantidade_pacotes": 2,
  "peso_kg": 5.5,
  "descricao_carga": "Documentos e amostras",
  "valor_mercadoria": 500.00
}
```

### 3. Tela: Minhas Entregas Intermunicipais

```
┌─────────────────────────────────────────────────────────────┐
│  Minhas Entregas Intermunicipais          [+ Nova Entrega]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Buscar...] [Status ▼] [Rota ▼] [Data ▼]                  │
│                                                             │
│  ──────────────────────────────────────────────────────────  │
│                                                             │
│  ⏰ INTER-20251120-001                                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Lages → Florianópolis                                 │ │
│  │ 📅 Coleta: 20/11/2025 às 08:00                        │ │
│  │ 📦 2 pacotes • 5.5kg                                  │ │
│  │ 💰 R$ 275,00                                          │ │
│  │                                                       │ │
│  │ Status: ⏰ Aguardando Entregador                      │ │
│  │ Criada em: 18/11/2025 às 14:30                       │ │
│  │                                                       │ │
│  │ [Ver Detalhes] [Cancelar] [Rastrear]                 │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ✅ INTER-20251118-045                                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Lages → Florianópolis                                 │ │
│  │ 📅 Coleta: 18/11/2025 às 09:00                        │ │
│  │ 📦 1 pacote • 3kg                                     │ │
│  │ 💰 R$ 273,00                                          │ │
│  │                                                       │ │
│  │ Status: ✅ Entregue                                   │ │
│  │ Entregador: João Silva ⭐⭐⭐⭐⭐                       │ │
│  │ Entregue em: 18/11/2025 às 11:45                     │ │
│  │                                                       │ │
│  │ [Ver Detalhes] [Ver Comprovantes] [Avaliar]          │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**API:**
```
GET /api/empresa/entregas-intermunicipais?status=aguardando_entregador&page=1
```

### 4. Tela: Detalhes da Entrega

```
┌─────────────────────────────────────────────┐
│  ← Entrega INTER-20251120-001               │
├─────────────────────────────────────────────┤
│                                             │
│  Status: ⏰ Aguardando Entregador           │
│                                             │
│  ──────────────────────────────────────────  │
│  📍 Rota                                    │
│  ──────────────────────────────────────────  │
│                                             │
│  Lages → Florianópolis                      │
│  180 km • ~2h30min                          │
│                                             │
│  ──────────────────────────────────────────  │
│  📅 Agendamento                             │
│  ──────────────────────────────────────────  │
│                                             │
│  Data da coleta: 20/11/2025                 │
│  Horário: 08:00 - 10:00                     │
│  Prazo de aceite: 19/11/2025 às 18h         │
│                                             │
│  ──────────────────────────────────────────  │
│  📦 Coleta                                  │
│  ──────────────────────────────────────────  │
│                                             │
│  Endereço:                                  │
│  Rua A, 100 - Sala 10                       │
│  Centro - Lages/SC                          │
│  CEP: 88000-000                             │
│                                             │
│  [Ver no Mapa]                              │
│                                             │
│  ──────────────────────────────────────────  │
│  🎯 Entrega                                 │
│  ──────────────────────────────────────────  │
│                                             │
│  Destinatário: Maria Silva                  │
│  Telefone: (48) 99999-1111                  │
│                                             │
│  Endereço:                                  │
│  Av. B, 200 - Apto 501                      │
│  Centro - Florianópolis/SC                  │
│  CEP: 88010-000                             │
│                                             │
│  [Ver no Mapa]                              │
│                                             │
│  ──────────────────────────────────────────  │
│  📦 Carga                                   │
│  ──────────────────────────────────────────  │
│                                             │
│  Quantidade: 2 pacotes                      │
│  Peso: 5.5kg                                │
│  Descrição: Documentos e amostras           │
│  Valor: R$ 500,00                           │
│                                             │
│  ──────────────────────────────────────────  │
│  💰 Financeiro                              │
│  ──────────────────────────────────────────  │
│                                             │
│  Valor do frete: R$ 275,00                  │
│  Forma de pagamento: Cartão •••• 1234       │
│  Status pagamento: ✅ Pago                  │
│                                             │
│  ──────────────────────────────────────────  │
│  📊 Timeline                                │
│  ──────────────────────────────────────────  │
│                                             │
│  ✅ 18/11 14:30 - Entrega criada            │
│  ⏰ Aguardando aceite do entregador          │
│  ⏰ Coleta prevista para 20/11 às 08:00     │
│  ⏰ Entrega prevista para 20/11             │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  [Cancelar Entrega] [Contatar Suporte]     │
│                                             │
└─────────────────────────────────────────────┘
```

**API:**
```
GET /api/empresa/entregas-intermunicipais/:id
```

### 5. Tela: Rastreamento em Tempo Real

```
┌─────────────────────────────────────────────┐
│  ← Rastreamento INTER-20251120-001          │
├─────────────────────────────────────────────┤
│                                             │
│  [  MAPA EM TEMPO REAL  ]                   │
│  📍 Pin do entregador                       │
│  📍 Pontos de coleta/entrega                │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Status Atual: 🚗 Em Coleta                 │
│                                             │
│  Entregador: João Silva                     │
│  Veículo: Fiat Uno Branco • ABC-1234        │
│  Telefone: (49) 99999-8888                  │
│  [📞 Ligar]                                 │
│                                             │
│  ──────────────────────────────────────────  │
│  Progresso                                  │
│  ──────────────────────────────────────────  │
│                                             │
│  Coletas: ▓▓░░ 2/3                          │
│  ✅ Empresa ABC (coletada 08:10)            │
│  ✅ Empresa XYZ (coletada 08:35)            │
│  🚗 Loja 123 (a caminho)                    │
│                                             │
│  Entregas: ░░░░ 0/3                         │
│  Aguardando término das coletas             │
│                                             │
│  ──────────────────────────────────────────  │
│  Timeline                                   │
│  ──────────────────────────────────────────  │
│                                             │
│  ✅ 08:00 - Viagem iniciada                 │
│  ✅ 08:07 - Chegou na Empresa ABC           │
│  ✅ 08:10 - Coleta realizada                │
│  ✅ 08:28 - Chegou na Empresa XYZ           │
│  ✅ 08:35 - Coleta realizada                │
│  🚗 08:40 - A caminho da Loja 123           │
│                                             │
│  Previsão de entrega: 11:30                 │
│                                             │
└─────────────────────────────────────────────┘
```

**API:**
```
GET /api/empresa/entregas-intermunicipais/:id/rastreamento
```

### 6. Tela: Comprovantes de Entrega

```
┌─────────────────────────────────────────────┐
│  ← Comprovantes INTER-20251120-001          │
├─────────────────────────────────────────────┤
│                                             │
│  ✅ Entrega Concluída                       │
│  Entregue em: 20/11/2025 às 11:45           │
│                                             │
│  ──────────────────────────────────────────  │
│  📸 Foto da Coleta                          │
│  ──────────────────────────────────────────  │
│                                             │
│  [  Foto dos pacotes coletados  ]           │
│  Tirada em: 20/11/2025 às 08:10             │
│                                             │
│  [Download] [Ampliar]                       │
│                                             │
│  ──────────────────────────────────────────  │
│  ✍️  Assinatura do Remetente                │
│  ──────────────────────────────────────────  │
│                                             │
│  [  Imagem da assinatura  ]                 │
│  Nome: João Santos                          │
│  Data/Hora: 20/11/2025 às 08:10             │
│                                             │
│  [Download]                                 │
│                                             │
│  ──────────────────────────────────────────  │
│  📸 Foto da Entrega                         │
│  ──────────────────────────────────────────  │
│                                             │
│  [  Foto da entrega concluída  ]            │
│  Tirada em: 20/11/2025 às 11:45             │
│                                             │
│  [Download] [Ampliar]                       │
│                                             │
│  ──────────────────────────────────────────  │
│  ✍️  Assinatura do Destinatário             │
│  ──────────────────────────────────────────  │
│                                             │
│  [  Imagem da assinatura  ]                 │
│  Nome: Maria Silva                          │
│  CPF: 123.456.789-00                        │
│  Data/Hora: 20/11/2025 às 11:45             │
│                                             │
│  [Download]                                 │
│                                             │
│  ──────────────────────────────────────────  │
│                                             │
│  [Baixar Todos os Comprovantes (PDF)]      │
│                                             │
└─────────────────────────────────────────────┘
```

**API:**
```
GET /api/empresa/entregas-intermunicipais/:id/comprovantes
```

---

# 🔌 INTEGRAÇÕES E APIS

## Google Maps API

### 1. Calcular Distância Entre Cidades

```javascript
// services/googleMapsService.js

async calcularDistancia(origem, destino) {
  const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
  
  const response = await axios.get(url, {
    params: {
      origins: origem, // "Lages, SC, Brazil"
      destinations: destino, // "Florianópolis, SC, Brazil"
      mode: 'driving',
      language: 'pt-BR',
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });

  if (response.data.status === 'OK') {
    const element = response.data.rows[0].elements[0];
    
    return {
      distancia_km: (element.distance.value / 1000).toFixed(2),
      tempo_minutos: Math.round(element.duration.value / 60)
    };
  }
  
  throw new Error('Não foi possível calcular a distância');
}
```

### 2. Otimizar Rota com Múltiplas Paradas

```javascript
async otimizarRota(origem, destino, paradas) {
  const url = 'https://maps.googleapis.com/maps/api/directions/json';
  
  const waypoints = paradas.map(p => 
    `${p.latitude},${p.longitude}`
  ).join('|');

  const response = await axios.get(url, {
    params: {
      origin: origem,
      destination: destino,
      waypoints: `optimize:true|${waypoints}`,
      mode: 'driving',
      language: 'pt-BR',
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });

  if (response.data.status === 'OK') {
    const route = response.data.routes[0];
    
    return {
      ordem_otimizada: route.waypoint_order,
      distancia_total_km: (route.legs.reduce((sum, leg) => 
        sum + leg.distance.value, 0) / 1000).toFixed(2),
      tempo_total_minutos: Math.round(route.legs.reduce((sum, leg) => 
        sum + leg.duration.value, 0) / 60)
    };
  }
  
  throw new Error('Não foi possível otimizar a rota');
}
```

## Sistema de Notificações

### Notificações Push (Firebase Cloud Messaging)

```javascript
// services/notificacaoService.js

async notificarEntregadoresDisponiveis(rota_id, data_coleta) {
  const diaSemana = new Date(data_coleta).getDay() + 1;
  
  // Buscar entregadores
  const query = `
    SELECT u.id, u.push_token, u.nome
    FROM entregador_rotas er
    INNER JOIN users u ON er.entregador_id = u.id
    WHERE 
      er.rota_id = $1
      AND er.ativa = true
      AND $2 = ANY(er.dias_semana)
      AND u.push_token IS NOT NULL
  `;
  
  const result = await pool.query(query, [rota_id, diaSemana]);
  
  // Enviar notificação para cada entregador
  const tokens = result.rows.map(r => r.push_token);
  
  const message = {
    notification: {
      title: '💰 Nova entrega disponível!',
      body: 'Uma nova entrega intermunicipal está disponível na sua rota'
    },
    data: {
      type: 'nova_entrega_intermunicipal',
      rota_id: rota_id,
      data_coleta: data_coleta
    },
    tokens: tokens
  };
  
  await admin.messaging().sendMulticast(message);
}
```

## Webhooks de Status

```javascript
// Para integração com sistemas externos da empresa

POST /webhooks/empresa/:empresa_id/entregas
{
  "event": "entrega_aceita",
  "entrega_id": "uuid",
  "codigo_rastreio": "INTER-20251120-001",
  "entregador": {
    "nome": "João Silva",
    "telefone": "(49) 99999-8888"
  },
  "timestamp": "2025-11-19T15:30:00Z"
}
```

## Cron Jobs

```javascript
// jobs/verificarEntregasSemEntregador.js

// Rodar todo dia às 18h
cron.schedule('0 18 * * *', async () => {
  // Buscar entregas sem entregador para amanhã
  const query = `
    SELECT * FROM entregas_intermunicipais
    WHERE status = 'aguardando_entregador'
      AND data_coleta_agendada = CURRENT_DATE + INTERVAL '1 day'
      AND prazo_aceite_ate <= NOW()
  `;
  
  const entregas = await pool.query(query);
  
  // Para cada entrega, ativar modo urgente
  for (const entrega of entregas.rows) {
    await ativarModoUrgente(entrega.id);
  }
});

async function ativarModoUrgente(entrega_id) {
  // Aumentar valor em 30%
  await pool.query(`
    UPDATE entregas_intermunicipais
    SET 
      modo_aceite = 'urgente',
      valor_original = valor_entregador,
      percentual_urgente = 30,
      valor_entregador = valor_entregador * 1.30,
      valor_frete = valor_frete * 1.30
    WHERE id = $1
  `, [entrega_id]);
  
  // Notificar todos entregadores da rota
  await notificarModoUrgente(entrega_id);
}
```

---

Pronto! Este é o documento consolidado completo com todas as seções separadas. 🚀
