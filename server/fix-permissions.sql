-- Script para corrigir permissões no banco de dados PostgreSQL
-- Execute este script como superusuário (postgres) no banco fretus-dev

-- Verificar o usuário atual e suas permissões
SELECT current_user, current_database();

-- Listar todas as tabelas e suas permissões
SELECT
    schemaname,
    tablename,
    tableowner,
    has_table_privilege(current_user, schemaname||'.'||tablename, 'SELECT') as has_select,
    has_table_privilege(current_user, schemaname||'.'||tablename, 'INSERT') as has_insert,
    has_table_privilege(current_user, schemaname||'.'||tablename, 'UPDATE') as has_update,
    has_table_privilege(current_user, schemaname||'.'||tablename, 'DELETE') as has_delete
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

-- Conceder todas as permissões para o usuário 'fretus' em todas as tabelas
-- ATENÇÃO: Ajuste o nome do usuário conforme necessário
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Conceder permissões em todas as tabelas existentes
    FOR r IN SELECT schemaname, tablename
             FROM pg_tables
             WHERE schemaname = 'public'
    LOOP
        EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %I.%I TO fretus', r.schemaname, r.tablename);
        RAISE NOTICE 'Granted permissions on %.%', r.schemaname, r.tablename;
    END LOOP;

    -- Conceder permissões em todas as sequências
    FOR r IN SELECT schemaname, sequencename
             FROM pg_sequences
             WHERE schemaname = 'public'
    LOOP
        EXECUTE format('GRANT ALL PRIVILEGES ON SEQUENCE %I.%I TO fretus', r.schemaname, r.sequencename);
        RAISE NOTICE 'Granted permissions on sequence %.%', r.schemaname, r.sequencename;
    END LOOP;
END $$;

-- Conceder permissões padrão para novas tabelas criadas no futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO fretus;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO fretus;

-- Verificar as permissões após a concessão
SELECT
    'Permissions fixed for user: ' || current_user as status,
    COUNT(*) as total_tables,
    SUM(CASE WHEN has_table_privilege(current_user, schemaname||'.'||tablename, 'SELECT') THEN 1 ELSE 0 END) as can_select,
    SUM(CASE WHEN has_table_privilege(current_user, schemaname||'.'||tablename, 'INSERT') THEN 1 ELSE 0 END) as can_insert,
    SUM(CASE WHEN has_table_privilege(current_user, schemaname||'.'||tablename, 'UPDATE') THEN 1 ELSE 0 END) as can_update,
    SUM(CASE WHEN has_table_privilege(current_user, schemaname||'.'||tablename, 'DELETE') THEN 1 ELSE 0 END) as can_delete
FROM pg_tables
WHERE schemaname = 'public';