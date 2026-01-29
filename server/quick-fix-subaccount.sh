#!/bin/bash

echo "🔍 Verificando subconta na Woovi..."

# Listar subcontas
curl -X GET \
  "https://api.woovi-sandbox.com/api/v1/subaccount/list" \
  -H "Authorization: $WOOVI_APP_ID" \
  -H "Content-Type: application/json" | jq .

echo ""
echo "✅ Subconta já existe na Woovi: producao@diegoeedsondocessalgadosltda.com.br"
echo ""
echo "📝 Agora você precisa:"
echo "1. Fazer login novamente como empresa (para atualizar a sessão)"
echo "2. Ou executar um UPDATE manual no banco para registrar a subconta"