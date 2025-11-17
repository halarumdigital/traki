# Sistema de Capacidade de Pacotes - Entregas Intermunicipais

## 🎯 Conceito: Capacidade por Rota

Quando o entregador se atrela a uma rota, ele define:
- **Quantos pacotes pode levar** (capacidade total)
- **Quais dias da semana** faz a rota
- **Horários** de saída e chegada

Exemplo:
```
Entregador João se atrela à rota Lages → Florianópolis
├─ Capacidade: 50 pacotes
├─ Peso máximo: 100kg
├─ Dias: Segunda, Quarta, Sexta
└─ Horário saída: 08:00
```

---

## 🗄️ Estrutura de Banco (Atualizada)

### Tabela: `entregador_rotas` (COM CAPACIDADE)

```sql
CREATE TABLE entregador_rotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entregador_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id) ON DELETE CASCADE,
  
  -- Disponibilidade
  dias_semana INTEGER[] NOT NULL, -- [1,2,3,4,5] = Seg a Sex
  horario_saida TIME NOT NULL,
  horario_chegada TIME,
  
  -- ⭐ CAPACIDADES DEFINIDAS PELO ENTREGADOR ⭐
  capacidade_pacotes INTEGER NOT NULL, -- Quantos pacotes pode levar
  capacidade_peso_kg DECIMAL(10,2) NOT NULL, -- Quanto peso suporta
  capacidade_volume_m3 DECIMAL(10,3), -- Volume do veículo (opcional)
  
  -- Configurações
  aceita_multiplas_coletas BOOLEAN DEFAULT true, -- Pode coletar em vários lugares?
  aceita_multiplas_entregas BOOLEAN DEFAULT true, -- Pode entregar em vários lugares?
  raio_coleta_km DECIMAL(10,2), -- Raio máximo para coletas na cidade origem
  
  -- Status
  ativa BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(entregador_id, rota_id),
  
  -- Validações
  CHECK (capacidade_pacotes > 0),
  CHECK (capacidade_peso_kg > 0),
  CHECK (array_length(dias_semana, 1) > 0)
);

CREATE INDEX idx_entregador_rotas_entregador ON entregador_rotas(entregador_id);
CREATE INDEX idx_entregador_rotas_rota ON entregador_rotas(rota_id);
CREATE INDEX idx_entregador_rotas_ativas ON entregador_rotas(ativa);
CREATE INDEX idx_entregador_rotas_dias ON entregador_rotas USING GIN(dias_semana);
```

### Nova Tabela: `entregador_capacidade_diaria`

Para controlar quanto o entregador já aceitou em cada dia:

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
  
  -- Disponível
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

---

## 🔄 Fluxo Completo com Capacidade

### **Passo 1: Entregador Se Atrela à Rota**

**Tela no App:**
```
┌─────────────────────────────────────┐
│  Selecionar Rota                    │
├─────────────────────────────────────┤
│                                     │
│  📍 Lages → Florianópolis           │
│  🚗 180 km • ~2h30min               │
│  💰 Valor médio: R$ 50/entrega      │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  📅 Dias da Semana                  │
│  ☑ Segunda    ☑ Terça               │
│  ☑ Quarta     ☐ Quinta              │
│  ☑ Sexta      ☐ Sábado              │
│  ☐ Domingo                          │
│                                     │
│  🕐 Horário de Saída                │
│  [08:00] ⏰                          │
│                                     │
│  🕐 Horário de Chegada (estimado)   │
│  [11:00] ⏰                          │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ⭐ CAPACIDADE DO SEU VEÍCULO       │
│                                     │
│  📦 Quantos pacotes pode levar?     │
│  [  50  ] pacotes                   │
│  (Exemplo: carro pequeno 20-30,     │
│   van 50-70, caminhão 100+)         │
│                                     │
│  ⚖️  Peso máximo suportado          │
│  [  100  ] kg                       │
│                                     │
│  📐 Volume do veículo (opcional)    │
│  [  2.5  ] m³                       │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ☑ Aceito múltiplas coletas         │
│  ☑ Aceito múltiplas entregas        │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [  💾 SALVAR E ATIVAR ROTA  ]     │
│                                     │
└─────────────────────────────────────┘
```

