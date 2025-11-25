import { Home, Package, LogOut, Building2, Menu, ChevronDown, Truck, CheckCircle2, XCircle, MapPin, Wallet, Calculator } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function EmpresaSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/empresa/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.clear();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      setLocation("/empresa");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao fazer logout",
        description: "Tente novamente.",
      });
    },
  });

  const navItems = [
    {
      label: "Dashboard",
      icon: Home,
      path: "/empresa/dashboard",
    },
    {
      label: "Carteira",
      icon: Wallet,
      path: "/empresa/carteira",
    },
    {
      label: "Precificação",
      icon: Calculator,
      path: "/empresa/precificacao",
    },
    {
      label: "Entregas",
      icon: Package,
      items: [
        {
          label: "Em andamento",
          icon: Truck,
          path: "/empresa/entregas/em-andamento",
        },
        {
          label: "Concluídas",
          icon: CheckCircle2,
          path: "/empresa/entregas/concluidas",
        },
        {
          label: "Canceladas",
          icon: XCircle,
          path: "/empresa/entregas/canceladas",
        },
      ],
    },
    {
      label: "Entregas Intermunicipais",
      icon: MapPin,
      path: "/empresa/entregas-intermunicipais",
    },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo/Header */}
        <div className="h-16 border-b border-border flex items-center px-6">
          <Building2 className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg">Fretus Empresa</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            // If item has subitems, render as collapsible
            if ('items' in item && item.items) {
              return (
                <Collapsible key={item.label} className="group/collapsible">
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1 pl-6">
                    {item.items.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isActive = location === subItem.path;

                      return (
                        <Link key={subItem.path} href={subItem.path}>
                          <button
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <SubIcon className="h-4 w-4" />
                            <span>{subItem.label}</span>
                          </button>
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            // Regular menu item
            const isActive = location === item.path;

            return (
              <Link key={item.path!} href={item.path!}>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-5 w-5" />
            Sair
          </Button>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
