// Carregar variáveis de ambiente do arquivo .env ANTES de importar outros módulos
import { config } from "dotenv";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Obter o diretório atual de forma compatível com ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tentar carregar o .env explicitamente
const envPath = path.resolve(__dirname, '../.env');
console.log('📁 Caminho do .env:', envPath);
console.log('📁 .env existe?', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const result = config({ path: envPath });
  console.log('✅ .env carregado:', result.error ? 'com erros' : 'com sucesso');
} else {
  console.log('❌ .env não encontrado em:', envPath);
}

import { Pool } from 'pg';

async function addNeedsReturnColumn() {
  try {
    console.log("🔄 Adicionando coluna needsReturn à tabela requests...");

    // Criar conexão direta com o banco usando a URL completa
    // Mas garantindo que a senha esteja corretamente formatada
    let dbUrl = process.env.DATABASE_URL;
    
    // Verificar se a URL está no formato correto
    if (!dbUrl) {
      console.log('❌ Variáveis de ambiente disponíveis:', Object.keys(process.env).filter(k => k.includes('DB')));
      throw new Error('DATABASE_URL não está definida');
    }
    
    console.log('🔗 URL do banco (parcial):', dbUrl.replace(/:([^:@]+)@/, ':***@'));
    
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Primeiro, vamos testar a conexão com uma query simples
    try {
      const testResult = await pool.query('SELECT NOW()');
      console.log("✅ Conexão com o banco estabelecida com sucesso");
      console.log("   Data/hora do servidor:", testResult.rows[0].now);
    } catch (testError) {
      console.error("❌ Erro ao testar conexão com o banco:", testError);
      throw testError;
    }

    // Verificar se a coluna já existe
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'requests'
      AND column_name = 'needs_return'
    `);

    if (checkResult.rows.length > 0) {
      console.log("✅ Coluna needs_return já existe na tabela requests");
      await pool.end();
      return;
    }

    // Adicionar a coluna needs_return
    await pool.query(`
      ALTER TABLE requests
      ADD COLUMN needs_return BOOLEAN DEFAULT FALSE
    `);

    console.log("✅ Coluna needs_return adicionada com sucesso à tabela requests");
    await pool.end();
  } catch (error) {
    console.error("❌ Erro ao adicionar coluna needs_return:", error);
    process.exit(1);
  }
}

// Executar a migração
addNeedsReturnColumn()
  .then(() => {
    console.log("🎉 Migração concluída com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Falha na migração:", error);
    process.exit(1);
  });