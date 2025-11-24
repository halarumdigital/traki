#!/usr/bin/env tsx
/**
 * Script para diagnosticar e corrigir problemas de permissão no banco de dados
 * Uso: tsx server/fix-db-permissions.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const { Pool } = pg;

async function fixPermissions() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL não encontrada no arquivo .env');
    process.exit(1);
  }

  console.log('🔍 Conectando ao banco de dados...');

  const pool = new Pool({ connectionString });

  try {
    // 1. Verificar conexão e usuário atual
    const currentUserResult = await pool.query('SELECT current_user, current_database()');
    const { current_user, current_database } = currentUserResult.rows[0];

    console.log(`✅ Conectado como usuário: ${current_user}`);
    console.log(`📦 Banco de dados: ${current_database}`);

    // 2. Verificar permissões atuais
    console.log('\n📋 Verificando permissões nas tabelas...\n');

    const permissionsQuery = `
      SELECT
        tablename,
        has_table_privilege($1, 'public.' || tablename, 'SELECT') as can_select,
        has_table_privilege($1, 'public.' || tablename, 'INSERT') as can_insert,
        has_table_privilege($1, 'public.' || tablename, 'UPDATE') as can_update,
        has_table_privilege($1, 'public.' || tablename, 'DELETE') as can_delete
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    const permissionsResult = await pool.query(permissionsQuery, [current_user]);

    let hasPermissionIssues = false;
    const problemTables: string[] = [];

    for (const row of permissionsResult.rows) {
      const hasAllPermissions = row.can_select && row.can_insert && row.can_update && row.can_delete;

      if (!hasAllPermissions) {
        hasPermissionIssues = true;
        problemTables.push(row.tablename);

        console.log(`❌ Tabela: ${row.tablename}`);
        console.log(`   SELECT: ${row.can_select ? '✅' : '❌'}`);
        console.log(`   INSERT: ${row.can_insert ? '✅' : '❌'}`);
        console.log(`   UPDATE: ${row.can_update ? '✅' : '❌'}`);
        console.log(`   DELETE: ${row.can_delete ? '✅' : '❌'}`);
      } else {
        console.log(`✅ Tabela: ${row.tablename} - Todas as permissões OK`);
      }
    }

    if (!hasPermissionIssues) {
      console.log('\n✅ Todas as permissões estão corretas!');
      return;
    }

    // 3. Sugerir comandos SQL para corrigir
    console.log('\n⚠️  Problemas de permissão detectados nas seguintes tabelas:');
    console.log(problemTables.join(', '));

    console.log('\n📝 Para corrigir, execute os seguintes comandos SQL como superusuário (postgres):\n');
    console.log('-- Conecte ao banco como superusuário postgres');
    console.log(`-- psql -U postgres -d ${current_database}`);
    console.log('\n-- Execute estes comandos:');

    for (const table of problemTables) {
      console.log(`GRANT ALL PRIVILEGES ON TABLE public.${table} TO ${current_user};`);
    }

    // Verificar sequências também
    const sequencesQuery = `
      SELECT sequencename
      FROM pg_sequences
      WHERE schemaname = 'public'
    `;

    const sequencesResult = await pool.query(sequencesQuery);

    if (sequencesResult.rows.length > 0) {
      console.log('\n-- Conceder permissões nas sequências:');
      for (const row of sequencesResult.rows) {
        console.log(`GRANT ALL PRIVILEGES ON SEQUENCE public.${row.sequencename} TO ${current_user};`);
      }
    }

    console.log('\n-- Conceder permissões padrão para futuras tabelas:');
    console.log(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${current_user};`);
    console.log(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ${current_user};`);

    // 4. Informações adicionais
    console.log('\n📌 Informações de conexão:');
    console.log(`   Host: ${connectionString.match(/@([^:\/]+)/)?.[1] || 'unknown'}`);
    console.log(`   Database: ${current_database}`);
    console.log(`   User: ${current_user}`);

    console.log('\n💡 Dica: Se você não tiver acesso como superusuário, entre em contato com o administrador do banco de dados.');

  } catch (error) {
    console.error('❌ Erro ao verificar permissões:', error);

    if (error instanceof Error) {
      if (error.message.includes('permission denied')) {
        console.log('\n⚠️  O usuário atual não tem permissões suficientes.');
        console.log('   Você precisa executar os comandos SQL como um superusuário (postgres).');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.log('\n⚠️  Não foi possível conectar ao banco de dados.');
        console.log('   Verifique se o servidor PostgreSQL está rodando e acessível.');
      }
    }
  } finally {
    await pool.end();
  }
}

// Executar o script
fixPermissions().catch(console.error);