import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users as UsersIcon, Mail, Calendar, Shield, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  nome: string;
  isAdmin: boolean;
  createdAt: string;
}

interface CreateUserForm {
  nome: string;
  email: string;
  password: string;
  isAdmin: string;
}

export default function Usuarios() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<CreateUserForm>({
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      isAdmin: "false",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          isAdmin: data.isAdmin === "true",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar usuário");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuário criado com sucesso!",
        description: "O novo usuário foi adicionado ao sistema.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4 animate-pulse">
            <UsersIcon className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os usuários do sistema
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar um novo usuário no sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    placeholder="Digite o nome completo"
                    {...form.register("nome", { required: true })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    {...form.register("email", { required: true })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    {...form.register("password", { required: true, minLength: 6 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Permissão</Label>
                  <RadioGroup
                    defaultValue="false"
                    onValueChange={(value) => form.setValue("isAdmin", value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="readonly" />
                      <Label htmlFor="readonly" className="font-normal cursor-pointer">
                        Somente Leitura
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="admin" />
                      <Label htmlFor="admin" className="font-normal cursor-pointer">
                        Administrador (pode tudo)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users?.map((user) => (
          <Card key={user.id} className="hover-elevate" data-testid={`card-user-${user.id}`}>
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(user.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{user.nome}</CardTitle>
                  {user.isAdmin ? (
                    <Badge variant="default" className="mt-1">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="mt-1">
                      Somente Leitura
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="truncate" data-testid={`text-email-${user.id}`}>
                  {user.email}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span data-testid={`text-created-${user.id}`}>
                  Criado em {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {users && users.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UsersIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum usuário encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