**Código - API:**
```javascript
// POST /api/entregador/rotas

async atrelarRota(req, res) {
  try {
    const entregador_id = req.user.id;
    const {
      rota_id,
      dias_semana,
      horario_saida,
      horario_chegada,
      capacidade_pacotes,
      capacidade_peso_kg,
      capacidade_volume_m3,
      aceita_multiplas_coletas,
      aceita_multiplas_entregas
    } = req.body;

    // Validações
    if (capacidade_pacotes < 1) {
      return res.status(400).json({ 
        error: 'Capacidade de pacotes deve ser pelo menos 1' 
      });
    }

    if (capacidade_peso_kg < 1) {
      return res.status(400).json({ 
        error: 'Capacidade de peso deve ser pelo menos 1kg' 
      });
    }

    if (!dias_semana || dias_semana.length === 0) {
      return res.status(400).json({ 
        error: 'Selecione pelo menos 1 dia da semana' 
      });
    }

    // Inserir ou atualizar
    const query = `
      INSERT INTO entregador_rotas (
        entregador_id,
        rota_id,
        dias_semana,
        horario_saida,
        horario_chegada,
        capacidade_pacotes,
        capacidade_peso_kg,
        capacidade_volume_m3,
        aceita_multiplas_coletas,
        aceita_multiplas_entregas,
        ativa
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      ON CONFLICT (entregador_id, rota_id) 
      DO UPDATE SET
        dias_semana = EXCLUDED.dias_semana,
        horario_saida = EXCLUDED.horario_saida,
        horario_chegada = EXCLUDED.horario_chegada,
        capacidade_pacotes = EXCLUDED.capacidade_pacotes,
        capacidade_peso_kg = EXCLUDED.capacidade_peso_kg,
        capacidade_volume_m3 = EXCLUDED.capacidade_volume_m3,
        aceita_multiplas_coletas = EXCLUDED.aceita_multiplas_coletas,
        aceita_multiplas_entregas = EXCLUDED.aceita_multiplas_entregas,
        ativa = true,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      entregador_id,
      rota_id,
      dias_semana,
      horario_saida,
      horario_chegada,
      capacidade_pacotes,
      capacidade_peso_kg,
      capacidade_volume_m3,
      aceita_multiplas_coletas,
      aceita_multiplas_entregas
    ]);

    return res.json({
      message: 'Rota ativada com sucesso!',
      rota: result.rows[0]
    });

  } catch (error) {
    console.error('Erro ao atrelar rota:', error);
    return res.status(500).json({ error: 'Erro ao salvar rota' });
  }
}
```

---

### **Passo 2: Entregador Vê Entregas Disponíveis (COM VALIDAÇÃO)**

**Query para buscar entregas que ele PODE aceitar:**

```sql
-- Buscar entregas disponíveis respeitando a capacidade do entregador
WITH capacidade_atual AS (
  SELECT 
    ecd.entregador_id,
    ecd.rota_id,
    ecd.data,
    ecd.pacotes_disponiveis,
    ecd.peso_disponivel_kg,
    er.capacidade_pacotes,
    er.capacidade_peso_kg
  FROM entregador_capacidade_diaria ecd
  INNER JOIN entregador_rotas er ON er.entregador_id = ecd.entregador_id 
    AND er.rota_id = ecd.rota_id
  WHERE 
    ecd.entregador_id = $1 -- entregador_id
    AND ecd.data = $2 -- data
    AND ecd.rota_id = $3 -- rota_id
    
  UNION ALL
  
  -- Se não existe registro ainda, pega capacidade total
  SELECT 
    er.entregador_id,
    er.rota_id,
    $2::DATE as data,
    er.capacidade_pacotes as pacotes_disponiveis,
    er.capacidade_peso_kg as peso_disponivel_kg,
    er.capacidade_pacotes,
    er.capacidade_peso_kg
  FROM entregador_rotas er
  WHERE 
    er.entregador_id = $1
    AND er.rota_id = $3
    AND NOT EXISTS (
      SELECT 1 FROM entregador_capacidade_diaria ecd2
      WHERE ecd2.entregador_id = er.entregador_id
        AND ecd2.rota_id = er.rota_id
        AND ecd2.data = $2
    )
  LIMIT 1
)
SELECT DISTINCT
  ei.*,
  r.nome_rota,
  r.distancia_km,
  co.nome as cidade_origem,
  cd.nome as cidade_destino,
  emp.nome as empresa_nome,
  ca.pacotes_disponiveis,
  ca.peso_disponivel_kg,
  -- Indicador se PODE aceitar
  CASE 
    WHEN ei.quantidade_pacotes <= ca.pacotes_disponiveis 
      AND ei.peso_kg <= ca.peso_disponivel_kg 
    THEN true 
    ELSE false 
  END as pode_aceitar
