import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { EmpresaSidebar } from "@/components/empresa-sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Mapa from "@/pages/mapa";
import Usuarios from "@/pages/usuarios";
import Cidades from "@/pages/cidades";
import Categorias from "@/pages/categorias";
import MarcasModelos from "@/pages/marcas-modelos";
import DocumentosMotorista from "@/pages/documentos-motorista";
import TiposCancelamentoEmpresa from "@/pages/tipos-cancelamento-empresa";
import Faq from "@/pages/faq";
import AssuntosTickets from "@/pages/assuntos-tickets";
import TicketsSuporte from "@/pages/tickets-suporte";
import CompleteEGanhe from "@/pages/complete-e-ganhe";
import Indicacao from "@/pages/indicacao";
import Notificacoes from "@/pages/notificacoes";
import Empresas from "@/pages/empresas";
import Financeiro from "@/pages/financeiro";
import FinanceiroSaques from "@/pages/financeiro-saques";
import AdminBoletos from "@/pages/admin-boletos";
import Precos from "@/pages/precos";
import RotasIntermunicipais from "@/pages/rotas-intermunicipais";
import MotoristasAtivos from "@/pages/motoristas-ativos";
import MotoristasBloqueados from "@/pages/motoristas-bloqueados";
import MotoristasAguardando from "@/pages/motoristas-aguardando";
import Configuracoes from "@/pages/configuracoes";
import Pesquisas from "@/pages/pesquisas";
import PesquisaPublica from "@/pages/pesquisa-publica";
import Register from "@/pages/register";
import EmpresaLogin from "@/pages/empresa-login";
import EmpresaRegister from "@/pages/empresa-register";
import EmpresaDashboard from "@/pages/empresa-dashboard";
import EmpresaEntregas from "@/pages/empresa-entregas";
import EmpresaEntregasEmAndamento from "@/pages/empresa-entregas-em-andamento";
import EmpresaEntregasConcluidas from "@/pages/empresa-entregas-concluidas";
import EmpresaEntregasCanceladas from "@/pages/empresa-entregas-canceladas";
import EmpresaCarteira from "@/pages/carteira";
import EmpresaPrecificacao from "@/pages/empresa-precificacao";
import EmpresaNotasFiscais from "@/pages/empresa-notas-fiscais";
import EmpresaFinanceiro from "@/pages/empresa-financeiro";
import EntregasIntermunicipais from "@/pages/entregas-intermunicipais";
import EntregasEmAndamento from "@/pages/entregas-em-andamento";
import EntregasConcluidas from "@/pages/entregas-concluidas";
import EntregasCanceladas from "@/pages/entregas-canceladas";
import AdminEntregasIntermunicipais from "@/pages/admin-entregas-intermunicipais";
import AdminViagensIntermunicipais from "@/pages/admin-viagens-intermunicipais";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/" || location === "/register" || location === "/forgot-password";
  const isPesquisaPage = location.startsWith("/pesquisa/");
  const isEmpresaAuthPage = location === "/empresa" || location === "/empresa/register";
  const isEmpresaPage = location.startsWith("/empresa/") && !isEmpresaAuthPage;

  // Pesquisa pública (sem autenticação)
  if (isPesquisaPage) {
    return (
      <Switch>
        <Route path="/pesquisa/:slug" component={PesquisaPublica} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Auth pages (admin login and register)
  if (isAuthPage) {
    return (
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/register" component={Register} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Empresa auth pages (login and register)
  if (isEmpresaAuthPage) {
    return (
      <Switch>
        <Route path="/empresa" component={EmpresaLogin} />
        <Route path="/empresa/register" component={EmpresaRegister} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Empresa portal pages (with EmpresaSidebar)
  if (isEmpresaPage) {
    return (
      <div className="flex h-screen w-full bg-background">
        <EmpresaSidebar />
        <div className="flex-1 lg:pl-64">
          <main className="h-full overflow-auto p-6">
            <Switch>
              <Route path="/empresa/dashboard" component={EmpresaDashboard} />
              <Route path="/empresa/carteira" component={EmpresaCarteira} />
              <Route path="/empresa/precificacao" component={EmpresaPrecificacao} />
              <Route path="/empresa/notas-fiscais" component={EmpresaNotasFiscais} />
              <Route path="/empresa/financeiro" component={EmpresaFinanceiro} />
              <Route path="/empresa/entregas/em-andamento" component={EmpresaEntregasEmAndamento} />
              <Route path="/empresa/entregas/concluidas" component={EmpresaEntregasConcluidas} />
              <Route path="/empresa/entregas/canceladas" component={EmpresaEntregasCanceladas} />
              <Route path="/empresa/entregas" component={EmpresaEntregas} />
              <Route path="/empresa/entregas-intermunicipais" component={EntregasIntermunicipais} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    );
  }

  // Admin portal pages (with AppSidebar)
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/mapa" component={Mapa} />
              <Route path="/usuarios" component={Usuarios} />
              <Route path="/cidades" component={Cidades} />
              <Route path="/categorias" component={Categorias} />
              <Route path="/marcas-modelos" component={MarcasModelos} />
              <Route path="/documentos-motorista" component={DocumentosMotorista} />
              <Route path="/tipos-cancelamento-empresa" component={TiposCancelamentoEmpresa} />
              <Route path="/faq" component={Faq} />
              <Route path="/suporte/assuntos" component={AssuntosTickets} />
              <Route path="/suporte/tickets" component={TicketsSuporte} />
              <Route path="/promocoes/complete-e-ganhe" component={CompleteEGanhe} />
              <Route path="/promocoes/indicacao" component={Indicacao} />
              <Route path="/notificacoes" component={Notificacoes} />
              <Route path="/empresas" component={Empresas} />
              <Route path="/financeiro" component={Financeiro} />
              <Route path="/financeiro/saques" component={FinanceiroSaques} />
              <Route path="/financeiro/boletos" component={AdminBoletos} />
              <Route path="/precos" component={Precos} />
              <Route path="/rotas-intermunicipais" component={RotasIntermunicipais} />
              <Route path="/motoristas/ativos" component={MotoristasAtivos} />
              <Route path="/motoristas/bloqueados" component={MotoristasBloqueados} />
              <Route path="/motoristas/aguardando" component={MotoristasAguardando} />
              <Route path="/entregas/em-andamento" component={EntregasEmAndamento} />
              <Route path="/entregas/concluidas" component={EntregasConcluidas} />
              <Route path="/entregas/canceladas" component={EntregasCanceladas} />
              <Route path="/admin/entregas-intermunicipais" component={AdminEntregasIntermunicipais} />
              <Route path="/admin/viagens-intermunicipais" component={AdminViagensIntermunicipais} />
              <Route path="/configuracoes" component={Configuracoes} />
              <Route path="/pesquisas" component={Pesquisas} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
