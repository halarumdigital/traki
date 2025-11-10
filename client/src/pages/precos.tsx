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
import { PlusCircle, Edit, DollarSign, Trash2 } from "lucide-react";

type CityPrice = {
  id: string;
  serviceLocationId: string;
  serviceLocationName?: string;
  vehicleTypeId: string;
  vehicleTypeName?: string;
  basePrice: string;
  pricePerDistance: string;
  pricePerTime: string;
  active: boolean;
};

type ServiceLocation = {
  id: string;
  name: string;
};

type VehicleType = {
  id: string;
  name: string;
};

const priceSchema = z.object({
  serviceLocationId: z.string().min(1, "Cidade é obrigatória"),
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
  active: z.boolean().default(true),
});

type PriceForm = z.infer<typeof priceSchema>;

export default function Precos() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<CityPrice | null>(null);

  // Buscar preços da API
  const { data: precos = [], isLoading } = useQuery<CityPrice[]>({
    queryKey: ["/api/city-prices"],
  });

  // Buscar cidades
  const { data: cities = [] } = useQuery<ServiceLocation[]>({
    queryKey: ["/api/cities"],
  });

  // Buscar categorias
  const { data: categories = [] } = useQuery<VehicleType[]>({
    queryKey: ["/api/vehicle-types"],
  });

  // Mutation para criar preço
  const createMutation = useMutation({
    mutationFn: async (data: PriceForm) => {
      return await apiRequest("POST", "/api/city-prices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-prices"] });
      toast({ title: "Sucesso!", description: "Preço criado com sucesso" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para atualizar preço
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PriceForm }) => {
      return await apiRequest("PUT", `/api/city-prices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-prices"] });
      toast({ title: "Sucesso!", description: "Preço atualizado com sucesso" });
      setIsDialogOpen(false);
      setEditingPrice(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para excluir preço
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
      active: true,
    },
  });

  const onSubmit = (data: PriceForm) => {
    if (editingPrice) {
      updateMutation.mutate({ id: editingPrice.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (preco: any) => {
    setEditingPrice(preco);
    form.reset({
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
      active: preco.active,
    });
    setIsDialogOpen(true);
  };

  const handleNewPrice = () => {
    setEditingPrice(null);
    form.reset({
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
      active: true,
    });
    setIsDialogOpen(true);
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
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                Tabela de Preços
              </CardTitle>
              <CardDescription>
                Configure os preços por cidade e categoria de veículo
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Button onClick={handleNewPrice}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Preço
              </Button>
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
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Seleção de Cidade e Categoria */}
                    <div className="grid grid-cols-2 gap-4">
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

                    {/* Preços Principais */}
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
                              <FormLabel>Preço por KM (R$)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="2.00" {...field} />
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
                              <FormLabel>Preço por Min (R$)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.50" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Configurações Adicionais */}
                    <div className="space-y-2">
                      <h3 className="font-medium">Configurações Adicionais</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="baseDistance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Distância Base (km)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" {...field} />
                              </FormControl>
                              <FormDescription>Distância incluída na tarifa base</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="cancellationFee"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Taxa de Cancelamento (%)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="waitingChargePerMinute"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cobrança por Min de Espera (R$)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
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
                              <FormLabel>Tempo de Espera Grátis (min)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
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
                              <FormLabel>Valor Parada (R$)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
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
                              <FormLabel>Valor Volta (R$)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Status Ativo */}
                    <FormField
                      control={form.control}
                      name="active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Ativo</FormLabel>
                            <FormDescription>
                              Desative para pausar temporariamente este preço
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingPrice
                          ? (updateMutation.isPending ? "Atualizando..." : "Atualizar Preço")
                          : (createMutation.isPending ? "Criando..." : "Criar Preço")}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cidade</TableHead>
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
                  <TableCell colSpan={7} className="text-center py-10">
                    Nenhuma configuração de preço cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                precos.map((preco) => (
                  <TableRow key={preco.id}>
                    <TableCell className="font-medium">{preco.serviceLocationName || '-'}</TableCell>
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
    </div>
  );
}
