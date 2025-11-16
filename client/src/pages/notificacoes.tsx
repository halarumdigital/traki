import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, CheckCircle, CheckCircle2, XCircle, Clock, Users, User, Search, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  body: string;
  targetType: string;
  targetId: string | null;
  targetCityId: string | null;
  status: string;
  errorMessage: string | null;
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  sentAt: string | null;
  cityName: string | null;
  driverName: string | null;
}

interface City {
  id: string;
  name: string;
  state: string;
  driverCount: number;
}

interface Driver {
  id: string;
  name: string;
  mobile: string;
  carModel: string | null;
  carNumber: string | null;
  hasToken: boolean;
}

export default function Notificacoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"city" | "driver">("city");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");

  // Check if user is admin
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // Queries
  const { data: notifications = [], isLoading, error: notificationsError } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    retry: false,
  });

  const { data: cities = [], isLoading: citiesLoading, error: citiesError } = useQuery<City[]>({
    queryKey: ["/api/notifications/cities"],
    enabled: isDialogOpen,
    retry: false,
  });

  const { data: drivers = [], isLoading: driversLoading, error: driversError } = useQuery<Driver[]>({
    queryKey: ["/api/notifications/drivers", selectedCityId],
    enabled: isDialogOpen && targetType === "driver" && !!selectedCityId,
    retry: false,
  });

  // Mutation para enviar notificação
  const sendNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao enviar notificação");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notificação enviada",
        description: data.message,
      });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao enviar notificação",
        description: error.message,
      });
    },
  });

  // Filtrar notificações pela busca
  const filteredNotifications = notifications.filter((notification) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    const titleMatch = notification.title?.toLowerCase().includes(search);
    const bodyMatch = notification.body?.toLowerCase().includes(search);
    const cityMatch = notification.cityName?.toLowerCase().includes(search);
    const driverMatch = notification.driverName?.toLowerCase().includes(search);
    return titleMatch || bodyMatch || cityMatch || driverMatch;
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setTitle("");
    setBody("");
    setTargetType("city");
    setSelectedCityId("");
    setSelectedDriverId("");
  };

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha o título e a mensagem",
      });
      return;
    }

    if (targetType === "city" && !selectedCityId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione uma cidade",
      });
      return;
    }

    if (targetType === "driver" && !selectedDriverId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um motorista",
      });
      return;
    }

    const data = {
      title,
      body,
      targetType,
      targetId: targetType === "driver" ? selectedDriverId : null,
      targetCityId: targetType === "city" ? selectedCityId : (targetType === "driver" ? selectedCityId : null),
    };

    sendNotificationMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Enviada
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getTargetInfo = (notification: Notification) => {
    if (notification.targetType === "driver") {
      return (
        <div className="flex items-center gap-1">
          <User className="w-4 h-4" />
          <span>{notification.driverName || "Motorista"}</span>
        </div>
      );
    } else if (notification.targetType === "city") {
      return (
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>{notification.cityName || "Cidade"}</span>
        </div>
      );
    }
    return "-";
  };

  // Verificar se houve erro de autenticação
  if (notificationsError) {
    const errorMessage = notificationsError.message || "";
    if (errorMessage.includes("401") || errorMessage.includes("Não autorizado")) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
            <p className="text-muted-foreground">
              Você precisa estar logado como administrador para acessar esta página.
            </p>
          </CardContent>
        </Card>
      );
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">Notificações Push</CardTitle>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Send className="w-4 h-4 mr-2" />
              Enviar Notificação
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar notificações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">
                        <div>{format(new Date(notification.createdAt), "dd/MM/yyyy", { locale: ptBR })}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(notification.createdAt), "HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{notification.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{notification.body}</TableCell>
                    <TableCell>{getTargetInfo(notification)}</TableCell>
                    <TableCell>{getStatusBadge(notification.status)}</TableCell>
                    <TableCell>
                      {notification.status === "sent" ? (
                        <div className="text-sm">
                          <div className="text-green-600">
                            ✓ {notification.successCount} sucesso
                          </div>
                          {notification.failureCount > 0 && (
                            <div className="text-red-600">
                              ✗ {notification.failureCount} falha(s)
                            </div>
                          )}
                        </div>
                      ) : notification.errorMessage ? (
                        <span className="text-sm text-red-600">{notification.errorMessage}</span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Enviar Notificação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar Notificação Push</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Digite o título da notificação"
              />
            </div>

            <div>
              <Label htmlFor="body">Mensagem</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Digite a mensagem da notificação"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="targetType">Tipo de Destino</Label>
              <Select value={targetType} onValueChange={(value: "city" | "driver") => {
                setTargetType(value);
                setSelectedDriverId("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="city">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Todos os motoristas de uma cidade
                    </div>
                  </SelectItem>
                  <SelectItem value="driver">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Motorista específico
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === "city" && (
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Select value={selectedCityId} onValueChange={setSelectedCityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {citiesLoading ? (
                      <div className="p-2 text-center text-muted-foreground">
                        Carregando cidades...
                      </div>
                    ) : citiesError ? (
                      <div className="p-2 text-center text-destructive">
                        Erro ao carregar cidades. Verifique se você está logado como administrador.
                      </div>
                    ) : cities.length === 0 ? (
                      <div className="p-2 text-center text-muted-foreground">
                        Nenhuma cidade cadastrada
                      </div>
                    ) : (
                      cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          <div>
                            {city.name} - {city.state}
                            <span className="text-muted-foreground ml-2">
                              ({city.driverCount} motorista{city.driverCount !== 1 ? "s" : ""})
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === "driver" && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-800">
                      Para enviar notificação a um motorista específico, primeiro selecione a cidade onde ele está cadastrado, depois escolha o motorista da lista.
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="driverCity">
                    Passo 1: Selecione a cidade do motorista
                  </Label>
                  <Select value={selectedCityId} onValueChange={(value) => {
                    setSelectedCityId(value);
                    setSelectedDriverId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a cidade para listar os motoristas" />
                    </SelectTrigger>
                    <SelectContent>
                      {citiesLoading ? (
                        <div className="p-2 text-center text-muted-foreground">
                          Carregando cidades...
                        </div>
                      ) : citiesError ? (
                        <div className="p-2 text-center text-destructive">
                          Erro ao carregar cidades. Verifique se você está logado como administrador.
                        </div>
                      ) : cities.length === 0 ? (
                        <div className="p-2 text-center text-muted-foreground">
                          Nenhuma cidade cadastrada
                        </div>
                      ) : (
                        cities.map((city) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name} - {city.state}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCityId && (
                  <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2">
                    <Label htmlFor="driver" className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Passo 2: Selecione o motorista
                    </Label>
                    <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o motorista específico" />
                      </SelectTrigger>
                      <SelectContent>
                        {driversLoading ? (
                          <div className="p-2 text-center text-muted-foreground">
                            Carregando motoristas...
                          </div>
                        ) : driversError ? (
                          <div className="p-2 text-center text-destructive">
                            Erro ao carregar motoristas. Verifique se você está logado como administrador.
                          </div>
                        ) : drivers.length === 0 ? (
                          <div className="p-2 text-center text-muted-foreground">
                            Nenhum motorista encontrado nesta cidade
                          </div>
                        ) : (
                          drivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              <div className="flex justify-between items-center w-full">
                                <div>
                                  {driver.name}
                                  {driver.carModel && (
                                    <span className="text-muted-foreground ml-2">
                                      ({driver.carModel} - {driver.carNumber})
                                    </span>
                                  )}
                                </div>
                                {!driver.hasToken && (
                                  <Badge variant="outline" className="ml-2">
                                    Sem token
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={sendNotificationMutation.isPending}
            >
              {sendNotificationMutation.isPending ? "Enviando..." : "Enviar Notificação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}