FROM entregas_intermunicipais ei
INNER JOIN rotas_intermunicipais r ON ei.rota_id = r.id
INNER JOIN cidades co ON r.cidade_origem_id = co.id
INNER JOIN cidades cd ON r.cidade_destino_id = cd.id
INNER JOIN users emp ON ei.empresa_id = emp.id
INNER JOIN entregador_rotas er ON er.rota_id = ei.rota_id
CROSS JOIN capacidade_atual ca
WHERE 
  er.entregador_id = $1
  AND ei.rota_id = $3
  AND ei.status = 'aguardando_entregador'
  AND er.ativa = true
  AND EXTRACT(DOW FROM ei.data_coleta_agendada) + 1 = ANY(er.dias_semana)
  AND DATE(ei.data_coleta_agendada) = $2
ORDER BY ei.horario_coleta_inicio;
```

**Tela no App (com indicador de capacidade):**

```
┌─────────────────────────────────────┐
│  Entregas Disponíveis               │
│  Quarta-feira, 20/11                │
├─────────────────────────────────────┤
│  📊 Sua Capacidade:                 │
│  📦 45/50 pacotes disponíveis       │
│  ⚖️  88/100kg disponíveis           │
│                                     │
│  ☑ 2 entregas já aceitas            │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ✅ INTER-20251118-001              │
│  ┌───────────────────────────────┐ │
│  │ ☑ Lages → Florianópolis       │ │
│  │ 📅 Qua 08:00                  │ │
│  │ 📦 3 pacotes • 4kg            │ │
│  │ 💰 R$ 35,00                   │ │
│  │ ✅ Você pode aceitar           │ │
│  │                               │ │
│  │ [Ver Detalhes] [Aceitar]      │ │
│  └───────────────────────────────┘ │
│                                     │
│  ✅ INTER-20251118-002              │
│  ┌───────────────────────────────┐ │
│  │ ☑ Lages → Florianópolis       │ │
│  │ 📅 Qua 08:30                  │ │
│  │ 📦 2 pacotes • 3kg            │ │
│  │ 💰 R$ 32,00                   │ │
│  │ ✅ Você pode aceitar           │ │
│  │                               │ │
│  │ [Ver Detalhes] [Aceitar]      │ │
│  └───────────────────────────────┘ │
│                                     │
│  ❌ INTER-20251118-003              │
│  ┌───────────────────────────────┐ │
│  │ ☑ Lages → Florianópolis       │ │
│  │ 📅 Qua 09:00                  │ │
│  │ 📦 50 pacotes • 45kg          │ │
│  │ 💰 R$ 120,00                  │ │
│  │ ⚠️ EXCEDE SUA CAPACIDADE      │ │
│  │    (você tem 45 pacotes       │ │
│  │     disponíveis)              │ │
│  │                               │ │
│  │ [Ver Detalhes]                │ │
│  └───────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  💡 Dica: Você ainda pode aceitar   │
│  até 45 pacotes (88kg)              │
│                                     │
└─────────────────────────────────────┘
```

---

### **Passo 3: Validação ao Aceitar Entrega**

**Código - Validar Capacidade:**

```javascript
// Service para validar e aceitar entregas

class CapacidadeService {
  
