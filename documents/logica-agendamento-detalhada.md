# Lógica de Agendamento e Execução - Entregas Intermunicipais

## 🎯 Visão Geral do Fluxo

O entregador trabalha com **dois tipos de entregas simultâneas**:
1. **Entregas Rápidas Urbanas** (dentro da cidade, on-demand)
2. **Entregas Intermunicipais Agendadas** (entre cidades, programadas)

### Característica Principal:
- Entregas intermunicipais ficam **AGENDADAS** no app
- Entregador vê sua agenda da semana
- No dia/hora agendado, ele executa a rota
- Cada coleta e entrega tem status individual e detalhado

---

## 🗄️ Estrutura de Banco de Dados Atualizada

### Nova Tabela: `viagem_coletas` (Status Individual de Coletas)

```sql
CREATE TABLE viagem_coletas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viagem_id UUID NOT NULL REFERENCES viagens_intermunicipais(id) ON DELETE CASCADE,
  entrega_id UUID NOT NULL REFERENCES entregas_intermunicipais(id) ON DELETE CASCADE,
  
  -- Dados do ponto de coleta
  endereco_id UUID NOT NULL REFERENCES enderecos(id),
  empresa_id UUID NOT NULL REFERENCES users(id),
  ordem_coleta INTEGER, -- Ordem otimizada de coleta
  
  -- Status da coleta
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  -- Valores: 'pendente', 'a_caminho', 'chegou', 'coletada', 'problema'
  
  -- Horários
  horario_previsto TIME NOT NULL,
  horario_chegada TIMESTAMP,
  horario_coleta TIMESTAMP,
  
  -- Dados da carga
  quantidade_pacotes INTEGER NOT NULL,
  peso_kg DECIMAL(10,2),
  descricao_carga TEXT,
  
  -- Comprovantes
  foto_chegada TEXT, -- Foto do local ao chegar
  foto_pacotes TEXT, -- Foto dos pacotes
  assinatura_remetente TEXT,
  observacoes TEXT,
  problema_descricao TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(viagem_id, entrega_id)
);

CREATE INDEX idx_viagem_coletas_viagem ON viagem_coletas(viagem_id);
CREATE INDEX idx_viagem_coletas_status ON viagem_coletas(status);
CREATE INDEX idx_viagem_coletas_ordem ON viagem_coletas(viagem_id, ordem_coleta);
```

### Nova Tabela: `viagem_entregas` (Status Individual de Entregas)

```sql
CREATE TABLE viagem_entregas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viagem_id UUID NOT NULL REFERENCES viagens_intermunicipais(id) ON DELETE CASCADE,
  entrega_id UUID NOT NULL REFERENCES entregas_intermunicipais(id) ON DELETE CASCADE,
  
  -- Dados do ponto de entrega
  endereco_id UUID NOT NULL REFERENCES enderecos(id),
  destinatario_nome VARCHAR(255) NOT NULL,
  destinatario_telefone VARCHAR(20) NOT NULL,
  ordem_entrega INTEGER, -- Ordem otimizada de entrega
  
  -- Status da entrega
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  -- Valores: 'pendente', 'a_caminho', 'chegou', 'entregue', 'recusada', 'ausente'
  
  -- Horários
  horario_previsto TIME,
  horario_chegada TIMESTAMP,
  horario_entrega TIMESTAMP,
  
  -- Dados da carga
  quantidade_pacotes INTEGER NOT NULL,
  peso_kg DECIMAL(10,2),
  
  -- Comprovantes
  foto_chegada TEXT, -- Foto do local ao chegar
  foto_entrega TEXT, -- Foto da entrega concluída
  assinatura_destinatario TEXT,
  nome_quem_recebeu VARCHAR(255), -- Se outra pessoa receber
  documento_quem_recebeu VARCHAR(20), -- CPF de quem recebeu
  observacoes TEXT,
  motivo_nao_entregue TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(viagem_id, entrega_id)
);

CREATE INDEX idx_viagem_entregas_viagem ON viagem_entregas(viagem_id);
CREATE INDEX idx_viagem_entregas_status ON viagem_entregas(status);
CREATE INDEX idx_viagem_entregas_ordem ON viagem_entregas(viagem_id, ordem_entrega);
```

### Atualização Tabela: `viagens_intermunicipais`

