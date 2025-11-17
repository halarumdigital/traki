# Exemplos de Código - Módulo de Entregas Intermunicipais

## 📚 Queries SQL Úteis (PostgreSQL)

### 1. Buscar Rotas Disponíveis por Origem e Destino

```sql
-- Buscar rotas entre duas cidades
SELECT 
  r.*,
  co.nome as cidade_origem,
  cd.nome as cidade_destino,
  COUNT(ei.id) as entregas_pendentes
FROM rotas_intermunicipais r
INNER JOIN cidades co ON r.cidade_origem_id = co.id
INNER JOIN cidades cd ON r.cidade_destino_id = cd.id
LEFT JOIN entregas_intermunicipais ei ON r.id = ei.rota_id 
  AND ei.status = 'aguardando_entregador'
WHERE 
  r.ativa = true
  AND co.id = $1  -- cidade_origem_id
  AND cd.id = $2  -- cidade_destino_id
GROUP BY r.id, co.nome, cd.nome;
```

### 2. Listar Entregadores Disponíveis para uma Rota

```sql
-- Buscar entregadores que fazem determinada rota em determinado dia
SELECT 
  u.id,
  u.nome,
  u.telefone,
  u.avaliacao_media,
  er.horario_saida,
  er.capacidade_pacotes,
  er.capacidade_peso_kg,
  COUNT(ei.id) as entregas_aceitas_dia
FROM entregador_rotas er
INNER JOIN users u ON er.entregador_id = u.id
LEFT JOIN entregas_intermunicipais ei ON ei.entregador_id = u.id 
  AND DATE(ei.data_coleta_agendada) = $2  -- data
  AND ei.status NOT IN ('cancelada', 'entregue')
WHERE 
  er.rota_id = $1  -- rota_id
  AND er.ativa = true
  AND $3 = ANY(er.dias_semana)  -- dia da semana (1-7)
GROUP BY u.id, u.nome, u.telefone, u.avaliacao_media, 
         er.horario_saida, er.capacidade_pacotes, er.capacidade_peso_kg
HAVING COUNT(ei.id) < er.capacidade_pacotes
ORDER BY u.avaliacao_media DESC, COUNT(ei.id) ASC;
```

### 3. Calcular Valor Total de uma Viagem

```sql
-- Calcular valor total considerando todas as entregas de uma viagem
WITH viagem_dados AS (
  SELECT 
    v.id as viagem_id,
    r.valor_base,
    r.distancia_km,
    r.valor_por_km,
    r.valor_por_parada,
    COUNT(DISTINCT ei.endereco_coleta_id) as total_coletas,
    COUNT(DISTINCT ei.endereco_entrega_id) as total_entregas,
    SUM(ei.valor_entregador) as soma_valores
  FROM viagens_intermunicipais v
  INNER JOIN rotas_intermunicipais r ON v.rota_id = r.id
  INNER JOIN entregas_intermunicipais ei ON ei.viagem_id = v.id
  WHERE v.id = $1  -- viagem_id
  GROUP BY v.id, r.valor_base, r.distancia_km, r.valor_por_km, r.valor_por_parada
)
SELECT 
  viagem_id,
  valor_base,
  distancia_km,
  valor_por_km,
  (distancia_km * valor_por_km) as valor_distancia,
  valor_por_parada,
  (total_coletas + total_entregas - 2) as paradas_adicionais,
  ((total_coletas + total_entregas - 2) * valor_por_parada) as valor_paradas,
  soma_valores as valor_total_entregador
FROM viagem_dados;
```

### 4. Entregas Pendentes por Rota e Data

```sql
-- Listar entregas aguardando entregador para uma rota específica
SELECT 
  ei.id,
  ei.codigo_rastreio,
  ei.data_coleta_agendada,
  ei.horario_coleta_inicio,
  ei.horario_coleta_fim,
  ei.quantidade_pacotes,
  ei.peso_kg,
  ei.valor_entregador,
  emp.nome as empresa_nome,
  ec.rua || ', ' || ec.numero || ' - ' || ec.bairro as endereco_coleta,
  ed.rua || ', ' || ed.numero || ' - ' || ed.bairro as endereco_entrega,
  ei.destinatario_nome,
  ei.destinatario_telefone
FROM entregas_intermunicipais ei
INNER JOIN users emp ON ei.empresa_id = emp.id
INNER JOIN enderecos ec ON ei.endereco_coleta_id = ec.id
INNER JOIN enderecos ed ON ei.endereco_entrega_id = ed.id
WHERE 
  ei.rota_id = $1  -- rota_id
  AND ei.status = 'aguardando_entregador'
  AND ei.data_coleta_agendada = $2  -- data
ORDER BY ei.horario_coleta_inicio;
```

### 5. Histórico de Viagens do Entregador

```sql
-- Buscar histórico completo de viagens com estatísticas
SELECT 
  v.id,
  v.codigo_viagem,
  v.data_viagem,
  r.nome_rota,
  v.horario_saida_real,
  v.horario_chegada_real,
  EXTRACT(EPOCH FROM (v.horario_chegada_real - v.horario_saida_real))/3600 as horas_viagem,
  v.total_coletas,
  v.total_entregas,
  v.total_km,
  v.valor_total,
  v.status,
  COUNT(ei.id) FILTER (WHERE ei.status = 'entregue') as entregas_concluidas,
  COUNT(ei.id) FILTER (WHERE ei.status = 'problema') as entregas_com_problema
FROM viagens_intermunicipais v
INNER JOIN rotas_intermunicipais r ON v.rota_id = r.id
LEFT JOIN entregas_intermunicipais ei ON ei.viagem_id = v.id
WHERE v.entregador_id = $1  -- entregador_id
GROUP BY v.id, v.codigo_viagem, v.data_viagem, r.nome_rota,
         v.horario_saida_real, v.horario_chegada_real,
         v.total_coletas, v.total_entregas, v.total_km, v.valor_total, v.status
ORDER BY v.data_viagem DESC
LIMIT 50;
```

