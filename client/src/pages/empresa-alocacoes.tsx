import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PlusCircle, UserPlus, Clock, RefreshCw, XCircle, Wallet, RotateCcw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AllocationTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  basePrice: string;
}

interface Allocation {
  id: string;
  companyId: string;
  timeSlotId: string;
  driverId: string | null;
  allocationDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: string;
  driverAmount: string | null;
  driver: {
    id: string;
    name: string;
    profilePicture: string | null;
    latitude: string | null;
    longitude: string | null;
  } | null;
  timeSlot: {
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  deliveryCount: number;
  createdAt: string;
}

interface WalletData {
  availableBalance: string;
}

interface CompanyData {
  id: string;
  name: string;
  paymentType: "PRE_PAGO" | "BOLETO";
}


const statusLabels: Record<string, string> = {
  pending: "Aguardando Aceite",
  accepted: "Aceito",
  in_progress: "Em Andamento",
  completed: "Finalizado",
  cancelled: "Cancelado",
  expired: "Expirado",
  release_requested: "Liberação Solicitada",
  released_early: "Liberado Antecipadamente",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-500",
  release_requested: "bg-orange-100 text-orange-800",
  released_early: "bg-purple-100 text-purple-800",
};

export default function EmpresaAlocacoes() {
  const { toast } = useToast();
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedTab, setSelectedTab] = useState("active");

  // Buscar dados da empresa
  const { data: companyData } = useQuery<CompanyData>({
    queryKey: ["/api/empresa/auth/me"],
  });

  // Buscar wallet
  const { data: walletData } = useQuery<WalletData>({
    queryKey: ["/api/empresa/wallet"],
  });

  const isBoletoCompany = companyData?.paymentType === "BOLETO";

  // Buscar faixas de horário
  const { data: timeSlots = [] } = useQuery<AllocationTimeSlot[]>({
    queryKey: ["/api/allocation-time-slots"],
  });