```sql
ALTER TABLE viagens_intermunicipais
ADD COLUMN coletas_pendentes INTEGER DEFAULT 0,
ADD COLUMN coletas_concluidas INTEGER DEFAULT 0,
ADD COLUMN entregas_pendentes INTEGER DEFAULT 0,
ADD COLUMN entregas_concluidas INTEGER DEFAULT 0,
ADD COLUMN distancia_percorrida_km DECIMAL(10,2) DEFAULT 0,
ADD COLUMN tempo_total_minutos INTEGER DEFAULT 0;

-- Função para atualizar contadores automaticamente
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

-- Triggers
CREATE TRIGGER trigger_atualizar_contadores_coletas
AFTER INSERT OR UPDATE OR DELETE ON viagem_coletas
FOR EACH ROW EXECUTE FUNCTION atualizar_contadores_viagem();

CREATE TRIGGER trigger_atualizar_contadores_entregas
AFTER INSERT OR UPDATE OR DELETE ON viagem_entregas
FOR EACH ROW EXECUTE FUNCTION atualizar_contadores_viagem();
```

---

## 📅 Fluxo Completo: Da Criação à Execução

### **Passo 1: Comerciante Cria Entrega**

```
Segunda-feira, 10h
├─ Comerciante acessa painel
├─ Cria entrega: Lages → Florianópolis
├─ Data: Quarta-feira às 8h
├─ Endereço coleta: Rua A, 100
├─ Endereço entrega: Rua B, 200
└─ Sistema salva com status: "aguardando_entregador"
```

**Banco de dados:**
```sql
INSERT INTO entregas_intermunicipais (
  codigo_rastreio,
  empresa_id,
  rota_id,
  data_coleta_agendada,
  horario_coleta_inicio,
  status
) VALUES (
  'INTER-20251118-12345',
  'uuid-empresa',
  'uuid-rota-lages-floripa',
  '2025-11-20', -- Quarta
  '08:00',
  'aguardando_entregador'
);
```

### **Passo 2: Sistema Notifica Entregadores**

```
Segunda-feira, 10h01s
├─ Sistema busca entregadores que fazem rota Lages→Floripa às Quartas
├─ Envia notificação push
│   "💰 Nova entrega disponível!"
│   "Lages → Florianópolis"
│   "Quarta 08:00 - R$ 50,00"
└─ Badge aparece no app: "3 entregas disponíveis"
```

### **Passo 3: Entregador Aceita Entregas**

```
Segunda-feira, 14h
├─ Entregador João abre app
├─ Vai em "Entregas Disponíveis"
├─ Vê 3 entregas para Quarta
├─ Seleciona as 3
├─ Clica "Aceitar Selecionadas"
└─ Sistema cria/atualiza VIAGEM
```

**Sistema cria viagem:**
```sql
-- 1. Criar ou buscar viagem
INSERT INTO viagens_intermunicipais (
  codigo_viagem,
  entregador_id,
  rota_id,
  data_viagem,
  horario_saida_previsto,
  status
) VALUES (
  'VG-20251120-001',
  'uuid-joao',
  'uuid-rota-lages-floripa',
  '2025-11-20',
  '08:00',
  'agendada' -- NOVO STATUS
);

-- 2. Atualizar entregas
UPDATE entregas_intermunicipais
SET 
  status = 'aceita',
  entregador_id = 'uuid-joao',
  viagem_id = 'uuid-viagem'
WHERE id IN ('uuid-entrega-1', 'uuid-entrega-2', 'uuid-entrega-3');

-- 3. Criar registros de coletas individuais
INSERT INTO viagem_coletas (viagem_id, entrega_id, endereco_id, empresa_id, horario_previsto, quantidade_pacotes, peso_kg, status)
VALUES 
  ('uuid-viagem', 'uuid-entrega-1', 'uuid-endereco-coleta-1', 'uuid-empresa-1', '08:00', 2, 5.0, 'pendente'),
  ('uuid-viagem', 'uuid-entrega-2', 'uuid-endereco-coleta-2', 'uuid-empresa-2', '08:30', 1, 3.0, 'pendente'),
  ('uuid-viagem', 'uuid-entrega-3', 'uuid-endereco-coleta-3', 'uuid-empresa-3', '09:00', 3, 8.0, 'pendente');

-- 4. Criar registros de entregas individuais
INSERT INTO viagem_entregas (viagem_id, entrega_id, endereco_id, destinatario_nome, destinatario_telefone, quantidade_pacotes, peso_kg, status)
VALUES 
  ('uuid-viagem', 'uuid-entrega-1', 'uuid-endereco-entrega-1', 'Maria Silva', '(48) 99999-1111', 2, 5.0, 'pendente'),
  ('uuid-viagem', 'uuid-entrega-2', 'uuid-endereco-entrega-2', 'João Santos', '(48) 99999-2222', 1, 3.0, 'pendente'),
  ('uuid-viagem', 'uuid-entrega-3', 'uuid-endereco-entrega-3', 'Ana Costa', '(48) 99999-3333', 3, 8.0, 'pendente');

-- 5. Otimizar ordem de coletas/entregas (Google Maps)
-- (Atualiza campos ordem_coleta e ordem_entrega)
```

