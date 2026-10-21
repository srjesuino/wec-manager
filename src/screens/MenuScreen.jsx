import { useState } from "react";
import { Check, ChevronRight, CircleHelp, CirclePlay, Flag, Gauge, Scale, Timer, Trophy, Upload, X, Zap } from "lucide-react";
import { CLASSES, CLASS_RULES, DIFFICULTIES, GAME_VERSION, PLAYER_COLORS, SERIES_CONFIG } from "../data/constants";
import { formatMoney } from "../utils/helpers";
import { DEFAULT_PLAYER_NUMBERS, START_SEASON } from "../engine/newGame";
import { teamScoringText } from "../engine/team";
import { programStartBudget } from "../engine/economy";

// Quantidades de carro por classe (Hypercar 0–2; LMGT3 sempre 0 ou 2)
const CAR_OPTIONS = { HYPERCAR: [0, 1, 2], LMGT3: [0, 2] };

// Segunda etapa da nova carreira: carros por classe, identidade da equipe, dificuldade e BoP
const NewCareerModal = ({ series, teamName, onCancel, onStart }) => {
  const [color, setColor] = useState(PLAYER_COLORS[0]);
  const [difficulty, setDifficulty] = useState("NORMAL");
  const [bopEnabled, setBopEnabled] = useState(true);
  const [cars, setCars] = useState(() => (series === "LMGT3" ? { HYPERCAR: 0, LMGT3: 2 } : { HYPERCAR: 1, LMGT3: 0 }));
  const [numbers, setNumbers] = useState(() => ({ HYPERCAR: [...DEFAULT_PLAYER_NUMBERS.HYPERCAR], LMGT3: [...DEFAULT_PLAYER_NUMBERS.LMGT3] }));
  const totalCars = cars.HYPERCAR + cars.LMGT3;
  const chosenNumbers = CLASSES.flatMap(cls => numbers[cls].slice(0, cars[cls]).map(value => value.trim()));
  const duplicated = chosenNumbers.some((value, i) => chosenNumbers.indexOf(value) !== i);
  const emptyNumber = chosenNumbers.some(value => !value);
  const canStart = totalCars > 0 && !duplicated && !emptyNumber;
  const startBudget = option => CLASSES.reduce((sum, cls) => sum + (cars[cls] ? programStartBudget(cls, cars[cls]) : 0), 0) * option.budgetMult;
  const setNumber = (cls, index, value) =>
    setNumbers(prev => ({ ...prev, [cls]: prev[cls].map((item, i) => (i === index ? value.replace(/\D/g, "").slice(0, 3) : item)) }));
  return (
    <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm z-50 overflow-y-auto flex items-start md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-3xl bg-gray-900 md:border border-gray-700 md:rounded-2xl shadow-2xl min-h-screen md:min-h-0 animate-in fade-in zoom-in-95 duration-300">
        <div className="p-5 md:p-6 border-b border-gray-800 flex justify-between items-start">
          <div>
            <div className="flex flex-wrap gap-1">
              {CLASSES.filter(cls => cars[cls] > 0).map(cls => (
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${cls === "HYPERCAR" ? "bg-red-600 text-white" : "bg-yellow-600 text-black"}`} key={cls}>
                  {cars[cls]}× {CLASS_RULES[cls].label}
                </span>
              ))}
            </div>
            <h2 className="text-2xl md:text-3xl font-black italic text-white mt-2">{teamName}</h2>
            <p className="text-gray-400 text-sm">Monte a equipe: carros em cada classe, identidade e o tamanho do desafio.</p>
          </div>
          <button onClick={onCancel} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-full text-white" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 md:p-6 space-y-8">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Carros da equipe</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CLASSES.map(cls => {
                const isHyper = cls === "HYPERCAR";
                return (
                  <div className={`p-4 rounded-xl border-2 ${cars[cls] > 0 ? (isHyper ? "border-red-600/60 bg-red-900/10" : "border-yellow-600/60 bg-yellow-900/10") : "border-gray-800 bg-gray-950"}`} key={cls}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-black italic text-lg text-white">{CLASS_RULES[cls].label}</span>
                      <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-700">
                        {CAR_OPTIONS[cls].map(count => (
                          <button
                            key={count}
                            onClick={() => setCars(prev => ({ ...prev, [cls]: count }))}
                            className={`px-3 py-1 text-xs font-black rounded ${cars[cls] === count ? (isHyper ? "bg-red-600 text-white" : "bg-yellow-500 text-black") : "text-gray-400 hover:text-white"}`}
                          >
                            {count === 0 ? "Fora" : `${count} carro${count > 1 ? "s" : ""}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      {isHyper ? "1 ou 2 carros." : "Na LMGT3 a equipe inscreve sempre 2 carros."} {teamScoringText(cls, START_SEASON)}
                    </p>
                    {cars[cls] > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="text-[10px] font-bold uppercase text-gray-500">Números</span>
                        {numbers[cls].slice(0, cars[cls]).map((value, index) => (
                          <input
                            key={index}
                            type="text"
                            inputMode="numeric"
                            maxLength={3}
                            value={value}
                            onChange={e => setNumber(cls, index, e.target.value)}
                            className="w-16 bg-gray-950 border border-gray-700 focus:border-blue-500 outline-none rounded-lg px-2 py-1.5 text-lg font-black italic text-center text-white"
                            aria-label={`Número do carro ${index + 1} na ${CLASS_RULES[cls].label}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {totalCars === 0 && <p className="text-xs text-red-400 mt-2">Escolha pelo menos um carro.</p>}
            {duplicated && <p className="text-xs text-red-400 mt-2">Cada carro precisa de um número diferente.</p>}
            {emptyNumber && <p className="text-xs text-red-400 mt-2">Preencha o número de todos os carros.</p>}
            <p className="text-[11px] text-gray-500 mt-2">
              Cada carro além do primeiro custa logística por corrida, mas aumenta o orçamento e a exposição para os patrocinadores. Na mesma classe os carros dividem o
              projeto: o P&D vale para os dois e custa 50% a mais.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Cor da equipe</h3>
            <div className="flex flex-wrap items-center gap-3">
              {PLAYER_COLORS.map(hex => (
                <button
                  key={hex}
                  onClick={() => setColor(hex)}
                  className={`w-10 h-10 rounded-full border-4 transition-transform active:scale-90 flex items-center justify-center ${color === hex ? "border-white scale-110" : "border-gray-800"}`}
                  style={{ backgroundColor: hex }}
                  aria-label={`Cor ${hex}`}
                >
                  {color === hex && <Check size={16} className={hex === "#f8fafc" || hex === "#eab308" ? "text-black" : "text-white"} />}
                </button>
              ))}
              <div className="flex gap-1 ml-2">
                {chosenNumbers.map((value, i) => (
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center text-base font-black italic text-black shadow-lg" style={{ backgroundColor: color }} key={i}>
                    {value || "?"}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Dificuldade</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.values(DIFFICULTIES).map(option => (
                <button
                  key={option.id}
                  onClick={() => setDifficulty(option.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${difficulty === option.id ? "border-blue-500 bg-blue-900/20" : "border-gray-800 bg-gray-950 hover:border-gray-600"}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black italic text-lg text-white">{option.label}</span>
                    {difficulty === option.id && <Check size={18} className="text-blue-400" />}
                  </div>
                  <p className="text-xs text-gray-400 leading-snug mb-3">{option.description}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase text-gray-500">
                    <span>Carro {option.startCar}</span>
                    <span>{formatMoney(startBudget(option))}</span>
                    <span>{option.boardCuts ? "Conselho pode cortar carros" : "Sem cortes do conselho"}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setBopEnabled(!bopEnabled)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-colors ${bopEnabled ? "border-green-600/60 bg-green-900/10" : "border-gray-800 bg-gray-950"}`}
          >
            <Scale size={28} className={`shrink-0 ${bopEnabled ? "text-green-400" : "text-gray-600"}`} />
            <div className="flex-1">
              <span className="font-bold text-white">Balance of Performance (BoP)</span>
              <p className="text-xs text-gray-400">
                Como no WEC real: carros acima da média da classe recebem lastro e os mais lentos ganham desempenho (até ±2% na Hypercar e ±3% na LMGT3).
              </p>
            </div>
            <span className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${bopEnabled ? "bg-green-600 text-white" : "bg-gray-800 text-gray-500"}`}>
              {bopEnabled ? "ATIVO" : "DESLIGADO"}
            </span>
          </button>
        </div>
        <div className="p-5 md:p-6 border-t border-gray-800 flex gap-3">
          <button onClick={onCancel} className="px-6 py-4 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 text-gray-300">
            Voltar
          </button>
          <button
            disabled={!canStart}
            onClick={() =>
              onStart({
                teamName,
                color,
                difficulty,
                bopEnabled,
                cars: { ...cars },
                numbers: Object.fromEntries(CLASSES.map(cls => [cls, numbers[cls].slice(0, cars[cls]).map(value => value.trim())]))
              })
            }
            className="flex-1 py-4 rounded-xl font-black text-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 active:scale-95 transition-all uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Começar carreira
          </button>
        </div>
      </div>
    </div>
  );
};

const MenuScreen = ({ initGame, importSaveFile, loadAutoSave, hasAutoSave, openHelp }) => {
  const [teamName, setTeamName] = useState("Iron Racing");
  const [pendingSeries, setPendingSeries] = useState(null);
  const handleSelectSeries = series => {
    if (teamName.trim()) {
      setPendingSeries(series);
    }
  };
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans relative overflow-hidden flex flex-col items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="z-10 w-full max-w-5xl flex flex-col items-center gap-6 md:gap-8">
        <div className="text-center space-y-2 mb-4 md:mb-8 px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Flag className="text-red-500 animate-pulse" size={24} />
            <span className="text-xs md:text-sm font-bold tracking-[0.3em] text-gray-400 uppercase">
              Motorsport Team Simulation
            </span>
          </div>
          <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 drop-shadow-2xl leading-tight">
            WEC MANAGER
          </h1>
          <p className="text-lg md:text-xl text-blue-400 font-bold italic">PRO EDITION · ENDURANCE</p>
        </div>
        <div className="flex gap-4 w-full max-w-md mb-8">
          {hasAutoSave && (
            <button
              onClick={loadAutoSave}
              className="flex-1 bg-green-700 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <CirclePlay size={20} />
              CONTINUAR
            </button>
          )}
          <label className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-95 border border-gray-700">
            <Upload size={20} />
            CARREGAR SAVE
            <input type="file" onChange={importSaveFile} accept=".json" className="hidden" />
          </label>
          <button
            onClick={openHelp}
            className="bg-gray-800 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-bold shadow-lg flex items-center justify-center border border-gray-700 active:scale-95"
            aria-label="Como jogar"
            title="Como jogar"
          >
            <CircleHelp size={20} />
          </button>
        </div>
        <div className="w-full max-w-2xl border-t border-gray-800 relative mb-8">
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-950 px-4 text-xs text-gray-500 font-bold uppercase">
            Ou comece uma nova carreira
          </span>
        </div>
        <div className="w-full max-w-md bg-gray-900/80 backdrop-blur-md border border-gray-700 p-2 rounded-full flex items-center shadow-2xl mb-8 md:mb-12 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-900 transition-all">
          <div className="bg-gray-800 rounded-full p-2 px-4 ml-1 shrink-0">
            <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase">Equipe</span>
          </div>
          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            className="bg-transparent border-none outline-none text-white px-3 md:px-4 py-2 w-full font-bold text-base md:text-lg placeholder-gray-600"
            placeholder="Nome da sua equipe..."
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full px-2 md:px-0">
          <div
            onClick={() => handleSelectSeries("HYPERCAR")}
            className="group relative h-64 md:h-80 bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-6 md:p-8 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:border-red-500/50 active:scale-95"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
              <Zap size={100} className="md:w-[140px] md:h-[140px]" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 bg-red-600 text-white text-[10px] md:text-xs font-black uppercase rounded-full">
                    Elite Class
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black italic text-white mb-2">HYPERCAR</h2>
                <p className="text-gray-400 text-xs md:text-sm max-w-[80%] md:max-w-xs">
                  O auge da tecnologia híbrida. Orçamentos milionários, pressão insana e os carros mais
                  rápidos do mundo.
                </p>
              </div>
              <div className="space-y-2 md:space-y-3 mt-2 md:mt-0">
                <div className="flex items-center gap-3 text-xs md:text-sm text-gray-300">
                  <Gauge size={16} className="text-red-500" />
                  <span>Velocidade Extrema</span>
                </div>
                <div className="flex items-center gap-3 text-xs md:text-sm text-gray-300">
                  <Trophy size={16} className="text-yellow-500" />
                  <span>Orçamento: {formatMoney(SERIES_CONFIG.HYPERCAR.budget, 0)}</span>
                </div>
                <div className="w-full bg-red-600/20 h-1 mt-2 md:mt-4 rounded-full overflow-hidden">
                  <div className="bg-red-600 h-full w-[95%]" />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase">
                  <span>Dificuldade</span>
                  <span>Muito Alta</span>
                </div>
              </div>
              <div className="absolute bottom-6 right-6 opacity-100 md:opacity-0 group-hover:opacity-100 transform translate-x-0 md:translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                <div className="bg-white text-black p-2 md:p-3 rounded-full shadow-lg">
                  <ChevronRight size={20} className="md:w-6 md:h-6" />
                </div>
              </div>
            </div>
          </div>
          <div
            onClick={() => handleSelectSeries("LMGT3")}
            className="group relative h-64 md:h-80 bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-6 md:p-8 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(234,179,8,0.3)] hover:border-yellow-500/50 active:scale-95"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
              <Timer size={100} className="md:w-[140px] md:h-[140px]" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 bg-yellow-600 text-black text-[10px] md:text-xs font-black uppercase rounded-full">
                    GT Class
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black italic text-white mb-2">LMGT3</h2>
                <p className="text-gray-400 text-xs md:text-sm max-w-[80%] md:max-w-xs">
                  A batalha das marcas lendárias. Estratégia pura, desgaste de pneus e corridas porta a porta.
                </p>
              </div>
              <div className="space-y-2 md:space-y-3 mt-2 md:mt-0">
                <div className="flex items-center gap-3 text-xs md:text-sm text-gray-300">
                  <Gauge size={16} className="text-yellow-500" />
                  <span>Competição Acirrada</span>
                </div>
                <div className="flex items-center gap-3 text-xs md:text-sm text-gray-300">
                  <Trophy size={16} className="text-yellow-500" />
                  <span>Orçamento (2 carros): {formatMoney(programStartBudget("LMGT3", 2), 0)}</span>
                </div>
                <div className="w-full bg-yellow-600/20 h-1 mt-2 md:mt-4 rounded-full overflow-hidden">
                  <div className="bg-yellow-600 h-full w-[60%]" />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase">
                  <span>Dificuldade</span>
                  <span>Média</span>
                </div>
              </div>
              <div className="absolute bottom-6 right-6 opacity-100 md:opacity-0 group-hover:opacity-100 transform translate-x-0 md:translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                <div className="bg-white text-black p-2 md:p-3 rounded-full shadow-lg">
                  <ChevronRight size={20} className="md:w-6 md:h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-gray-600 text-[10px] md:text-xs mt-4 md:mt-8">
          Versão {GAME_VERSION} • Desenvolvido com React & Vite
        </p>
      </div>
      {pendingSeries && (
        <NewCareerModal series={pendingSeries} teamName={teamName.trim()} onCancel={() => setPendingSeries(null)} onStart={initGame} />
      )}
    </div>
  );
};
export default MenuScreen;