  // Buscar alocações do dia
  const today = new Date().toISOString().split("T")[0];
  const { data: allocations = [], isLoading, refetch } = useQuery<Allocation[]>({
    queryKey: ["/api/empresa/allocations", today],
    queryFn: async () => {
      const response = await fetch(`/api/empresa/allocations?date=${today}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao buscar alocações");
      return response.json();
    },
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Alocações ativas (para o mapa)
  const activeAllocations = useMemo(() => {
    return allocations.filter(
      (a) => ["accepted", "in_progress", "release_requested"].includes(a.status) && a.driver
    );
  }, [allocations]);

  // Alocações pendentes
  const pendingAllocations = useMemo(() => {
    return allocations.filter((a) => a.status === "pending");
  }, [allocations]);

  // Alocações expiradas (ninguém aceitou)
  const expiredAllocations = useMemo(() => {
    return allocations.filter((a) => a.status === "expired");
  }, [allocations]);

  // Socket.IO para atualizações em tempo real
  useEffect(() => {
    const newSocket = io({
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Socket conectado");
      // Entrar na sala da empresa
      newSocket.emit("join-company", "company"); // O ID virá da sessão no servidor
    });

    newSocket.on("allocation-accepted", (data) => {
      console.log("Alocação aceita:", data);
      toast({
        title: "Entregador Aceito!",
        description: `${data.driverName} aceitou sua alocação`,
      });
      refetch();
    });

    newSocket.on("allocation-release-requested", (data) => {
      console.log("Liberação solicitada:", data);
      toast({
        title: "Liberação Solicitada",
        description: `Um entregador solicitou liberação antecipada`,
        variant: "destructive",
      });
      refetch();
    });

    newSocket.on("allocation-expired", (data) => {
      console.log("Alocação expirada:", data);
      toast({
        title: "Alocação Expirada",
        description: "Nenhum entregador aceitou a alocação",
        variant: "destructive",
      });
      refetch();
    });

    newSocket.on("allocation-completed", () => {
      refetch();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [toast, refetch]);

  // Mutation para criar alocação
  const createMutation = useMutation({
    mutationFn: async (data: { timeSlotId: string; quantity: number }) => {
      return await apiRequest("POST", "/api/empresa/allocations", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/wallet"] });
      toast({
        title: "Alocação Criada!",
        description: `${data.driversNotified} entregadores foram notificados`,
      });
      setIsNewDialogOpen(false);
      setSelectedTimeSlot("");
      setQuantity(1);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para liberar entregador
  const releaseMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      return await apiRequest("POST", `/api/empresa/allocations/${allocationId}/release`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/wallet"] });
      toast({
        title: "Entregador Liberado",
        description: "O entregador foi liberado com sucesso",
      });
      setIsReleaseDialogOpen(false);
      setSelectedAllocation(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para aprovar liberação antecipada
  const approveReleaseMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      return await apiRequest("POST", `/api/empresa/allocations/${allocationId}/approve-release`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/wallet"] });
      toast({
        title: "Liberação Aprovada",
        description: "O entregador foi liberado com valor proporcional",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para cancelar alocação pendente
  const cancelMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      return await apiRequest("POST", `/api/empresa/allocations/${allocationId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/allocations"] });
      toast({
        title: "Alocação Cancelada",
        description: "A alocação foi cancelada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para relançar alocação expirada
  const relaunchMutation = useMutation({
    mutationFn: async (allocation: Allocation) => {
      return await apiRequest("POST", "/api/empresa/allocations", {
        timeSlotId: allocation.timeSlotId,
        quantity: 1,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/wallet"] });
      toast({
        title: "Alocação Relançada!",
        description: `${data.driversNotified} entregadores foram notificados`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(value));
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  const selectedSlot = timeSlots.find((s) => s.id === selectedTimeSlot);
  const totalValue = selectedSlot ? parseFloat(selectedSlot.basePrice) * quantity : 0;
  const walletBalance = parseFloat(walletData?.availableBalance || "0");
  // Para empresas boleto, sempre permite (será cobrado no boleto)
  const hasEnoughBalance = isBoletoCompany || walletBalance >= totalValue;

  const handleCreateAllocation = () => {
    if (!selectedTimeSlot) {
      toast({
        title: "Erro",
        description: "Selecione uma faixa de horário",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({ timeSlotId: selectedTimeSlot, quantity });
  };

  const handleReleaseClick = (allocation: Allocation) => {
    setSelectedAllocation(allocation);
    setIsReleaseDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alocar Entregador</h1>
          <p className="text-muted-foreground">
            Solicite entregadores exclusivos para períodos de pico
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
            <Wallet className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">
              Saldo: {formatCurrency(walletData?.availableBalance || "0")}
            </span>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Alocação
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="active">
            Ativas ({activeAllocations.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pendentes ({pendingAllocations.length + expiredAllocations.length})
          </TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {/* Lista de Alocações Ativas */}
          {activeAllocations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Entregadores Alocados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeAllocations.map((allocation) => (
                    <Card key={allocation.id} className="border-2">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-semibold text-primary">
                                {allocation.driver?.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold">{allocation.driver?.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {allocation.timeSlot?.name}
                              </p>
                            </div>
                          </div>
                          <Badge className={statusColors[allocation.status]}>
                            {statusLabels[allocation.status]}
                          </Badge>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Horário:</span>
                            <span>{formatTime(allocation.startTime)} - {formatTime(allocation.endTime)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Entregas:</span>
                            <span className="font-semibold">{allocation.deliveryCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(allocation.totalAmount)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4">
                          {allocation.status === "release_requested" ? (
                            <Button
                              variant="outline"
                              className="w-full border-orange-500 text-orange-500 hover:bg-orange-50"
                              onClick={() => approveReleaseMutation.mutate(allocation.id)}
                              disabled={approveReleaseMutation.isPending}
                            >
                              {approveReleaseMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Aprovar Liberação
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => handleReleaseClick(allocation)}
                            >
                              Liberar Agora
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <UserPlus className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhum entregador alocado</p>
                  <p className="text-sm mb-4">Solicite uma alocação para reservar entregadores exclusivos</p>
                  <Button onClick={() => setIsNewDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Alocação
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-6">
          {/* Alocações Pendentes */}
          <Card>
            <CardHeader>
              <CardTitle>Alocações Aguardando Aceite</CardTitle>
              <CardDescription>
                Entregadores estão sendo notificados. O primeiro a aceitar receberá a alocação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingAllocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma alocação pendente
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingAllocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="animate-pulse">
                          <Clock className="h-6 w-6 text-yellow-500" />
                        </div>
                        <div>
                          <p className="font-medium">{allocation.timeSlot?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(allocation.startTime)} - {formatTime(allocation.endTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-green-600">
                          {formatCurrency(allocation.totalAmount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelMutation.mutate(allocation.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="h-5 w-5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alocações Expiradas */}
          {expiredAllocations.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Alocações Expiradas
                </CardTitle>
                <CardDescription>
                  Nenhum entregador aceitou estas alocações. Você pode relançar para tentar novamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expiredAllocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="flex items-center justify-between p-4 border border-orange-200 bg-orange-50 dark:bg-orange-950 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <AlertCircle className="h-6 w-6 text-orange-500" />
                        <div>
                          <p className="font-medium">{allocation.timeSlot?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(allocation.startTime)} - {formatTime(allocation.endTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-green-600">
                          {formatCurrency(allocation.totalAmount)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => relaunchMutation.mutate(allocation)}
                          disabled={relaunchMutation.isPending}
                          className="border-orange-500 text-orange-600 hover:bg-orange-100"
                        >
                          {relaunchMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-2" />
                          )}
                          Relançar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Alocações</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Faixa</TableHead>
                      <TableHead>Entregador</TableHead>
                      <TableHead>Entregas</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations
                      .filter((a) => ["completed", "released_early", "cancelled"].includes(a.status))
                      .map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>{allocation.allocationDate}</TableCell>
                          <TableCell>
                            {allocation.timeSlot?.name} ({formatTime(allocation.startTime)} - {formatTime(allocation.endTime)})
                          </TableCell>
                          <TableCell>{allocation.driver?.name || "-"}</TableCell>
                          <TableCell>{allocation.deliveryCount}</TableCell>
                          <TableCell className="font-medium text-green-600">
                            {formatCurrency(allocation.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[allocation.status]}>
                              {statusLabels[allocation.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Nova Alocação */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Alocação</DialogTitle>
            <DialogDescription>
              Solicite entregadores exclusivos para um período de pico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Faixa de Horário</Label>
              <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma faixa" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{slot.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({formatTime(slot.startTime)} - {formatTime(slot.endTime)}) - {formatCurrency(slot.basePrice)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade de Entregadores</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center"
                  min={1}
                  max={10}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  disabled={quantity >= 10}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Valor por entregador:</span>
                <span>{selectedSlot ? formatCurrency(selectedSlot.basePrice) : "-"}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span className="text-green-600">{formatCurrency(totalValue.toString())}</span>
              </div>
              {isBoletoCompany ? (
                <div className="flex justify-between text-sm">
                  <span>Forma de pagamento:</span>
                  <span className="text-blue-600 font-medium">Boleto</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span>Saldo disponível:</span>
                  <span className={hasEnoughBalance ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(walletData?.availableBalance || "0")}
                  </span>
                </div>
              )}
            </div>

            {isBoletoCompany && selectedTimeSlot && (
              <Alert>
                <AlertDescription>
                  O valor será adicionado ao seu próximo boleto.
                </AlertDescription>
              </Alert>
            )}

            {!isBoletoCompany && !hasEnoughBalance && selectedTimeSlot && (
              <Alert variant="destructive">
                <AlertDescription>
                  Saldo insuficiente. Recarregue sua carteira para continuar.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateAllocation}
              disabled={!selectedTimeSlot || !hasEnoughBalance || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Solicitando...
                </>
              ) : (
                "Solicitar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Liberação */}
      <AlertDialog open={isReleaseDialogOpen} onOpenChange={setIsReleaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar Entregador?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao liberar o entregador antes do fim do período, você será cobrado o{" "}
              <strong>valor total</strong> da alocação ({selectedAllocation ? formatCurrency(selectedAllocation.totalAmount) : ""}).
              <br /><br />
              O entregador receberá o valor integral e ficará disponível para outras empresas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedAllocation) {
                  releaseMutation.mutate(selectedAllocation.id);
                }
              }}
              disabled={releaseMutation.isPending}
            >
              {releaseMutation.isPending ? "Liberando..." : "Confirmar Liberação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
