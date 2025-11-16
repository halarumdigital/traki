# ✅ Checklist de Implementação - Sistema de Retorno ao Ponto de Origem

## 📱 Checklist para Desenvolvedor Mobile

### Fase 1: Preparação e Estrutura de Dados

- [ ] **Adicionar campo `needsReturn` no modelo de entrega**
  - Tipo: Boolean
  - Valor padrão: false

- [ ] **Adicionar novos campos de timestamp no modelo**
  - `deliveredAt`: String (ISO 8601)
  - `returningAt`: String (ISO 8601)
  - `returnedAt`: String (ISO 8601)

- [ ] **Adicionar novos status no enum/constantes**
  - `delivered_awaiting_return`
  - `returning`

- [ ] **Criar labels e traduções para novos status**
  - PT-BR: "Entregue, aguardando retorno"
  - PT-BR: "Retornando ao ponto de origem"

---

### Fase 2: Implementação de Endpoints

- [ ] **Modificar chamada do endpoint `/delivered`**
  - Verificar resposta `needsReturn` em `data`
  - Implementar fluxo condicional baseado em `needsReturn`

- [ ] **Implementar endpoint `/start-return`**
  ```javascript
  POST /api/v1/driver/deliveries/{id}/start-return
  Headers: Authorization Bearer token
  ```

- [ ] **Implementar endpoint `/complete-return`**
  ```javascript
  POST /api/v1/driver/deliveries/{id}/complete-return
  Headers: Authorization Bearer token
  ```

- [ ] **Implementar tratamento de erros para cada endpoint**
  - 400: Validação (ex: "precisa entregar primeiro")
  - 401: Não autenticado
  - 403: Não autorizado
  - 404: Entrega não encontrada
  - 500: Erro interno

---

### Fase 3: Interface do Usuário (UI)

#### Modal de Notificação (Nova Entrega Disponível)

