import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet, Search, Building2, RefreshCw, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyWithSubaccount {
  id: string;
  name: string;
  cnpj: string;
  pixKey: string | null;
  pixKeyType: string | null;
  subaccountId: string | null;
  balance: number;
  lastBalanceUpdate: string | null;
}

export default function Financeiro() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedPixKey, setCopiedPixKey] = useState<string | null>(null);

  // Buscar empresas com subcontas
  const { data, isLoading, error, refetch } = useQuery<{
    companies: CompanyWithSubaccount[];
    totalBalance: number;
    totalCompanies: number;
  }>({
    queryKey: ["/api/financial/admin/companies-with-subaccounts", searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/financial/admin/companies-with-subaccounts?${params}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar empresas");
      }

      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Nunca atualizado";
    return new Date(date).toLocaleString('pt-BR');
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const getPixKeyTypeLabel = (type: string | null) => {
    if (!type) return "-";
    const labels: Record<string, string> = {
      EMAIL: "E-mail",
      CPF: "CPF",
      CNPJ: "CNPJ",
      PHONE: "Telefone",
      EVP: "Chave Aleatória",
    };
    return labels[type] || type;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPixKey(text);
    toast({
      title: "Copiado!",
      description: "Chave PIX copiada para área de transferência",
    });
    setTimeout(() => setCopiedPixKey(null), 2000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">Gestão de empresas</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalCompanies || 0}</div>
            <p className="text-xs text-muted-foreground">Com subcontas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.totalBalance || 0)}</div>
            <p className="text-xs text-muted-foreground">Em todas as subcontas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Empresa</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.totalCompanies ? formatCurrency(data.totalBalance / data.totalCompanies) : "R$ 0,00"}
            </div>
            <p className="text-xs text-muted-foreground">Saldo médio</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Empresa</CardTitle>
          <CardDescription>Pesquise por nome ou CNPJ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Digite o nome da empresa ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Buscar</Button>
          </form>
        </CardContent>
      </Card>

      {/* Tabela de Empresas */}
      <Card>
        <CardHeader>
          <CardTitle>Empresas com Subcontas</CardTitle>
          <CardDescription>Lista de todas as empresas com subcontas cadastradas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Carregando empresas...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p>Erro ao carregar empresas</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-2">
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo PIX</TableHead>
                  <TableHead>Chave PIX</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Última Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.companies?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma empresa com subconta encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  data.companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{formatCNPJ(company.cnpj)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPixKeyTypeLabel(company.pixKeyType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {company.pixKey ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm truncate max-w-[200px]">
                              {company.pixKey}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(company.pixKey!)}
                            >
                              {copiedPixKey === company.pixKey ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {company.subaccountId ? (
                          <span className={company.balance > 0 ? "text-green-600" : ""}>
                            {formatCurrency(company.balance)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sem subconta</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(company.lastBalanceUpdate)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}