### 6. Dashboard de Estatísticas (Admin)

```sql
-- Estatísticas gerais do sistema
SELECT 
  (SELECT COUNT(*) FROM rotas_intermunicipais WHERE ativa = true) as rotas_ativas,
  (SELECT COUNT(DISTINCT entregador_id) FROM entregador_rotas WHERE ativa = true) as entregadores_ativos,
  (SELECT COUNT(*) FROM entregas_intermunicipais WHERE status = 'aguardando_entregador') as entregas_pendentes,
  (SELECT COUNT(*) FROM entregas_intermunicipais 
   WHERE status IN ('aceita', 'em_coleta', 'coletada', 'em_entrega')) as entregas_em_andamento,
  (SELECT COUNT(*) FROM entregas_intermunicipais 
   WHERE status = 'entregue' 
   AND DATE(data_entrega_realizada) = CURRENT_DATE) as entregas_hoje,
  (SELECT COALESCE(SUM(taxa_plataforma), 0) FROM entregas_intermunicipais 
   WHERE status = 'entregue' 
   AND DATE(data_entrega_realizada) >= DATE_TRUNC('month', CURRENT_DATE)) as receita_mes;
```

### 7. Rotas Mais Populares

```sql
-- Top 10 rotas com mais entregas
SELECT 
  r.id,
  r.nome_rota,
  co.nome || ' → ' || cd.nome as rota_descricao,
  r.distancia_km,
  COUNT(ei.id) as total_entregas,
  COUNT(DISTINCT ei.empresa_id) as total_empresas,
  COUNT(DISTINCT ei.entregador_id) as total_entregadores,
  COALESCE(SUM(ei.taxa_plataforma), 0) as receita_total
FROM rotas_intermunicipais r
INNER JOIN cidades co ON r.cidade_origem_id = co.id
INNER JOIN cidades cd ON r.cidade_destino_id = cd.id
LEFT JOIN entregas_intermunicipais ei ON ei.rota_id = r.id
  AND ei.status = 'entregue'
  AND ei.created_at >= DATE_TRUNC('month', CURRENT_DATE)
WHERE r.ativa = true
GROUP BY r.id, r.nome_rota, co.nome, cd.nome, r.distancia_km
ORDER BY total_entregas DESC
LIMIT 10;
```

### 8. Otimizar Ordem de Coletas/Entregas (Com PostGIS)

```sql
-- Se usar PostGIS para cálculos geográficos
-- Ordena pontos de coleta pela proximidade (Traveling Salesman simplificado)
WITH pontos_ordenados AS (
  SELECT 
    ei.id,
    ei.codigo_rastreio,
    ec.latitude,
    ec.longitude,
    ST_MakePoint(ec.longitude, ec.latitude)::geography as ponto,
    'coleta' as tipo
  FROM entregas_intermunicipais ei
  INNER JOIN enderecos ec ON ei.endereco_coleta_id = ec.id
  WHERE ei.viagem_id = $1
  
  UNION ALL
  
  SELECT 
    ei.id,
    ei.codigo_rastreio,
    ed.latitude,
    ed.longitude,
    ST_MakePoint(ed.longitude, ed.latitude)::geography as ponto,
    'entrega' as tipo
  FROM entregas_intermunicipais ei
  INNER JOIN enderecos ed ON ei.endereco_entrega_id = ed.id
  WHERE ei.viagem_id = $1
)
SELECT 
  id,
  codigo_rastreio,
  tipo,
  latitude,
  longitude,
  ROW_NUMBER() OVER (ORDER BY ST_Distance(ponto, LAG(ponto) OVER (ORDER BY tipo DESC))) as ordem_sugerida
FROM pontos_ordenados;
```

### 9. Validar Capacidade do Entregador

```sql
-- Verificar se entregador pode aceitar mais entregas
SELECT 
  er.capacidade_pacotes,
  er.capacidade_peso_kg,
  COALESCE(SUM(ei.quantidade_pacotes), 0) as pacotes_aceitos,
  COALESCE(SUM(ei.peso_kg), 0) as peso_aceito,
  (er.capacidade_pacotes - COALESCE(SUM(ei.quantidade_pacotes), 0)) as pacotes_disponiveis,
  (er.capacidade_peso_kg - COALESCE(SUM(ei.peso_kg), 0)) as peso_disponivel
FROM entregador_rotas er
LEFT JOIN entregas_intermunicipais ei ON ei.entregador_id = er.entregador_id
  AND ei.rota_id = er.rota_id
  AND DATE(ei.data_coleta_agendada) = $2  -- data
  AND ei.status IN ('aceita', 'em_coleta', 'coletada', 'em_entrega')
WHERE 
  er.entregador_id = $1  -- entregador_id
  AND er.rota_id = $3  -- rota_id
GROUP BY er.capacidade_pacotes, er.capacidade_peso_kg;
```

### 10. Relatório Financeiro da Empresa

```sql
-- Relatório de gastos com entregas intermunicipais
SELECT 
  DATE_TRUNC('month', ei.created_at) as mes,
  COUNT(*) as total_entregas,
  COUNT(*) FILTER (WHERE ei.status = 'entregue') as entregas_concluidas,
  COUNT(*) FILTER (WHERE ei.status = 'cancelada') as entregas_canceladas,
  SUM(ei.valor_frete) as valor_total_frete,
  SUM(ei.valor_frete) FILTER (WHERE ei.status = 'entregue') as valor_pago,
  AVG(ei.valor_frete) as ticket_medio,
  COUNT(DISTINCT ei.rota_id) as rotas_utilizadas
FROM entregas_intermunicipais ei
WHERE 
  ei.empresa_id = $1  -- empresa_id
  AND ei.created_at >= $2  -- data_inicio
  AND ei.created_at <= $3  -- data_fim
GROUP BY DATE_TRUNC('month', ei.created_at)
ORDER BY mes DESC;
```

