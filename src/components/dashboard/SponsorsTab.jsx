import { Briefcase, Crown, DollarSign, Gem, Lock, Medal, ShieldCheck, Trophy, TrendingUp, Zap } from "lucide-react";
import { SPONSORS, TRACKS, TWO_CAR_SPONSOR_BONUS } from "../../data/constants";
import { formatMoney } from "../../utils/helpers";
import { sponsorOffer, sponsorSlots, sponsorMultiplier } from "../../engine/economy";

const TYPE_INFO = {
  FIXED: { icon: ShieldCheck, color: "text-blue-400", label: "Fixo" },
  PERFORMANCE: { icon: TrendingUp, color: "text-red-400", label: "Por desempenho" },
  UPFRONT: { icon: Briefcase, color: "text-green-400", label: "Luvas altas" },
  GAMBLE: { icon: Zap, color: "text-yellow-400", label: "Aposta" },
  PODIUM: { icon: Medal, color: "text-orange-400", label: "Bônus de pódio" },
  LEMANS: { icon: Trophy, color: "text-amber-300", label: "Bônus Le Mans" },
  WIN: { icon: Crown, color: "text-purple-300", label: "Bônus de vitória" }
};

const TypeIcon = ({ type, size = 20 }) => {
  const info = TYPE_INFO[type];
  if (!info) {
    return <DollarSign size={size} />;
  }
  const Icon = info.icon;
  return <Icon size={size} className={info.color} />;
};

const termsLine = contract => {
  switch (contract.type) {
    case "GAMBLE":
      return `Entre $0 e ${formatMoney(contract.maxRandom)} por corrida`;
    case "PERFORMANCE":
      return `${formatMoney(contract.perRacePayment)} por corrida se terminar no Top ${contract.goalPosition} da classe`;
    case "PODIUM":
      return `${formatMoney(contract.perRacePayment)} por corrida + ${formatMoney(contract.bonus)} por pódio`;
    case "WIN":
      return `${formatMoney(contract.perRacePayment)} por corrida + ${formatMoney(contract.bonus)} por vitória`;
    case "LEMANS":
      return `${formatMoney(contract.perRacePayment)} por corrida + ${formatMoney(contract.bonus)} com Top ${contract.goalPosition} em Le Mans`;
    default:
      return `${formatMoney(contract.perRacePayment)} por corrida`;
  }
};

const SponsorsTab = ({ game, onSignSponsor }) => {
  const player = game.playerTeam;
  const slots = sponsorSlots(player);
  const activeIds = player.sponsors.map(contract => contract.id);
  const market = SPONSORS.filter(sponsor => !activeIds.includes(sponsor.id));
  const multiplier = sponsorMultiplier(player);
  const leMansDone = game.raceIndex > TRACKS.findIndex(track => track.id === "lemans");
  const sister = game.sisterTeam;
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {sister && (
        <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-4 text-sm text-green-100">
          <span className="font-black">Dois carros na pista: patrocinadores pagam +{Math.round(TWO_CAR_SPONSOR_BONUS * 100)}% (exposição).</span>{" "}
          <span className="text-green-200/80">
            Metas de desempenho, pódio, vitória e Le Mans são conferidas em cada carro pela meta da classe dele (#{player.number} e #{sister.number}): vale o melhor resultado.
          </span>
        </div>
      )}
      <section>
        <h3 className="text-white font-bold uppercase text-sm mb-4 flex items-center gap-2">
          <Briefcase size={16} /> Contratos Ativos ({player.sponsors.length}/{slots})
          {multiplier > 1 && <span className="text-[10px] bg-green-800 text-green-100 px-2 py-0.5 rounded">Hospitality +{Math.round((multiplier - 1) * 100)}%</span>}
        </h3>
        {player.sponsors.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-gray-700 rounded-xl text-center text-gray-500 text-sm">
            Sua equipe não possui patrocinadores. Assine contratos abaixo para gerar receita.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {player.sponsors.map(contract => (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-green-900/50 p-4 rounded-lg shadow-lg relative overflow-hidden" key={contract.id}>
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <Gem size={64} />
                </div>
                <div className="flex justify-between items-start mb-1 relative z-10">
                  <span className="font-bold text-lg text-white">{contract.name}</span>
                  <TypeIcon type={contract.type} />
                </div>
                <div className="text-xs text-gray-400 mb-3">{contract.industry}</div>
                <p className="text-xs text-green-300 font-bold mb-3 relative z-10">{termsLine(contract)}</p>
                <div className="flex justify-between text-sm border-t border-gray-700 pt-2 relative z-10">
                  <span className="text-gray-500">Restam</span>
                  <span className="font-mono text-white">{contract.remaining} corridas</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="text-white font-bold uppercase text-sm mb-1 flex items-center gap-2">
          <DollarSign size={16} /> Mercado de Patrocínios
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Patrocinadores maiores exigem reputação. Sua reputação: <span className="text-yellow-400 font-bold">{Math.round(player.reputation ?? 0)}</span>.
          {player.class === "LMGT3" && " Na LMGT3 os valores são menores (1/3 da Hypercar)."}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {market.map(sponsor => {
            const offer = sponsorOffer(sponsor, player.class);
            const locked = (player.reputation ?? 0) < (sponsor.minReputation ?? 0);
            const full = player.sponsors.length >= slots;
            const pointless = sponsor.type === "LEMANS" && leMansDone && offer.duration < TRACKS.length - game.raceIndex + 4;
            return (
              <div className={`bg-gray-800 border p-5 rounded-xl flex flex-col justify-between shadow-md ${locked ? "border-gray-800 opacity-60" : "border-gray-700"}`} key={sponsor.id}>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-lg text-gray-200">{sponsor.name}</h4>
                    <TypeIcon type={sponsor.type} />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    {sponsor.industry} · {TYPE_INFO[sponsor.type]?.label}
                  </span>
                  <p className="text-xs text-gray-400 my-3 leading-snug min-h-[2rem]">{sponsor.description}</p>
                  <div className="space-y-2 mb-4 bg-gray-900/50 p-3 rounded">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Luvas:</span>
                      <span className="text-green-400 font-bold font-mono">{formatMoney(offer.signingBonus)}</span>
                    </div>
                    <div className="text-xs text-white font-bold">{termsLine(offer)}</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Duração:</span>
                      <span className="text-white font-bold font-mono">{offer.duration} etapas</span>
                    </div>
                    {pointless && <div className="text-[10px] text-yellow-400 font-bold">Le Mans já passou nesta temporada.</div>}
                  </div>
                </div>
                <button
                  disabled={full || locked}
                  onClick={() => onSignSponsor(sponsor)}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded shadow-lg transition-all uppercase text-sm tracking-wider active:scale-95 flex items-center justify-center gap-2"
                >
                  {locked ? (
                    <>
                      <Lock size={14} /> Reputação {sponsor.minReputation}+
                    </>
                  ) : full ? (
                    "Sem Espaço"
                  ) : (
                    "Assinar Contrato"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default SponsorsTab;
