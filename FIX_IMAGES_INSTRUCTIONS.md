# 🖼️ Correção de Imagens Não Aparecendo no Modal de Motoristas

## 🔍 Problema Identificado

Após migração do banco de dados, as imagens dos documentos dos motoristas não estão aparecendo no modal de visualização em `/motoristas/ativos`.

## 🎯 Causa Provável

As URLs das imagens no banco de dados podem estar:
1. Apontando para `localhost` ou IP local do servidor antigo
2. Usando URLs absolutas com domínio incorreto
3. Faltando configuração de `SERVER_URL` no arquivo `.env`

## ✅ Solução Passo a Passo

### 1️⃣ Verificar o Estado Atual das URLs

Execute o script de verificação para ver como estão as URLs no banco:

```bash
npm run check:driver-images
```

ou manualmente:

```bash
node --import tsx server/check-driver-images.ts
```

Este script mostrará:
- Exemplos de URLs armazenadas
- Estatísticas de URLs problemáticas
- Estado da configuração `SERVER_URL`

### 2️⃣ Configurar SERVER_URL no .env

Abra o arquivo `.env` e certifique-se de que `SERVER_URL` está configurada corretamente:

```env
# Para desenvolvimento local
SERVER_URL=http://localhost:5010

# Para produção (exemplo)
SERVER_URL=https://api.fretus.com
```

⚠️ **IMPORTANTE**: Use o domínio/IP onde o servidor Express está rodando!

### 3️⃣ Atualizar URLs no Banco de Dados

Execute o script de atualização interativo:

```bash
npm run update:image-urls
```

ou manualmente:

```bash
node --import tsx server/update-image-urls.ts
```

O script oferecerá duas opções:

#### Opção 1: Converter para URLs Relativas (RECOMENDADO)
- Transforma `http://localhost:5010/uploads/...` em `/uploads/...`
- As URLs relativas usarão automaticamente `SERVER_URL` ou o host da requisição
- Mais flexível para mudanças futuras de servidor

#### Opção 2: Substituir por Novo Domínio
- Substitui `localhost` pelo domínio especificado
- Útil se você preferir URLs absolutas
- Exemplo: `http://localhost:5010/uploads/...` → `https://api.fretus.com/uploads/...`

### 4️⃣ Reiniciar o Servidor

Após as mudanças, reinicie o servidor para aplicar a nova configuração:

```bash
npm run dev
# ou
npm run start
```

### 5️⃣ Testar a Visualização

1. Acesse `/motoristas/ativos`
2. Clique no ícone de olho (👁️) para ver detalhes de um motorista
3. Na aba "Cadastro", role até "Documentos Enviados"
4. As imagens devem aparecer corretamente

## 🔧 Scripts Disponíveis

Foram criados dois scripts auxiliares:

### `server/check-driver-images.ts`
- Verifica o estado atual das URLs
- Mostra estatísticas e exemplos
- Identifica problemas de configuração

### `server/update-image-urls.ts`
- Atualiza URLs problemáticas interativamente
- Oferece opções de correção
- Valida o resultado após atualização

## 📝 Adicionar aos Scripts do package.json (Opcional)

Para facilitar o uso futuro, adicione ao `package.json`:

```json
{
  "scripts": {
    "check:driver-images": "tsx server/check-driver-images.ts",
    "update:image-urls": "tsx server/update-image-urls.ts"
  }
}
```

## 🚨 Troubleshooting

### Problema: Imagens ainda não aparecem após correção

1. **Verifique o console do navegador** (F12) para erros 404 ou CORS
2. **Confirme que os arquivos existem** no diretório `uploads/documents_driver/`
3. **Verifique permissões** do diretório de uploads
4. **Teste a URL diretamente** no navegador

### Problema: CORS bloqueando imagens

Se as imagens estão em domínio diferente, configure CORS no servidor:

```typescript
// server/index.ts
app.use('/uploads', cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
```

### Problema: Arquivos não existem no novo servidor

Se você migrou apenas o banco mas não os arquivos:

1. Copie o diretório `uploads/` do servidor antigo
2. Ou configure um serviço de storage na nuvem (R2, S3, etc)

## 💡 Dicas

- **URLs Relativas são Preferíveis**: Facilitam migrações futuras
- **Sempre Configure SERVER_URL**: Mesmo com URLs relativas, é útil ter configurada
- **Faça Backup**: Antes de executar atualizações em produção
- **Teste Primeiro**: Execute os scripts em ambiente de desenvolvimento

## 📞 Suporte

Se o problema persistir:
1. Execute o script de verificação e analise o output
2. Verifique os logs do servidor para erros
3. Confirme que o middleware de arquivos estáticos está configurado:

```typescript
// server/index.ts
app.use('/uploads', express.static('uploads'));
```

---

**Última atualização**: Script criado para resolver problema de migração de servidor