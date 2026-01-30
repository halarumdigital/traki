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
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Edit, Trash2, Clock, MapPin } from "lucide-react";

const timeSlotSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  startTime: z.string().min(1, "Horário de início é obrigatório"),
  endTime: z.string().min(1, "Horário de fim é obrigatório"),
  basePrice: z.string().min(1, "Preço é obrigatório"),
  serviceLocationId: z.string().optional(),
  active: z.boolean().default(true),
});

type TimeSlotForm = z.infer<typeof timeSlotSchema>;

type AllocationTimeSlot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  basePrice: string;
  serviceLocationId: string | null;
  cityName?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ServiceLocation = {
  id: string;
  name: string;
  state: string;
  active: boolean;
};

export default function AdminAllocationSlots() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AllocationTimeSlot | null>(null);

  // Buscar faixas de horário
  const { data: timeSlots = [], isLoading } = useQuery<AllocationTimeSlot[]>({
    queryKey: ["/api/admin/allocation-time-slots"],
  });

  // Buscar cidades
  const { data: cities = [] } = useQuery<ServiceLocation[]>({
    queryKey: ["/api/service-locations"],
  });

  // Mutation para criar faixa
  const createMutation = useMutation({
    mutationFn: async (data: TimeSlotForm) => {
      return await apiRequest("POST", "/api/admin/allocation-time-slots", {
        ...data,
        serviceLocationId: data.serviceLocationId === "all" ? null : data.serviceLocationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allocation-time-slots"] });
      toast({ title: "Sucesso!", description: "Faixa de horário criada com sucesso" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para atualizar faixa
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TimeSlotForm> }) => {
      return await apiRequest("PUT", `/api/admin/allocation-time-slots/${id}`, {
        ...data,
        serviceLocationId: data.serviceLocationId === "all" ? null : data.serviceLocationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allocation-time-slots"] });
      toast({ title: "Sucesso!", description: "Faixa de horário atualizada com sucesso" });
      setIsDialogOpen(false);
      setEditingSlot(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para excluir faixa
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/allocation-time-slots/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allocation-time-slots"] });
      toast({ title: "Sucesso!", description: "Faixa de horário excluída com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para toggle status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return await apiRequest("PUT", `/api/admin/allocation-time-slots/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allocation-time-slots"] });
      toast({ title: "Sucesso!", description: "Status atualizado" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<TimeSlotForm>({
    resolver: zodResolver(timeSlotSchema),
    defaultValues: {
      name: "",
      startTime: "",
      endTime: "",
      basePrice: "",
      serviceLocationId: "all",
      active: true,
    },
  });

  const openCreateDialog = () => {
    setEditingSlot(null);
    form.reset({
      name: "",
      startTime: "",
      endTime: "",
      basePrice: "",
      serviceLocationId: "all",
      active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (slot: AllocationTimeSlot) => {
    setEditingSlot(slot);
    form.reset({
      name: slot.name,
      startTime: slot.startTime.slice(0, 5), // HH:MM
      endTime: slot.endTime.slice(0, 5), // HH:MM
      basePrice: slot.basePrice,
      serviceLocationId: slot.serviceLocationId || "all",
      active: slot.active,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: TimeSlotForm) => {
    if (editingSlot) {
      updateMutation.mutate({ id: editingSlot.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta faixa de horário?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5); // HH:MM
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(value));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faixas de Horário para Alocação</h1>
          <p className="text-muted-foreground">
            Configure as faixas de horário disponíveis para alocação de entregadores
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Faixa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faixas Cadastradas</CardTitle>
          <CardDescription>
            Defina os períodos de pico onde as empresas podem alocar entregadores exclusivos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : timeSlots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma faixa de horário cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeSlots.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {slot.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(slot.basePrice)}
                    </TableCell>
                    <TableCell>
                      {slot.cityName ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {slot.cityName}
                        </div>
                      ) : (
                        <Badge variant="secondary">Todas</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={slot.active}
                        onCheckedChange={(checked) =>
                          toggleStatusMutation.mutate({ id: slot.id, active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(slot)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(slot.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Criar/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? "Editar Faixa de Horário" : "Nova Faixa de Horário"}
            </DialogTitle>
            <DialogDescription>
              Configure uma faixa de horário para alocação de entregadores
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Almoço, Noite" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora Início</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora Fim</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="basePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço da Alocação (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceLocationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma cidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">Todas as cidades</SelectItem>
                        {cities
                          .filter((c) => c.active)
                          .map((city) => (
                            <SelectItem key={city.id} value={city.id}>
                              {city.name} - {city.state}
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
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Ativo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Faixa disponível para alocação
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Salvando..."
                    : editingSlot
                    ? "Salvar"
                    : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