### **Passo 4: Viagem Aparece na Agenda do Entregador**

```
App do Entregador - Tela "Minha Agenda"

┌─────────────────────────────────────┐
│  📅 Minha Agenda                    │
├─────────────────────────────────────┤
│  [Hoje] [Amanhã] [►Quarta] [Quinta] │
├─────────────────────────────────────┤
│                                     │
│  🚚 Entregas Urbanas (Hoje)        │
│  └─ 3 entregas pendentes            │
│                                     │
│  ─────────────────────────────────  │
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
└─────────────────────────────────────┘
```

### **Passo 5: No Dia da Viagem - Entregador Inicia**

```
Quarta-feira, 07:50
├─ Push notification: "🔔 Sua viagem começa em 10 minutos!"
├─ Entregador abre app
├─ Clica na viagem agendada
└─ Vê tela de detalhes com mapa
```

**Tela: Detalhes da Viagem**
```
┌─────────────────────────────────────┐
│  ← Viagem Lages → Florianópolis    │
├─────────────────────────────────────┤
│                                     │
│  [  MAPA INTERATIVO COM PINS  ]    │
│                                     │
│  📍 Pins Vermelhos: Coletas (3)     │
│  📍 Pins Verdes: Entregas (3)       │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  📦 COLETAS (3)                     │
│                                     │
│  ✅ 1. Empresa ABC - Rua A, 100     │
│     └─ 2 pacotes • 5kg              │
│     └─ Status: ⏰ Pendente           │
│     └─ Horário: 08:00               │
│                                     │
│  ⏰ 2. Empresa XYZ - Rua C, 300     │
│     └─ 1 pacote • 3kg               │
│     └─ Status: ⏰ Pendente           │
│     └─ Horário: 08:30               │
│                                     │
│  ⏰ 3. Loja 123 - Rua E, 500        │
│     └─ 3 pacotes • 8kg              │
│     └─ Status: ⏰ Pendente           │
│     └─ Horário: 09:00               │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  🎯 ENTREGAS (3)                    │
│                                     │
│  ⏰ 1. Maria Silva - Av. B, 200     │
│     └─ 2 pacotes • 5kg              │
│     └─ Status: 🔒 Aguardando coleta │
│                                     │
│  ⏰ 2. João Santos - Rua D, 400     │
│     └─ 1 pacote • 3kg               │
│     └─ Status: 🔒 Aguardando coleta │
│                                     │
│  ⏰ 3. Ana Costa - Av. F, 600       │
│     └─ 3 pacotes • 8kg              │
│     └─ Status: 🔒 Aguardando coleta │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [    🚀 INICIAR VIAGEM    ]       │
│                                     │
└─────────────────────────────────────┘
```

### **Passo 6: Entregador Clica "Iniciar Viagem"**

```sql
-- Atualizar viagem
UPDATE viagens_intermunicipais
SET 
  status = 'em_andamento',
  horario_saida_real = NOW()
WHERE id = 'uuid-viagem';

-- Atualizar primeira coleta
UPDATE viagem_coletas
SET status = 'a_caminho'
WHERE viagem_id = 'uuid-viagem'
  AND ordem_coleta = 1;
```

**App mostra:**
```
┌─────────────────────────────────────┐
│  🚗 A caminho da primeira coleta    │
├─────────────────────────────────────┤
│                                     │
│  📍 Empresa ABC                     │
│  Rua A, 100 - Centro               │
│                                     │
│  📦 2 pacotes • 5kg                 │
│  🕐 Previsto: 08:00                 │
│                                     │
│  Distância: 2.5 km                  │
│  Tempo estimado: 8 min              │
│                                     │
│  [   📍 NAVEGAR ATÉ O LOCAL   ]    │
│                                     │
│  [   ✅ CHEGUEI NO LOCAL   ]       │
│                                     │
└─────────────────────────────────────┘
```

