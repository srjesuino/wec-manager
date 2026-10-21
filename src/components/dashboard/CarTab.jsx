import { Flag, Info, Lock, Scale, Settings, Sparkles, Stamp, Timer, Users, Wrench, Zap } from "lucide-react";
import { Fragment, useState } from "react";
import { PART_INFO, TRACKS, HOMOLOGATION, CLASS_RULES } from "../../data/constants";
import { formatMoney } from "../../utils/helpers";
import { CAR_PARTS, PART_CAP, facilityDiscount, bonusUpgradeChance, usesToken } from "../../engine/economy";
import { bopFor, bopWeight } from "../../engine/weekend";
import { PLAYER_ID, playerEntries, playerClasses, classPrograms, carsInProgram, programUpgradeCost } from "../../engine/team";
import { regulationFor } from "../../engine/season";

const PART_ICONS = {
  engine: Zap,
  aero: Flag,
  chassis: Wrench,
  reliability: Settings,
  efficiency: Timer,
  crew: Users
};

const CarTab = ({ game, onBuyUpgrade }) => {
  const player = game.playerTeam;
  const classes = playerClasses(game);
  const [selectedClass, setSelectedClass] = useState(classes[0]);
  const cls = classes.includes(selectedClass) ? selectedClass : classes[0];
  const program = player.programs[cls];
  const classCars = playerEntries(game).filter(entry => entry.class === cls);
  const shared = carsInProgram(game, PLAYER_ID, cls) > 1;
  const funds = player.funds;
  const rivals = classPrograms(game, cls).filter(row => row.team.id !== PLAYER_ID);
  const best = part => (rivals.length ? Math.max(...rivals.map(row => row.program.car[part] ?? 0)) : 0);
  const avg = part => Math.round(rivals.reduce((sum, row) => sum + (row.program.car[part] ?? 0), 0) / Math.max(1, rivals.length));
  const bonus = bonusUpgradeChance(player);
  const track = TRACKS[game.raceIndex];
  const bop = track && game.career.bopEnabled !== false ? bopFor(game, PLAYER_ID, cls, track.type) : 0;
  const tokens = program.devTokens ?? 0;
  const newRegs = regulationFor(game.season).type === "RESET";
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className={`rounded-xl p-3 border flex flex-wrap items-center gap-3 ${tokens > 0 ? "bg-gray-900 border-gray-800" : "bg-red-900/20 border-red-800/60"}`}>
        <Stamp size={20} className={tokens > 0 ? "text-blue-400 shrink-0" : "text-red-400 shrink-0"} />
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-black text-white">
            Fichas de homologação{classes.length > 1 ? ` (${CLASS_RULES[cls].label})` : ""}: <span className={tokens > 0 ? "text-blue-300" : "text-red-300"}>{tokens}</span> nesta temporada
          </div>
          <p className="text-[11px] text-gray-400">
            Cada evolução de Motor, Aero, Chassi ou Eficiência usa uma ficha (Confiabilidade e equipe de pit não usam: correções de confiabilidade são liberadas pelo regulamento). Todo projeto recebe {HOMOLOGATION.base} por temporada
            ({HOMOLOGATION.newRegulation} no ano de regulamento novo){newRegs ? " — este é um ano de regulamento novo" : ""}, mais até {HOMOLOGATION.catchUpMax} extras se estiver muito atrás do
            melhor carro da classe. As fichas são do projeto, não de cada carro. A IA segue a mesma regra.
          </p>
        </div>
      </div>
      {classes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-gray-500">Programa:</span>
          {classes.map(item => (
            <button
              key={item}
              onClick={() => setSelectedClass(item)}
              className={`px-4 py-2 rounded-lg border-2 font-black text-sm flex items-center gap-2 transition-colors ${
                cls === item
                  ? item === "HYPERCAR"
                    ? "border-red-500 bg-red-900/30 text-white"
                    : "border-yellow-500 bg-yellow-900/30 text-white"
                  : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600"
              }`}
            >
              {CLASS_RULES[item].label}
            </button>
          ))}
          <span className="text-[11px] text-gray-500">Cada classe tem o próprio projeto e as próprias fichas; os custos seguem a classe.</span>
        </div>
      )}
      {shared && (
        <div className="bg-cyan-900/20 border border-cyan-700/50 rounded-xl p-3 text-sm text-cyan-200 font-bold flex items-center gap-2">
          <Sparkles size={16} className="shrink-0" /> Um projeto para os {classCars.length} carros da {CLASS_RULES[cls].label} (#{classCars.map(item => item.number).join(" e #")}): cada
          upgrade vale para todos e custa 50% a mais.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CAR_PARTS.map(part => {
          const info = PART_INFO[part];
          const Icon = PART_ICONS[part];
          const level = program.car[part] || 0;
          const cost = programUpgradeCost(game, player, cls, part);
          const canAfford = funds >= cost;
          const discount = facilityDiscount(player.facilities, part);
          const locked = usesToken(part) && tokens <= 0;
          return (
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-between h-full hover:border-gray-600 transition-colors shadow-lg" key={part}>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${info.color} bg-opacity-20 text-white`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-200 text-sm uppercase">{info.label}</h4>
                      <p className="text-[10px] text-gray-500">{info.desc}</p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-white">{level}</span>
                </div>
                <div className="relative h-2 bg-gray-900 rounded-full overflow-visible mb-1 mt-3">
                  <div className={`h-full rounded-full ${info.color}`} style={{ width: `${Math.min(100, level)}%` }} />
                  <div className="absolute -top-1 w-0.5 h-4 bg-gray-400" style={{ left: `${avg(part)}%` }} title="Média da classe" />
                  <div className="absolute -top-1 w-0.5 h-4 bg-red-400" style={{ left: `${best(part)}%` }} title="Melhor da classe" />
                </div>
                <div className="flex justify-between text-[9px] uppercase font-bold text-gray-500">
                  <span>
                    <span className="text-gray-400">▮</span> média {avg(part)}
                  </span>
                  <span>
                    <span className="text-red-400">▮</span> melhor {best(part)}
                  </span>
                </div>
              </div>
              <button
                disabled={!canAfford || level >= PART_CAP || locked}
                onClick={() => onBuyUpgrade(part, cls)}
                className={`w-full mt-4 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex justify-center items-center gap-2 ${
                  canAfford && level < PART_CAP && !locked
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600"
                }`}
              >
                {level >= PART_CAP ? (
                  "MAX"
                ) : locked ? (
                  <Fragment>
                    <Lock size={12} /> Sem fichas até a próxima temporada
                  </Fragment>
                ) : (
                  <Fragment>
                    <span>Melhorar</span>
                    <span className="font-mono opacity-80">{formatMoney(cost)}</span>
                    {discount > 0 && <span className="text-[9px] bg-green-700 text-green-100 px-1 rounded">-{Math.round(discount * 100)}%</span>}
                  </Fragment>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-3">
            <Scale size={16} className="text-green-400" /> Balance of Performance
          </h3>
          {game.career.bopEnabled === false ? (
            <p className="text-sm text-gray-400">O BoP está desligado nesta carreira: vence quem desenvolver o melhor carro.</p>
          ) : (
            <>
              <p className="text-sm text-gray-300 mb-2">
                Previsão para {track?.name}{classes.length > 1 ? ` (${CLASS_RULES[cls].label})` : ""}:{" "}
                <span className={`font-black ${bop > 0 ? "text-green-400" : bop < 0 ? "text-red-400" : "text-gray-300"}`}>
                  {bop > 0 ? "+" : ""}
                  {bop.toFixed(2)}% de desempenho ({bopWeight(bop) > 0 ? "+" : ""}
                  {bopWeight(bop)} kg)
                </span>
              </p>
              <p className="text-xs text-gray-500">
                A FIA compensa parte da diferença entre o seu carro e a média da classe, considerando o tipo de pista (Hypercar: 40% da diferença, até ±2%; LMGT3: 60%, até ±3%). Desenvolver continua valendo: o BoP nunca
                anula toda a vantagem.
              </p>
            </>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-3">
            <Info size={16} className="text-blue-400" /> Como as peças contam
          </h3>
          <ul className="text-xs text-gray-400 space-y-1.5">
            <li>
              <span className="text-white font-bold">Motor, Aero e Chassi</span> definem o ritmo; o peso de cada uma muda com o tipo de pista.
            </li>
            <li>
              <span className="text-white font-bold">Chassi</span> também reduz o desgaste dos pneus; <span className="text-white font-bold">Eficiência</span> alonga os stints.
            </li>
            <li>
              <span className="text-white font-bold">Confiabilidade</span> reduz quebras; <span className="text-white font-bold">Pit Crew</span> acelera os pit stops.
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-yellow-400" /> Diretor Técnico: {Math.round(bonus * 100)}% de chance de um upgrade render +3.
            </li>
            <li>Acima do nível 80 cada upgrade fica bem mais caro.</li>
            <li>
              Regulamento novo a cada 5 temporadas: todos ganham carro novo. A qualidade do seu conceito depende do Diretor Técnico, do Túnel de Vento e do Centro de Motores (e de
              um pouco de sorte). {regulationFor(game.season + 1).text}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CarTab;