- [ ] **Adicionar aviso de retorno quando `needsReturn = true`**
  - Banner/Card destacado com ícone ⚠️
  - Texto: "ESTA ENTREGA POSSUI VOLTA"
  - Subtítulo: "Você precisará retornar ao ponto de retirada após entregar"
  - Background: Amarelo/laranja claro (#FFF4E6)
  - Borda: 2px laranja (#FFB020)
  - Posição: Entre distância/tempo e valor
  - Padding: 12px, Border radius: 8px

#### Tela de Entrega em Andamento

- [ ] **Adicionar badge/indicador visual para entregas com retorno**
  - Mostrar ícone 🔄 ou badge "Requer retorno"
  - Usar cor diferenciada (ex: laranja/amarelo)

- [ ] **Modificar botão "Marcar como Entregue"**
  - Manter funcionalidade atual
  - Adaptar texto se `needsReturn = true`

#### Tela de Retorno (Nova)

- [ ] **Criar tela "Aguardando Retorno"**
  - Título: "Produto Entregue!"
  - Subtítulo: "Retorne ao ponto de retirada"
  - Mostrar endereço de retorno (pickupAddress)
  - Botão: "Iniciar Retorno"
  - Ícone/ilustração indicando retorno

- [ ] **Criar tela "Retornando"**
  - Título: "Retornando..."
  - Mostrar endereço de destino
  - Integrar com navegação GPS
  - Mostrar distância até o ponto (opcional)
  - Botão: "Cheguei no Local"
  - Loader/animação de trajeto

#### Validações de UX

- [ ] **Validar proximidade antes de permitir "Cheguei no Local"**
  - Usar geolocalização para verificar distância
  - Raio de tolerância: 100-200 metros
  - Mostrar mensagem se muito longe

- [ ] **Adicionar diálogo de confirmação**
  - Ao marcar como entregue (se needsReturn)
  - Ao completar retorno

---

### Fase 4: Navegação e Geolocalização

- [ ] **Integrar navegação GPS na tela de retorno**
  - Usar Google Maps / Apple Maps
  - Passar coordenadas do ponto de retirada

- [ ] **Implementar verificação de proximidade**
  - Calcular distância entre posição atual e destino
  - Habilitar botão "Cheguei" apenas quando próximo

- [ ] **Adicionar atualização periódica de localização**
  - Atualizar distância em tempo real
  - Mostrar progresso do retorno

---

### Fase 5: Estados e Fluxo de Navegação

- [ ] **Implementar máquina de estados para entrega**
  ```
  in_progress → delivered_awaiting_return → returning → completed
                       OU
  in_progress → completed (se needsReturn = false)
  ```

- [ ] **Adaptar navegação entre telas**
  - De "Entrega" para "Aguardando Retorno"
  - De "Aguardando Retorno" para "Retornando"
  - De "Retornando" para "Concluída"

- [ ] **Prevenir navegação back durante retorno**
  - Bloquear saída acidental
  - Adicionar confirmação se tentar voltar

---

### Fase 6: Notificações e Feedback

- [ ] **Adicionar notificações push para cada etapa**
  - "Produto entregue! Retorne ao ponto de retirada"
  - "Retorno iniciado"
  - "Entrega concluída! Você está disponível"

- [ ] **Implementar feedback visual de sucesso**
  - Animação de checkmark
  - Toast/Snackbar com mensagens
  - Vibração no dispositivo

- [ ] **Mostrar alertas importantes**
  - "Você precisa retornar ao ponto de origem"
  - "Motorista indisponível até completar retorno"

---

### Fase 7: Disponibilidade do Motorista

- [ ] **Atualizar indicador de disponibilidade**
  - Mostrar "Indisponível" durante retorno
  - Status visual diferenciado

- [ ] **Bloquear aceitação de novas entregas**
  - Durante status `delivered_awaiting_return`
  - Durante status `returning`

- [ ] **Liberar motorista ao completar retorno**
  - Atualizar status para disponível
  - Permitir aceitar novas entregas
  - Notificar motorista

---

### Fase 8: Testes

#### Testes Unitários

- [ ] **Testar parsing de resposta `/delivered`**
  - Com `needsReturn = true`
  - Com `needsReturn = false`

- [ ] **Testar chamadas de API**
  - `/start-return` com sucesso
  - `/complete-return` com sucesso
  - Tratamento de erros

- [ ] **Testar máquina de estados**
  - Transições válidas
  - Transições inválidas (devem falhar)

#### Testes de Integração

- [ ] **Testar fluxo completo sem retorno**
  1. Marcar como entregue
  2. Verificar status = completed
  3. Verificar motorista disponível

- [ ] **Testar fluxo completo com retorno**
  1. Marcar como entregue
  2. Verificar status = delivered_awaiting_return
  3. Iniciar retorno
  4. Verificar status = returning
  5. Completar retorno
  6. Verificar status = completed
  7. Verificar motorista disponível

- [ ] **Testar tentativa de pular etapas**
  1. Tentar completar retorno sem iniciar
  2. Verificar erro apropriado

#### Testes de UI

- [ ] **Testar navegação entre telas**
  - Fluxo normal
  - Fluxo com retorno
  - Botão voltar bloqueado

- [ ] **Testar indicadores visuais**
  - Badge "Requer retorno"
  - Cores de status
  - Animações

- [ ] **Testar em diferentes resoluções**
  - Celular pequeno
  - Celular médio
  - Tablet

#### Testes de Geolocalização

- [ ] **Testar verificação de proximidade**
  - Longe do ponto (>200m)
  - Próximo do ponto (<100m)
  - No ponto exato

- [ ] **Testar navegação GPS**
  - Abrir app de navegação
  - Retornar ao app após navegação

---

### Fase 9: Documentação e Code Review

- [ ] **Documentar código**
  - Comentários em funções principais
  - JSDoc/TypeDoc nos métodos

- [ ] **Atualizar README do projeto**
  - Adicionar seção sobre retorno
  - Documentar novos endpoints

- [ ] **Criar pull request**
  - Descrição detalhada
  - Screenshots/GIFs das telas
  - Lista de mudanças

- [ ] **Code review**
  - Solicitar revisão de pares
  - Endereçar comentários

---

### Fase 10: Deploy e Monitoramento

- [ ] **Testar em ambiente de staging**
  - Com dados reais
  - Diferentes cenários

- [ ] **Realizar testes com usuários beta**
  - Motoristas reais
  - Diferentes dispositivos

- [ ] **Monitorar logs de erro**
  - Primeira semana após deploy
  - Analytics de uso dos novos endpoints

- [ ] **Coletar feedback dos motoristas**
  - Facilidade de uso
  - Clareza das instruções
  - Problemas encontrados

---

## 📋 Checklist de QA

### Cenários de Teste

#### Cenário 1: Entrega Normal (Sem Retorno)
- [ ] Aceitar entrega sem `needsReturn`
- [ ] Marcar como entregue
- [ ] Verificar status = completed
- [ ] Verificar motorista disponível imediatamente

#### Cenário 2: Entrega com Retorno (Fluxo Feliz)
- [ ] Aceitar entrega com `needsReturn = true`
- [ ] Badge/indicador visível
- [ ] Marcar como entregue
- [ ] Tela de retorno mostrada
- [ ] Iniciar retorno
- [ ] Navegação GPS iniciada
- [ ] Chegar próximo ao ponto
- [ ] Botão "Cheguei" habilitado
- [ ] Completar retorno
- [ ] Status = completed
- [ ] Motorista disponível

#### Cenário 3: Tentativa de Burlar Sistema
- [ ] Tentar iniciar retorno sem entregar
- [ ] Verificar erro: "Precisa entregar primeiro"
- [ ] Tentar completar sem iniciar retorno
- [ ] Verificar erro: "Precisa iniciar retorno"

#### Cenário 4: Perda de Conexão
- [ ] Desconectar internet durante retorno
- [ ] Tentar completar retorno
- [ ] Verificar tratamento de erro
- [ ] Reconectar e tentar novamente

#### Cenário 5: Force Close do App
- [ ] Iniciar retorno
- [ ] Fechar app forçadamente
- [ ] Reabrir app
- [ ] Verificar estado correto mantido

---

## 🎯 Critérios de Aceitação

### Funcional
- ✅ Motorista consegue marcar entrega como completa (sem retorno)
- ✅ Motorista consegue entregar e iniciar retorno (com retorno)
- ✅ Motorista consegue completar retorno
- ✅ Sistema valida sequência de etapas
- ✅ Motorista fica indisponível durante retorno

### UX/UI
- ✅ Interface clara e intuitiva
- ✅ Feedback visual apropriado
- ✅ Mensagens de erro compreensíveis
- ✅ Navegação fluida entre telas

### Performance
- ✅ Chamadas de API rápidas (<2s)
- ✅ UI responsiva
- ✅ Geolocalização precisa

### Qualidade
- ✅ Sem crashes
- ✅ Sem memory leaks
- ✅ Tratamento de erros robusto
- ✅ Código testado e documentado

---

## 📞 Suporte e Dúvidas

**Backend:** Verificar logs do servidor
**API:** Consultar [DOCUMENTACAO_RETORNO_MOTORISTA.md](DOCUMENTACAO_RETORNO_MOTORISTA.md)
**Exemplos:** Consultar [EXEMPLOS_API_RETORNO.json](EXEMPLOS_API_RETORNO.json)

---

**Data de Criação:** 11/11/2025
**Versão:** 1.0.0
