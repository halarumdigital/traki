import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Shield, User as UserIcon, Mail, Calendar, Key } from "lucide-react";
import { useEffect } from "react";
import { TestSentry } from "@/components/TestSentry";

interface UserData {
  id: string;
  email: string;
  nome: string;
  isAdmin: boolean;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useQuery<UserData>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  useEffect(() => {
    if (error && !isLoading) {
      setLocation("/");
    }
  }, [error, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4 animate-pulse">
            <UserIcon className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || error) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Visão geral da sua conta</p>
      </div>

      {/* Test Sentry component (only in development) */}
      <TestSentry />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                  {getInitials(user.nome)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{user.nome}</CardTitle>
                <CardDescription className="mt-1">
                  Informações da sua conta
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground" data-testid="text-email">{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Key className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground" data-testid="text-id">ID: {user.id}</span>
            </div>
            {user.isAdmin && (
              <div className="pt-2">
                <Badge variant="default" data-testid="badge-admin">
                  <Shield className="w-3 h-3 mr-1" />
                  Administrador
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {user.isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Área Administrativa
              </CardTitle>
              <CardDescription>
                Recursos exclusivos para administradores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Como administrador, você tem acesso a:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Gerenciamento de usuários</li>
                  <li>Configurações do sistema</li>
                  <li>Relatórios e estatísticas</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