---

## 🔧 Exemplos de Código Node.js

### 1. Service: Calcular Preço da Entrega

```javascript
// services/entregaIntermunicipalService.js

class EntregaIntermunicipalService {
  
  /**
   * Calcula o preço de uma entrega intermunicipal
   * @param {Object} params - Parâmetros da entrega
   * @returns {Object} Detalhamento dos valores
   */
  async calcularPreco(params) {
    const { 
      rota_id, 
      data_coleta_agendada,
      pontos_coleta = 1,  // Quantidade de pontos de coleta
      pontos_entrega = 1  // Quantidade de pontos de entrega
    } = params;

    // Buscar dados da rota
    const rota = await this.buscarRota(rota_id);
    
    if (!rota) {
      throw new Error('Rota não encontrada');
    }

    // Constantes da plataforma
    const VALOR_BASE_SAIDA = 5.00;
    const TAXA_PLATAFORMA_PERCENTUAL = 0.20; // 20%

    // Cálculos
    const valorDistancia = rota.distancia_km * rota.valor_por_km;
    
    // Paradas adicionais (subtrai 2 pois origem e destino já estão incluídos no valor base)
    const paradasAdicionais = Math.max(0, (pontos_coleta + pontos_entrega - 2));
    const valorParadas = paradasAdicionais * rota.valor_por_parada;

    const subtotal = VALOR_BASE_SAIDA + valorDistancia + valorParadas;
    const taxaPlataforma = subtotal * TAXA_PLATAFORMA_PERCENTUAL;
    const valorEntregador = subtotal - taxaPlataforma;

    return {
      rota: {
        id: rota.id,
        nome: rota.nome_rota,
        distancia_km: rota.distancia_km,
        tempo_medio_minutos: rota.tempo_medio_minutos
      },
      detalhamento: {
        valor_base: VALOR_BASE_SAIDA,
        valor_distancia: parseFloat(valorDistancia.toFixed(2)),
        paradas_adicionais: paradasAdicionais,
        valor_paradas: parseFloat(valorParadas.toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2)),
        taxa_plataforma: parseFloat(taxaPlataforma.toFixed(2)),
        taxa_percentual: TAXA_PLATAFORMA_PERCENTUAL * 100
      },
      valores: {
        valor_total: parseFloat(subtotal.toFixed(2)),
        valor_empresa: parseFloat(subtotal.toFixed(2)),
        valor_entregador: parseFloat(valorEntregador.toFixed(2)),
        taxa_plataforma: parseFloat(taxaPlataforma.toFixed(2))
      }
    };
  }

  async buscarRota(rota_id) {
    const query = `
      SELECT * FROM rotas_intermunicipais 
      WHERE id = $1 AND ativa = true
    `;
    const result = await pool.query(query, [rota_id]);
    return result.rows[0];
  }

  /**
   * Criar nova entrega intermunicipal
   */
  async criarEntrega(dados) {
    const {
      empresa_id,
      rota_id,
      data_coleta_agendada,
      horario_coleta_inicio,
      horario_coleta_fim,
      endereco_coleta_id,
      endereco_entrega,
      destinatario_nome,
      destinatario_telefone,
      quantidade_pacotes,
      peso_kg,
      volume_m3,
      descricao_carga,
      valor_mercadoria
    } = dados;

    // Gerar código de rastreio único
    const codigo_rastreio = await this.gerarCodigoRastreio();

    // Calcular preço
    const precificacao = await this.calcularPreco({
      rota_id,
      data_coleta_agendada,
      pontos_coleta: 1,
      pontos_entrega: 1
    });

    // Criar ou buscar endereço de entrega
    const endereco_entrega_id = await this.criarEndereco(endereco_entrega);

    // Inserir entrega
    const query = `
      INSERT INTO entregas_intermunicipais (
        codigo_rastreio,
        empresa_id,
        rota_id,
        endereco_coleta_id,
        data_coleta_agendada,
        horario_coleta_inicio,
        horario_coleta_fim,
        endereco_entrega_id,
        destinatario_nome,
        destinatario_telefone,
        data_entrega_prevista,
        quantidade_pacotes,
        peso_kg,
        volume_m3,
        descricao_carga,
        valor_mercadoria,
        valor_frete,
        taxa_plataforma,
        valor_entregador,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;

    const values = [
      codigo_rastreio,
      empresa_id,
      rota_id,
      endereco_coleta_id,
      data_coleta_agendada,
      horario_coleta_inicio,
      horario_coleta_fim,
      endereco_entrega_id,
      destinatario_nome,
      destinatario_telefone,
      data_coleta_agendada, // data_entrega_prevista = mesma data por enquanto
      quantidade_pacotes,
      peso_kg,
      volume_m3,
      descricao_carga,
      valor_mercadoria,
      precificacao.valores.valor_total,
      precificacao.valores.taxa_plataforma,
      precificacao.valores.valor_entregador,
      'aguardando_entregador'
    ];

    const result = await pool.query(query, values);
    const entrega = result.rows[0];

    // Notificar entregadores disponíveis
    await this.notificarEntregadoresDisponiveis(rota_id, data_coleta_agendada);

    return {
      entrega,
      precificacao
    };
  }

  async gerarCodigoRastreio() {
    // Formato: INTER-YYYYMMDD-XXXXX
    const data = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    return `INTER-${data}-${random}`;
  }

  async notificarEntregadoresDisponiveis(rota_id, data_coleta) {
    const diaSemana = new Date(data_coleta).getDay() + 1; // 1-7
    
    const query = `
      SELECT DISTINCT u.id, u.push_token
      FROM entregador_rotas er
      INNER JOIN users u ON er.entregador_id = u.id
      WHERE 
        er.rota_id = $1
        AND er.ativa = true
        AND $2 = ANY(er.dias_semana)
        AND u.push_token IS NOT NULL
    `;
    
    const result = await pool.query(query, [rota_id, diaSemana]);
    
    // Enviar notificações push
    for (const entregador of result.rows) {
      await this.enviarNotificacao(entregador.id, {
        title: 'Nova entrega disponível!',
        body: 'Uma nova entrega intermunicipal está disponível na sua rota',
        data: {
          type: 'nova_entrega_intermunicipal',
          rota_id
        }
      });
    }
  }
}

