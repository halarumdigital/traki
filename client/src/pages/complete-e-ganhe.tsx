import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, Plus, Gift, Calendar as CalendarIcon, Award, Trophy } from "lucide-react";
import { insertPromotionSchema, type Promotion } from "@shared/schema";

const formSchema = insertPromotionSchema.extend({
  validDatesArray: z.array(z.date()).min(1, "Selecione pelo menos uma data"),
}).omit({ validDates: true });

type FormData = z.infer<typeof formSchema>;

const promotionTypes = [
  { value: "complete_and_win", label: "Complete e Ganhe", description: "Meta de entregas para ganhar prêmio" },
  { value: "top_performer", label: "Quem fizer mais", description: "Motorista com mais entregas ganha" },
];

export default function CompleteEGanhePage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  const { data: promotions, isLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "complete_and_win",
      name: "",
      validDatesArray: [],
      rule: "",
      deliveryQuantity: 1,
      prize: "",
      active: true,
    },
  });

  const selectedType = form.watch("type");

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        ...data,
        validDates: data.validDatesArray
          .map(date => format(date, "yyyy-MM-dd"))
          .sort()
          .join(","),
      };
      delete payload.validDatesArray;

      // Limpar campos desnecessários baseado no tipo
      if (payload.type === "top_performer") {
        delete payload.deliveryQuantity;
      }

      return await apiRequest("POST", "/api/promotions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({
        title: "Promoção criada",
        description: "A promoção foi criada com sucesso.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar promoção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const payload: any = {
        ...data,
        validDates: data.validDatesArray
          .map(date => format(date, "yyyy-MM-dd"))
          .sort()
          .join(","),
      };
      delete payload.validDatesArray;

      // Limpar campos desnecessários baseado no tipo
      if (payload.type === "top_performer") {
        delete payload.deliveryQuantity;
      }

      return await apiRequest("PUT", `/api/promotions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({
        title: "Promoção atualizada",
        description: "A promoção foi atualizada com sucesso.",
      });
      setIsDialogOpen(false);
      setEditingPromotion(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar promoção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/promotions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({
        title: "Promoção excluída",
        description: "A promoção foi excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir promoção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (editingPromotion) {
      updateMutation.mutate({ id: editingPromotion.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    const dates = promotion.validDates.split(",").map(dateStr => new Date(dateStr));
    form.reset({
      type: promotion.type || "complete_and_win",
      name: promotion.name,
      validDatesArray: dates,
      rule: promotion.rule,
      deliveryQuantity: promotion.deliveryQuantity || undefined,
      prize: promotion.prize || "",
      active: promotion.active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta promoção?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingPromotion(null);
    form.reset({
      type: "complete_and_win",
      name: "",
      validDatesArray: [],
      rule: "",
      deliveryQuantity: 1,
      prize: "",
      active: true,
    });
  };

  const formatDates = (dates: string) => {
    const dateArray = dates.split(",").sort();
    if (dateArray.length <= 3) {
      return dateArray
        .map(dateStr => format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR }))
        .join(", ");
    }
    return `${dateArray.length} datas selecionadas`;
  };

  const selectedDates = form.watch("validDatesArray");

  const getPromotionTypeLabel = (type: string) => {
    const typeObj = promotionTypes.find(t => t.value === type);
    return typeObj?.label || type;
  };

  const getPromotionIcon = (type: string) => {
    return type === "top_performer" ? Trophy : Gift;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Gift className="h-6 w-6 text-white" />
            </div>
            Promoções
          </h1>
          <p className="text-muted-foreground mt-2">
            Crie promoções especiais para incentivar seus motoristas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2" onClick={() => handleDialogClose()}>
              <Plus className="h-4 w-4" />
              Nova Promoção
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Award className="h-6 w-6 text-purple-500" />
                {editingPromotion ? "Editar Promoção" : "Nova Promoção"}
              </DialogTitle>
            </DialogHeader>
            <Separator className="my-4" />
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Tipo de Promoção</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {promotionTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{type.label}</span>
                                <span className="text-xs text-muted-foreground">{type.description}</span>
                              </div>
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Nome da Promoção</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Bônus de Fim de Semana"
                          className="h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedType === "complete_and_win" ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="deliveryQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Meta de Entregas</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="Ex: 10"
                              className="h-11"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormDescription>Quantidade de entregas para ganhar</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="prize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Prêmio</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: R$ 100,00"
                              className="h-11"
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormDescription>Prêmio ao completar a meta</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="prize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Prêmio</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: R$ 100,00"
                            className="h-11"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormDescription>O que o vencedor vai ganhar</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="validDatesArray"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-base flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Validade da Promoção
                      </FormLabel>
                      <FormDescription>
                        Selecione as datas em que a promoção estará válida
                      </FormDescription>
                      <div className="flex flex-col md:flex-row gap-4">
                        <FormControl>
                          <Calendar
                            mode="multiple"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={ptBR}
                            className="rounded-lg border shadow-sm"
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          />
                        </FormControl>
                        {selectedDates && selectedDates.length > 0 && (
                          <div className="flex-1 space-y-3">
                            <div className="rounded-lg border p-4 bg-muted/50">
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                Datas Selecionadas ({selectedDates.length})
                              </h4>
                              <div className="max-h-[250px] overflow-y-auto space-y-2">
                                {selectedDates
                                  .sort((a, b) => a.getTime() - b.getTime())
                                  .map((date, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center gap-2 p-2 rounded-md bg-background border"
                                    >
                                      <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-sm">
                                        {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Regra da Promoção</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={
                            selectedType === "complete_and_win"
                              ? "Descreva a regra. Ex: Complete 10 entregas em um dia e ganhe R$ 50,00 de bônus"
                              : "Descreva a regra. Ex: O motorista que fizer mais entregas nos dias selecionados ganha R$ 100,00"
                          }
                          className="min-h-[120px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Explique como os motoristas podem ganhar essa promoção
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-medium cursor-pointer">
                          Promoção Ativa
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handleDialogClose}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="gap-2"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      "Salvando..."
                    ) : (
                      <>
                        <Award className="h-4 w-4" />
                        {editingPromotion ? "Atualizar" : "Criar"} Promoção
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promoções Cadastradas</CardTitle>
          <CardDescription>
            Gerencie todas as promoções de entregas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Gift className="h-12 w-12 mb-4 animate-pulse" />
              <p>Carregando promoções...</p>
            </div>
          ) : !promotions || promotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Gift className="h-12 w-12" />
              </div>
              <p className="text-lg font-medium">Nenhuma promoção cadastrada</p>
              <p className="text-sm">Crie sua primeira promoção para começar</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Promoção</TableHead>
                    <TableHead className="font-semibold">Datas Válidas</TableHead>
                    <TableHead className="font-semibold">Detalhes</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((promotion) => {
                    const Icon = getPromotionIcon(promotion.type || "complete_and_win");
                    return (
                      <TableRow key={promotion.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Icon className="h-3 w-3" />
                            {getPromotionTypeLabel(promotion.type || "complete_and_win")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              promotion.type === "top_performer"
                                ? "bg-gradient-to-br from-yellow-100 to-orange-100"
                                : "bg-gradient-to-br from-purple-100 to-pink-100"
                            }`}>
                              <Icon className={`h-4 w-4 ${
                                promotion.type === "top_performer" ? "text-orange-600" : "text-purple-600"
                              }`} />
                            </div>
                            <div>
                              <div className="font-medium">{promotion.name}</div>
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {promotion.rule}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatDates(promotion.validDates)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {promotion.type === "top_performer" ? (
                            <div className="text-sm">
                              <span className="font-medium">Prêmio:</span> {promotion.prize || "N/A"}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="outline" className="gap-1">
                                <Award className="h-3 w-3" />
                                {promotion.deliveryQuantity} entregas
                              </Badge>
                              {promotion.prize && (
                                <div className="text-sm text-muted-foreground">
                                  Prêmio: {promotion.prize}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {promotion.active ? (
                            <Badge className="bg-green-500 hover:bg-green-600">
                              Ativa
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Inativa
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(promotion)}
                              className="hover:bg-primary/10 hover:text-primary"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(promotion.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
