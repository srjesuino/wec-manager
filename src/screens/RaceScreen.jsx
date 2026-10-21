import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  CloudRain,
  Flag,
  Fuel,
  Funnel,
  List,
  Map as MapIcon,
  Moon,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Repeat,
  Shield,
  SkipForward,
  Sun,
  Target,
  TriangleAlert,
  User,
  Wrench,
  X,
  Zap
} from "lucide-react";
import { TYRES, TYRE_ORDER, STRATEGIES, TEAM_ORDERS } from "../data/constants";
import { formatClock, formatLapTime, shortName, surname, toDisplayTime } from "../utils/helpers";
import { estimateStint, estimatePitTime, computeAutoPlan, raceClock, classLabel, canSwapTeamCars } from "../engine/race";
import TrackMap from "../components/TrackMap";
import { TyreBadge, TeamStripe, MeterBar } from "../components/ui/common";

const SPEEDS = [
  { id: 1, label: "1x", tps: 10 },
  { id: 2, label: "2x", tps: 20 },
  { id: 5, label: "5x", tps: 50 },
  { id: 10, label: "10x", tps: 100 }
];

const RADIO_TONES = {
  info: "border-blue-500 text-blue-100",
  warn: "border-yellow-500 text-yellow-100",
  danger: "border-red-500 text-red-100",
  good: "border-green-500 text-green-100"
};

// Diferença para o carro de referência ("LÍDER", "+1L", "+3.2s")
const gapText = (car, reference, elapsed) => {
  if (!reference || car.entryId === reference.entryId) {
    return "LÍDER";
  }
  if (car.status === "DNF") {
    return "OUT";
  }
  if (car.status === "PIT") {
    return "BOX";
  }
  const lapLength = car.lapLength;
  if (reference.finished) {
    const lapsDown = reference.laps - car.laps - (car.finished ? 0 : 1);
    if (lapsDown >= 1) {
      return `+${lapsDown}L`;
    }
    const arrival = car.finished
      ? car.finishTime
      : elapsed + ((car.laps + 1) * lapLength - car.distance) / Math.max(10, car.pace || car.speed / 3.6);
    return `+${(Math.max(0, arrival - reference.finishTime) * car.timeScale).toFixed(1)}s`;
  }
  const distance = reference.distance - car.distance;
  if (reference.laps - car.laps >= 1 && distance > lapLength) {
    return `+${Math.floor(distance / lapLength)}L`;
  }
  return `+${((distance / Math.max(10, car.pace || car.speed / 3.6)) * car.timeScale).toFixed(1)}s`;
};

