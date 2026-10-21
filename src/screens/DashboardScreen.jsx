import { useState } from "react";
import {
  CalendarDays,
  ChartColumn,
  CircleHelp,
  CirclePlay,
  EllipsisVertical,
  Factory,
  Globe,
  Handshake,
  LayoutDashboard,
  LayoutGrid,
  Maximize,
  Minimize,
  Play,
  Save,
  Settings,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import { TRACKS, CLASS_RULES } from "../data/constants";
import { formatMoney } from "../utils/helpers";
import { ClassBadge, MeterBar, confidenceColor } from "../components/ui/common";
import NewsFeed from "../components/NewsFeed";
import OverviewTab from "../components/dashboard/OverviewTab";
import CarTab from "../components/dashboard/CarTab";
import FactoryTab from "../components/dashboard/FactoryTab";
import DriversTab from "../components/dashboard/DriversTab";
import SponsorsTab from "../components/dashboard/SponsorsTab";
import FinancesTab from "../components/dashboard/FinancesTab";
import CalendarTab from "../components/dashboard/CalendarTab";
import StandingsTab from "../components/dashboard/StandingsTab";
import GridTab from "../components/dashboard/GridTab";
import { playerEntries, playerClasses } from "../engine/team";
import { playerStandingRow } from "../engine/career";

const TABS = [
  { id: "overview", label: "Visão Geral", title: "Visão Geral", icon: LayoutDashboard, group: "Gestão" },
  { id: "car", label: "Carro & P&D", title: "Desenvolvimento", icon: Wrench, group: "Gestão" },
  { id: "factory", label: "Fábrica", title: "Fábrica & Equipe Técnica", icon: Factory, group: "Gestão" },
  { id: "drivers", label: "Pilotos", title: "Pilotos", icon: Users, group: "Gestão" },
  { id: "sponsors", label: "Patrocínios", title: "Sala de Negociações", icon: Handshake, group: "Gestão" },
  { id: "finances", label: "Finanças", title: "Finanças", icon: Wallet, group: "Gestão" },
  { id: "calendar", label: "Calendário", title: "Calendário", icon: CalendarDays, group: "Mundo" },
  { id: "standings", label: "Classificação", title: "Classificação", icon: TrendingUp, group: "Mundo" },
  { id: "news", label: "Notícias", title: "Centro de Notícias", icon: Globe, group: "Mundo" },
  { id: "grid", label: "Editor de grid", title: "Editor de grid", icon: LayoutGrid, group: "Mundo" }
];

const MOBILE_MAIN = ["overview", "car", "drivers"];

const DashboardScreen = ({ game, activeTab, setActiveTab, isNewsLoading, isFullScreen, toggleFullScreen, openModal, actions }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const player = game.playerTeam;
  const entries = playerEntries(game);
  const classes = playerClasses(game);
  const nextRace = TRACKS[game.raceIndex];
  const unreadCount = game.newsFeed.filter(item => !item.read).length;
  const current = TABS.find(tab => tab.id === activeTab) || TABS[0];
  const goTo = id => {
    setActiveTab(id);
    setIsMoreOpen(false);
  };

  const renderTab = () => {
    switch (current.id) {
      case "car":
        return <CarTab game={game} onBuyUpgrade={actions.buyUpgrade} />;
      case "factory":
        return <FactoryTab game={game} onUpgradeFacility={actions.upgradeFacility} onHireStaff={actions.hireStaff} />;
      case "drivers":
        return <DriversTab game={game} onSignDriver={actions.signDriver} onSetStarter={actions.setStarter} onSwapDrivers={actions.swapDrivers} />;
      case "sponsors":
        return <SponsorsTab game={game} onSignSponsor={actions.signSponsor} />;
      case "finances":
        return <FinancesTab game={game} />;
      case "calendar":
        return <CalendarTab game={game} />;
      case "standings":
        return <StandingsTab game={game} />;
      case "grid":
        return <GridTab game={game} onCreate={actions.createTeam} onEdit={actions.editTeam} onDelete={actions.deleteTeam} />;
      case "news":
        return (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 min-h-[70vh]">
            <NewsFeed newsFeed={game.newsFeed} markAllRead={actions.markAllRead} isLoading={isNewsLoading} />
          </div>
        );
      default:
        return <OverviewTab game={game} onStartWeekend={actions.startWeekend} setActiveTab={setActiveTab} />;
    }
  };

  const headerButton = (onClick, Icon, label, extra = null) => (
    <button
      onClick={onClick}
      className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-all group relative"
      aria-label={label}
    >
      <Icon size={20} />
      {extra}
      <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-black text-xs p-2 rounded whitespace-nowrap z-50">{label}</div>
    </button>
  );

  const mobileMenuItem = (onClick, Icon, label, iconClass) => (
    <button
      onClick={() => {
        onClick();
        setIsMenuOpen(false);
      }}
      className="w-full text-left px-4 py-3 text-sm font-bold text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 border-b border-gray-800 last:border-0"
    >
      <Icon size={16} className={iconClass} /> {label}
    </button>
  );

  return (
    <div className="h-[100dvh] bg-gray-950 text-white font-sans flex flex-col overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-800 h-16 shrink-0 flex items-center justify-between px-3 md:px-6 z-30 shadow-md gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden md:flex gap-1 shrink-0">
            {entries.map(entry => (
              <div
                className="relative w-10 h-10 rounded-lg shadow-lg flex items-center justify-center font-black italic text-black"
                style={{ backgroundColor: player.color }}
                title={`#${entry.number} · ${entry.class === "HYPERCAR" ? "Hypercar" : "LMGT3"}`}
                key={entry.id}
              >
                {entry.number}
                {entries.length > 1 && (
                  <span className={`absolute -bottom-1 -right-1 text-[7px] not-italic px-1 rounded ${entry.class === "HYPERCAR" ? "bg-red-700 text-white" : "bg-yellow-500 text-black"}`}>
                    {entry.class === "HYPERCAR" ? "HYP" : "GT3"}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="font-black italic text-lg md:text-2xl text-white tracking-tight leading-none truncate max-w-[140px] md:max-w-none">{player.name}</h1>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-400 uppercase font-bold tracking-wider mt-0.5">
              {entries.map(entry => (
                // Com dois carros os selos com número já aparecem no desktop; aqui fica só no celular
                <span className={`flex items-center gap-1 ${entries.length > 1 ? "md:hidden" : ""}`} key={entry.id}>
                  {entries.length > 1 && <span className="text-gray-400">#{entry.number}</span>}
                  <ClassBadge cls={entry.class} size="xs" />
                </span>
              ))}
              <span className="text-gray-500">
                S{game.season} · Etapa {Math.min(game.raceIndex + 1, TRACKS.length)}/{TRACKS.length}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden lg:flex flex-col w-28 leading-tight">
            <span className="text-[10px] text-gray-500 uppercase font-bold flex justify-between">
              <span>Conselho</span>
              <span>{game.career.confidence}%</span>
            </span>
            <MeterBar value={game.career.confidence} color={confidenceColor(game.career.confidence)} height="h-1.5" />
          </div>
          <div className="hidden md:flex flex-col items-end leading-tight">
            <span className="text-[10px] text-gray-500 uppercase font-bold">Reputação</span>
            <span className="font-mono font-bold text-yellow-400 flex items-center gap-1">
              <Star size={12} fill="currentColor" /> {Math.round(player.reputation ?? 0)}
            </span>
          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[8px] md:text-[10px] text-gray-500 uppercase font-bold hidden md:block">Orçamento</span>
            <span className={`font-mono font-bold text-sm md:text-xl ${player.funds < 1000000 ? "text-red-400" : "text-green-400"}`}>{formatMoney(player.funds)}</span>
            <span className="text-[10px] font-bold text-yellow-500 md:hidden">
              {classes.map(cls => `${classes.length > 1 ? `${CLASS_RULES[cls].short} ` : ""}${playerStandingRow(game, cls)?.points ?? 0}`).join(" · ")} Pts
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 relative shrink-0">
          <button onClick={toggleFullScreen} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-all" aria-label="Tela cheia">
            {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <div className="hidden md:flex gap-2">
            {headerButton(() => openModal("stats"), ChartColumn, "Centro de Dados")}
            {headerButton(() => openModal("help"), CircleHelp, "Como jogar")}
            {headerButton(() => openModal("settings"), Settings, "Configurações")}
            {headerButton(actions.exportSaveFile, Save, "Exportar save")}
          </div>
          <div className="md:hidden relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-lg border transition-all ${isMenuOpen ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-800 border-gray-700 text-gray-300"}`}
              aria-label="Menu"
            >
              <EllipsisVertical size={18} />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {mobileMenuItem(() => openModal("stats"), ChartColumn, "Centro de Dados", "text-blue-500")}
                {mobileMenuItem(() => openModal("help"), CircleHelp, "Como jogar", "text-green-500")}
                {mobileMenuItem(() => openModal("settings"), Settings, "Configurações", "text-gray-400")}
                {mobileMenuItem(actions.exportSaveFile, Save, "Exportar save", "text-yellow-500")}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <div className="hidden md:flex w-64 bg-gray-900 border-r border-gray-800 flex-col p-4 gap-2 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="mb-2">
            <button
              onClick={actions.startWeekend}
              disabled={!nextRace}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 group disabled:opacity-50"
            >
              <span className="text-xs text-blue-200 uppercase tracking-widest group-hover:text-white">Próxima Corrida</span>
              <div className="flex items-center gap-2 text-lg px-2">
                <CirclePlay size={24} className="animate-pulse shrink-0" />
                <span className="truncate">{nextRace?.name}</span>
              </div>
              <span className="text-[10px] text-blue-200/80">
                {nextRace?.code} · {nextRace?.date} · Etapa {game.raceIndex + 1}
              </span>
            </button>
          </div>
          {["Gestão", "Mundo"].map(group => (
            <div className="space-y-1" key={group}>
              <p className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 mt-4">{group}</p>
              {TABS.filter(tab => tab.group === group).map(tab => {
                const Icon = tab.icon;
                const active = current.id === tab.id;
                return (
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm flex items-center justify-between transition-colors ${
                      active ? "bg-gray-800 text-white shadow-inner" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                    }`}
                    key={tab.id}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={18} className={active ? "text-blue-400" : "text-gray-500"} /> {tab.label}
                    </span>
                    {tab.id === "news" && unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex-1 bg-gray-950 p-3 md:p-8 overflow-y-auto relative custom-scrollbar pb-28 md:pb-8">
          <div className="mb-4 md:mb-6 flex items-center gap-2 text-sm text-gray-500">
            <span className="uppercase font-bold tracking-wider">Dashboard</span>
            <span>/</span>
            <span className="text-white font-bold">{current.title}</span>
          </div>
          {renderTab()}
        </div>
      </div>
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setIsMoreOpen(false)}>
          <div
            className="absolute bottom-[70px] left-0 right-0 bg-gray-900 border-t border-gray-700 rounded-t-2xl p-4 grid grid-cols-3 gap-3 animate-in slide-in-from-bottom-4 duration-200"
            onClick={event => event.stopPropagation()}
          >
            {TABS.filter(tab => !MOBILE_MAIN.includes(tab.id)).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => goTo(tab.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border ${current.id === tab.id ? "border-blue-500 bg-blue-900/20 text-blue-300" : "border-gray-800 bg-gray-950 text-gray-400"}`}
                >
                  <div className="relative">
                    <Icon size={20} />
                    {tab.id === "news" && unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />}
                  </div>
                  <span className="text-[10px] font-bold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="md:hidden border-t border-gray-800 bg-gray-900 pb-safe fixed bottom-0 left-0 right-0 z-40 h-[70px]">
        <div className="flex justify-around items-center h-full">
          {[TABS[0], TABS[1]].map(tab => {
            const Icon = tab.icon;
            return (
              <button onClick={() => goTo(tab.id)} className={`flex flex-col items-center justify-center p-2 w-full ${current.id === tab.id ? "text-blue-400" : "text-gray-500"}`} key={tab.id}>
                <Icon size={20} />
                <span className="text-[10px] font-bold mt-1">{tab.id === "overview" ? "Início" : "Carro"}</span>
              </button>
            );
          })}
          <div className="relative -top-6">
            <button
              onClick={actions.startWeekend}
              className="bg-blue-600 text-white rounded-full p-4 shadow-lg shadow-blue-900/40 border-4 border-gray-950 active:scale-95 transition-transform"
              aria-label="Próxima corrida"
            >
              <Play size={26} fill="white" className="translate-x-0.5" />
            </button>
          </div>
          <button onClick={() => goTo("drivers")} className={`flex flex-col items-center justify-center p-2 w-full ${current.id === "drivers" ? "text-blue-400" : "text-gray-500"}`}>
            <Users size={20} />
            <span className="text-[10px] font-bold mt-1">Pilotos</span>
          </button>
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`flex flex-col items-center justify-center p-2 w-full relative ${!MOBILE_MAIN.includes(current.id) || isMoreOpen ? "text-blue-400" : "text-gray-500"}`}
          >
            <div className="relative">
              {isMoreOpen ? <X size={20} /> : <EllipsisVertical size={20} />}
              {unreadCount > 0 && !isMoreOpen && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-900" />}
            </div>
            <span className="text-[10px] font-bold mt-1">Mais</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
