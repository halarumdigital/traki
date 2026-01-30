import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Edit, DollarSign, Trash2, Clock } from "lucide-react";

type CityPrice = {
  id: string;
  serviceLocationId: string;
  serviceLocationName?: string;
  vehicleTypeId: string;
  vehicleTypeName?: string;
  basePrice: string;
  pricePerDistance: string;
  pricePerTime: string;
  tipo: string;
  rotaIntermunicipalId?: string;
  rotaIntermunicipalNome?: string;
  active: boolean;
};

type ServiceLocation = {
  id: string;
  name: string;
  state?: string;
};

type VehicleType = {
  id: string;
  name: string;
};

type RotaIntermunicipal = {
  id: string;
  nomeRota: string;
};

type AllocationSlotItem = {
  name: string;
  startTime: string;
  endTime: string;
  basePrice: string;
  active: boolean;
};

type AllocationTimeSlot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  basePrice: string;
  serviceLocationId: string | null;
  cityName?: string | null;
  active: boolean;
};

const priceSchema = z.object({
  tipo: z.enum(["entrega_rapida", "rota_intermunicipal"]).default("entrega_rapida"),
  rotaIntermunicipalId: z.string().optional(),
  serviceLocationId: z.string().optional(),
  vehicleTypeId: z.string().min(1, "Categoria é obrigatória"),
  basePrice: z.string().min(1, "Tarifa base é obrigatória"),
  pricePerDistance: z.string().min(1, "Preço por km é obrigatório"),
  pricePerTime: z.string().min(1, "Preço por minuto é obrigatório"),
  baseDistance: z.string().default("0"),
  waitingChargePerMinute: z.string().default("0"),
  freeWaitingTimeMins: z.string().default("5"),
  cancellationFee: z.string().default("0"),
  stopPrice: z.string().default("0"),
  returnPrice: z.string().default("0"),
  dynamicPrice: z.string().default("0"),
  dynamicPriceActive: z.boolean().default(false),
  active: z.boolean().default(true),
}).refine((data) => {
  if (data.tipo === "rota_intermunicipal") {
    return !!data.rotaIntermunicipalId;
  }
  if (data.tipo === "entrega_rapida") {
    return !!data.serviceLocationId;
  }
  return true;
}, {
  message: "Campo obrigatório para este tipo de preço",
  path: ["serviceLocationId"],
}).refine((data) => {
  if (data.tipo === "rota_intermunicipal") {
    return !!data.rotaIntermunicipalId;
  }
  return true;
}, {
  message: "Rota intermunicipal é obrigatória quando o tipo é 'Rota Intermunicipal'",
  path: ["rotaIntermunicipalId"],
});

type PriceForm = z.infer<typeof priceSchema>;

