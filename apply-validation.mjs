import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ler o arquivo routes.ts
const routesPath = path.join(__dirname, 'server', 'routes.ts');
let content = fs.readFileSync(routesPath, 'utf8');

// Definir o código de validação a ser inserido
const validationCode = `
      // 🔒 NOVA VALIDAÇÃO: Verificar se o motorista já tem uma entrega em andamento
      const [activeDelivery] = await db
        .select()
        .from(requests)
        .where(
          and(
            eq(requests.driverId, driverId),
            eq(requests.isCompleted, false),
            eq(requests.isCancelled, false)
          )
        )
        .limit(1);

      if (activeDelivery) {
        // Se tiver uma entrega ativa, verificar se já foi retirada
        if (!activeDelivery.isTripStart) {
          console.log(\`❌ Motorista \${driverId} tentou aceitar nova entrega sem ter retirado a anterior (\${activeDelivery.requestNumber})\`);
          return res.status(409).json({
            message: "Você já possui uma entrega em andamento. Retire o pedido antes de aceitar uma nova entrega.",
            code: "DELIVERY_IN_PROGRESS_NOT_PICKED_UP",
            activeDeliveryId: activeDelivery.id,
            activeDeliveryNumber: activeDelivery.requestNumber
          });
        }

        // Se já retirou, pode aceitar nova entrega (mas ainda não pode abrir a nova até finalizar a atual)
        console.log(\`⚠️ Motorista \${driverId} já tem entrega retirada (\${activeDelivery.requestNumber}), mas pode aceitar nova\`);
      }
`;

// Procurar o ponto de inserção
const searchPattern = /console\.log\(`✅ Motorista \$\{driverId\} aceitando solicitação \$\{requestId\}`\);\n\n      \/\/ Verificar se a solicitação ainda está disponível/;

if (searchPattern.test(content)) {
  // Substituir adicionando a validação
  content = content.replace(
    searchPattern,
    `console.log(\`✅ Motorista \${driverId} aceitando solicitação \${requestId}\`);\n${validationCode}\n      // Verificar se a solicitação ainda está disponível`
  );

  // Salvar o arquivo modificado
  fs.writeFileSync(routesPath, content, 'utf8');
  console.log('✅ Validação adicionada com sucesso ao endpoint de aceitar entrega!');
  console.log('📍 Localização: server/routes.ts, endpoint POST /api/v1/driver/requests/:id/accept');
} else {
  console.error('❌ Não foi possível encontrar o ponto de inserção no arquivo.');
  console.log('Por favor, aplique as alterações manualmente usando o arquivo VALIDACAO_ENTREGAS.md');
}
