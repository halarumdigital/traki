import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, Loader2, User as UserIcon, Check, X, Phone, Building2, Tag, MapPin } from "lucide-react";
import { useLocation, Link } from "wouter";

const registerSchema = z.object({
  name: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos").optional().or(z.literal("")),
  cnpj: z.string()
    .regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos")
    .optional()
    .or(z.literal("")),
  responsibleName: z.string().optional().or(z.literal("")),
  responsibleWhatsapp: z.string().optional().or(z.literal("")),
  responsibleEmail: z.string().email("Email do responsável inválido").optional().or(z.literal("")),
  street: z.string().optional().or(z.literal("")),
  number: z.string().optional().or(z.literal("")),
  complement: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  cep: z.string().optional().or(z.literal("")),
  city: z.string().min(1, "Selecione uma cidade"),
  state: z.string().optional().or(z.literal("")),
  referralCode: z.string().optional().or(z.literal("")),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type RegisterCredentials = z.infer<typeof registerSchema>;

interface RegisterResponse {
  message: string;
  company: {
    id: string;
    name: string;
    email: string;
  };
}

interface City {
  id: string;
  name: string;
  state: string;
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

const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cnpjDisplay, setCnpjDisplay] = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [whatsappDisplay, setWhatsappDisplay] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<RegisterCredentials>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      cnpj: "",
      responsibleName: "",
      responsibleWhatsapp: "",
      responsibleEmail: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      cep: "",
      city: "",
      state: "",
      referralCode: "",
      password: "",
      confirmPassword: "",
    },
  });

  const [cnpjLoading, setCnpjLoading] = useState(false);

  // Buscar cidades disponíveis
  const { data: citiesData } = useQuery<{ success: boolean; data: City[] }>({
    queryKey: ["/api/public/cities"],
    queryFn: async () => {
      const res = await fetch("/api/public/cities");
      if (!res.ok) throw new Error("Erro ao buscar cidades");
      return res.json();
    },
  });

  const cities = citiesData?.data || [];

  // Atualizar estado automaticamente quando cidade é selecionada
  const selectedCity = form.watch("city");
  useEffect(() => {
    if (selectedCity) {
      const city = cities.find((c) => c.name === selectedCity);
      if (city) {
        form.setValue("state", city.state);
      }
    }
  }, [selectedCity, cities, form]);

  const lookupCnpj = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;

    setCnpjLoading(true);
    try {
      const res = await fetch(`/api/cnpj-lookup?cnpj=${cleanCnpj}`);
      if (!res.ok) throw new Error("Erro ao consultar CNPJ");
      const data = await res.json();

      if (data.nomeFantasia) form.setValue("name", data.nomeFantasia);
      if (data.logradouro) form.setValue("street", data.logradouro);
      if (data.numero) form.setValue("number", data.numero);
      if (data.complemento) form.setValue("complement", data.complemento);
      if (data.cep) form.setValue("cep", data.cep);
      if (data.bairro) form.setValue("neighborhood", data.bairro);
      // Cidade e estado são selecionados manualmente

      toast({
        title: "CNPJ encontrado!",
        description: "Os dados da empresa foram preenchidos automaticamente.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao consultar CNPJ",
        description: "Não foi possível recuperar os dados. Preencha manualmente.",
      });
    } finally {
      setCnpjLoading(false);
    }
  };

  const password = form.watch("password");
  const passwordStrength = calculatePasswordStrength(password || "");

  const registerMutation = useMutation<RegisterResponse, Error, RegisterCredentials>({
    mutationFn: async (credentials: RegisterCredentials) => {
      const { confirmPassword, ...data } = credentials;
      const res = await apiRequest("POST", "/api/empresa/auth/register", data);
      return await res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/empresa/auth/me"] });
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
      <div className="w-full max-w-2xl">
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
              {/* Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Dados da Empresa
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="text-sm font-medium">
                    CNPJ
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <Input
                      id="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={cnpjDisplay}
                      onChange={(e) => {
                        const formatted = formatCNPJ(e.target.value);
                        setCnpjDisplay(formatted);
                        const digits = formatted.replace(/\D/g, "");
                        form.setValue("cnpj", digits);
                        if (digits.length === 14) {
                          lookupCnpj(digits);
                        }
                      }}
                      maxLength={18}
                      className="pl-10 h-12 text-base border-2 transition-all duration-200"
                      disabled={registerMutation.isPending || cnpjLoading}
                    />
                    {cnpjLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {form.formState.errors.cnpj && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      {form.formState.errors.cnpj.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Nome da empresa *
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Nome da empresa"
                      className="pl-10 h-12 text-base border-2 transition-all duration-200"
                      data-testid="input-name"
                      {...form.register("name")}
                      disabled={registerMutation.isPending}
                    />
                  </div>
                  {form.formState.errors.name && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email *
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
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Telefone
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Phone className="w-5 h-5" />
                      </div>
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
                        className="pl-10 h-12 text-base border-2 transition-all duration-200"
                        disabled={registerMutation.isPending}
                      />
                    </div>
                    {form.formState.errors.phone && (
                      <p className="text-sm font-medium text-destructive mt-2">
                        {form.formState.errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </h3>
                <p className="text-sm text-muted-foreground">
                  Parte do endereço é preenchida automaticamente ao informar o CNPJ. Selecione a cidade manualmente.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="street" className="text-sm font-medium">
                      Logradouro
                    </Label>
                    <Input
                      id="street"
                      placeholder="Rua, Avenida..."
                      className="h-12 text-base border-2 transition-all duration-200"
                      {...form.register("street")}
                      disabled={registerMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="number" className="text-sm font-medium">
                      Numero
                    </Label>
                    <Input
                      id="number"
                      placeholder="123"
                      className="h-12 text-base border-2 transition-all duration-200"
                      {...form.register("number")}
                      disabled={registerMutation.isPending}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="complement" className="text-sm font-medium">
                      Complemento
                    </Label>
                    <Input
                      id="complement"
                      placeholder="Sala, Andar, Bloco..."
                      className="h-12 text-base border-2 transition-all duration-200"
                      {...form.register("complement")}
                      disabled={registerMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="neighborhood" className="text-sm font-medium">
                      Bairro
                    </Label>
                    <Input
                      id="neighborhood"
                      placeholder="Bairro"
                      className="h-12 text-base border-2 transition-all duration-200"
                      {...form.register("neighborhood")}
                      disabled={registerMutation.isPending}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep" className="text-sm font-medium">
                      CEP
                    </Label>
                    <Input
                      id="cep"
                      placeholder="00000-000"
                      className="h-12 text-base border-2 transition-all duration-200"
                      {...form.register("cep")}
                      disabled={registerMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-sm font-medium">
                      Cidade *
                    </Label>
                    <select
                      id="city"
                      {...form.register("city")}
                      className="flex h-12 w-full rounded-md border-2 border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                      disabled={registerMutation.isPending}
                    >
                      <option value="">Selecione a cidade</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.name}>
                          {city.name} - {city.state}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.city && (
                      <p className="text-sm font-medium text-destructive mt-2">
                        {form.formState.errors.city.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-sm font-medium">
                      UF
                    </Label>
                    <Input
                      id="state"
                      placeholder="UF"
                      maxLength={2}
                      className="h-12 text-base border-2 transition-all duration-200 uppercase bg-muted"
                      {...form.register("state")}
                      disabled={true}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  Dados do Responsável
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="responsibleName" className="text-sm font-medium">
                    Nome do Responsável
                  </Label>
                  <Input
                    id="responsibleName"
                    placeholder="Nome completo do responsável"
                    className="h-12 text-base border-2 transition-all duration-200"
                    {...form.register("responsibleName")}
                    disabled={registerMutation.isPending}
                  />
                  {form.formState.errors.responsibleName && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      {form.formState.errors.responsibleName.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="responsibleWhatsapp" className="text-sm font-medium">
                      WhatsApp do Responsável
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Phone className="w-5 h-5" />
                      </div>
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
                        className="pl-10 h-12 text-base border-2 transition-all duration-200"
                        disabled={registerMutation.isPending}
                      />
                    </div>
                    {form.formState.errors.responsibleWhatsapp && (
                      <p className="text-sm font-medium text-destructive mt-2">
                        {form.formState.errors.responsibleWhatsapp.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsibleEmail" className="text-sm font-medium">
                      Email do Responsável
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Mail className="w-5 h-5" />
                      </div>
                      <Input
                        id="responsibleEmail"
                        type="email"
                        placeholder="responsavel@email.com"
                        className="pl-10 h-12 text-base border-2 transition-all duration-200"
                        {...form.register("responsibleEmail")}
                        disabled={registerMutation.isPending}
                      />
                    </div>
                    {form.formState.errors.responsibleEmail && (
                      <p className="text-sm font-medium text-destructive mt-2">
                        {form.formState.errors.responsibleEmail.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Código de Indicação */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Código de Indicação (Opcional)
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="referralCode" className="text-sm font-medium">
                    Código de Indicação
                  </Label>
                  <Input
                    id="referralCode"
                    placeholder="Digite o código de indicação"
                    className="h-12 text-base border-2 transition-all duration-200 uppercase"
                    {...form.register("referralCode")}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      form.setValue("referralCode", e.target.value);
                    }}
                    disabled={registerMutation.isPending}
                  />
                  <p className="text-sm text-muted-foreground">
                    Possui um código de indicação? Insira aqui
                  </p>
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Senha de Acesso
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Senha *
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
                    Confirmar senha *
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