module.exports = new EntregaIntermunicipalService();
```

### 2. Controller: Entregas para Empresa

```javascript
// controllers/empresa/entregaIntermunicipalController.js

const entregaService = require('../../services/entregaIntermunicipalService');

class EntregaIntermunicipalController {
  
  /**
   * POST /api/empresa/entregas-intermunicipais/calcular-frete
   * Calcular preço sem criar a entrega
   */
  async calcularFrete(req, res) {
    try {
      const { rota_id, pontos_coleta, pontos_entrega } = req.body;

      const precificacao = await entregaService.calcularPreco({
        rota_id,
        pontos_coleta: pontos_coleta || 1,
        pontos_entrega: pontos_entrega || 1
      });

      return res.json(precificacao);
    } catch (error) {
      console.error('Erro ao calcular frete:', error);
      return res.status(400).json({
        error: 'Erro ao calcular frete',
        message: error.message
      });
    }
  }

  /**
   * POST /api/empresa/entregas-intermunicipais
   * Criar nova entrega
   */
  async criar(req, res) {
    try {
      const empresa_id = req.user.id;
      const dados = {
        ...req.body,
        empresa_id
      };

      const resultado = await entregaService.criarEntrega(dados);

      return res.status(201).json(resultado);
    } catch (error) {
      console.error('Erro ao criar entrega:', error);
      return res.status(400).json({
        error: 'Erro ao criar entrega',
        message: error.message
      });
    }
  }