const PlayerPanel = ({ car, raceState, est }) => {
  const driver = car.drivers[car.currentDriverIdx];
  const fatigue = car.fatigue[car.currentDriverIdx];
  const classCars = raceState.grid.filter(entry => entry.class === car.class);
  const ahead = classCars[car.classPosition - 2];
  const behind = classCars[car.classPosition];
  const L = raceState.track.length;
  const gapTo = other => {
    if (!other || other.status === "DNF") {
      return "—";
    }
    const distance = Math.abs(other.distance - car.distance);
    if (distance > L) {
      return `${Math.floor(distance / L)}L`;
    }
    return `${toDisplayTime(distance / Math.max(10, car.pace), raceState.track).toFixed(1)}s`;
  };
  return (
    <div className="bg-gray-950 p-2 rounded border border-gray-800 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <User size={14} className="text-blue-400 shrink-0" />
          <span className="text-xs font-bold text-white truncate">{driver.name}</span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono shrink-0">
          P{car.classPosition} {classLabel(car.class)} · P{car.position} geral
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <div className="flex items-center gap-1 text-[8px] text-gray-500 uppercase font-bold">
            <Fuel size={10} /> Fuel
          </div>
          <div className={`text-sm font-mono font-bold ${car.fuel < 15 ? "text-red-500 animate-pulse" : "text-white"}`}>{Math.round(car.fuel)}%</div>
          <div className="text-[9px] text-gray-500">{est.fuelLaps.toFixed(1)} voltas</div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase font-bold">Pneus</div>
          <TyreBadge compound={car.tyreCompound} wear={car.tyreWear} />
          <div className="text-[9px] text-gray-500">{car.tyreAge} voltas</div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase font-bold">Fadiga</div>
          <div className={`text-sm font-mono font-bold ${fatigue > 60 ? "text-red-400" : fatigue > 45 ? "text-yellow-400" : "text-white"}`}>{Math.round(fatigue)}%</div>
          <MeterBar value={fatigue} color={fatigue > 60 ? "bg-red-500" : "bg-blue-500"} height="h-1" />
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase font-bold">Dano</div>
          <div className={`text-sm font-mono font-bold ${car.damage > 0 ? "text-orange-400" : "text-gray-500"}`}>{Math.round(car.damage)}%</div>
          {car.puncture && <div className="text-[9px] text-red-400 font-bold">FURADO</div>}
          {car.problem && <div className="text-[9px] text-red-400 font-bold">PROBLEMA</div>}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-[10px] font-mono border-t border-gray-800 pt-2">
        <div>
          <span className="text-gray-500 block text-[8px] uppercase font-sans font-bold">Última</span>
          {formatLapTime(toDisplayTime(car.lastLap, raceState.track))}
        </div>
        <div>
          <span className="text-gray-500 block text-[8px] uppercase font-sans font-bold">Melhor</span>
          <span className="text-purple-300">{formatLapTime(toDisplayTime(car.bestLap, raceState.track))}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[8px] uppercase font-sans font-bold">À frente</span>
          <span className="text-green-300">{ahead ? gapTo(ahead) : "—"}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[8px] uppercase font-sans font-bold">Atrás</span>
          <span className="text-red-300">{behind ? gapTo(behind) : "—"}</span>
        </div>
      </div>
    </div>
  );
};

