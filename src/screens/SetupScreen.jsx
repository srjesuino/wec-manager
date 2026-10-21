import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CircleAlert,
  CircleCheckBig,
  Copy,
  MessageSquare,
  Settings,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import { TRACK_TYPE_LABELS, CLASS_RULES } from "../data/constants";
import { setupAttempts } from "../engine/weekend";
import { playerEntries } from "../engine/team";

// Engenheiro 3+ estrelas diz o tamanho do ajuste; 4+ estrelas dá uma estimativa em pontos
const engineerDetail = (diff, stars) => {
  const absDiff = Math.abs(diff);
  if (stars < 3 || absDiff <= 5) {
    return "";
  }
  const size = absDiff > 30 ? "ajuste grande" : absDiff > 15 ? "ajuste médio" : "ajuste pequeno";
  return stars >= 4 ? ` [${size}, ~${Math.round(absDiff / 5) * 5} pts ${diff > 0 ? "a menos" : "a mais"}]` : ` [${size}]`;
};

const SetupScreen = ({ game, weekend, entry, copyFrom = null, onSetupComplete }) => {
  const car = entry || playerEntries(game)[0];
  const multiCar = playerEntries(game).length > 1;
  const teamName = game.playerTeam.name;
  const trackName = weekend.track.name;
  const trackType = weekend.track.type;
  const maxAttempts = setupAttempts(game.playerTeam);
  const engineerStars = game.playerTeam.staff?.raceEngineer?.stars ?? 2;
  const getIdealSetup = type => {
    switch (type) {
      case "speed":
        return {
          aero: 20,
          susp: 80,
          gear: 80
        };
      case "technical":
        return {
          aero: 80,
          susp: 30,
          gear: 30
        };
      case "endurance":
        return {
          aero: 60,
          susp: 40,
          gear: 60
        };
      default:
        return {
          aero: 50,
          susp: 50,
          gear: 50
        };
    }
  };
  const [idealSetup, setIdealSetup] = useState({
    aero: 50,
    susp: 50,
    gear: 50
  });
  const [setup, setSetup] = useState({
    aero: 50,
    susp: 50,
    gear: 50
  });
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const logRef = useRef(null);
  useEffect(() => {
    const base = getIdealSetup(trackType);
    const randomize = value => Math.min(95, Math.max(5, value + (Math.floor(Math.random() * 30) - 15)));
    setIdealSetup({
      aero: randomize(base.aero),
      susp: randomize(base.susp),
      gear: randomize(base.gear)
    });
    setSetup({
      aero: 50,
      susp: 50,
      gear: 50
    });
  }, [trackType]);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [feedbackLog]);
  const handleChange = (key, value) => {
    setSetup(prev => ({
      ...prev,
      [key]: parseInt(value)
    }));
  };
  const consultDriver = () => {
    if (attempts >= maxAttempts) {
      return;
    }
    setAttempts(prev => prev + 1);
    const aeroDiff = setup.aero - idealSetup.aero;
    const suspDiff = setup.susp - idealSetup.susp;
    const gearDiff = setup.gear - idealSetup.gear;
    const messages = [];
    const getFeedback = (diff, label) => {
      const absDiff = Math.abs(diff);
      if (absDiff <= 5) {
        return {
          text: `${label}: Excelente! No ponto ideal.`,
          type: "perfect"
        };
      }
      if (absDiff <= 15) {
        return {
          text: `${label}: Estamos perto, só ajuste fino.`,
          type: "good"
        };
      }
      if (label === "Aerodinâmica") {
        if (diff > 0) {
          return {
            text: "Muita asa! O carro está uma parede nas retas.",
            type: "bad"
          };
        } else {
          return {
            text: "Falta asa! O carro não segura nas curvas rápidas.",
            type: "bad"
          };
        }
      }
      if (label === "Suspensão") {
        if (diff > 0) {
          return {
            text: "Suspensão muito dura! O carro quica demais.",
            type: "bad"
          };
        } else {
          return {
            text: "Suspensão muito mole! O carro está 'navegando'.",
            type: "bad"
          };
        }
      }
      if (label === "Câmbio") {
        if (diff > 0) {
          return {
            text: "Marchas muito longas! O motor morre na saída.",
            type: "bad"
          };
        } else {
          return {
            text: "Marchas muito curtas! Cortando giro na reta.",
            type: "bad"
          };
        }
      }
    };
    [
      [aeroDiff, "Aerodinâmica"],
      [suspDiff, "Suspensão"],
      [gearDiff, "Câmbio"]
    ].forEach(([diff, label]) => {
      const feedback = getFeedback(diff, label);
      messages.push({ ...feedback, text: feedback.text + engineerDetail(diff, engineerStars) });
    });
    setFeedbackLog(prev => [
      ...prev,
      {
        id: Date.now(),
        msgs: messages,
        round: attempts + 1
      }
    ]);
  };
  const confirmSetup = () => {
    setIsConfirming(true);
    const aeroError = Math.abs(setup.aero - idealSetup.aero);
    const suspError = Math.abs(setup.susp - idealSetup.susp);
    const gearError = Math.abs(setup.gear - idealSetup.gear);
    const averageError = (aeroError + suspError + gearError) / 3;
    const score = Math.max(0, 100 - averageError * 2);
    setTimeout(() => {
      onSetupComplete(score);
    }, 1500);
  };
  const attemptsLeft = maxAttempts - attempts;
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row font-sans overflow-hidden">
      <div className="w-full md:w-1/2 p-6 flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-800 bg-gray-900 z-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold bg-blue-900 text-blue-200 px-2 py-1 rounded uppercase">
              {TRACK_TYPE_LABELS[trackType] || trackType}
            </span>
            <span className="text-xs font-bold text-gray-500 uppercase">{teamName}</span>
            {multiCar && (
              <span className={`text-xs font-black px-2 py-1 rounded ${car.class === "HYPERCAR" ? "bg-red-900 text-red-200" : "bg-yellow-900 text-yellow-200"}`}>
                Carro #{car.number} · {CLASS_RULES[car.class]?.label ?? car.class}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-black italic text-white uppercase flex items-center gap-2">
            <Settings className="text-blue-500" size={32} /> SETUP BOX
          </h1>
          <p className="text-gray-400 text-sm mt-1">Ajuste o carro para {trackName}.</p>
        </div>
        <div className="space-y-8 bg-black/20 p-6 rounded-xl border border-gray-800">
          <div>
            <div className="flex justify-between mb-2 text-sm font-bold">
              <span className="text-cyan-400">AERODINÂMICA</span>
              <span className="text-gray-500">{setup.aero}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={setup.aero}
              onChange={e => handleChange("aero", e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 uppercase font-bold">
              <span>Baixo Arrasto</span>
              <span>Alta Carga</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2 text-sm font-bold">
              <span className="text-green-400">SUSPENSÃO</span>
              <span className="text-gray-500">{setup.susp}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={setup.susp}
              onChange={e => handleChange("susp", e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 uppercase font-bold">
              <span>Macia</span>
              <span>Rígida</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2 text-sm font-bold">
              <span className="text-red-400">CÂMBIO</span>
              <span className="text-gray-500">{setup.gear}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={setup.gear}
              onChange={e => handleChange("gear", e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 uppercase font-bold">
              <span>Curto (Aceleração)</span>
              <span>Longo (Velocidade)</span>
            </div>
          </div>
        </div>
        <div className="mt-8 flex gap-4">
          <button
            onClick={consultDriver}
            disabled={isConfirming || attemptsLeft <= 0}
            className={`flex-1 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border ${attemptsLeft <= 0 ? "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed" : "bg-gray-800 hover:bg-gray-700 text-white border-gray-600"}`}
          >
            <MessageSquare size={18} />
            {attemptsLeft <= 0 ? "SEM TENTATIVAS" : "CONSULTAR PILOTO"}
          </button>
          {copyFrom && (
            <button
              onClick={() => onSetupComplete(copyFrom.score)}
              disabled={isConfirming}
              title="Usa os dados do carro irmão: rápido, mas menos preciso que um acerto próprio."
              className="flex-1 font-bold py-4 rounded-xl flex flex-col items-center justify-center transition-all active:scale-95 border bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
            >
              <span className="flex items-center gap-2">
                <Copy size={18} /> Usar dados do #{copyFrom.number} (~{Math.round(copyFrom.score)}%)
              </span>
              <span className="text-[10px] text-gray-400 font-normal">Dados do carro irmão, menos precisos</span>
            </button>
          )}
          <button
            onClick={confirmSetup}
            disabled={isConfirming}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
          >
            {isConfirming ? <Activity className="animate-spin" /> : <CircleCheckBig size={18} />}
            {isConfirming ? "CALCULANDO..." : "CONFIRMAR SETUP"}
          </button>
        </div>
      </div>
      <div className="w-full md:w-1/2 bg-gray-950 flex flex-col h-[50vh] md:h-auto relative">
        <div className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10 flex justify-between items-center">
          <h3 className="font-bold text-gray-300 flex items-center gap-2">
            <Activity size={18} className="text-yellow-500" /> FEEDBACK
          </h3>
          <span
            className={`text-xs font-mono font-bold px-2 py-1 rounded ${attemptsLeft === 0 ? "bg-red-900 text-red-200" : "bg-gray-800 text-gray-400"}`}
          >
            Tentativas: {attempts} / {maxAttempts}
          </span>
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth custom-scrollbar">
          {feedbackLog.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
              <Settings size={48} className="mb-4" />
              <p className="text-sm text-center max-w-xs">
                Ajuste os valores na esquerda e clique em "Consultar Piloto". Você tem {maxAttempts} chances.{engineerStars >= 3 ? " Seu engenheiro indica o tamanho de cada ajuste." : ""}
              </p>
            </div>
          )}
          {feedbackLog.map(entry => (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" key={entry.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Ajuste #{entry.round}
                </span>
                <div className="h-px bg-gray-800 flex-1" />
              </div>
              <div className="space-y-2">
                {entry.msgs.map((msg, index) => (
                  <div
                    className={`p-3 rounded-lg border-l-4 text-sm font-medium shadow-sm flex items-start gap-3 ${msg.type === "perfect" ? "bg-purple-900/10 border-purple-500 text-purple-200" : msg.type === "good" ? "bg-green-900/10 border-green-500 text-green-200" : "bg-red-900/10 border-red-500 text-red-200"}`}
                    key={index}
                  >
                    <div className="mt-0.5">
                      {msg.type === "perfect" ? (
                        <ThumbsUp size={14} />
                      ) : msg.type === "good" ? (
                        <ArrowRight size={14} />
                      ) : (
                        <ThumbsDown size={14} />
                      )}
                    </div>
                    {msg.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {attempts >= maxAttempts && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-center animate-in fade-in">
              <CircleAlert className="mx-auto text-yellow-500 mb-2" size={24} />
              <p className="text-gray-300 text-sm font-bold">Sessão de testes encerrada.</p>
              <p className="text-gray-500 text-xs">Confirme o setup atual para ir para a qualificação.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SetupScreen;
