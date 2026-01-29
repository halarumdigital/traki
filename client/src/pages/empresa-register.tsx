import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Building2, Mail, Phone, MapPin, User, Tag, Wallet } from "lucide-react";
import { useLocation, Link } from "wouter";

const empresaRegisterSchema = z.object({
  // Dados da Empresa
  name: z.string().min(2, "Nome fantasia deve ter pelo menos 2 caracteres"),
  razaoSocial: z.string().min(2, "Razão social deve ter pelo menos 2 caracteres"),
  cnpj: z.string()
    .min(14, "CNPJ deve ter 14 dígitos")
    .regex(/^\d{14}$/, "CNPJ deve conter apenas números"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),

  // Endereço
  street: z.string().min(3, "Logradouro é obrigatório"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Bairro é obrigatório"),
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().length(2, "Estado deve ter 2 caracteres (ex: SP)"),
  cep: z.string()
    .min(8, "CEP deve ter 8 dígitos")
    .regex(/^\d{8}$/, "CEP deve conter apenas números"),
  reference: z.string().optional(),

  // Responsável
  responsibleName: z.string().min(2, "Nome do responsável é obrigatório"),
  responsibleWhatsapp: z.string().min(10, "WhatsApp do responsável é obrigatório"),
  responsibleEmail: z.string().email("Email do responsável inválido"),

  // Senha
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string(),

  // Dados PIX
  pixKeyType: z.enum(["EMAIL", "CPF", "CNPJ", "PHONE", "EVP"]).optional(),
  pixKey: z.string().optional(),

  // Indicação
  referralCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type EmpresaRegisterData = z.infer<typeof empresaRegisterSchema>;

interface RegisterResponse {
  message: string;
  company: {
    id: string;
    name: string;
    email: string;
  };
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

const formatCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
};

const formatCEP = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
};

const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

export default function EmpresaRegister() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cnpjDisplay, setCnpjDisplay] = useState("");
  const [cepDisplay, setCepDisplay] = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [whatsappDisplay, setWhatsappDisplay] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<EmpresaRegisterData>({
    resolver: zodResolver(empresaRegisterSchema),
    defaultValues: {
      name: "",
      razaoSocial: "",
      cnpj: "",
      email: "",
      phone: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      cep: "",
      reference: "",
      responsibleName: "",
      responsibleWhatsapp: "",
      responsibleEmail: "",
      password: "",
      confirmPassword: "",
      pixKeyType: undefined,
      pixKey: "",
      referralCode: "",
    },
  });

  const password = form.watch("password");
  const passwordStrength = calculatePasswordStrength(password || "");

  const registerMutation = useMutation<RegisterResponse, Error, EmpresaRegisterData>({
    mutationFn: async (data: EmpresaRegisterData) => {
      const { confirmPassword, ...registerData } = data;
      const res = await apiRequest("POST", "/api/empresa/auth/register", registerData);
      return await res.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Empresa cadastrada com sucesso!",
        description: `Bem-vindo, ${data.company.name}`,
      });
      setLocation("/empresa/dashboard");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar empresa",
        description: error.message || "Não foi possível cadastrar a empresa. Tente novamente.",
      });
    },
  });

  const onSubmit = (data: EmpresaRegisterData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-4xl shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
            <Building2 className="h-8 w-8" />
            Cadastro de Empresa
          </CardTitle>
          <CardDescription className="text-center text-base">
            Preencha os dados para criar sua conta empresarial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados da Empresa
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Fantasia *</Label>
                  <Input
                    id="name"
                    placeholder="Nome da sua empresa"
                    {...form.register("name")}
                    className={form.formState.errors.name ? "border-destructive" : ""}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="razaoSocial">Razão Social *</Label>
                  <Input
                    id="razaoSocial"
                    placeholder="Razão social completa"
                    {...form.register("razaoSocial")}
                    className={form.formState.errors.razaoSocial ? "border-destructive" : ""}
                  />
                  {form.formState.errors.razaoSocial && (
                    <p className="text-sm text-destructive">{form.formState.errors.razaoSocial.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpjDisplay}
                    onChange={(e) => {
                      const formatted = formatCNPJ(e.target.value);
                      setCnpjDisplay(formatted);
                      form.setValue("cnpj", formatted.replace(/\D/g, ""));
                    }}
                    maxLength={18}
                    className={form.formState.errors.cnpj ? "border-destructive" : ""}
                  />
                  {form.formState.errors.cnpj && (
                    <p className="text-sm text-destructive">{form.formState.errors.cnpj.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={phoneDisplay}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setPhoneDisplay(formatted);
                      form.setValue("phone", formatted.replace(/\D/g, ""));
                    }}
                    maxLength={15}
                    className={form.formState.errors.phone ? "border-destructive" : ""}
                  />
                  {form.formState.errors.phone && (
                    <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email da Empresa *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="empresa@exemplo.com"
                    className={`pl-9 ${form.formState.errors.email ? "border-destructive" : ""}`}
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="street">Logradouro *</Label>
                  <Input
                    id="street"
                    placeholder="Rua, Avenida, etc"
                    {...form.register("street")}
                    className={form.formState.errors.street ? "border-destructive" : ""}
                  />
                  {form.formState.errors.street && (
                    <p className="text-sm text-destructive">{form.formState.errors.street.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="number">Número *</Label>
                  <Input
                    id="number"
                    placeholder="123"
                    {...form.register("number")}
                    className={form.formState.errors.number ? "border-destructive" : ""}
                  />
                  {form.formState.errors.number && (
                    <p className="text-sm text-destructive">{form.formState.errors.number.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    placeholder="Apto, Sala, etc"
                    {...form.register("complement")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input
                    id="neighborhood"
                    placeholder="Nome do bairro"
                    {...form.register("neighborhood")}
                    className={form.formState.errors.neighborhood ? "border-destructive" : ""}
                  />
                  {form.formState.errors.neighborhood && (
                    <p className="text-sm text-destructive">{form.formState.errors.neighborhood.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade *</Label>
                  <Input
                    id="city"
                    placeholder="Nome da cidade"
                    {...form.register("city")}
                    className={form.formState.errors.city ? "border-destructive" : ""}
                  />
                  {form.formState.errors.city && (
                    <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">Estado (UF) *</Label>
                  <Input
                    id="state"
                    placeholder="SP"
                    maxLength={2}
                    {...form.register("state")}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      form.setValue("state", e.target.value);
                    }}
                    className={form.formState.errors.state ? "border-destructive" : ""}
                  />
                  {form.formState.errors.state && (
                    <p className="text-sm text-destructive">{form.formState.errors.state.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={cepDisplay}
                    onChange={(e) => {
                      const formatted = formatCEP(e.target.value);
                      setCepDisplay(formatted);
                      form.setValue("cep", formatted.replace(/\D/g, ""));
                    }}
                    maxLength={9}
                    className={form.formState.errors.cep ? "border-destructive" : ""}
                  />
                  {form.formState.errors.cep && (
                    <p className="text-sm text-destructive">{form.formState.errors.cep.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Ponto de Referência</Label>
                <Input
                  id="reference"
                  placeholder="Próximo ao supermercado..."
                  {...form.register("reference")}
                />
              </div>
            </div>

            {/* Responsável */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Responsável
              </h3>

              <div className="space-y-2">
                <Label htmlFor="responsibleName">Nome Completo *</Label>
                <Input
                  id="responsibleName"
                  placeholder="Nome do responsável"
                  {...form.register("responsibleName")}
                  className={form.formState.errors.responsibleName ? "border-destructive" : ""}
                />
                {form.formState.errors.responsibleName && (
                  <p className="text-sm text-destructive">{form.formState.errors.responsibleName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsibleWhatsapp">WhatsApp *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="responsibleWhatsapp"
                      placeholder="(00) 00000-0000"
                      value={whatsappDisplay}
                      onChange={(e) => {
                        const formatted = formatPhone(e.target.value);
                        setWhatsappDisplay(formatted);
                        form.setValue("responsibleWhatsapp", formatted.replace(/\D/g, ""));
                      }}
                      maxLength={15}
                      className={`pl-9 ${form.formState.errors.responsibleWhatsapp ? "border-destructive" : ""}`}
                    />
                  </div>
                  {form.formState.errors.responsibleWhatsapp && (
                    <p className="text-sm text-destructive">{form.formState.errors.responsibleWhatsapp.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsibleEmail">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="responsibleEmail"
                      type="email"
                      placeholder="responsavel@exemplo.com"
                      className={`pl-9 ${form.formState.errors.responsibleEmail ? "border-destructive" : ""}`}
                      {...form.register("responsibleEmail")}
                    />
                  </div>
                  {form.formState.errors.responsibleEmail && (
                    <p className="text-sm text-destructive">{form.formState.errors.responsibleEmail.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Senha de Acesso</h3>

              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    className={form.formState.errors.password ? "border-destructive" : ""}
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Força da senha:</span>
                      <span className={`font-medium ${passwordStrength < 40 ? 'text-destructive' : passwordStrength < 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {getPasswordStrengthLabel(passwordStrength)}
                      </span>
                    </div>
                    <Progress
                      value={passwordStrength}
                      className="h-2"
                      indicatorClassName={getPasswordStrengthColor(passwordStrength)}
                    />
                  </div>
                )}
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Digite sua senha novamente"
                    className={form.formState.errors.confirmPassword ? "border-destructive" : ""}
                    {...form.register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Dados PIX */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Dados PIX para Pagamentos
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure uma chave PIX para receber pagamentos e gerenciar o saldo da empresa
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pixKeyType">Tipo de Chave PIX</Label>
                  <select
                    id="pixKeyType"
                    {...form.register("pixKeyType")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Selecione o tipo (opcional)</option>
                    <option value="EMAIL">Email</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="PHONE">Telefone</option>
                    <option value="EVP">Chave Aleatória</option>
                  </select>
                  {form.formState.errors.pixKeyType && (
                    <p className="text-sm text-destructive">{form.formState.errors.pixKeyType.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pixKey">Chave PIX</Label>
                  <Input
                    id="pixKey"
                    placeholder="Digite sua chave PIX"
                    {...form.register("pixKey")}
                  />
                  {form.formState.errors.pixKey && (
                    <p className="text-sm text-destructive">{form.formState.errors.pixKey.message}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 A chave PIX será usada para receber pagamentos das entregas e recargas de saldo via PIX
              </p>
            </div>

            {/* Código de Indicação */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Código de Indicação (Opcional)
              </h3>
              <div className="space-y-2">
                <Label htmlFor="referralCode">Código de Indicação</Label>
                <Input
                  id="referralCode"
                  placeholder="Digite o código de indicação do motorista"
                  {...form.register("referralCode")}
                  className="uppercase"
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Possui um código de indicação? Insira aqui para ganhar benefícios!
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                "Cadastrar Empresa"
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Já possui uma conta?{" "}
              <Link href="/empresa/login" className="text-primary hover:underline font-medium">
                Fazer login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
