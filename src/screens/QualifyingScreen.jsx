import { Fragment, useEffect, useRef, useState } from "react";
import { CirclePlay, CloudRain, Crown, Timer, Zap } from "lucide-react";
import { TYRES, TYRE_ORDER } from "../data/constants";
import { formatLapTime } from "../utils/helpers";
import { qualifyingBarFactor } from "../engine/weekend";
import { TeamStripe } from "../components/ui/common";

const SECTOR_STYLES = {
  purple: { border: "border-purple-500", bg: "bg-purple-900/20", text: "text-purple-400", short: "PUR" },
  green: { border: "border-green-500", bg: "bg-green-900/20", text: "text-green-400", short: "GRN" },
  yellow: { border: "border-yellow-500", bg: "bg-yellow-900/20", text: "text-yellow-400", short: "YEL" },
  red: { border: "border-red-500", bg: "bg-red-900/20", text: "text-red-400", short: "RED" }
};

// Minigame: travar a barra na zona roxa em cada um dos 3 setores
const QualifyingGame = ({ teamName, trackName, barFactor, onComplete }) => {
  const [sector, setSector] = useState(1);
  const [phase, setPhase] = useState("waiting");
  const [barPosition, setBarPosition] = useState(0);
  const [results, setResults] = useState([]);
  const positionRef = useRef(0);
  const directionRef = useRef(1);
  const frameRef = useRef();
  const lastTimeRef = useRef(0);
  // % da barra por segundo (antes dependia da taxa de quadros do monitor)
  const speed = (1.5 + sector * 0.3) * 60 * barFactor;

  useEffect(() => {
    if (phase !== "running") {
      return undefined;
    }
    lastTimeRef.current = performance.now();
    const animate = now => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      let next = positionRef.current + speed * directionRef.current * dt;
      if (next >= 100) {
        next = 100;
        directionRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        directionRef.current = 1;
      }
      positionRef.current = next;
      setBarPosition(next);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, speed]);

  const startLap = () => {
    if (phase !== "waiting") {
      return;
    }
    positionRef.current = 0;
    directionRef.current = 1;
    setBarPosition(0);
    setPhase("running");
  };

  const lockSector = () => {
    if (phase !== "running") {
      return;
    }
    const distanceFromCenter = Math.abs(50 - positionRef.current);
    let result;
    if (distanceFromCenter < 3) {
      result = { score: 100, color: "purple", text: "PERFEITO" };
    } else if (distanceFromCenter < 10) {
      result = { score: 80, color: "green", text: "BOM" };
    } else if (distanceFromCenter < 20) {
      result = { score: 50, color: "yellow", text: "MÉDIO" };
    } else {
      result = { score: 20, color: "red", text: "ERRO" };
    }
    const newResults = [...results, { ...result, sector }];
    setResults(newResults);
    if (sector < 3) {
      setPhase("locked");
      setTimeout(() => {
        setSector(prev => prev + 1);
        setPhase("waiting");
      }, 1200);
    } else {
      setPhase("done");
      setTimeout(() => {
        onComplete(newResults.reduce((acc, item) => acc + item.score, 0) / 3);
      }, 1500);
    }
  };

  useEffect(() => {
    const onKey = event => {
      if (event.code !== "Space" && event.code !== "Enter") {
        return;
      }
      event.preventDefault();
      if (phase === "running") {
        lockSector();
      } else if (phase === "waiting") {
        startLap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const last = results[results.length - 1];
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden touch-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black z-0" />
      <div className="z-10 max-w-2xl w-full flex flex-col items-center">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-xs md:text-sm font-bold text-gray-500 tracking-widest uppercase mb-1">{teamName}</h2>
          <h1 className="text-2xl md:text-4xl font-black italic text-white uppercase">{trackName}</h1>
          <div className="text-xs text-blue-400 font-bold mt-1 uppercase tracking-widest">Sessão de Qualificação</div>
        </div>
        <div className="flex gap-2 md:gap-4 mb-8 md:mb-12 w-full justify-center">
          {[1, 2, 3].map(sectorNumber => {
            const result = results.find(item => item.sector === sectorNumber);
            const style = result ? SECTOR_STYLES[result.color] : null;
            const current = sectorNumber === sector && !result;
            return (
              <div
                className={`flex-1 max-w-[100px] h-20 md:h-24 rounded-lg md:rounded-xl border-2 ${style ? `${style.border} ${style.bg}` : current ? "border-white bg-gray-800" : "border-gray-800 bg-gray-900"} flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden`}
                key={sectorNumber}
              >
                <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase z-10">S{sectorNumber}</span>
                {result ? (
                  <span className={`text-xl md:text-2xl font-black z-10 ${style.text}`}>{style.short}</span>
                ) : (
                  current && <Zap size={20} className="text-white animate-pulse mt-1" />
                )}
              </div>
            );
          })}
        </div>
        <div className="bg-gray-900 border border-gray-700 p-4 md:p-8 rounded-2xl shadow-2xl relative w-full">
          <div className="mb-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Timer className="text-blue-400" size={20} />
              <span className="font-mono font-bold text-lg md:text-xl text-blue-100">{phase === "running" ? "EM VOLTA..." : "AGUARDANDO..."}</span>
            </div>
            {last && phase !== "running" && <span className={`font-bold animate-bounce text-sm md:text-base ${SECTOR_STYLES[last.color].text}`}>{last.text}</span>}
          </div>
          <div className="h-12 md:h-16 bg-gray-950 rounded-lg border border-gray-600 relative overflow-hidden mb-8">
            <Fragment>
              <div className="absolute top-0 bottom-0 left-[30%] right-[30%] bg-yellow-900/30 border-l border-r border-yellow-700" />
              <div className="absolute top-0 bottom-0 left-[40%] right-[40%] bg-green-900/40 border-l border-r border-green-600" />
              <div className="absolute top-0 bottom-0 left-[47%] right-[47%] bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)] z-10" />
            </Fragment>
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-20 will-change-transform"
              style={{
                left: `${barPosition}%`
              }}
            >
              <div className="absolute -top-1 -left-1.5 w-4 h-4 bg-white rotate-45" />
              <div className="absolute -bottom-1 -left-1.5 w-4 h-4 bg-white rotate-45" />
            </div>
          </div>
          <div className="text-center">
            {phase === "running" ? (
              <button
                key="lock"
                onPointerDown={event => {
                  event.preventDefault();
                  lockSector();
                }}
                className="w-full h-24 md:h-20 bg-red-600 active:bg-red-700 text-white font-black text-2xl md:text-xl rounded-xl shadow-lg shadow-red-900/30 transition-all uppercase tracking-wider active:scale-95 flex items-center justify-center border-b-4 border-red-800 active:border-b-0 active:mt-1"
              >
                TRAVAR!
              </button>
            ) : phase === "done" ? (
              <div className="text-green-400 font-bold text-xl animate-pulse py-4">CALCULANDO GRID...</div>
            ) : (
              <button
                key="start"
                disabled={phase !== "waiting"}
                onClick={startLap}
                className="w-full py-4 md:py-5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-black text-lg md:text-xl rounded-xl shadow-lg shadow-blue-900/30 transition-all uppercase tracking-wider active:scale-95"
              >
                {phase === "locked" ? "PRÓXIMO SETOR..." : sector === 1 ? "INICIAR VOLTA" : `INICIAR SETOR ${sector}`}
              </button>
            )}
          </div>
          <div className="mt-4 text-center text-[10px] md:text-xs text-gray-500">
            Toque em "TRAVAR" (ou aperte Espaço) quando a barra estiver na zona roxa central.
          </div>
        </div>
      </div>
    </div>
  );
};

const TYRE_HINTS = {
  SOFT: "Mais rápido, desgasta 40% mais",
  MEDIUM: "Equilíbrio entre ritmo e duração",
  HARD: "Mais lento, dura bem mais",
  WET: "Obrigatório na chuva; derrete no seco"
};

// Grid de largada + escolha do pneu inicial
const QualifyingResults = ({ game, weekend, onStartRace }) => {
  const player = game.playerTeam;
  const [view, setView] = useState(player.class);
  const [tyre, setTyre] = useState(weekend.startTyre);
  const mine = weekend.qualifying.find(entry => entry.isPlayer);
  const rows = weekend.qualifying.filter(entry => entry.class === view);
  const wet = weekend.startWetness > 30;
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Resultado da Classificação · {weekend.track.name}</p>
          <h1 className="text-4xl md:text-6xl font-black italic mt-2">
            P{mine.classPosition} <span className="text-lg md:text-2xl text-gray-500 not-italic font-bold">na classe · P{mine.position} geral</span>
          </h1>
          {mine.pole && (
            <div className="inline-flex items-center gap-2 mt-3 bg-purple-600 text-white font-black px-4 py-2 rounded-full shadow-lg shadow-purple-900/40 animate-in zoom-in duration-500">
              <Crown size={18} /> POLE POSITION! +1 ponto no campeonato
            </div>
          )}
          <p className="text-sm text-gray-400 mt-2">
            Setup {weekend.setupScore.toFixed(0)}% · Volta {weekend.qualyScore.toFixed(0)}% · Melhor volta {formatLapTime(mine.lapTime)} com {mine.driver}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase text-gray-300">Grid de largada</h3>
              <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800">
                {["HYPERCAR", "LMGT3"].map(cls => (
                  <button
                    key={cls}
                    onClick={() => setView(cls)}
                    className={`px-3 py-1 text-xs font-bold rounded ${view === cls ? (cls === "HYPERCAR" ? "bg-red-600 text-white" : "bg-yellow-600 text-black") : "text-gray-400"}`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[55vh] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase text-gray-500 bg-gray-950 sticky top-0">
                  <tr>
                    <th className="p-2 text-center w-10">Pos</th>
                    <th className="p-2">Equipe</th>
                    <th className="p-2 hidden md:table-cell">Piloto</th>
                    <th className="p-2 text-right">Tempo</th>
                    <th className="p-2 text-right">Dif.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map(entry => (
                    <tr className={entry.isPlayer ? "bg-blue-900/20" : ""} key={entry.teamId}>
                      <td className="p-2 text-center font-mono font-bold text-gray-400">{entry.classPosition}</td>
                      <td className="p-2">
                        <span className="flex items-center gap-2">
                          <TeamStripe color={entry.color} />
                          <span className="text-[10px] font-mono text-gray-500">#{entry.number}</span>
                          <span className={`font-bold ${entry.isPlayer ? "text-blue-300" : "text-gray-200"}`}>{entry.teamName}</span>
                          {entry.pole && <Crown size={12} className="text-purple-400" />}
                        </span>
                      </td>
                      <td className="p-2 text-gray-400 hidden md:table-cell">{entry.driver}</td>
                      <td className="p-2 text-right font-mono">{formatLapTime(entry.lapTime)}</td>
                      <td className="p-2 text-right font-mono text-gray-500">{entry.pole ? "—" : `+${entry.gap.toFixed(3)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-sm uppercase text-gray-300">Pneu de largada</h3>
              {wet ? (
                <p className="text-xs text-blue-300 flex items-center gap-1 mt-1">
                  <CloudRain size={12} /> Pista molhada na largada: pneus de chuva recomendados.
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">A troca acontece nos pit stops. Pneus duram mais que um tanque se você poupar.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TYRE_ORDER.map(id => {
                const info = TYRES[id];
                return (
                  <button
                    key={id}
                    onClick={() => setTyre(id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${tyre === id ? "bg-gray-800" : "border-gray-800 bg-gray-950 hover:border-gray-600"}`}
                    style={tyre === id ? { borderColor: info.color } : undefined}
                  >
                    <div className="flex items-center gap-2 font-black" style={{ color: info.color }}>
                      <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] text-white" style={{ borderColor: info.color }}>
                        {info.short}
                      </span>
                      {info.label}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 leading-tight">{TYRE_HINTS[id]}</p>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => onStartRace(tyre)}
              className="mt-auto w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg shadow-green-900/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <CirclePlay size={22} /> Ir para a largada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const QualifyingScreen = ({ game, weekend, onQualyComplete, onStartRace }) => {
  if (weekend.qualifying) {
    return <QualifyingResults game={game} weekend={weekend} onStartRace={onStartRace} />;
  }
  return (
    <QualifyingGame
      teamName={game.playerTeam.name}
      trackName={weekend.track.name}
      barFactor={qualifyingBarFactor(game.playerTeam)}
      onComplete={onQualyComplete}
    />
  );
};

export default QualifyingScreen;
