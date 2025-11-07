# 🚀 Deploy em Produção - Guia Completo

## Arquitetura da Aplicação

Este guia ensina como separar a aplicação Fretus em **3 servidores VPS distintos**:

```
┌─────────────────────────┐
│   VPS 1 - FRONTEND      │
│   painel.fretus.com     │  ← Painel Web (React + Vite)
│   nginx (80, 443)       │     Arquivos estáticos
└────────┬────────────────┘
         │
         │ HTTPS Requests
         ↓
┌─────────────────────────┐
│   VPS 2 - API/BACKEND   │
│   api.fretus.com        │  ← Express + Node.js
│   nginx + PM2 (5010)    │     REST API
└────────┬────────────────┘
         │
         │ PostgreSQL Connection
         ↓
┌─────────────────────────┐
│   VPS 3 - BANCO DADOS   │
│   db.fretus.com         │  ← PostgreSQL 15+
│   PostgreSQL (5432)     │     Sem acesso público
└─────────────────────────┘
```

---

## 📋 Pré-requisitos

### Você precisará de:

- **3 VPS** com Ubuntu 22.04 LTS ou superior
- **Domínio** configurado (ex: fretus.com)
- **Acesso SSH** aos 3 servidores
- **Git** instalado localmente
- **Node.js 18+** instalado localmente

### Especificações mínimas recomendadas:

| VPS | CPU | RAM | Disco | Função |
|-----|-----|-----|-------|--------|
| VPS 1 | 1 core | 1GB | 25GB | Frontend (nginx) |
| VPS 2 | 2 cores | 2GB | 50GB | API (Node.js + PM2) |
| VPS 3 | 2 cores | 4GB | 50GB | PostgreSQL + Backups |

---

## 🎯 FASE 1: Preparação do Código

### 1.1 - Modificar Frontend para Produção

**Arquivo:** `client/src/lib/queryClient.ts` ou onde configura o Axios/Dio

Procure por configurações de URL da API e modifique:

```typescript
// ANTES
const API_URL = 'http://localhost:5010';

// DEPOIS
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5010';
```

**Criar arquivo `.env.production`:**

```bash
# f:\fretus\.env.production
VITE_API_URL=https://api.fretus.com
```

### 1.2 - Adicionar CORS no Backend

**Instalar dependência:**

```bash
cd f:\fretus
npm install cors
npm install @types/cors --save-dev
```

**Arquivo:** `server/index.ts` (adicionar logo após os imports)

```typescript
import cors from 'cors';

// ... outros imports ...

const app = express();

// Adicionar CORS ANTES de outras configurações
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ... resto do código ...
```

### 1.3 - Remover Código de Servir Frontend

**Arquivo:** `server/index.ts`

Procure e **COMENTE ou REMOVA** estas linhas (final do arquivo):

```typescript
// ❌ REMOVER ESTAS LINHAS
if (app.get("env") === "development") {
  await setupVite(app, server);
} else {
  serveStatic(app);
}
```

O backend não deve mais servir o frontend. Apenas a API.

### 1.4 - Testar Build Local

```bash
# Build do frontend
npm run build

# Verificar se pasta dist foi criada
dir dist
# Deve conter: index.html, assets/, etc.
```

### 1.5 - Commit das Mudanças

```bash
git add .
git commit -m "Preparar aplicação para deploy em produção"
git push origin main
```

---

## 🗄️ FASE 2: Configurar VPS 3 (Banco de Dados)

### 2.1 - Conectar ao VPS 3

```bash
ssh root@<IP_VPS3>
```

### 2.2 - Atualizar Sistema

```bash
apt update && apt upgrade -y
apt install -y postgresql postgresql-contrib
```

### 2.3 - Verificar Instalação

```bash
psql --version
# Deve mostrar: psql (PostgreSQL) 14.x ou superior

systemctl status postgresql
# Deve estar "active (running)"
```

### 2.4 - Criar Database e Usuário