### **Passo 7: Entregador Chega no Local de Coleta**

```
Quarta-feira, 08:05
├─ Entregador chegou na Empresa ABC
├─ Clica "CHEGUEI NO LOCAL"
└─ Sistema atualiza status
```

```sql
UPDATE viagem_coletas
SET 
  status = 'chegou',
  horario_chegada = NOW()
WHERE viagem_id = 'uuid-viagem'
  AND ordem_coleta = 1;
```

**App mostra tela de coleta:**
```
┌─────────────────────────────────────┐
│  📦 Coleta - Empresa ABC            │
├─────────────────────────────────────┤
│                                     │
│  Remetente: Empresa ABC Ltda        │
│  Contato: (49) 3333-4444            │
│                                     │
│  📦 Itens para coletar:             │
│  • 2 pacotes                        │
│  • Peso total: 5kg                  │
│  • Descrição: Documentos            │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  📸 Tirar foto dos pacotes          │
│  [  Capturar Foto  ]                │
│                                     │
│  ✍️ Assinatura do remetente         │
│  [  Coletar Assinatura  ]           │
│                                     │
│  💬 Observações (opcional)          │
│  [________________________]         │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [  ❌ Reportar Problema  ]         │
│                                     │
│  [  ✅ CONFIRMAR COLETA  ]         │
│                                     │
└─────────────────────────────────────┘
```

### **Passo 8: Entregador Confirma Coleta**

```
├─ Tirou foto dos pacotes
├─ Coletou assinatura digital
├─ Clicou "CONFIRMAR COLETA"
└─ Sistema salva dados
```

```sql
UPDATE viagem_coletas
SET 
  status = 'coletada',
  horario_coleta = NOW(),
  foto_pacotes = 'https://storage.../foto1.jpg',
  assinatura_remetente = 'data:image/png;base64,...'
WHERE viagem_id = 'uuid-viagem'
  AND ordem_coleta = 1;

-- Automaticamente, próxima coleta fica "a_caminho"
UPDATE viagem_coletas
SET status = 'a_caminho'
WHERE viagem_id = 'uuid-viagem'
  AND ordem_coleta = 2;
```

**App volta para lista e mostra progresso:**
```
┌─────────────────────────────────────┐
│  📦 COLETAS (3)                     │
│                                     │
│  ✅ 1. Empresa ABC - Rua A, 100     │
│     └─ 2 pacotes • 5kg              │
│     └─ Status: ✅ Coletada 08:07    │
│                                     │
│  🚗 2. Empresa XYZ - Rua C, 300     │
│     └─ 1 pacote • 3kg               │
│     └─ Status: 🚗 A caminho         │
│     └─ Horário: 08:30               │
│     └─ [NAVEGAR] [CHEGUEI]          │
│                                     │
│  ⏰ 3. Loja 123 - Rua E, 500        │
│     └─ 3 pacotes • 8kg              │
│     └─ Status: ⏰ Pendente           │
│                                     │
│  ─────────────────────────────────  │
│  Progresso: 1/3 coletas ✅          │
└─────────────────────────────────────┘
```

### **Passo 9: Todas Coletas Concluídas → Inicia Entregas**

```
Quarta-feira, 09:30
├─ Entregador coletou nos 3 pontos
├─ Todas coletas: status "coletada"
└─ Sistema libera entregas automaticamente
```

```sql
-- Quando todas coletas forem concluídas
-- Atualizar primeira entrega
UPDATE viagem_entregas
SET status = 'a_caminho'
WHERE viagem_id = 'uuid-viagem'
  AND ordem_entrega = 1;
```

**App mostra:**
```
┌─────────────────────────────────────┐
│  ✅ Todas coletas concluídas!       │
│                                     │
│  📦 6 pacotes coletados             │
│  ⚖️  16kg total                     │
│                                     │
│  🎯 Iniciando entregas...           │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  🎯 ENTREGAS (3)                    │
│                                     │
│  🚗 1. Maria Silva - Av. B, 200     │
│     └─ 2 pacotes • 5kg              │
│     └─ Status: 🚗 A caminho         │
│     └─ Tel: (48) 99999-1111         │
│     └─ [NAVEGAR] [CHEGUEI]          │
│                                     │
│  ⏰ 2. João Santos - Rua D, 400     │
│     └─ Status: ⏰ Pendente           │
│                                     │
│  ⏰ 3. Ana Costa - Av. F, 600       │
│     └─ Status: ⏰ Pendente           │
└─────────────────────────────────────┘
```

