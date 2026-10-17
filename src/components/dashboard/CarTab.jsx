import { Flag, Info, Scale, Settings, Sparkles, Timer, Users, Wrench, Zap } from "lucide-react";
import { Fragment } from "react";
import { PART_INFO, TRACKS } from "../../data/constants";
import { formatMoney } from "../../utils/helpers";
import { CAR_PARTS, PART_CAP, upgradeCost, facilityDiscount, bonusUpgradeChance } from "../../engine/economy";
import { allTeams, computeBop, bopWeight } from "../../engine/weekend";

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
  const rivals = allTeams(game).filter(team => team.class === player.class && team.id !== player.id);
  const best = part => Math.max(...rivals.map(team => team.car[part]));
  const avg = part => Math.round(rivals.reduce((sum, team) => sum + team.car[part], 0) / Math.max(1, rivals.length));
  const bonus = bonusUpgradeChance(player);
  const track = TRACKS[game.raceIndex];
  const bop = track && game.career.bopEnabled !== false ? computeBop(allTeams(game), track.type)[player.id] || 0 : 0;
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CAR_PARTS.map(part => {
          const info = PART_INFO[part];
          const Icon = PART_ICONS[part];
          const level = player.car[part] || 0;
          const cost = upgradeCost(player, part);
          const canAfford = player.funds >= cost;
          const discount = facilityDiscount(player, part);
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
                disabled={!canAfford || level >= PART_CAP}
                onClick={() => onBuyUpgrade(part)}
                className={`w-full mt-4 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex justify-center items-center gap-2 ${
                  canAfford && level < PART_CAP
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600"
                }`}
              >
                {level >= PART_CAP ? (
                  "MAX"
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
                Previsão para {track?.name}:{" "}
                <span className={`font-black ${bop > 0 ? "text-green-400" : bop < 0 ? "text-red-400" : "text-gray-300"}`}>
                  {bop > 0 ? "+" : ""}
                  {bop.toFixed(2)}% de desempenho ({bopWeight(bop) > 0 ? "+" : ""}
                  {bopWeight(bop)} kg)
                </span>
              </p>
              <p className="text-xs text-gray-500">
                A FIA compensa 40% da diferença entre o seu carro e a média da classe, considerando o tipo de pista (até ±2%). Desenvolver continua valendo: o BoP nunca
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
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CarTab;