```bash
# Entrar como usuário postgres
sudo -u postgres psql

# Dentro do psql, executar:
CREATE DATABASE fretus_prod;
CREATE USER fretus_user WITH ENCRYPTED PASSWORD 'SuaSenhaSeguraAqui123!@#';
GRANT ALL PRIVILEGES ON DATABASE fretus_prod TO fretus_user;

# Dar permissões no schema public (PostgreSQL 15+)
\c fretus_prod
GRANT ALL ON SCHEMA public TO fretus_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fretus_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fretus_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fretus_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fretus_user;

# Sair
\q
```

### 2.5 - Configurar Acesso Remoto

**Editar `postgresql.conf`:**

```bash
nano /etc/postgresql/14/main/postgresql.conf
```

Procure a linha `listen_addresses` e modifique:

```conf
# Permitir conexões de qualquer IP (ou especifique o IP do VPS 2)
listen_addresses = '*'
```

**Editar `pg_hba.conf`:**

```bash
nano /etc/postgresql/14/main/pg_hba.conf
```

Adicione no final do arquivo (substitua `<IP_VPS2>` pelo IP real do VPS 2):

```conf
# Permitir acesso do VPS 2 (API)
host    fretus_prod     fretus_user     <IP_VPS2>/32         scram-sha-256
```

### 2.6 - Reiniciar PostgreSQL

```bash
systemctl restart postgresql
systemctl status postgresql
```

### 2.7 - Configurar Firewall

```bash
# Instalar UFW
apt install -y ufw

# Permitir SSH
ufw allow 22/tcp

# Bloquear PostgreSQL de todos
ufw deny 5432/tcp

# Permitir PostgreSQL apenas do VPS 2
ufw allow from <IP_VPS2> to any port 5432

# Ativar firewall
ufw enable
ufw status
```

### 2.8 - Configurar Backup Automático

```bash
# Criar diretório de backups
mkdir -p /backups
chmod 700 /backups

# Criar script de backup
nano /usr/local/bin/backup-postgres.sh
```

Conteúdo do script:

```bash
#!/bin/bash
DATA=$(date +%Y%m%d_%H%M%S)
pg_dump -U fretus_user -h localhost fretus_prod | gzip > /backups/fretus_${DATA}.sql.gz

# Manter apenas últimos 7 dias
find /backups -name "fretus_*.sql.gz" -mtime +7 -delete

echo "Backup realizado: fretus_${DATA}.sql.gz"
```

Tornar executável:

```bash
chmod +x /usr/local/bin/backup-postgres.sh
```

**Agendar backup diário (2h da manhã):**

```bash
crontab -e
```

Adicionar:

```cron
0 2 * * * /usr/local/bin/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1
```

### 2.9 - Testar Conexão Remota (do seu PC)

```bash
# Instalar psql no Windows (opcional)
# Ou testar do VPS 2 depois

# Testar conexão
psql -h <IP_VPS3> -U fretus_user -d fretus_prod -W
# Digite a senha quando solicitado
# Se conectar com sucesso, está funcionando!
```

---

## 🚀 FASE 3: Configurar VPS 2 (API/Backend)

### 3.1 - Conectar ao VPS 2

```bash
ssh root@<IP_VPS2>
```

### 3.2 - Instalar Node.js 18+

```bash
# Adicionar repositório NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# Instalar Node.js e npm
apt install -y nodejs

# Verificar versões
node --version  # v18.x ou superior
npm --version   # 9.x ou superior
```

### 3.3 - Instalar PM2 e nginx

```bash
npm install -g pm2
apt install -y nginx
```

### 3.4 - Criar Usuário para a Aplicação

```bash
# Criar usuário sem privilégios de root
adduser fretus --disabled-password --gecos ""

# Criar diretório da aplicação
mkdir -p /home/fretus/api
chown -R fretus:fretus /home/fretus/api
```

### 3.5 - Clonar Repositório

```bash
# Como usuário fretus
su - fretus

# Clonar (ou usar git)
cd /home/fretus/api
git clone https://github.com/seu-usuario/fretus.git .

# Ou via rsync do seu PC (no seu PC Windows):
# rsync -avz --exclude 'node_modules' --exclude 'client' --exclude '.git' f:\fretus\ root@<IP_VPS2>:/home/fretus/api/
```