### **Passo 10: Chegou no Local de Entrega**

```
Quarta-feira, 10:45
├─ Entregador chegou no endereço de Maria Silva
├─ Clica "CHEGUEI NO LOCAL"
└─ Sistema atualiza
```

```sql
UPDATE viagem_entregas
SET 
  status = 'chegou',
  horario_chegada = NOW()
WHERE viagem_id = 'uuid-viagem'
  AND ordem_entrega = 1;
```

**Tela de Entrega:**
```
┌─────────────────────────────────────┐
│  🎯 Entrega - Maria Silva           │
├─────────────────────────────────────┤
│                                     │
│  Destinatário: Maria Silva          │
│  Telefone: (48) 99999-1111          │
│  [  📞 Ligar  ]                     │
│                                     │
│  Endereço:                          │
│  Av. B, 200 - Apto 501              │
│  Centro - Florianópolis             │
│                                     │
│  📦 Itens para entregar:            │
│  • 2 pacotes                        │
│  • Peso: 5kg                        │
│  • Origem: Empresa ABC              │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  📸 Tirar foto da entrega           │
│  [  Capturar Foto  ]                │
│                                     │
│  ✍️ Assinatura do destinatário      │
│  [  Coletar Assinatura  ]           │
│                                     │
│  👤 Quem recebeu?                   │
│  ( ) Maria Silva (destinatário)     │
│  ( ) Outra pessoa                   │
│                                     │
│  [Se outra pessoa:]                 │
│  Nome: [______________]             │
│  CPF:  [___.___.___-__]             │
│                                     │
│  💬 Observações (opcional)          │
│  [________________________]         │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [  ❌ Destinatário Ausente  ]      │
│  [  🚫 Recusou Recebimento  ]       │
│                                     │
│  [  ✅ CONFIRMAR ENTREGA  ]        │
│                                     │
└─────────────────────────────────────┘
```

### **Passo 11: Confirma Entrega**

```sql
UPDATE viagem_entregas
SET 
  status = 'entregue',
  horario_entrega = NOW(),
  foto_entrega = 'https://storage.../entrega1.jpg',
  assinatura_destinatario = 'data:image/png;base64,...',
  nome_quem_recebeu = 'Maria Silva'
WHERE viagem_id = 'uuid-viagem'
  AND ordem_entrega = 1;

-- Atualizar entrega principal
UPDATE entregas_intermunicipais
SET 
  status = 'entregue',
  data_entrega_realizada = NOW(),
  foto_entrega = 'https://storage.../entrega1.jpg',
  assinatura_entrega = 'data:image/png;base64,...'
WHERE id = 'uuid-entrega-1';

-- Próxima entrega fica "a_caminho"
UPDATE viagem_entregas
SET status = 'a_caminho'
WHERE viagem_id = 'uuid-viagem'
  AND ordem_entrega = 2;

-- Notificar empresa
-- [Sistema envia notificação para a empresa]
```

### **Passo 12: Todas Entregas Concluídas**

```
Quarta-feira, 12:30
├─ Entregador finalizou todas as 3 entregas
├─ Sistema detecta viagem completa
└─ Solicita finalização
```

**App mostra:**
```
┌─────────────────────────────────────┐
│  🎉 Todas entregas concluídas!      │
├─────────────────────────────────────┤
│                                     │
│  ✅ 3 coletas realizadas            │
│  ✅ 3 entregas concluídas           │
│                                     │
│  📊 Resumo da viagem:               │
│  • Distância: 187 km                │
│  • Tempo total: 4h 30min            │
│  • Início: 08:00                    │
│  • Término: 12:30                   │
│                                     │
│  💰 Valor ganho: R$ 150,00          │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Deseja avaliar a viagem?           │
│  ⭐⭐⭐⭐⭐                         │
│                                     │
│  [  ✅ FINALIZAR VIAGEM  ]         │
│                                     │
└─────────────────────────────────────┘
```