  /**
   * Verifica se entregador tem capacidade para aceitar entregas
   */
  async validarCapacidade(entregador_id, rota_id, data, entregas_ids) {
    
    // 1. Buscar capacidade do entregador
    const capacidadeQuery = `
      SELECT capacidade_pacotes, capacidade_peso_kg
      FROM entregador_rotas
      WHERE entregador_id = $1 AND rota_id = $2 AND ativa = true
    `;
    const capResult = await pool.query(capacidadeQuery, [entregador_id, rota_id]);
    
    if (capResult.rows.length === 0) {
      throw new Error('Você não está atrelado a esta rota');
    }
    
    const capacidade_total = capResult.rows[0];
    
    // 2. Buscar quanto já foi aceito hoje
    const jáAceitoQuery = `
      SELECT 
        COALESCE(SUM(ei.quantidade_pacotes), 0) as pacotes_aceitos,
        COALESCE(SUM(ei.peso_kg), 0) as peso_aceito
      FROM entregas_intermunicipais ei
      WHERE 
        ei.entregador_id = $1
        AND ei.rota_id = $2
        AND DATE(ei.data_coleta_agendada) = $3
        AND ei.status IN ('aceita', 'em_coleta', 'coletada', 'em_entrega')
    `;
    const jáAceito = await pool.query(jáAceitoQuery, [entregador_id, rota_id, data]);
    
    // 3. Calcular quanto tem disponível
    const pacotes_disponiveis = capacidade_total.capacidade_pacotes - jáAceito.rows[0].pacotes_aceitos;
    const peso_disponivel = capacidade_total.capacidade_peso_kg - jáAceito.rows[0].peso_aceito;
    
    // 4. Buscar total das entregas que quer aceitar
    const entregasQuery = `
      SELECT 
        SUM(quantidade_pacotes) as total_pacotes,
        SUM(peso_kg) as total_peso
      FROM entregas_intermunicipais
      WHERE id = ANY($1)
    `;
    const entregas = await pool.query(entregasQuery, [entregas_ids]);
    const total = entregas.rows[0];
    
    // 5. Validar
    if (total.total_pacotes > pacotes_disponiveis) {
      return {
        valido: false,
        motivo: 'capacidade_pacotes',
        mensagem: `Você só pode aceitar ${pacotes_disponiveis} pacotes. Tentando aceitar ${total.total_pacotes}.`,
        dados: {
          capacidade_total: capacidade_total.capacidade_pacotes,
          já_aceito: jáAceito.rows[0].pacotes_aceitos,
          disponível: pacotes_disponiveis,
          tentando_aceitar: total.total_pacotes
        }
      };
    }
    
    if (total.total_peso > peso_disponivel) {
      return {
        valido: false,
        motivo: 'capacidade_peso',
        mensagem: `Você só pode aceitar ${peso_disponivel.toFixed(2)}kg. Tentando aceitar ${total.total_peso.toFixed(2)}kg.`,
        dados: {
          capacidade_total: capacidade_total.capacidade_peso_kg,
          já_aceito: jáAceito.rows[0].peso_aceito,
          disponível: peso_disponivel,
          tentando_aceitar: total.total_peso
        }
      };
    }
    
    // 6. Tudo OK!
    return {
      valido: true,
      dados: {
        pacotes_disponiveis_apos: pacotes_disponiveis - total.total_pacotes,
        peso_disponivel_apos: peso_disponivel - total.total_peso
      }
    };
  }
  
  /**
   * Atualiza ou cria registro de capacidade diária
   */
  async atualizarCapacidadeDiaria(entregador_id, rota_id, data, pacotes_aceitos, peso_aceito) {
    
    const query = `
      INSERT INTO entregador_capacidade_diaria (
        entregador_id,
        rota_id,
        data,
        capacidade_total_pacotes,
        capacidade_total_peso_kg,
        pacotes_aceitos,
        peso_aceito_kg,
        entregas_aceitas
      )
      SELECT 
        $1, $2, $3,
        er.capacidade_pacotes,
        er.capacidade_peso_kg,
        $4, $5, 1
      FROM entregador_rotas er
      WHERE er.entregador_id = $1 AND er.rota_id = $2
      
      ON CONFLICT (entregador_id, rota_id, data)
      DO UPDATE SET
        pacotes_aceitos = entregador_capacidade_diaria.pacotes_aceitos + $4,
        peso_aceito_kg = entregador_capacidade_diaria.peso_aceito_kg + $5,
        entregas_aceitas = entregador_capacidade_diaria.entregas_aceitas + 1,
        updated_at = NOW()
      
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      entregador_id, 
      rota_id, 
      data, 
      pacotes_aceitos, 
      peso_aceito
    ]);
    
    return result.rows[0];
  }
}

module.exports = new CapacidadeService();
```

**Controller - Aceitar Entregas (com validação):**

```javascript
async aceitarEntregas(req, res) {
  try {
    const entregador_id = req.user.id;
    const { entrega_ids, data_viagem } = req.body;

    if (!Array.isArray(entrega_ids) || entrega_ids.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos uma entrega' });
    }

    // Buscar rota das entregas
    const entregasQuery = `
      SELECT DISTINCT rota_id, SUM(quantidade_pacotes) as total_pacotes, SUM(peso_kg) as total_peso
      FROM entregas_intermunicipais
      WHERE id = ANY($1) AND status = 'aguardando_entregador'
      GROUP BY rota_id
    `;
    const entregas = await pool.query(entregasQuery, [entrega_ids]);
    
    if (entregas.rows.length === 0) {
      return res.status(400).json({ error: 'Entregas não encontradas ou já foram aceitas' });
    }
    
    if (entregas.rows.length > 1) {
      return res.status(400).json({ error: 'Entregas devem ser da mesma rota' });
    }
    
    const rota_id = entregas.rows[0].rota_id;
    const total_pacotes = entregas.rows[0].total_pacotes;
    const total_peso = entregas.rows[0].total_peso;

    // ⭐ VALIDAR CAPACIDADE ⭐
    const validacao = await capacidadeService.validarCapacidade(
      entregador_id,
      rota_id,
      data_viagem,
      entrega_ids
    );

    if (!validacao.valido) {
      return res.status(400).json({
        error: validacao.mensagem,
        detalhes: validacao.dados
      });
    }

    // Criar ou buscar viagem
    let viagem_id = await viagemService.criarOuBuscarViagem(
      entregador_id,
      rota_id,
      data_viagem
    );

    // Aceitar entregas
    const updateQuery = `
      UPDATE entregas_intermunicipais
      SET 
        status = 'aceita',
        entregador_id = $1,
        viagem_id = $2,
        updated_at = NOW()
      WHERE id = ANY($3)
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [entregador_id, viagem_id, entrega_ids]);