### 3.6 - Instalar Dependências

```bash
cd /home/fretus/api
npm install --production
```

### 3.7 - Criar Arquivo .env

```bash
nano /home/fretus/api/.env
```

Conteúdo:

```bash
NODE_ENV=production
PORT=5010

# Banco de dados (VPS 3)
DATABASE_URL=postgresql://fretus_user:SuaSenhaSeguraAqui123!@#@<IP_VPS3>:5432/fretus_prod

# CORS - Frontend
CORS_ORIGIN=https://painel.fretus.com

# Session
SESSION_SECRET=gere-um-secret-aleatorio-super-seguro-aqui-com-64-caracteres

# Firebase (copie do seu .env local)
FIREBASE_PROJECT_ID=seu-projeto-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_AQUI\n-----END PRIVATE KEY-----\n"
```

**⚠️ IMPORTANTE:** Proteger o arquivo .env

```bash
chmod 600 /home/fretus/api/.env
```

### 3.8 - Executar Migrations

```bash
cd /home/fretus/api
npm run db:push
# Criar tabelas no banco de dados

# Opcional: Criar usuário admin
npm run db:seed
```

### 3.9 - Testar API Localmente

```bash
# Iniciar API temporariamente
npm start

# Em outro terminal, testar:
curl http://localhost:5010/api/auth/me
# Deve retornar: {"message":"Não autenticado"}
# Se retornar isso, está funcionando!

# Parar com Ctrl+C
```

### 3.10 - Configurar PM2

```bash
# Como usuário fretus
cd /home/fretus/api

# Iniciar aplicação com PM2
pm2 start npm --name "fretus-api" -- start

# Ver logs
pm2 logs fretus-api

# Configurar auto-start ao reiniciar servidor
pm2 startup systemd -u fretus --hp /home/fretus
# Copiar e executar o comando que aparecer

pm2 save

# Verificar status
pm2 status
```

### 3.11 - Configurar nginx (Proxy Reverso)

```bash
# Como root
exit  # Sair do usuário fretus

nano /etc/nginx/sites-available/fretus-api
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name api.fretus.com;

    # Logs
    access_log /var/log/nginx/fretus-api-access.log;
    error_log /var/log/nginx/fretus-api-error.log;

    # Proxy para Node.js
    location / {
        proxy_pass http://localhost:5010;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Upload de arquivos (documentos motoristas)
        client_max_body_size 10M;
    }

    # WebSocket para Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:5010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

**Ativar site:**

```bash
ln -s /etc/nginx/sites-available/fretus-api /etc/nginx/sites-enabled/
nginx -t  # Testar configuração
systemctl restart nginx
```

### 3.12 - Configurar SSL (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx

# Obter certificado SSL
certbot --nginx -d api.fretus.com

# Seguir instruções (email, aceitar termos)
# Escolher opção 2 (redirecionar HTTP para HTTPS)

# Renovação automática já está configurada
certbot renew --dry-run
```

### 3.13 - Configurar Firewall

```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
ufw status
```

### 3.14 - Testar API Externamente

```bash
# Do seu PC
curl https://api.fretus.com/api/auth/me

# Deve retornar JSON: {"message":"Não autenticado"}
```

---

## 🎨 FASE 4: Configurar VPS 1 (Frontend)

### 4.1 - Conectar ao VPS 1

```bash
ssh root@<IP_VPS1>
```

### 4.2 - Instalar nginx

```bash
apt update && apt upgrade -y
apt install -y nginx
```

### 4.3 - Criar Diretório do Site

```bash
mkdir -p /var/www/fretus-painel
chown -R www-data:www-data /var/www/fretus-painel
```

### 4.4 - Fazer Build e Enviar Frontend

**No seu PC Windows:**

```bash
cd f:\fretus

# Verificar se .env.production está correto
type .env.production
# Deve conter: VITE_API_URL=https://api.fretus.com

# Build
npm run build

# Enviar para VPS 1 (via WinSCP, FileZilla ou rsync)
# Copiar todo conteúdo da pasta dist/ para /var/www/fretus-painel/
```