  /**
   * GET /api/empresa/entregas-intermunicipais
   * Listar entregas da empresa
   */
  async listar(req, res) {
    try {
      const empresa_id = req.user.id;
      const { status, data_inicio, data_fim, rota_id, page = 1, limit = 20 } = req.query;

      const offset = (page - 1) * limit;

      let whereConditions = ['ei.empresa_id = $1'];
      let params = [empresa_id];
      let paramIndex = 2;

      if (status) {
        whereConditions.push(`ei.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (data_inicio) {
        whereConditions.push(`ei.data_coleta_agendada >= $${paramIndex}`);
        params.push(data_inicio);
        paramIndex++;
      }

      if (data_fim) {
        whereConditions.push(`ei.data_coleta_agendada <= $${paramIndex}`);
        params.push(data_fim);
        paramIndex++;
      }

      if (rota_id) {
        whereConditions.push(`ei.rota_id = $${paramIndex}`);
        params.push(rota_id);
        paramIndex++;
      }

      const query = `
        SELECT 
          ei.*,
          r.nome_rota,
          co.nome as cidade_origem,
          cd.nome as cidade_destino,
          ent.nome as entregador_nome,
          ent.telefone as entregador_telefone,
          ec.rua || ', ' || ec.numero as endereco_coleta_resumo,
          ed.rua || ', ' || ed.numero as endereco_entrega_resumo
        FROM entregas_intermunicipais ei
        INNER JOIN rotas_intermunicipais r ON ei.rota_id = r.id
        INNER JOIN cidades co ON r.cidade_origem_id = co.id
        INNER JOIN cidades cd ON r.cidade_destino_id = cd.id
        LEFT JOIN users ent ON ei.entregador_id = ent.id
        INNER JOIN enderecos ec ON ei.endereco_coleta_id = ec.id
        INNER JOIN enderecos ed ON ei.endereco_entrega_id = ed.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ei.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Contar total
      const countQuery = `
        SELECT COUNT(*) FROM entregas_intermunicipais ei
        WHERE ${whereConditions.join(' AND ')}
      `;
      const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 1));
      const total = parseInt(countResult.rows[0].count);

      return res.json({
        entregas: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Erro ao listar entregas:', error);
      return res.status(500).json({
        error: 'Erro ao listar entregas',
        message: error.message
      });
    }
  }

  /**
   * GET /api/empresa/entregas-intermunicipais/:id
   * Detalhes de uma entrega
   */
  async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const empresa_id = req.user.id;

      const query = `
        SELECT 
          ei.*,
          r.nome_rota,
          r.distancia_km,
          r.tempo_medio_minutos,
          co.nome as cidade_origem,
          cd.nome as cidade_destino,
          ent.nome as entregador_nome,
          ent.telefone as entregador_telefone,
          ent.foto_perfil as entregador_foto,
          ent.avaliacao_media as entregador_avaliacao,
          json_build_object(
            'rua', ec.rua,
            'numero', ec.numero,
            'complemento', ec.complemento,
            'bairro', ec.bairro,
            'cidade', ec.cidade,
            'estado', ec.estado,
            'cep', ec.cep,
            'latitude', ec.latitude,
            'longitude', ec.longitude
          ) as endereco_coleta,
          json_build_object(
            'rua', ed.rua,
            'numero', ed.numero,
            'complemento', ed.complemento,
            'bairro', ed.bairro,
            'cidade', ed.cidade,
            'estado', ed.estado,
            'cep', ed.cep,
            'latitude', ed.latitude,
            'longitude', ed.longitude
          ) as endereco_entrega
        FROM entregas_intermunicipais ei
        INNER JOIN rotas_intermunicipais r ON ei.rota_id = r.id
        INNER JOIN cidades co ON r.cidade_origem_id = co.id
        INNER JOIN cidades cd ON r.cidade_destino_id = cd.id
        LEFT JOIN users ent ON ei.entregador_id = ent.id
        INNER JOIN enderecos ec ON ei.endereco_coleta_id = ec.id
        INNER JOIN enderecos ed ON ei.endereco_entrega_id = ed.id
        WHERE ei.id = $1 AND ei.empresa_id = $2
      `;

      const result = await pool.query(query, [id, empresa_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entrega não encontrada' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao buscar entrega:', error);
      return res.status(500).json({
        error: 'Erro ao buscar entrega',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/empresa/entregas-intermunicipais/:id
   * Cancelar entrega
   */
  async cancelar(req, res) {
    try {
      const { id } = req.params;
      const empresa_id = req.user.id;
      const { motivo } = req.body;

      // Buscar entrega
      const buscarQuery = `
        SELECT * FROM entregas_intermunicipais 
        WHERE id = $1 AND empresa_id = $2
      `;
      const entrega = await pool.query(buscarQuery, [id, empresa_id]);

      if (entrega.rows.length === 0) {
        return res.status(404).json({ error: 'Entrega não encontrada' });
      }

      const entregaData = entrega.rows[0];

      // Verificar se pode cancelar
      if (!['aguardando_entregador', 'aceita'].includes(entregaData.status)) {
        return res.status(400).json({
          error: 'Não é possível cancelar esta entrega',
          message: 'A entrega já está em andamento ou foi concluída'
        });
      }

      // Calcular taxa de cancelamento
      const horasParaColeta = (new Date(entregaData.data_coleta_agendada) - new Date()) / (1000 * 60 * 60);
      let taxaCancelamento = 0;

      if (horasParaColeta < 6) {
        taxaCancelamento = entregaData.valor_frete; // 100%
      } else if (horasParaColeta < 24) {
        taxaCancelamento = entregaData.valor_frete * 0.5; // 50%
      }

      // Atualizar status
      const updateQuery = `
        UPDATE entregas_intermunicipais 
        SET 
          status = 'cancelada',
          observacoes = COALESCE(observacoes || E'\n', '') || $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const observacao = `Cancelada pela empresa. Motivo: ${motivo}. Taxa: R$ ${taxaCancelamento.toFixed(2)}`;
      const result = await pool.query(updateQuery, [observacao, id]);

      // Se tinha entregador, notificar
      if (entregaData.entregador_id) {
        await this.notificarEntregador(entregaData.entregador_id, {
          title: 'Entrega cancelada',
          body: `A entrega ${entregaData.codigo_rastreio} foi cancelada pela empresa`,
          data: {
            type: 'entrega_cancelada',
            entrega_id: id
          }
        });
      }

      return res.json({
        message: 'Entrega cancelada com sucesso',
        entrega: result.rows[0],
        taxa_cancelamento: taxaCancelamento
      });
    } catch (error) {
      console.error('Erro ao cancelar entrega:', error);
      return res.status(500).json({
        error: 'Erro ao cancelar entrega',
        message: error.message
      });
    }
  }
}

module.exports = new EntregaIntermunicipalController();
```

### 3. Controller: Entregas para Entregador

```javascript
// controllers/entregador/entregaIntermunicipalController.js

class EntregadorEntregaController {
  
  /**
   * GET /api/entregador/entregas-disponiveis
   * Listar entregas disponíveis nas rotas do entregador
   */
  async listarDisponiveis(req, res) {
    try {
      const entregador_id = req.user.id;
      const { rota_id, data } = req.query;

      let whereConditions = [`er.entregador_id = $1`];
      let params = [entregador_id];
      let paramIndex = 2;

      if (rota_id) {
        whereConditions.push(`ei.rota_id = $${paramIndex}`);
        params.push(rota_id);
        paramIndex++;
      }

      if (data) {
        whereConditions.push(`ei.data_coleta_agendada = $${paramIndex}`);
        params.push(data);
        paramIndex++;
      }

      const query = `
        SELECT DISTINCT
          ei.*,
          r.nome_rota,
          r.distancia_km,
          co.nome as cidade_origem,
          cd.nome as cidade_destino,
          emp.nome as empresa_nome,
          emp.telefone as empresa_telefone,
          ec.rua || ', ' || ec.numero || ' - ' || ec.bairro as endereco_coleta_resumo,
          ed.rua || ', ' || ed.numero || ' - ' || ed.bairro as endereco_entrega_resumo
        FROM entregas_intermunicipais ei
        INNER JOIN rotas_intermunicipais r ON ei.rota_id = r.id
        INNER JOIN cidades co ON r.cidade_origem_id = co.id
        INNER JOIN cidades cd ON r.cidade_destino_id = cd.id
        INNER JOIN users emp ON ei.empresa_id = emp.id
        INNER JOIN enderecos ec ON ei.endereco_coleta_id = ec.id
        INNER JOIN enderecos ed ON ei.endereco_entrega_id = ed.id
        INNER JOIN entregador_rotas er ON er.rota_id = ei.rota_id
        WHERE 
          ${whereConditions.join(' AND ')}
          AND ei.status = 'aguardando_entregador'
          AND er.ativa = true
          AND EXTRACT(DOW FROM ei.data_coleta_agendada) + 1 = ANY(er.dias_semana)
        ORDER BY ei.data_coleta_agendada, ei.horario_coleta_inicio
      `;

      const result = await pool.query(query, params);

      return res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar entregas disponíveis:', error);
      return res.status(500).json({
        error: 'Erro ao listar entregas',
        message: error.message
      });
    }
  }

  /**
   * POST /api/entregador/entregas-intermunicipais/aceitar
   * Aceitar múltiplas entregas
   */
  async aceitar(req, res) {
    try {
      const entregador_id = req.user.id;
      const { entrega_ids, data_viagem } = req.body;

      if (!Array.isArray(entrega_ids) || entrega_ids.length === 0) {
        return res.status(400).json({ error: 'Nenhuma entrega selecionada' });
      }

      // Validar se todas as entregas estão disponíveis
      const validarQuery = `
        SELECT ei.*, r.nome_rota
        FROM entregas_intermunicipais ei
        INNER JOIN rotas_intermunicipais r ON ei.rota_id = r.id
        INNER JOIN entregador_rotas er ON er.rota_id = ei.rota_id
        WHERE 
          ei.id = ANY($1)
          AND ei.status = 'aguardando_entregador'
          AND er.entregador_id = $2
          AND er.ativa = true
      `;

      const entregas = await pool.query(validarQuery, [entrega_ids, entregador_id]);

      if (entregas.rows.length !== entrega_ids.length) {
        return res.status(400).json({
          error: 'Algumas entregas não estão disponíveis ou você não tem permissão'
        });
      }

      // Verificar capacidade
      const rota_id = entregas.rows[0].rota_id;
      const capacidadeQuery = `
        SELECT 
          er.capacidade_pacotes,
          er.capacidade_peso_kg,
          COALESCE(SUM(ei.quantidade_pacotes), 0) as pacotes_aceitos,
          COALESCE(SUM(ei.peso_kg), 0) as peso_aceito
        FROM entregador_rotas er
        LEFT JOIN entregas_intermunicipais ei ON ei.entregador_id = er.entregador_id
          AND ei.rota_id = er.rota_id
          AND DATE(ei.data_coleta_agendada) = $2
          AND ei.status IN ('aceita', 'em_coleta', 'coletada', 'em_entrega')
        WHERE 
          er.entregador_id = $1
          AND er.rota_id = $3
        GROUP BY er.capacidade_pacotes, er.capacidade_peso_kg
      `;

      const capacidade = await pool.query(capacidadeQuery, [entregador_id, data_viagem, rota_id]);
      const cap = capacidade.rows[0];

      const novos_pacotes = entregas.rows.reduce((sum, e) => sum + e.quantidade_pacotes, 0);
      const novo_peso = entregas.rows.reduce((sum, e) => sum + e.peso_kg, 0);

      if (cap.pacotes_aceitos + novos_pacotes > cap.capacidade_pacotes) {
        return res.status(400).json({
          error: 'Capacidade de pacotes excedida',
          capacidade: cap.capacidade_pacotes,
          atual: cap.pacotes_aceitos,
          tentando_adicionar: novos_pacotes
        });
      }

      if (cap.peso_aceito + novo_peso > cap.capacidade_peso_kg) {
        return res.status(400).json({
          error: 'Capacidade de peso excedida',
          capacidade: cap.capacidade_peso_kg,
          atual: cap.peso_aceito,
          tentando_adicionar: novo_peso
        });
      }

      // Buscar ou criar viagem
      let viagem_id;
      const buscarViagemQuery = `
        SELECT id FROM viagens_intermunicipais
        WHERE entregador_id = $1 AND rota_id = $2 AND data_viagem = $3
      `;
      
      const viagemExistente = await pool.query(buscarViagemQuery, [entregador_id, rota_id, data_viagem]);

      if (viagemExistente.rows.length > 0) {
        viagem_id = viagemExistente.rows[0].id;
      } else {
        // Criar nova viagem
        const codigo_viagem = `VG-${Date.now()}`;
        const criarViagemQuery = `
          INSERT INTO viagens_intermunicipais (
            codigo_viagem, entregador_id, rota_id, data_viagem,
            horario_saida_previsto, horario_chegada_previsto, status
          ) VALUES ($1, $2, $3, $4, $5, $6, 'planejada')
          RETURNING id
        `;
        
        const novaViagem = await pool.query(criarViagemQuery, [
          codigo_viagem,
          entregador_id,
          rota_id,
          data_viagem,
          entregas.rows[0].horario_coleta_inicio,
          entregas.rows[0].horario_coleta_fim,
        ]);
        
        viagem_id = novaViagem.rows[0].id;
      }

      // Atualizar entregas
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

      // Notificar empresas
      for (const entrega of result.rows) {
        await this.notificarEmpresa(entrega.empresa_id, {
          title: 'Entrega aceita!',
          body: `Sua entrega ${entrega.codigo_rastreio} foi aceita por um entregador`,
          data: {
            type: 'entrega_aceita',
            entrega_id: entrega.id
          }
        });
      }

      // Atualizar contadores da viagem
      await this.atualizarContagensViagem(viagem_id);

      return res.json({
        message: 'Entregas aceitas com sucesso',
        viagem_id,
        entregas_aceitas: result.rows.length
      });
    } catch (error) {
      console.error('Erro ao aceitar entregas:', error);
      return res.status(500).json({
        error: 'Erro ao aceitar entregas',
        message: error.message
      });
    }
  }

  async atualizarContagensViagem(viagem_id) {
    const query = `
      UPDATE viagens_intermunicipais v
      SET 
        total_coletas = (
          SELECT COUNT(DISTINCT endereco_coleta_id)
          FROM entregas_intermunicipais
          WHERE viagem_id = v.id
        ),
        total_entregas = (
          SELECT COUNT(DISTINCT endereco_entrega_id)
          FROM entregas_intermunicipais
          WHERE viagem_id = v.id
        ),
        valor_total = (
          SELECT COALESCE(SUM(valor_entregador), 0)
          FROM entregas_intermunicipais
          WHERE viagem_id = v.id
        )
      WHERE v.id = $1
    `;
    
    await pool.query(query, [viagem_id]);
  }
}

module.exports = new EntregadorEntregaController();
```

### 4. Integração Google Maps

```javascript
// services/googleMapsService.js

const axios = require('axios');

class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
  }

  /**
   * Calcular distância e tempo entre duas cidades
   */
  async calcularDistancia(origem, destino) {
    try {
      const url = `${this.baseUrl}/distancematrix/json`;
      
      const response = await axios.get(url, {
        params: {
          origins: origem,
          destinations: destino,
          mode: 'driving',
          language: 'pt-BR',
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK') {
        const element = response.data.rows[0].elements[0];
        
        if (element.status === 'OK') {
          return {
            distancia_km: (element.distance.value / 1000).toFixed(2),
            distancia_texto: element.distance.text,
            tempo_minutos: Math.round(element.duration.value / 60),
            tempo_texto: element.duration.text
          };
        }
      }

      throw new Error('Não foi possível calcular a distância');
    } catch (error) {
      console.error('Erro ao calcular distância:', error);
      throw error;
    }
  }

  /**
   * Otimizar rota com múltiplas paradas
   */
  async otimizarRota(origem, destino, paradas) {
    try {
      const url = `${this.baseUrl}/directions/json`;
      
      const waypoints = paradas.map(p => {
        if (p.latitude && p.longitude) {
          return `${p.latitude},${p.longitude}`;
        }
        return `${p.endereco}`;
      }).join('|');

      const response = await axios.get(url, {
        params: {
          origin: origem,
          destination: destino,
          waypoints: `optimize:true|${waypoints}`,
          mode: 'driving',
          language: 'pt-BR',
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK') {
        const route = response.data.routes[0];
        const waypointOrder = route.waypoint_order;
        
        return {
          ordem_otimizada: waypointOrder,
          distancia_total_km: (route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000).toFixed(2),
          tempo_total_minutos: Math.round(route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60),
          polyline: route.overview_polyline.points
        };
      }

      throw new Error('Não foi possível otimizar a rota');
    } catch (error) {
      console.error('Erro ao otimizar rota:', error);
      throw error;
    }
  }

  /**
   * Geocodificar endereço
   */
  async geocodificar(endereco) {
    try {
      const url = `${this.baseUrl}/geocode/json`;
      
      const response = await axios.get(url, {
        params: {
          address: endereco,
          language: 'pt-BR',
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK') {
        const result = response.data.results[0];
        
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          endereco_formatado: result.formatted_address
        };
      }

      throw new Error('Não foi possível geocodificar o endereço');
    } catch (error) {
      console.error('Erro ao geocodificar:', error);
      throw error;
    }
  }
}

module.exports = new GoogleMapsService();
```

---

## 🗃️ Migrations PostgreSQL

### Migration: Criar Tabelas Principais

```sql
-- migrations/001_create_rotas_intermunicipais.sql

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de cidades (se não existir)
CREATE TABLE IF NOT EXISTS cidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  estado VARCHAR(2) NOT NULL,
  ibge_code VARCHAR(7) UNIQUE,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cidades_estado ON cidades(estado);
CREATE INDEX IF NOT EXISTS idx_cidades_nome ON cidades(nome);

-- Tabela de rotas intermunicipais
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

-- Tabela de rotas do entregador
CREATE TABLE entregador_rotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entregador_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id) ON DELETE CASCADE,
  dias_semana INTEGER[] NOT NULL,
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

-- Tabela de viagens
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (status IN ('planejada', 'em_andamento', 'concluida', 'cancelada'))
);

CREATE INDEX idx_viagens_entregador ON viagens_intermunicipais(entregador_id);
CREATE INDEX idx_viagens_rota ON viagens_intermunicipais(rota_id);
CREATE INDEX idx_viagens_data ON viagens_intermunicipais(data_viagem);
CREATE INDEX idx_viagens_status ON viagens_intermunicipais(status);

-- Tabela de entregas intermunicipais
CREATE TABLE entregas_intermunicipais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_rastreio VARCHAR(50) UNIQUE NOT NULL,
  empresa_id UUID NOT NULL REFERENCES users(id),
  rota_id UUID NOT NULL REFERENCES rotas_intermunicipais(id),
  entregador_id UUID REFERENCES users(id),
  viagem_id UUID REFERENCES viagens_intermunicipais(id),
  
  endereco_coleta_id UUID NOT NULL REFERENCES enderecos(id),
  data_coleta_agendada DATE NOT NULL,
  horario_coleta_inicio TIME NOT NULL,
  horario_coleta_fim TIME NOT NULL,
  data_coleta_realizada TIMESTAMP,
  
  endereco_entrega_id UUID NOT NULL REFERENCES enderecos(id),
  destinatario_nome VARCHAR(255) NOT NULL,
  destinatario_telefone VARCHAR(20) NOT NULL,
  data_entrega_prevista DATE NOT NULL,
  data_entrega_realizada TIMESTAMP,
  
  quantidade_pacotes INTEGER DEFAULT 1,
  peso_kg DECIMAL(10,2),
  volume_m3 DECIMAL(10,3),
  descricao_carga TEXT,
  valor_mercadoria DECIMAL(10,2),
  
  valor_frete DECIMAL(10,2) NOT NULL,
  taxa_plataforma DECIMAL(10,2) NOT NULL,
  valor_entregador DECIMAL(10,2) NOT NULL,
  
  status VARCHAR(50) NOT NULL DEFAULT 'aguardando_entregador',
  observacoes TEXT,
  foto_coleta TEXT,
  assinatura_coleta TEXT,
  foto_entrega TEXT,
  assinatura_entrega TEXT,
  
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
  ))
);

CREATE INDEX idx_entregas_inter_empresa ON entregas_intermunicipais(empresa_id);
CREATE INDEX idx_entregas_inter_entregador ON entregas_intermunicipais(entregador_id);
CREATE INDEX idx_entregas_inter_rota ON entregas_intermunicipais(rota_id);
CREATE INDEX idx_entregas_inter_status ON entregas_intermunicipais(status);
CREATE INDEX idx_entregas_inter_data_coleta ON entregas_intermunicipais(data_coleta_agendada);
CREATE INDEX idx_entregas_inter_viagem ON entregas_intermunicipais(viagem_id);

-- Triggers para updated_at
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
```

---

## 📱 Exemplos React Native (Entregador)

### Tela: Entregas Disponíveis

```jsx
// screens/EntregadorScreens/EntregasDisponiveisScreen.js

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet
} from 'react-native';
import { CheckBox } from 'react-native-elements';
import api from '../../services/api';

export default function EntregasDisponiveisScreen({ navigation }) {
  const [entregas, setEntregas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    carregarEntregas();
  }, []);

  const carregarEntregas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/entregador/entregas-disponiveis');
      setEntregas(response.data);
    } catch (error) {
      console.error('Erro ao carregar entregas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as entregas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleSelecao = (entregaId) => {
    if (selecionadas.includes(entregaId)) {
      setSelecionadas(selecionadas.filter(id => id !== entregaId));
    } else {
      setSelecionadas([...selecionadas, entregaId]);
    }
  };

  const aceitarSelecionadas = async () => {
    if (selecionadas.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos uma entrega');
      return;
    }

    try {
      setLoading(true);
      
      await api.post('/entregador/entregas-intermunicipais/aceitar', {
        entrega_ids: selecionadas,
        data_viagem: entregas.find(e => e.id === selecionadas[0]).data_coleta_agendada
      });

      Alert.alert(
        'Sucesso!',
        `${selecionadas.length} entrega(s) aceita(s) com sucesso`,
        [{ text: 'OK', onPress: () => navigation.navigate('MinhasViagens') }]
      );
    } catch (error) {
      console.error('Erro ao aceitar entregas:', error);
      Alert.alert('Erro', error.response?.data?.message || 'Não foi possível aceitar as entregas');
    } finally {
      setLoading(false);
    }
  };

  const calcularTotalSelecionadas = () => {
    return entregas
      .filter(e => selecionadas.includes(e.id))
      .reduce((sum, e) => sum + parseFloat(e.valor_entregador), 0);
  };

  const renderEntrega = ({ item }) => {
    const isSelected = selecionadas.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleSelecao(item.id)}
      >
        <View style={styles.checkboxContainer}>
          <CheckBox
            checked={isSelected}
            onPress={() => toggleSelecao(item.id)}
            containerStyle={styles.checkbox}
          />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.header}>
            <Text style={styles.codigo}>{item.codigo_rastreio}</Text>
            <Text style={styles.valor}>R$ {parseFloat(item.valor_entregador).toFixed(2)}</Text>
          </View>

          <View style={styles.rotaContainer}>
            <Text style={styles.rota}>
              {item.cidade_origem} → {item.cidade_destino}
            </Text>
            <Text style={styles.distancia}>{item.distancia_km} km</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Coleta:</Text>
            <Text style={styles.info}>
              {new Date(item.data_coleta_agendada).toLocaleDateString('pt-BR')} às {item.horario_coleta_inicio}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Empresa:</Text>
            <Text style={styles.info}>{item.empresa_nome}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Endereço:</Text>
            <Text style={styles.info} numberOfLines={1}>
              {item.endereco_coleta_resumo}
            </Text>
          </View>

          <View style={styles.cargaContainer}>
            <Text style={styles.carga}>
              📦 {item.quantidade_pacotes} pacote(s) • {item.peso_kg} kg
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={entregas}
        renderItem={renderEntrega}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={carregarEntregas} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Nenhuma entrega disponível no momento
            </Text>
          </View>
        }
      />

      {selecionadas.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>
              {selecionadas.length} selecionada(s)
            </Text>
            <Text style={styles.totalValor}>
              R$ {calcularTotalSelecionadas().toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.botaoAceitar}
            onPress={aceitarSelecionadas}
            disabled={loading}
          >
            <Text style={styles.botaoAceitarTexto}>
              {loading ? 'Processando...' : 'Aceitar Selecionadas'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardSelected: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  checkboxContainer: {
    justifyContent: 'center',
    marginRight: 8,
  },
  checkbox: {
    padding: 0,
    margin: 0,
  },
  cardContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codigo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  valor: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  rotaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rota: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  distancia: {
    fontSize: 14,
    color: '#999',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  info: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  cargaContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  carga: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 8,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalValor: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  botaoAceitar: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  botaoAceitarTexto: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
```

---

**Pronto! Agora você tem:**

1. ✅ Documento técnico completo e detalhado
2. ✅ Estrutura de banco de dados PostgreSQL
3. ✅ Queries SQL úteis e otimizadas
4. ✅ Exemplos de código Node.js (Services e Controllers)
5. ✅ Integração com Google Maps API
6. ✅ Migrations para PostgreSQL
7. ✅ Exemplo de tela React Native

Todos os arquivos estão prontos para usar no Claude Code!
