#!/bin/bash

# Carregar NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Usar a versão do Node
nvm use 22.21.1

# Executar o script
node --import tsx server/setup-webhook-local.ts