**Ou via rsync (se tiver SSH configurado):**

```bash
# Do Windows (Git Bash ou WSL)
rsync -avz dist/ root@<IP_VPS1>:/var/www/fretus-painel/
```

### 4.5 - Configurar nginx (SPA)

```bash
nano /etc/nginx/sites-available/fretus-painel
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name painel.fretus.com www.painel.fretus.com;

    root /var/www/fretus-painel;
    index index.html;

    # Logs
    access_log /var/log/nginx/fretus-painel-access.log;
    error_log /var/log/nginx/fretus-painel-error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # SPA - todas as rotas retornam index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets (JS, CSS, imagens)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**Ativar site:**

```bash
ln -s /etc/nginx/sites-available/fretus-painel /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 4.6 - Configurar SSL

```bash
apt install -y certbot python3-certbot-nginx

certbot --nginx -d painel.fretus.com -d www.painel.fretus.com

# Seguir instruções
# Escolher opção 2 (redirecionar HTTP para HTTPS)
```

### 4.7 - Configurar Firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

### 4.8 - Testar Frontend

Abrir navegador: `https://painel.fretus.com`

Deve carregar o painel!

---

## 🌐 FASE 5: Configurar DNS

No painel do seu provedor de domínio (ex: GoDaddy, Namecheap, Registro.br):

### Registros A:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | painel | `<IP_VPS1>` | 3600 |
| A | www.painel | `<IP_VPS1>` | 3600 |
| A | api | `<IP_VPS2>` | 3600 |

### Aguardar propagação DNS (até 24h, geralmente 1-2h)

Verificar propagação:

```bash
# Windows
nslookup painel.fretus.com
nslookup api.fretus.com

# Deve retornar os IPs corretos
```

---

## ✅ FASE 6: Testes Finais

### 6.1 - Testar API

```bash
# Validar email
curl -X POST https://api.fretus.com/api/v1/driver/validate-mobile-for-login \
  -H "Content-Type: application/json" \
  -d '{"email":"ze1@gmail.com"}'

# Deve retornar JSON com dados do motorista
```

### 6.2 - Testar Painel

1. Abrir `https://painel.fretus.com`
2. Fazer login com admin (admin@fretus.com / admin123)
3. Navegar pelas páginas
4. Verificar se chamadas API funcionam

### 6.3 - Testar App Flutter

Atualizar URL base no app:

```dart
final dio = Dio(BaseOptions(
  baseUrl: 'https://api.fretus.com',
));
```

Testar login do motorista.

---

## 🔒 FASE 7: Segurança Adicional

### 7.1 - Desabilitar Login Root via SSH (Todos os VPS)

```bash
nano /etc/ssh/sshd_config
```

Modificar:

```conf
PermitRootLogin no
PasswordAuthentication no  # Usar apenas chaves SSH
```

Reiniciar SSH:

```bash
systemctl restart sshd
```

### 7.2 - Instalar Fail2Ban (Todos os VPS)

```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### 7.3 - Configurar Rate Limiting (VPS 2 - API)

**nginx:**

```nginx
# /etc/nginx/sites-available/fretus-api

# Adicionar no topo (fora do server)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    # ... configuração existente ...

    location / {
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;

        # ... resto da configuração ...
    }
}
```

Reiniciar nginx:

```bash
nginx -t
systemctl restart nginx
```

---

## 📊 FASE 8: Monitoramento

### 8.1 - Monitorar PM2 (VPS 2)

```bash
pm2 monit  # Interface de monitoramento

pm2 logs fretus-api  # Ver logs em tempo real
pm2 logs fretus-api --lines 100  # Últimas 100 linhas
```

### 8.2 - Monitorar nginx (VPS 1 e 2)

```bash
# Logs de acesso
tail -f /var/log/nginx/fretus-*-access.log

# Logs de erro
tail -f /var/log/nginx/fretus-*-error.log
```

### 8.3 - Monitorar PostgreSQL (VPS 3)

```bash
# Conexões ativas
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Ver queries lentas
sudo -u postgres psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';"
```

---

## 🔄 FASE 9: Atualização da Aplicação

### Atualizar Frontend (VPS 1)

```bash
# No seu PC
cd f:\fretus
git pull
npm run build

