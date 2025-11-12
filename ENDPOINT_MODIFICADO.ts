// Este é o endpoint modificado com a validação
// Substitua o conteúdo do endpoint POST /api/v1/driver/requests/:id/accept
// no arquivo server/routes.ts (linha ~5370)

  // POST /api/v1/driver/requests/:id/accept - Aceitar solicitação
  app.post("/api/v1/driver/requests/:id/accept", async (req, res) => {
    try {
      // Permitir autenticação via sessão OU Bearer token
      let driverId = req.session.driverId;

      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Erro ao decodificar token:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const requestId = req.params.id;
      console.log(`✅ Motorista ${driverId} aceitando solicitação ${requestId}`);

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
          console.log(`❌ Motorista ${driverId} tentou aceitar nova entrega sem ter retirado a anterior (${activeDelivery.requestNumber})`);
          return res.status(409).json({
            message: "Você já possui uma entrega em andamento. Retire o pedido antes de aceitar uma nova entrega.",
            code: "DELIVERY_IN_PROGRESS_NOT_PICKED_UP",
            activeDeliveryId: activeDelivery.id,
            activeDeliveryNumber: activeDelivery.requestNumber
          });
        }

        // Se já retirou, pode aceitar nova entrega (mas ainda não pode abrir a nova até finalizar a atual)
        console.log(`⚠️ Motorista ${driverId} já tem entrega retirada (${activeDelivery.requestNumber}), mas pode aceitar nova`);
      }

      // Verificar se a solicitação ainda está disponível
      const [request] = await db
        .select()
        .from(requests)
        .where(eq(requests.id, requestId))
        .limit(1);

      if (!request) {
        return res.status(404).json({
          message: "Solicitação não encontrada",
        });
      }

      if (request.driverId) {
        return res.status(409).json({
          message: "Esta solicitação já foi aceita por outro motorista",
        });
      }

      // ... (resto do código permanece igual)
    } catch (error) {
      console.error("Erro ao aceitar solicitação:", error);
      return res.status(500).json({ message: "Erro ao aceitar solicitação" });
    }
  });