```sql
UPDATE viagens_intermunicipais
SET 
  status = 'concluida',
  horario_chegada_real = NOW(),
  distancia_percorrida_km = 187,
  tempo_total_minutos = 270
WHERE id = 'uuid-viagem';
```

---

## 🔄 Estados Possíveis de Cada Etapa

### **Status de Coleta (`viagem_coletas.status`):**

| Status | Descrição | Ações Disponíveis |
|--------|-----------|-------------------|
| `pendente` | Aguardando vez | - |
| `a_caminho` | Entregador indo até o local | Navegar, Cheguei |
| `chegou` | Chegou no local | Confirmar Coleta, Reportar Problema |
| `coletada` | ✅ Coleta concluída | - |
| `problema` | ❌ Problema na coleta | Ver detalhes |

### **Status de Entrega (`viagem_entregas.status`):**

| Status | Descrição | Ações Disponíveis |
|--------|-----------|-------------------|
| `pendente` | Aguardando coletas | 🔒 Bloqueado |
| `a_caminho` | Indo até o destinatário | Navegar, Cheguei, Ligar |
| `chegou` | Chegou no local | Confirmar Entrega, Ausente, Recusado |
| `entregue` | ✅ Entrega concluída | - |
| `ausente` | 🏠 Destinatário ausente | Reagendar, Retornar |
| `recusada` | 🚫 Recusou recebimento | Ver motivo |

### **Status da Viagem (`viagens_intermunicipais.status`):**

| Status | Descrição |
|--------|-----------|
| `agendada` | ⏰ Viagem programada, aguardando dia/hora |
| `em_andamento` | 🚗 Viagem em execução |
| `concluida` | ✅ Viagem finalizada |
| `cancelada` | ❌ Viagem cancelada |

---

## 📱 Telas do App (Resumo)

### 1. **Tela: Minha Agenda**
- Lista de dias da semana
- Entregas urbanas do dia
- Viagens intermunicipais agendadas
- Badge com contador

### 2. **Tela: Detalhes da Viagem (Antes de Iniciar)**
- Mapa com todos os pontos
- Lista de coletas (expandível)
- Lista de entregas (expandível)
- Botão "Iniciar Viagem"

### 3. **Tela: Viagem em Andamento**
- Progresso visual (1/3, 2/3, 3/3)
- Lista de coletas com status
- Lista de entregas com status
- Card do ponto atual destacado

### 4. **Tela: Confirmação de Coleta**
- Foto dos pacotes
- Assinatura do remetente
- Observações
- Botão confirmar

### 5. **Tela: Confirmação de Entrega**
- Foto da entrega
- Assinatura do destinatário
- Quem recebeu (com CPF se for outra pessoa)
- Observações
- Botões: Confirmar, Ausente, Recusado

### 6. **Tela: Resumo Final**
- Estatísticas da viagem
- Valor ganho
- Avaliação
- Botão finalizar

---

## 🎯 Vantagens desta Abordagem

✅ **Organização:** Entregador vê agenda completa  
✅ **Flexibilidade:** Pode fazer entregas urbanas entre viagens  
✅ **Rastreabilidade:** Status individual de cada coleta/entrega  
✅ **Comprovação:** Fotos e assinaturas de cada etapa  
✅ **Transparência:** Empresa acompanha em tempo real  
✅ **Segurança:** CPF de quem recebeu (se não for destinatário)  
✅ **Otimização:** Ordem otimizada via Google Maps  

---

## 🔔 Notificações Durante a Viagem

### **Para Entregador:**
- 1 dia antes: "Lembrete: Você tem uma viagem amanhã às 8h"
- 1h antes: "Sua viagem começa em 1 hora"
- Na hora: "Hora de iniciar sua viagem!"
- A cada coleta: "Próxima coleta: Empresa XYZ"
- A cada entrega: "Próxima entrega: João Santos"

### **Para Empresa:**
- Quando aceita: "Sua entrega foi aceita por João"
- 1 dia antes: "Sua coleta será realizada amanhã"
- Ao coletar: "✅ Seus pacotes foram coletados"
- Ao entregar: "✅ Entrega concluída para Maria Silva"

### **Para Destinatário (opcional):**
- No dia: "Sua encomenda está a caminho"
- 30min antes: "Entregador chegando em 30 minutos"
- Ao chegar: "Entregador chegou no local"

---

Quer que eu gere o código completo desta implementação?
