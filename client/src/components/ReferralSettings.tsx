import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Users, DollarSign } from "lucide-react";

// Schema para configurações de indicação
const referralSettingsSchema = z.object({
  minimumDeliveries: z.number().int().min(1, "Mínimo de entregas deve ser maior que 0"),
  commissionAmount: z.number().min(0, "Valor da comissão deve ser maior ou igual a 0"),
  enabled: z.boolean(),
});

type ReferralSettingsForm = z.infer<typeof referralSettingsSchema>;

export function ReferralSettings() {
  const { toast } = useToast();

  // Buscar configurações de indicação
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/referral-settings"],
  });

  const form = useForm<ReferralSettingsForm>({
    resolver: zodResolver(referralSettingsSchema),
    defaultValues: {
      minimumDeliveries: 10,
      commissionAmount: 50.00,
      enabled: true,
    },
  });

  // Atualizar formulário quando os dados chegarem
  useEffect(() => {
    if (settings) {
      form.reset({
        minimumDeliveries: settings.minimumDeliveries,
        commissionAmount: typeof settings.commissionAmount === 'string'
          ? parseFloat(settings.commissionAmount)
          : settings.commissionAmount,
        enabled: settings.enabled,
      });
    }
  }, [settings, form]);

  // Mutation para salvar configurações
  const saveMutation = useMutation({
    mutationFn: async (data: ReferralSettingsForm) => {
      return await apiRequest("PUT", "/api/referral-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-settings"] });
      toast({
        title: "Sucesso!",
        description: "Configurações de indicação salvas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configurações de indicação",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReferralSettingsForm) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="text-center">Carregando configurações de indicação...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Sistema de Indicação</CardTitle>
          </div>
          <CardDescription>
            Configure as regras e valores para o sistema de indicação de entregadores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ativar Sistema de Indicação</FormLabel>
                      <FormDescription>
                        Permite que entregadores ganhem comissão ao indicar novos entregadores
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("enabled") && (
                <>
                  <FormField
                    control={form.control}
                    name="minimumDeliveries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mínimo de Corridas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="10"
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Número mínimo de entregas que o indicado precisa completar para o indicador ganhar a comissão
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="commissionAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Comissão (R$)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="50.00"
                              className="pl-10"
                              value={field.value}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Valor que o indicador receberá quando o indicado atingir o mínimo de corridas
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Card informativo sobre o funcionamento */}
      {form.watch("enabled") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Como funciona o sistema de indicação?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="font-semibold text-primary">1.</span>
                <p>Cada entregador cadastrado recebe um código único de indicação (nome + 2 dígitos)</p>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-primary">2.</span>
                <p>O entregador compartilha seu código com amigos interessados em trabalhar como entregadores</p>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-primary">3.</span>
                <p>No cadastro, o novo entregador insere o código de quem o indicou</p>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-primary">4.</span>
                <p>Quando o indicado completar {form.watch("minimumDeliveries")} entregas, quem indicou ganha R$ {form.watch("commissionAmount").toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-primary">5.</span>
                <p>O sistema registra automaticamente quando a meta é atingida e libera a comissão para pagamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}