    // ⭐ ATUALIZAR CAPACIDADE DIÁRIA ⭐
    await capacidadeService.atualizarCapacidadeDiaria(
      entregador_id,
      rota_id,
      data_viagem,
      total_pacotes,
      total_peso
    );

    // Criar registros de coletas e entregas individuais
    await viagemService.criarColetasEntregas(viagem_id, result.rows);

    // Notificar empresas
    for (const entrega of result.rows) {
      await notificacaoService.notificarEmpresa(entrega.empresa_id, {
        title: 'Entrega aceita!',
        body: `Sua entrega ${entrega.codigo_rastreio} foi aceita`,
        data: { type: 'entrega_aceita', entrega_id: entrega.id }
      });
    }

    return res.json({
      message: 'Entregas aceitas com sucesso!',
      viagem_id,
      entregas_aceitas: result.rows.length,
      capacidade_restante: validacao.dados
    });

  } catch (error) {
    console.error('Erro ao aceitar entregas:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

---

### **Passo 4: Entregador Visualiza Sua Capacidade**

**Nova Tela: Minha Capacidade (Opcional)**

```
┌─────────────────────────────────────┐
│  Minha Capacidade                   │
│  Rota: Lages → Florianópolis        │
├─────────────────────────────────────┤
│                                     │
│  ⚙️ CONFIGURAÇÃO                    │
│  📦 Capacidade: 50 pacotes          │
│  ⚖️  Peso máximo: 100kg             │
│  📐 Volume: 2.5 m³                  │
│                                     │
│  📅 Dias: Seg, Qua, Sex             │
│  🕐 Horário: 08:00 - 11:00          │
│                                     │
│  [Editar Configuração]              │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  📊 USO HOJE (Quarta, 20/11)        │
│                                     │
│  📦 Pacotes                         │
│  ▓▓▓▓▓▓▓░░░ 35/50 (70%)            │
│                                     │
│  ⚖️  Peso                           │
│  ▓▓▓▓▓▓░░░░ 65/100kg (65%)         │
│                                     │
│  📊 Entregas Aceitas: 3             │
│                                     │
│  ✅ Você ainda pode aceitar:        │
│     • 15 pacotes                    │
│     • 35kg                          │
│                                     │
│  [Ver Entregas Disponíveis]         │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  📅 PRÓXIMOS DIAS                   │
│                                     │
│  Sexta, 22/11                       │
│  📦 0/50 pacotes                    │
│  💰 Nenhuma entrega aceita ainda    │
│                                     │
│  Segunda, 25/11                     │
│  📦 0/50 pacotes                    │
│  💰 Nenhuma entrega aceita ainda    │
│                                     │
└─────────────────────────────────────┘
```

---

## 📊 Queries Úteis

### 1. Verificar Capacidade Disponível

```sql
-- Ver capacidade disponível de um entregador em uma data
SELECT 
  er.capacidade_pacotes,
  er.capacidade_peso_kg,
  COALESCE(ecd.pacotes_aceitos, 0) as pacotes_aceitos,
  COALESCE(ecd.peso_aceito_kg, 0) as peso_aceito,
  er.capacidade_pacotes - COALESCE(ecd.pacotes_aceitos, 0) as pacotes_disponiveis,
  er.capacidade_peso_kg - COALESCE(ecd.peso_aceito_kg, 0) as peso_disponivel,
  COALESCE(ecd.entregas_aceitas, 0) as entregas_aceitas
FROM entregador_rotas er
LEFT JOIN entregador_capacidade_diaria ecd 
  ON ecd.entregador_id = er.entregador_id 
  AND ecd.rota_id = er.rota_id
  AND ecd.data = $2
WHERE 
  er.entregador_id = $1
  AND er.rota_id = $3
  AND er.ativa = true;
```

### 2. Listar Entregadores com Capacidade

```sql
-- Buscar entregadores que TÊM capacidade para uma entrega específica
SELECT 
  u.id,
  u.nome,
  u.telefone,
  er.capacidade_pacotes,
  er.capacidade_peso_kg,
  COALESCE(ecd.pacotes_aceitos, 0) as pacotes_aceitos,
  er.capacidade_pacotes - COALESCE(ecd.pacotes_aceitos, 0) as pacotes_disponiveis,
  er.capacidade_peso_kg - COALESCE(ecd.peso_aceito_kg, 0) as peso_disponivel
FROM entregador_rotas er
INNER JOIN users u ON er.entregador_id = u.id
LEFT JOIN entregador_capacidade_diaria ecd 
  ON ecd.entregador_id = er.entregador_id 
  AND ecd.rota_id = er.rota_id
  AND ecd.data = $2
WHERE 
  er.rota_id = $1
  AND er.ativa = true
  AND $3 = ANY(er.dias_semana) -- dia da semana
  AND (er.capacidade_pacotes - COALESCE(ecd.pacotes_aceitos, 0)) >= $4 -- pacotes necessários
  AND (er.capacidade_peso_kg - COALESCE(ecd.peso_aceito_kg, 0)) >= $5 -- peso necessário
ORDER BY pacotes_disponiveis DESC;
```

### 3. Relatório de Uso de Capacidade

```sql
-- Relatório de aproveitamento da capacidade
SELECT 
  u.nome as entregador,
  r.nome_rota,
  ecd.data,
  ecd.capacidade_total_pacotes,
  ecd.pacotes_aceitos,
  ecd.pacotes_disponiveis,
  ROUND((ecd.pacotes_aceitos::DECIMAL / ecd.capacidade_total_pacotes * 100), 2) as percentual_uso,
  ecd.entregas_aceitas,
  CASE 
    WHEN ecd.pacotes_disponiveis = 0 THEN 'Capacidade Máxima'
    WHEN ecd.pacotes_aceitos = 0 THEN 'Não Utilizado'
    WHEN (ecd.pacotes_aceitos::DECIMAL / ecd.capacidade_total_pacotes) >= 0.8 THEN 'Bem Aproveitado'
    ELSE 'Subutilizado'
  END as status_aproveitamento
FROM entregador_capacidade_diaria ecd
INNER JOIN users u ON ecd.entregador_id = u.id
INNER JOIN rotas_intermunicipais r ON ecd.rota_id = r.id
WHERE ecd.data >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ecd.data DESC, percentual_uso DESC;
```

---

## ⚡ Triggers Automáticos

```sql
-- Trigger para liberar capacidade ao cancelar entrega
CREATE OR REPLACE FUNCTION liberar_capacidade_cancelamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a entrega foi cancelada, libera a capacidade
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

## 🎯 Vantagens do Sistema de Capacidade

✅ **Controle Real:** Entregador define quanto pode levar  
✅ **Sem Sobrecarga:** Sistema impede aceitar além da capacidade  
✅ **Flexibilidade:** Capacidade diferente por rota/veículo  
✅ **Otimização:** Melhor aproveitamento da capacidade  
✅ **Previsibilidade:** Empresa sabe se tem entregador disponível  
✅ **Relatórios:** Análise de aproveitamento da frota  

---

Agora o sistema está completo com controle de capacidade! Quer que eu gere mais alguma funcionalidade específica?
