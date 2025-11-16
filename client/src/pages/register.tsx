import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, Loader2, User as UserIcon, Check, X } from "lucide-react";
import { useLocation, Link } from "wouter";

const registerSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type RegisterCredentials = z.infer<typeof registerSchema>;

interface RegisterResponse {
  id: string;
  email: string;
  nome: string;
  isAdmin: boolean;
}

const calculatePasswordStrength = (password: string): number => {
  let strength = 0;
  
  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 10;
  if (/[a-z]/.test(password)) strength += 20;
  if (/[A-Z]/.test(password)) strength += 20;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 15;
  
  return Math.min(strength, 100);
};

const getPasswordStrengthColor = (strength: number): string => {
  if (strength < 40) return "bg-destructive";
  if (strength < 70) return "bg-yellow-500";
  return "bg-green-500";
};

const getPasswordStrengthLabel = (strength: number): string => {
  if (strength < 40) return "Fraca";
  if (strength < 70) return "Média";
  return "Forte";
};

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<RegisterCredentials>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");
  const passwordStrength = calculatePasswordStrength(password || "");

  const registerMutation = useMutation<RegisterResponse, Error, RegisterCredentials>({
    mutationFn: async (credentials: RegisterCredentials) => {
      const { confirmPassword, ...data } = credentials;
      const res = await apiRequest("POST", "/api/auth/register", data);
      return await res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Conta criada com sucesso!",
        description: `Bem-vindo, ${data.nome}`,
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error.message || "Não foi possível criar a conta. Tente novamente.",
      });
    },
  });

  const onSubmit = (data: RegisterCredentials) => {
    registerMutation.mutate(data);
  };

  const passwordRequirements = [
    { label: "Pelo menos 8 caracteres", met: (password?.length || 0) >= 8 },
    { label: "Letra maiúscula", met: /[A-Z]/.test(password || "") },
    { label: "Letra minúscula", met: /[a-z]/.test(password || "") },
    { label: "Número", met: /[0-9]/.test(password || "") },
    { label: "Caractere especial", met: /[^a-zA-Z0-9]/.test(password || "") },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary mb-4">
            <UserIcon className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Preencha os dados para começar
          </p>
        </div>

        <Card className="shadow-lg border-card-border">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl font-semibold">Cadastro</CardTitle>
            <CardDescription>
              Crie sua conta de forma rápida e segura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-sm font-medium">
                    Nome completo
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome completo"
                      className="pl-10 h-12 text-base border-2 transition-all duration-200"
                      data-testid="input-name"
                      {...form.register("nome")}
                      disabled={registerMutation.isPending}
                    />
                  </div>
                  {form.formState.errors.nome && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      {form.formState.errors.nome.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Mail className="w-5 h-5" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10 h-12 text-base border-2 transition-all duration-200"
                      data-testid="input-email"
                      {...form.register("email")}
                      disabled={registerMutation.isPending}
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Senha
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Lock className="w-5 h-5" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Crie uma senha forte"
                      className="pl-10 pr-12 h-12 text-base border-2 transition-all duration-200"
                      data-testid="input-password"
                      {...form.register("password")}
                      disabled={registerMutation.isPending}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover-elevate active-elevate-2 p-2 rounded-md transition-colors"
                      data-testid="button-toggle-password"
                      disabled={registerMutation.isPending}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                  
                  {password && password.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Força da senha:</span>
                        <span className={`font-medium ${passwordStrength >= 70 ? 'text-green-600' : passwordStrength >= 40 ? 'text-yellow-600' : 'text-destructive'}`}>
                          {getPasswordStrengthLabel(passwordStrength)}
                        </span>
                      </div>
                      <Progress 
                        value={passwordStrength} 
                        className="h-2"
                        data-testid="progress-password-strength"
                      />
                      
                      <div className="mt-3 space-y-1">
                        {passwordRequirements.map((req, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            {req.met ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className={req.met ? "text-foreground" : "text-muted-foreground"}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Lock className="w-5 h-5" />
                    </div>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Digite a senha novamente"
                      className="pl-10 pr-12 h-12 text-base border-2 transition-all duration-200"
                      data-testid="input-confirm-password"
                      {...form.register("confirmPassword")}
                      disabled={registerMutation.isPending}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover-elevate active-elevate-2 p-2 rounded-md transition-colors"
                      data-testid="button-toggle-confirm-password"
                      disabled={registerMutation.isPending}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold transition-all duration-150"
                disabled={registerMutation.isPending}
                data-testid="button-submit"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Criar conta"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-center text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <Link href="/">
                  <span className="text-primary font-medium hover:underline underline-offset-4 transition-all cursor-pointer" data-testid="link-login">
                    Entrar
                  </span>
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
