import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginCredentials } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, Truck, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation, Link } from "wouter";

interface CompanyLoginResponse {
  message: string;
  company: {
    id: string;
    name: string;
    email: string;
  };
}

export default function EmpresaLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const savedEmail = typeof window !== "undefined" ? localStorage.getItem("savedCompanyEmail") : null;
  const shouldRemember = typeof window !== "undefined" ? localStorage.getItem("rememberCompany") === "true" : false;

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: savedEmail || "",
      password: "",
    },
  });

  useEffect(() => {
    setRememberMe(shouldRemember);
  }, [shouldRemember]);

  const loginMutation = useMutation<CompanyLoginResponse, Error, LoginCredentials>({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await apiRequest("POST", "/api/empresa/auth/login", credentials);
      return await res.json();
    },
    onSuccess: async (data) => {
      if (rememberMe) {
        localStorage.setItem("rememberCompany", "true");
        localStorage.setItem("savedCompanyEmail", data.company.email);
      } else {
        localStorage.removeItem("rememberCompany");
        localStorage.removeItem("savedCompanyEmail");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/empresa/auth/me"] });
      toast({
        title: "Login bem-sucedido!",
        description: `Bem-vindo de volta, ${data.company.name}`,
      });
      setLocation("/empresa/dashboard");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description: error.message || "Credenciais inválidas. Tente novamente.",
      });
    },
  });

  const onSubmit = (data: LoginCredentials) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-slate-50">
      {/* Left Column - Hero/Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 flex-col justify-between p-12 text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1616432043562-3671ea2e5242?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 to-slate-900/90"></div>

          {/* Decorative Elements */}
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "2s" }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 font-bold text-2xl tracking-tight mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <span>Fretus</span>
          </div>
          <p className="text-slate-400 text-sm pl-1">Sistema Integrado de Logística</p>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">Gerencie suas entregas com eficiência e precisão.</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-slate-300">Rastreamento em tempo real de todas as entregas e motoristas.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-slate-300">Gestão financeira completa com emissão de boletos e notas.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-slate-300">Otimização de rotas intermunicipais e locais.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-500">
          &copy; 2025 Fretus Logística. v2.5.0
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bem-vindo de volta</h1>
            <p className="text-slate-500">Entre com suas credenciais para acessar o painel.</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="empresa@email.com"
                  className="pl-9 bg-white border-slate-200 focus-visible:ring-blue-600 transition-all"
                  {...form.register("email")}
                  disabled={loginMutation.isPending}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-sm font-medium text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <a href="#" className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Esqueceu a senha?
                </a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  className="pl-9 pr-10 bg-white border-slate-200 focus-visible:ring-blue-600 transition-all"
                  {...form.register("password")}
                  disabled={loginMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={loginMutation.isPending}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm font-medium text-red-500">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                disabled={loginMutation.isPending}
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal cursor-pointer text-slate-600"
              >
                Lembrar-me
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base shadow-sm hover:shadow-md transition-all duration-200"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Entrar no Sistema
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