# Enviar para VPS 1
rsync -avz dist/ root@<IP_VPS1>:/var/www/fretus-painel/

# Limpar cache do navegador ou usar cache busting
```

### Atualizar API (VPS 2)

```bash
# No VPS 2
su - fretus
cd /home/fretus/api

git pull
npm install --production

# Reiniciar PM2
pm2 restart fretus-api

# Ver logs
pm2 logs fretus-api
```

### Executar Migrations (se houver)

```bash
cd /home/fretus/api
npm run db:push
```

---

## 🆘 Troubleshooting

### Problema: API não conecta ao banco

**Verificar:**

```bash
# VPS 2 - Testar conexão
psql -h <IP_VPS3> -U fretus_user -d fretus_prod -W

# Se não conectar:
# 1. Verificar firewall VPS 3: ufw status
# 2. Verificar pg_hba.conf
# 3. Verificar se PostgreSQL está ouvindo em *
```

### Problema: Frontend não carrega

**Verificar:**

```bash
# VPS 1
ls -la /var/www/fretus-painel/
# Deve ter: index.html, assets/

# Ver logs nginx
tail -f /var/log/nginx/fretus-painel-error.log
```

### Problema: CORS Error

**Verificar:**

```bash
# VPS 2 - Ver .env
cat /home/fretus/api/.env | grep CORS_ORIGIN
# Deve ser: CORS_ORIGIN=https://painel.fretus.com

# Reiniciar PM2
pm2 restart fretus-api
```

### Problema: PM2 não inicia após reiniciar VPS

```bash
# VPS 2
su - fretus
pm2 resurrect
pm2 save
```

---

## 📝 Checklist Final

### VPS 3 (Banco):
- [ ] PostgreSQL instalado e rodando
- [ ] Database `fretus_prod` criada
- [ ] Usuário `fretus_user` criado com permissões
- [ ] Acesso remoto configurado (apenas VPS 2)
- [ ] Firewall ativo (UFW)
- [ ] Backup automático configurado
- [ ] Testar conexão remota

### VPS 2 (API):
- [ ] Node.js 18+ instalado
- [ ] Código clonado em `/home/fretus/api`
- [ ] `.env` configurado com DATABASE_URL correto
- [ ] Migrations executadas (`npm run db:push`)
- [ ] PM2 rodando com auto-start
- [ ] nginx configurado como proxy reverso
- [ ] SSL configurado (Let's Encrypt)
- [ ] Firewall ativo
- [ ] API acessível via `https://api.fretus.com`

### VPS 1 (Frontend):
- [ ] nginx instalado
- [ ] Build do frontend enviado para `/var/www/fretus-painel`
- [ ] nginx configurado para SPA
- [ ] SSL configurado
- [ ] Firewall ativo
- [ ] Painel acessível via `https://painel.fretus.com`

### DNS:
- [ ] `painel.fretus.com` → IP VPS 1
- [ ] `api.fretus.com` → IP VPS 2
- [ ] Propagação DNS completa

### Testes:
- [ ] Login no painel funciona
- [ ] Chamadas API funcionam
- [ ] App Flutter conecta à API
- [ ] Upload de documentos funciona
- [ ] Notificações push funcionam

---

## 📞 Suporte

**Logs úteis:**

```bash
# VPS 1 (Frontend)
tail -f /var/log/nginx/fretus-painel-error.log

# VPS 2 (API)
pm2 logs fretus-api
tail -f /var/log/nginx/fretus-api-error.log

# VPS 3 (Banco)
tail -f /var/log/postgresql/postgresql-14-main.log
```

**Comandos úteis:**

```bash
# Reiniciar serviços
systemctl restart nginx
pm2 restart all
systemctl restart postgresql

# Ver status
systemctl status nginx
pm2 status
systemctl status postgresql

# Ver uso de recursos
htop
df -h  # Disco
free -h  # RAM
```

---

**Versão do documento:** 1.0
**Data:** 06/11/2025
**Autor:** Documentação Fretus