export default function Precos() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<CityPrice | null>(null);
  const [pendingSlots, setPendingSlots] = useState<AllocationSlotItem[]>([]);
  const [newSlotName, setNewSlotName] = useState("");
  const [newSlotStart, setNewSlotStart] = useState("");
  const [newSlotEnd, setNewSlotEnd] = useState("");
  const [newSlotPrice, setNewSlotPrice] = useState("");

  const { data: precos = [], isLoading } = useQuery<CityPrice[]>({
    queryKey: ["/api/city-prices"],
  });

  const { data: cities = [] } = useQuery<ServiceLocation[]>({
    queryKey: ["/api/cities"],
  });

  const { data: categories = [] } = useQuery<VehicleType[]>({
    queryKey: ["/api/vehicle-types"],
  });

  const { data: rotas = [] } = useQuery<RotaIntermunicipal[]>({
    queryKey: ["/api/rotas-intermunicipais"],
  });

  const { data: allocationSlots = [] } = useQuery<AllocationTimeSlot[]>({
    queryKey: ["/api/admin/allocation-time-slots"],
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/allocation-time-slots/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allocation-time-slots"] });
      toast({ title: "Sucesso!", description: "Faixa excluída" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PriceForm) => {
      return await apiRequest("POST", "/api/city-prices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-prices"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PriceForm }) => {
      return await apiRequest("PUT", `/api/city-prices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-prices"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/city-prices/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-prices"] });
      toast({ title: "Sucesso!", description: "Preço excluído com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<PriceForm>({
    resolver: zodResolver(priceSchema),
    defaultValues: {
      tipo: "entrega_rapida",
      rotaIntermunicipalId: "",
      serviceLocationId: "",
      vehicleTypeId: "",
      basePrice: "",
      pricePerDistance: "",
      pricePerTime: "",
      baseDistance: "0",
      waitingChargePerMinute: "0",
      freeWaitingTimeMins: "5",
      cancellationFee: "0",
      stopPrice: "0",
      returnPrice: "0",
      dynamicPrice: "0",
      dynamicPriceActive: false,
      active: true,
    },
  });

  const tipoValue = form.watch("tipo");

  const onSubmit = async (data: PriceForm) => {
    try {
      if (editingPrice) {
        await updateMutation.mutateAsync({ id: editingPrice.id, data });
        toast({ title: "Sucesso!", description: "Preço atualizado com sucesso" });
      } else {
        await createMutation.mutateAsync(data);
        toast({ title: "Sucesso!", description: "Preço criado com sucesso" });
      }

      // Criar faixas de alocação pendentes
      console.log("Verificando faixas pendentes:", {
        tipo: data.tipo,
        serviceLocationId: data.serviceLocationId,
        pendingSlotsLength: pendingSlots.length,
        pendingSlots
      });

      if (data.tipo === "entrega_rapida" && data.serviceLocationId && pendingSlots.length > 0) {
        console.log("Iniciando criação de faixas...");
        let slotsCreated = 0;
        for (const slot of pendingSlots) {
          try {
            console.log("Criando faixa:", slot);
            const response = await apiRequest("POST", "/api/admin/allocation-time-slots", {
              ...slot,
              serviceLocationId: data.serviceLocationId,
            });
            console.log("Faixa criada com sucesso:", response);
            slotsCreated++;
          } catch (error: any) {
            console.error("Erro ao criar faixa:", error);
            toast({ title: "Erro ao criar faixa", description: error.message || "Erro desconhecido", variant: "destructive" });
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/admin/allocation-time-slots"] });
        if (slotsCreated > 0) {
          toast({ title: "Sucesso!", description: `${slotsCreated} faixa(s) de alocação criada(s)` });
        }
        setPendingSlots([]);
      }

      setIsDialogOpen(false);
      setEditingPrice(null);
      form.reset();
    } catch (error: any) {
      console.error("Erro no onSubmit:", error);
      toast({ title: "Erro", description: error.message || "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleEdit = (preco: any) => {
    setEditingPrice(preco);
    setPendingSlots([]);
    setNewSlotName("");
    setNewSlotStart("");
    setNewSlotEnd("");
    setNewSlotPrice("");
    form.reset({
      tipo: preco.tipo || "entrega_rapida",
      rotaIntermunicipalId: preco.rotaIntermunicipalId || "",
      serviceLocationId: preco.serviceLocationId,
      vehicleTypeId: preco.vehicleTypeId,
      basePrice: preco.basePrice,
      pricePerDistance: preco.pricePerDistance,
      pricePerTime: preco.pricePerTime,
      baseDistance: preco.baseDistance,
      waitingChargePerMinute: preco.waitingChargePerMinute,
      freeWaitingTimeMins: preco.freeWaitingTimeMins.toString(),
      cancellationFee: preco.cancellationFee,
      stopPrice: preco.stopPrice || "0",
      returnPrice: preco.returnPrice || "0",
      dynamicPrice: preco.dynamicPrice || "0",
      dynamicPriceActive: preco.dynamicPriceActive ?? false,
      active: preco.active,
    });
    setIsDialogOpen(true);
  };

  const handleNewPrice = () => {
    setEditingPrice(null);
    setPendingSlots([]);
    setNewSlotName("");
    setNewSlotStart("");
    setNewSlotEnd("");
    setNewSlotPrice("");
    form.reset({
      tipo: "entrega_rapida",
      rotaIntermunicipalId: "",
      serviceLocationId: "",
      vehicleTypeId: "",
      basePrice: "",
      pricePerDistance: "",
      pricePerTime: "",
      baseDistance: "0",
      waitingChargePerMinute: "0",
      freeWaitingTimeMins: "5",
      cancellationFee: "0",
      stopPrice: "0",
      returnPrice: "0",
      dynamicPrice: "0",
      dynamicPriceActive: false,
      active: true,
    });
    setIsDialogOpen(true);
  };

  const handleAddPendingSlot = () => {
    if (!newSlotName || !newSlotStart || !newSlotEnd || !newSlotPrice) {
      toast({ title: "Erro", description: "Preencha todos os campos da faixa", variant: "destructive" });
      return;
    }
    setPendingSlots([...pendingSlots, {
      name: newSlotName,
      startTime: newSlotStart,
      endTime: newSlotEnd,
      basePrice: newSlotPrice,
      active: true,
    }]);
    setNewSlotName("");
    setNewSlotStart("");
    setNewSlotEnd("");
    setNewSlotPrice("");
  };

  const handleRemovePendingSlot = (index: number) => {
    setPendingSlots(pendingSlots.filter((_, i) => i !== index));
  };

  const handleDelete = (id: string, cityName?: string, vehicleName?: string) => {
    const nome = `${cityName || 'Cidade'} - ${vehicleName || 'Categoria'}`;
    if (confirm(`Tem certeza que deseja excluir a configuração de preço "${nome}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-10">
            <div className="text-center">Carregando preços...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Precificação
        </h1>
        <p className="text-muted-foreground">
          Configure preços de entrega por cidade e categoria
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tabela de Preços</CardTitle>
              <CardDescription>
                Configure os preços por cidade e categoria de veículo
              </CardDescription>
            </div>
            <Button onClick={handleNewPrice}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Preço
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Cidade/Rota</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tarifa Base</TableHead>
                <TableHead>Por KM</TableHead>
                <TableHead>Por Min</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {precos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    Nenhuma configuração de preço cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                precos.map((preco) => (
                  <TableRow key={preco.id}>
                    <TableCell>
                      <Badge variant={preco.tipo === "rota_intermunicipal" ? "outline" : "secondary"}>
                        {preco.tipo === "rota_intermunicipal" ? "Rota Intermunicipal" : "Entrega Rápida"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {preco.tipo === "rota_intermunicipal"
                        ? preco.rotaIntermunicipalNome || '-'
                        : preco.serviceLocationName || '-'}
                    </TableCell>
                    <TableCell>{preco.vehicleTypeName || '-'}</TableCell>
                    <TableCell>R$ {preco.basePrice}</TableCell>
                    <TableCell>R$ {preco.pricePerDistance}</TableCell>
                    <TableCell>R$ {preco.pricePerTime}</TableCell>
                    <TableCell>
                      <Badge variant={preco.active ? "default" : "secondary"}>
                        {preco.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleEdit(preco)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(preco.id, preco.serviceLocationName, preco.vehicleTypeName)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPrice ? "Editar Preço" : "Novo Preço"}</DialogTitle>
            <DialogDescription>
              {editingPrice
                ? "Atualize as configurações de preço"
                : "Configure os preços para uma cidade e categoria específica"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log("Erros de validação:", errors);
              toast({ title: "Erro de validação", description: "Preencha todos os campos obrigatórios", variant: "destructive" });
            })} className="space-y-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Preço</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="entrega_rapida">Entrega Rápida</SelectItem>
                        <SelectItem value="rota_intermunicipal">Rota Intermunicipal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Escolha se este preço é para entrega rápida na cidade ou para rota intermunicipal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {tipoValue === "rota_intermunicipal" && (
                <FormField
                  control={form.control}
                  name="rotaIntermunicipalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rota Intermunicipal</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a rota" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rotas.map((rota) => (
                            <SelectItem key={rota.id} value={rota.id}>
                              {rota.nomeRota}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className={tipoValue === "entrega_rapida" ? "grid grid-cols-2 gap-4" : ""}>
                {tipoValue === "entrega_rapida" && (
                  <FormField
                    control={form.control}
                    name="serviceLocationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a cidade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cities.map((city) => (
                              <SelectItem key={city.id} value={city.id}>
                                {city.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="vehicleTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Precificação</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="basePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarifa Base (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="5.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pricePerDistance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Por KM (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1.50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pricePerTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Por Minuto (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.30" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Configurações Adicionais</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="baseDistance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distância Base (km)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="0" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">Incluída na tarifa base</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="waitingChargePerMinute"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Espera/Min (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freeWaitingTimeMins"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Espera Grátis (min)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <FormField
                    control={form.control}
                    name="cancellationFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taxa Cancelamento (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stopPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parada Extra (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="returnPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retorno (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="font-medium">Preço Dinâmico (Surge)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dynamicPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Multiplicador</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="1.5" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">Ex: 1.5 = 50% mais caro</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dynamicPriceActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mt-2">
                        <div className="space-y-0.5">
                          <FormLabel>Ativar Surge</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Faixas de Alocação - apenas para Entrega Rápida com cidade selecionada */}
              {tipoValue === "entrega_rapida" && form.watch("serviceLocationId") && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Faixas de Alocação (opcional)
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure horários para alocação de entregadores exclusivos nesta cidade
                  </p>

                  {/* Faixas existentes salvas no banco */}
                  {(() => {
                    const selectedCityId = form.watch("serviceLocationId");
                    const existingSlots = allocationSlots.filter(
                      (slot) => slot.serviceLocationId === selectedCityId
                    );
                    console.log("Debug faixas:", {
                      selectedCityId,
                      allocationSlotsTotal: allocationSlots.length,
                      allocationSlots: allocationSlots.map(s => ({ id: s.id, name: s.name, serviceLocationId: s.serviceLocationId })),
                      existingSlotsFiltered: existingSlots.length
                    });
                    if (existingSlots.length === 0) return null;
                    return (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Faixas salvas:</p>
                        {existingSlots.map((slot) => (
                          <div key={slot.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                            <div className="flex items-center gap-3">
                              <Badge variant="default">{slot.name}</Badge>
                              <span className="text-sm">{slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}</span>
                              <span className="text-sm font-medium text-green-600">R$ {slot.basePrice}</span>
                              {!slot.active && <Badge variant="secondary">Inativo</Badge>}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Excluir esta faixa de alocação?")) {
                                  deleteSlotMutation.mutate(slot.id);
                                }
                              }}
                              disabled={deleteSlotMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Faixas pendentes (ainda não salvas) */}
                  {pendingSlots.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Novas faixas (serão salvas ao clicar Salvar):</p>
                      {pendingSlots.map((slot, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{slot.name}</Badge>
                            <span className="text-sm">{slot.startTime} - {slot.endTime}</span>
                            <span className="text-sm font-medium text-green-600">R$ {slot.basePrice}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePendingSlot(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-2 items-end">
                    <div>
                      <label className="text-xs text-muted-foreground">Nome</label>
                      <Input
                        placeholder="Almoço"
                        value={newSlotName}
                        onChange={(e) => setNewSlotName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Início</label>
                      <Input
                        type="time"
                        value={newSlotStart}
                        onChange={(e) => setNewSlotStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Fim</label>
                      <Input
                        type="time"
                        value={newSlotEnd}
                        onChange={(e) => setNewSlotEnd(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Preço (R$)</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="35.00"
                        value={newSlotPrice}
                        onChange={(e) => setNewSlotPrice(e.target.value)}
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={handleAddPendingSlot}>
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Status</FormLabel>
                      <FormDescription>Preço ativo para uso</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
