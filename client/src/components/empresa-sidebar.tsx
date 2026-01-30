import {
  Home,
  Package,
  LogOut,
  Building2,
  Menu,
  ChevronDown,
  Truck,
  CheckCircle2,
  XCircle,
  MapPin,
  Wallet,
  Calculator,
  FileText,
  DollarSign,
  Clock,
  User,
  UserPlus
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CompanyInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
}

export function EmpresaSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [entregasOpen, setEntregasOpen] = useState(true);

  const { data: companyInfo } = useQuery<CompanyInfo>({
    queryKey: ["/api/empresa/auth/me"],
  });

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

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActive = (path: string) => location === path;
  const isEntregasActive = location.startsWith("/empresa/entregas");

  const menuSections = [
    {
      title: "Principal",
      items: [
        {
          label: "Dashboard",
          icon: Home,
          path: "/empresa/dashboard",
        },
      ],
    },
    {
      title: "Operacional",
      items: [
        {
          label: "Entregas",
          icon: Package,
          isCollapsible: true,
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
          label: "Intermunicipais",
          icon: MapPin,
          path: "/empresa/entregas-intermunicipais",
        },
        {
          label: "Alocar Entregador",
          icon: UserPlus,
          path: "/empresa/alocacoes",
        },
      ],
    },
    {
      title: "Financeiro",
      items: [
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
          label: "Notas Fiscais",
          icon: FileText,
          path: "/empresa/notas-fiscais",
        },
        {
          label: "Boletos",
          icon: DollarSign,
          path: "/empresa/financeiro",
        },
      ],
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* Logo/Header */}
      <div className="h-16 border-b border-slate-700/50 flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg">Fretus</span>
            <p className="text-[10px] text-slate-400 -mt-0.5">Portal Empresa</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {menuSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  // If item has subitems (collapsible)
                  if ('isCollapsible' in item && item.isCollapsible && 'items' in item) {
                    return (
                      <Collapsible
                        key={item.label}
                        open={entregasOpen}
                        onOpenChange={setEntregasOpen}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                              isEntregasActive
                                ? "bg-blue-600/20 text-blue-400"
                                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform duration-200",
                                entregasOpen && "rotate-180"
                              )}
                            />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1 ml-4 pl-3 border-l border-slate-700/50 space-y-1">
                          {item.items.map((subItem) => {
                            const SubIcon = subItem.icon;
                            const active = isActive(subItem.path);

                            return (
                              <Link key={subItem.path} href={subItem.path}>
                                <button
                                  onClick={() => setIsMobileOpen(false)}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                                    active
                                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
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
                  const active = isActive(item.path!);

                  return (
                    <Link key={item.path} href={item.path!}>
                      <button
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 mb-3 px-2">
          <Avatar className="h-9 w-9 bg-slate-700 border border-slate-600">
            <AvatarFallback className="text-xs font-semibold text-slate-300 bg-slate-700">
              {companyInfo?.name?.substring(0, 2).toUpperCase() || "EM"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {companyInfo?.name || "Empresa"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {companyInfo?.email || ""}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-400 hover:text-red-400 hover:bg-red-950/30"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-4 w-4" />
          {logoutMutation.isPending ? "Saindo..." : "Sair"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="bg-white shadow-md"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-40 w-64">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
