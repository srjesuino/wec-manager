import { useState } from "react";
import { Settings, Trash2, X } from "lucide-react";
import { DIFFICULTIES, GAME_VERSION } from "../../data/constants";

const SettingsModal = ({ settings, career, onChange, onReset, onMenu, onClose }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="fixed inset-0 bg-gray-950/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={event => event.stopPropagation()}>
        <div className="p-5 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-black italic flex items-center gap-2">
            <Settings size={20} className="text-gray-400" /> Configurações
          </h2>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-800 hover:bg-gray-700" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Velocidade inicial da corrida</h3>
            <div className="flex gap-2">
              {[1, 2, 5, 10].map(speed => (
                <button
                  key={speed}
                  onClick={() => onChange({ raceSpeed: speed })}
                  className={`flex-1 py-2 rounded-lg font-bold border ${settings.raceSpeed === speed ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-950 border-gray-700 text-gray-400"}`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => onChange({ aiNews: !settings.aiNews })} className="w-full flex items-center justify-between gap-4 text-left">
            <div>
              <h3 className="text-sm font-bold text-white">Notícias geradas por IA</h3>
              <p className="text-xs text-gray-500">Usa o backend de mídia do jogo depois de cada corrida. Se falhar, as notícias locais assumem.</p>
            </div>
            <span className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${settings.aiNews ? "bg-green-600" : "bg-gray-700"}`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${settings.aiNews ? "translate-x-5" : ""}`} />
            </span>
          </button>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <div>
              Dificuldade: <span className="text-white font-bold">{DIFFICULTIES[career.difficulty]?.label}</span>
            </div>
            <div>
              Balance of Performance: <span className="text-white font-bold">{career.bopEnabled === false ? "desligado" : "ativo"}</span>
            </div>
            <div>Versão {GAME_VERSION}</div>
          </div>
          <button onClick={onMenu} className="w-full py-3 rounded-lg font-bold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700">
            Voltar ao menu principal (o jogo fica salvo)
          </button>
          <button
            onClick={() => (confirmReset ? onReset() : setConfirmReset(true))}
            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 border ${confirmReset ? "bg-red-700 border-red-500 text-white" : "bg-gray-950 border-red-900/60 text-red-400 hover:bg-red-900/20"}`}
          >
            <Trash2 size={16} /> {confirmReset ? "Confirmar: apagar o save automático" : "Apagar save e voltar ao menu"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