const PitPlanner = ({ car, raceState, plan, setPlan, onRequest, onCancel, onAuto, autoStrategy }) => {
  const pitTime = estimatePitTime(car, { ...plan, repair: plan.repair && car.damage > 0 }, raceState);
  const disabled = car.status !== "RUN" || car.finished;
  if (autoStrategy) {
    return (
      <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-xs text-blue-200">
        <Bot size={18} className="shrink-0" />
        <span className="flex-1">Box automático: o engenheiro decide quando parar, os pneus e as trocas de piloto.</span>
        <button onClick={() => onAuto(false)} className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-bold">
          Assumir
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase text-gray-500">Plano de pit stop</span>
        <div className="flex gap-2">
          <button onClick={() => setPlan(computeAutoPlan(car, raceState))} className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
            Sugestão do engenheiro
          </button>
          <button onClick={() => onAuto(true)} className="text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-1">
            <Bot size={11} /> Automático
          </button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1">
        <button
          onClick={() => setPlan({ ...plan, tyres: null })}
          className={`py-2 text-[9px] font-bold rounded border ${plan.tyres == null ? "bg-gray-700 border-gray-400 text-white" : "bg-gray-800 border-gray-700 text-gray-500"}`}
        >
          MANTER
        </button>
        {TYRE_ORDER.map(id => (
          <button
            key={id}
            onClick={() => setPlan({ ...plan, tyres: id })}
            className={`py-2 text-[10px] font-black rounded border ${plan.tyres === id ? "bg-gray-800 text-white" : "bg-gray-900 border-gray-700 text-gray-500"}`}
            style={plan.tyres === id ? { borderColor: TYRES[id].color, color: TYRES[id].color } : undefined}
          >
            {TYRES[id].label.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {car.drivers.map((driver, idx) => {
          const selected = (plan.driverSwap ?? car.currentDriverIdx) === idx;
          return (
            <button
              key={driver.id}
              onClick={() => setPlan({ ...plan, driverSwap: idx === car.currentDriverIdx ? null : idx })}
              className={`flex-1 py-1.5 px-1 rounded border text-left ${selected ? "bg-blue-900/40 border-blue-500 text-white" : "bg-gray-900 border-gray-700 text-gray-400"}`}
            >
              <div className="text-[10px] font-bold truncate">
                {idx === car.currentDriverIdx ? "↻ " : ""}
                {surname(driver.name)}
              </div>
              <div className={`text-[9px] font-mono ${car.fatigue[idx] > 60 ? "text-red-400" : "text-gray-500"}`}>fadiga {Math.round(car.fatigue[idx])}%</div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        {car.damage > 0 && (
          <button
            onClick={() => setPlan({ ...plan, repair: !plan.repair })}
            className={`px-2 rounded border text-[10px] font-bold flex items-center gap-1 ${plan.repair ? "bg-orange-900/40 border-orange-500 text-orange-200" : "bg-gray-900 border-gray-700 text-gray-500"}`}
          >
            <Wrench size={12} /> Reparo
          </button>
        )}
        {car.boxRequested ? (
          <button
            onClick={onCancel}
            disabled={car.forcedPit}
            className="flex-1 py-3 rounded font-bold border text-xs uppercase tracking-wider bg-gray-800 border-gray-600 text-gray-300 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <X size={14} /> {car.forcedPit ? "Pit obrigatório" : "Cancelar box"} · fim da volta
          </button>
        ) : (
          <button
            onClick={onRequest}
            disabled={disabled}
            className="flex-1 py-3 rounded font-black border text-xs uppercase tracking-wider transition-all active:scale-95 bg-yellow-600 hover:bg-yellow-500 border-yellow-500 text-black shadow-lg flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <RefreshCw size={16} /> {car.status === "PIT" ? "NO BOX" : "BOX BOX"} · ~{Math.round(toDisplayTime(pitTime.total, raceState.track))}s
          </button>
        )}
      </div>
    </div>
  );
};

// Carros do jogador: Hypercar primeiro, depois pelo número
const sortPlayers = cars =>
  [...cars].sort((a, b) => (a.class === b.class ? Number(a.number) - Number(b.number) : a.class === "HYPERCAR" ? -1 : 1));

// Seletor dos carros do jogador (equipe com mais de um carro)
const CarSelector = ({ players, selectedId, onSelect, radio, elapsed }) => (
  <div className={`grid gap-2 ${players.length > 2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
    {players.map(car => {
      const alert = radio.some(message => message.entryId === car.entryId && message.tone === "danger" && elapsed - message.t < 90);
      const status = car.status === "DNF" ? "DNF" : car.status === "PIT" ? "PIT" : car.boxRequested ? "BOX" : null;
      return (
        <button
          key={car.entryId}
          onClick={() => onSelect(car.entryId)}
          className={`relative flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left ${selectedId === car.entryId ? "bg-blue-900/40 border-blue-500" : "bg-gray-950 border-gray-800 hover:border-gray-600"}`}
        >
          <span className="text-sm font-black italic text-white">#{car.number}</span>
          <span className={`text-[8px] font-black px-1 py-0.5 rounded ${car.class === "HYPERCAR" ? "bg-red-900 text-red-200" : "bg-yellow-900 text-yellow-200"}`}>{classLabel(car.class)}</span>
          <span className="text-xs font-mono font-bold text-gray-300">{car.status === "DNF" ? "—" : `P${car.classPosition}`}</span>
          {status && (
            <span
              className={`ml-auto text-[9px] font-black px-1 rounded ${status === "DNF" ? "bg-red-900 text-red-200" : status === "PIT" ? "bg-yellow-600 text-black" : "bg-blue-600 text-white animate-pulse"}`}
            >
              {status}
            </span>
          )}
          {alert && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
        </button>
      );
    })}
  </div>
);

const RaceScreen = ({ raceState, game, advance, simulateRest, requestPit, cancelPit, changeStrategy, toggleAutoStrategy, changeTeamOrders, swapCars, endRace }) => {
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(game.settings?.raceSpeed ?? 1);
  const [viewClass, setViewClass] = useState("ALL");
  const [mobileView, setMobileView] = useState("map");
  const [feedTab, setFeedTab] = useState("radio");
  const [selectedId, setSelectedId] = useState(() => sortPlayers(raceState.grid.filter(car => car.isPlayer))[0]?.entryId);
  const [plans, setPlans] = useState({});
  const [radioFilter, setRadioFilter] = useState("ALL");
  const finished = raceState.finished;
  const tps = SPEEDS.find(option => option.id === speed)?.tps ?? 10;

  useEffect(() => {
    if (!running || finished) {
      return undefined;
    }
    let frame;
    let last = performance.now();
    let accumulator = 0;
    const loop = now => {
      accumulator += ((now - last) / 1000) * tps;
      last = now;
      const ticks = Math.min(30, Math.floor(accumulator));
      if (ticks > 0) {
        accumulator -= ticks;
        advance(ticks);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, tps, finished, advance]);

  useEffect(() => {
    if (finished) {
      setRunning(false);
    }
  }, [finished]);

  // Espaço pausa/retoma
  useEffect(() => {
    const onKey = event => {
      if (event.code === "Space" && !finished && event.target.tagName !== "INPUT") {
        event.preventDefault();
        setRunning(value => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished]);

  const players = sortPlayers(raceState.grid.filter(car => car.isPlayer));
  const twoCars = players.length > 1;
  const player = players.find(car => car.entryId === selectedId) || players[0];
  const est = player ? estimateStint(player, raceState) : null;
  const defaultPlan = { tyres: raceState.trackWetness > 40 ? "WET" : "MEDIUM", driverSwap: null, repair: true };
  const plan = (player && plans[player.entryId]) || defaultPlan;
  const setPlan = next => player && setPlans(prev => ({ ...prev, [player.entryId]: next }));
  // Classes em que o jogador tem dois carros (ordens de equipe)
  const pairClasses = ["HYPERCAR", "LMGT3"].filter(cls => players.filter(car => car.class === cls).length > 1);
  const L = raceState.track.length;
  const visibleGrid = useMemo(() => {
    const list = viewClass === "ALL" ? raceState.grid : raceState.grid.filter(car => car.class === viewClass);
    return list.map(car => ({ ...car, lapLength: L, timeScale: raceState.track.timeScale || 1 }));
  }, [raceState.grid, viewClass, L, raceState.track.timeScale]);
  const reference = visibleGrid[0];
  const clock = raceClock(raceState);
  const night = raceState.night || 0;
  const trend = raceState.targetWetness - raceState.trackWetness;
  const neutral = raceState.neutral;
  const radio = [...raceState.radio].filter(message => radioFilter === "ALL" || message.entryId === radioFilter || !message.entryId).reverse();
  const events = [...raceState.events].filter(event => feedTab === "all" || event.important).reverse().slice(0, 60);

  const handleSimulate = () => {
    setRunning(false);
    simulateRest();
  };

  return (
    <div className="h-[100dvh] bg-gray-950 text-white flex flex-col font-sans overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-800 p-2 shrink-0 shadow-lg z-20">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 md:gap-5">
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] text-gray-500 uppercase font-bold">Volta</span>
              <div className="font-mono leading-none flex items-baseline gap-1">
                <span className="text-white font-bold text-base md:text-lg">{Math.min(raceState.leaderLap, raceState.totalLaps)}</span>
                <span className="text-gray-600 text-xs">/{raceState.totalLaps}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded border border-gray-700">
              {night > 0.5 ? <Moon size={14} className="text-indigo-300" /> : <Sun size={14} className="text-yellow-400" />}
              <span className="text-[10px] md:text-xs font-mono font-bold text-gray-200">{formatClock(clock)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded border border-gray-700" title="Umidade da pista">
              {raceState.weather === "RAIN" ? <CloudRain className="text-blue-400" size={14} /> : <Sun className="text-yellow-400 animate-spin-slow" size={14} />}
              <span className="text-[10px] md:text-xs font-mono font-bold text-blue-200">{Math.round(raceState.trackWetness)}%</span>
              {Math.abs(trend) > 5 && (trend > 0 ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-yellow-400" />)}
            </div>
            {neutral && (
              <div className={`font-black px-2 py-1 rounded text-xs animate-pulse ${neutral.type === "SC" ? "bg-yellow-500 text-black" : "bg-amber-600 text-black"}`}>
                {neutral.type === "SC" ? `SC · ${neutral.lapsLeft}v` : `FCY · ${Math.ceil(neutral.timeLeft)}s`}
              </div>
            )}
            {players
              .filter(car => car.boxRequested && car.status !== "PIT")
              .map(car => (
                <div className="bg-blue-600 text-white font-bold px-2 py-1 rounded text-[10px] animate-pulse" key={car.entryId}>
                  BOX{twoCars ? ` #${car.number}` : ""}
                </div>
              ))}
          </div>
          <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 order-3 md:order-none">
            {["ALL", "HYPERCAR", "LMGT3"].map(cls => (
              <button
                onClick={() => setViewClass(cls)}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                  viewClass === cls
                    ? cls === "HYPERCAR"
                      ? "bg-red-600 text-white"
                      : cls === "LMGT3"
                        ? "bg-yellow-600 text-black"
                        : "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
                key={cls}
              >
                {cls === "ALL" ? "GERAL" : cls === "HYPERCAR" ? "HYP" : "GT3"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            {finished ? (
              <button
                onClick={endRace}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold animate-pulse text-xs md:text-sm uppercase tracking-wider shadow-lg shadow-green-900/20 flex items-center gap-2"
              >
                <Flag size={16} /> Ver resultado
              </button>
            ) : (
              <div className="flex gap-1 bg-gray-800 p-1 rounded-lg border border-gray-700">
                <button
                  onClick={() => setRunning(!running)}
                  className={`p-2 md:px-3 rounded text-white active:scale-95 transition-transform ${running ? "bg-gray-700 hover:bg-gray-600" : "bg-green-700 hover:bg-green-600"}`}
                  aria-label={running ? "Pausar" : "Iniciar"}
                >
                  {running ? <Pause size={16} /> : <Play size={16} />}
                </button>
                {SPEEDS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setSpeed(option.id)}
                    className={`px-1.5 md:px-2 rounded text-[10px] md:text-xs font-bold ${speed === option.id ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  onClick={handleSimulate}
                  className="p-2 rounded text-red-300 hover:bg-gray-700 active:scale-95"
                  title="Simular até o fim (o box automático assume o carro)"
                  aria-label="Simular até o fim"
                >
                  <SkipForward size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="md:hidden flex border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <button
          onClick={() => setMobileView("map")}
          className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${mobileView === "map" ? "text-white border-b-2 border-blue-500 bg-gray-800" : "text-gray-500"}`}
        >
          <MapIcon size={14} /> Estratégia
        </button>
        <button
          onClick={() => setMobileView("standings")}
          className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${mobileView === "standings" ? "text-white border-b-2 border-blue-500 bg-gray-800" : "text-gray-500"}`}
        >
          <List size={14} /> Classificação
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        <div className={`w-full md:w-1/2 flex flex-col border-r border-gray-800 bg-gray-950 overflow-y-auto custom-scrollbar ${mobileView === "map" ? "flex" : "hidden md:flex"}`}>
          <div className="min-h-[220px] md:min-h-[260px] flex-1 bg-black/40 p-2 md:p-4 flex items-center justify-center relative touch-none">
            <TrackMap
              cars={raceState.grid}
              track={raceState.track}
              viewClass={viewClass}
              night={night}
              neutral={neutral?.type}
              playerColor={game.playerTeam.color}
              selectedId={twoCars ? player?.entryId : null}
            />
            {!running && !finished && raceState.elapsed === 0 && (
              <button
                onClick={() => setRunning(true)}
                className="absolute inset-x-4 bottom-4 bg-black/80 border border-green-600 rounded-xl p-3 text-center hover:bg-black/90 animate-in fade-in"
              >
                <div className="text-xs text-green-400 font-bold uppercase">Pronto para a largada</div>
                <div className="text-lg font-black italic flex items-center justify-center gap-2">
                  <Play size={18} /> Dar a largada (ou aperte Espaço)
                </div>
              </button>
            )}
            {finished && player && (
              <div className="absolute inset-x-4 bottom-4 bg-black/80 border border-green-600 rounded-xl p-3 text-center animate-in fade-in zoom-in-95">
                <div className="text-xs text-green-400 font-bold uppercase">Bandeira quadriculada</div>
                {players.map(car => (
                  <div className={`${players.length > 2 ? "text-sm md:text-base" : twoCars ? "text-lg" : "text-2xl"} font-black italic`} key={car.entryId}>
                    {twoCars ? `#${car.number} · ` : ""}
                    {car.status === "DNF" ? `Abandono: ${car.dnfReason}` : `P${car.classPosition} na classe${twoCars ? ` ${classLabel(car.class)}` : ""}`}
                  </div>
                ))}
              </div>
            )}
          </div>
          {player && est && (
            <div className="bg-gray-900 border-t border-gray-800 p-3 md:p-4 pb-6 md:pb-4 shadow-[0_-5px_15px_rgba(0,0,0,0.3)] z-10 space-y-3">
              {twoCars && <CarSelector players={players} selectedId={player.entryId} onSelect={setSelectedId} radio={raceState.radio} elapsed={raceState.elapsed} />}
              <PlayerPanel car={player} raceState={raceState} est={est} />
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["CONSERVE", Shield, "POUPAR", "bg-green-600 border-green-500"],
                  ["BALANCED", Target, "NORMAL", "bg-blue-600 border-blue-500"],
                  ["ATTACK", Zap, "ATAQUE", "bg-red-600 border-red-500"]
                ].map(([id, Icon, label, activeClass]) => (
                  <button
                    key={id}
                    onClick={() => changeStrategy(id, player.entryId)}
                    className={`py-2 rounded flex flex-col items-center justify-center gap-0.5 border ${player.strategy === id ? `${activeClass} text-white` : "bg-gray-800 border-gray-700 text-gray-400"}`}
                    title={`Ritmo ${Math.round((STRATEGIES[id].pace - 1) * 100)}% · consumo x${STRATEGIES[id].fuel} · pneus x${STRATEGIES[id].tyre}`}
                  >
                    <Icon size={16} />
                    <span className="text-[9px] font-bold">{label}</span>
                  </button>
                ))}
              </div>
              <PitPlanner
                car={player}
                raceState={raceState}
                plan={plan}
                setPlan={setPlan}
                autoStrategy={player.autoStrategy}
                onAuto={enabled => toggleAutoStrategy(enabled, player.entryId)}
                onRequest={() => requestPit(plan, player.entryId)}
                onCancel={() => cancelPit(player.entryId)}
              />
              {!finished &&
                pairClasses.map(cls => {
                  const pair = players.filter(car => car.class === cls);
                  const orders = raceState.teamOrders?.[cls] || "FREE";
                  return (
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 space-y-1.5" key={cls}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1.5">
                          Ordens de equipe
                          <span className={`text-[8px] font-black px-1 py-0.5 rounded ${cls === "HYPERCAR" ? "bg-red-900 text-red-200" : "bg-yellow-900 text-yellow-200"}`}>{classLabel(cls)}</span>
                          <span className="text-gray-400 font-mono normal-case">{pair.map(car => `#${car.number}`).join(" · ")}</span>
                        </span>
                        <div className="flex bg-gray-900 rounded p-0.5 border border-gray-700">
                          {Object.values(TEAM_ORDERS).map(order => (
                            <button
                              key={order.id}
                              onClick={() => changeTeamOrders(cls, order.id)}
                              title={order.description}
                              className={`px-2 py-1 text-[10px] font-bold rounded ${orders === order.id ? (order.id === "HOLD" ? "bg-orange-600 text-white" : "bg-blue-600 text-white") : "text-gray-400"}`}
                            >
                              {order.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => swapCars(cls)}
                        disabled={!canSwapTeamCars(raceState, cls)}
                        className="w-full py-1.5 rounded border text-[10px] font-bold uppercase flex items-center justify-center gap-1 bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-40"
                        title="O carro da frente abre passagem (os dois precisam estar juntos na pista)"
                      >
                        <Repeat size={12} /> Inverter posições
                      </button>
                    </div>
                  );
                })}
              <div>
                <div className="flex gap-3 mb-1 border-b border-gray-800 items-end">
                  {[
                    ["radio", "Rádio", Radio],
                    ["events", "Corrida", Flag],
                    ["all", "Tudo", Funnel]
                  ].map(([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => setFeedTab(id)}
                      className={`pb-1 text-[10px] font-bold uppercase flex items-center gap-1 border-b-2 ${feedTab === id ? "border-blue-500 text-white" : "border-transparent text-gray-500"}`}
                    >
                      <Icon size={11} /> {label}
                    </button>
                  ))}
                  {twoCars && feedTab === "radio" && (
                    <div className="ml-auto flex gap-1 pb-1">
                      {[["ALL", "Todos"], ...players.map(car => [car.entryId, `#${car.number}`])].map(([id, label]) => (
                        <button
                          key={id}
                          onClick={() => setRadioFilter(id)}
                          className={`px-1.5 text-[9px] font-bold rounded ${radioFilter === id ? "bg-blue-600 text-white" : "text-gray-500 hover:text-white"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-full bg-black/40 rounded p-2 h-24 md:h-28 overflow-y-auto text-[10px] font-mono space-y-1 custom-scrollbar border border-gray-800">
                  {feedTab === "radio"
                    ? radio.length === 0
                      ? <p className="text-gray-600">Rádio em silêncio. O engenheiro avisa sobre combustível, pneus, chuva e fadiga.</p>
                      : radio.map((message, index) => (
                          <div className={`border-l-2 pl-2 leading-tight ${RADIO_TONES[message.tone] || RADIO_TONES.info}`} key={`${message.t}-${index}`}>
                            <span className="text-gray-500">V{message.lap} </span>
                            {message.text}
                          </div>
                        ))
                    : events.map((event, index) => (
                        <div className="border-l-2 border-blue-500 pl-2 text-gray-400 leading-tight" key={`${event.t}-${index}`}>
                          <span className="text-gray-600">V{event.lap} </span>
                          {event.text}
                        </div>
                      ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className={`w-full md:w-1/2 overflow-y-auto bg-gray-950 ${mobileView === "standings" ? "block" : "hidden md:block"}`}>
          <div className="bg-gray-900 p-2 flex items-center justify-between border-b border-gray-800 text-xs font-bold text-gray-400 uppercase">
            <div className="flex items-center gap-2">
              <Funnel size={14} />
              <span>Classificação: {viewClass === "ALL" ? "Geral" : viewClass}</span>
            </div>
            {raceState.fastestLaps && (
              <span className="text-[10px] text-purple-300 normal-case font-mono hidden lg:inline">
                {["HYPERCAR", "LMGT3"]
                  .filter(cls => raceState.fastestLaps[cls])
                  .map(cls => `${classLabel(cls)} ${formatLapTime(toDisplayTime(raceState.fastestLaps[cls].time, raceState.track))}`)
                  .join(" · ")}
              </span>
            )}
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-900 text-[10px] font-bold text-gray-500 uppercase z-10 shadow-sm">
              <tr>
                <th className="p-2 w-8 text-center bg-gray-900">Pos</th>
                <th className="p-2 bg-gray-900">Equipe</th>
                <th className="p-2 text-center bg-gray-900">Pneus</th>
                <th className="p-2 text-center bg-gray-900 hidden lg:table-cell">Pits</th>
                <th className="p-2 text-right bg-gray-900 hidden md:table-cell">Última</th>
                <th className="p-2 text-right bg-gray-900">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900/50">
              {visibleGrid.map((car, index) => {
                const gained = car.classPosition < car.startClassPosition;
                const lost = car.classPosition > car.startClassPosition;
                return (
                  <tr className={`${car.isPlayer ? "bg-blue-900/20" : index % 2 === 0 ? "bg-gray-900/20" : ""}`} key={car.entryId}>
                    <td className="p-2 text-center font-mono text-gray-400 text-xs">
                      {viewClass === "ALL" ? car.position : car.classPosition}
                      <div className={`text-[8px] ${gained ? "text-green-500" : lost ? "text-red-500" : "text-gray-700"}`}>
                        {gained ? `▲${car.startClassPosition - car.classPosition}` : lost ? `▼${car.classPosition - car.startClassPosition}` : "•"}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <TeamStripe color={car.color} />
                        <span className={`text-[8px] font-black px-1 py-0.5 rounded ${car.class === "HYPERCAR" ? "bg-red-900 text-red-200" : "bg-yellow-900 text-yellow-200"}`}>
                          {classLabel(car.class)}
                        </span>
                        <div className="min-w-0">
                          <div className={`font-bold text-xs md:text-sm truncate max-w-[110px] md:max-w-[180px] ${car.isPlayer ? "text-blue-400" : "text-gray-200"}`}>
                            <span className="text-gray-500 font-mono text-[10px] mr-1">#{car.number}</span>
                            {car.teamName}
                          </div>
                          <div className="text-[9px] text-gray-500 truncate">
                            {shortName(car.drivers[car.currentDriverIdx].name)}
                            {car.damage > 0 && car.status !== "DNF" && <span className="text-orange-400"> · dano {Math.round(car.damage)}%</span>}
                            {car.heldUp && <span className="text-yellow-500"> · na briga</span>}
                          </div>
                        </div>
                        {car.isPlayer && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <TyreBadge compound={car.tyreCompound} />
                      <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden mt-1 max-w-[40px] mx-auto">
                        <div className={`h-full ${car.tyreWear < 30 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${Math.max(0, car.tyreWear)}%` }} />
                      </div>
                    </td>
                    <td className="p-2 text-center text-xs text-gray-500 font-mono hidden lg:table-cell">{car.pitStops}</td>
                    <td className="p-2 text-right text-[11px] font-mono text-gray-400 hidden md:table-cell">{formatLapTime(toDisplayTime(car.lastLap, raceState.track))}</td>
                    <td className="p-2 text-right font-mono text-xs md:text-sm">
                      <span
                        className={
                          car.status === "PIT"
                            ? "text-yellow-500 animate-pulse font-bold"
                            : car.status === "DNF"
                              ? "text-red-600 font-black"
                              : car.finished
                                ? "text-green-400"
                                : index === 0
                                  ? "text-green-500"
                                  : "text-gray-400"
                        }
                      >
                        {car.finished && index === 0 ? "🏁" : gapText(car, reference, raceState.elapsed)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {raceState.grid.some(car => car.status === "DNF") && (
            <div className="p-3 text-[10px] text-gray-500 flex items-center gap-1.5">
              <TriangleAlert size={12} /> Abandonos: {raceState.grid.filter(car => car.status === "DNF").map(car => `${car.teamName} #${car.number} (${car.dnfReason})`).join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RaceScreen;
