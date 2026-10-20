import { Cpu, Headphones, Megaphone, Monitor, UserPlus, Wind, Hammer, Wrench } from "lucide-react";
import { FACILITIES, FACILITY_ORDER, FACILITY_MAX_LEVEL, STAFF_ROLES, STAFF_ORDER } from "../../data/constants";
import { formatMoney } from "../../utils/helpers";
import { facilityUpgradeCost, staffSalary, staffHiringFee, bonusUpgradeChance, sponsorSlots } from "../../engine/economy";
import { setupAttempts, qualifyingBarFactor } from "../../engine/weekend";
import { Stars } from "../ui/common";

const FACILITY_ICONS = {
  windTunnel: Wind,
  engineShop: Cpu,
  simulator: Monitor,
  hospitality: Megaphone
};

const ROLE_ICONS = {
  technicalDirector: Hammer,
  raceEngineer: Headphones,
  crewChief: Wrench
};

const facilityEffect = (team, id) => {
  const level = team.facilities[id];
  switch (id) {
    case "windTunnel":
      return `-${(level - 1) * 6}% no P&D de Aero e Chassi`;
    case "engineShop":
      return `-${(level - 1) * 6}% no P&D de Motor, Eficiência e Confiabilidade`;
    case "simulator":
      return `${setupAttempts(team)} tentativas de setup · barra ${Math.round((1 - qualifyingBarFactor(team)) * 100)}% mais lenta${level >= 3 ? " · pilotos jovens evoluem mais" : ""}`;
    default:
      return `+${(level - 1) * 6}% nos patrocínios · ${sponsorSlots(team)} vagas de contrato`;
  }
};

const staffEffect = (team, role, stars) => {
  if (role === "technicalDirector") {
    return `${Math.round(bonusUpgradeChance({ staff: { technicalDirector: { stars } } }) * 100)}% de chance de upgrade +3`;
  }
  if (role === "raceEngineer") {
    return stars >= 4 ? "Feedback preciso, +1 tentativa de setup, radar de chuva" : stars >= 3 ? "Feedback detalhado e radar de chuva" : stars >= 2 ? "Radar de chuva no rádio" : "Feedback básico";
  }
  return `Pit stop ${Math.round((1 - (1.08 - stars * 0.04)) * 100)}% mais rápido · erro ${Math.round(Math.max(0.02, 0.1 - stars * 0.016) * 100)}%`;
};

const FactoryTab = ({ game, onUpgradeFacility, onHireStaff }) => {
  const player = game.playerTeam;
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {game.sisterTeam && (
        <p className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 text-sm text-blue-100">
          Instalações e equipe técnica atendem os dois carros (#{player.number} e #{game.sisterTeam.number}): cada ampliação ou contratação vale para os dois.
        </p>
      )}
      <section>
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Instalações</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FACILITY_ORDER.map(id => {
            const facility = FACILITIES[id];
            const Icon = FACILITY_ICONS[id];
            const level = player.facilities[id];
            const maxed = level >= FACILITY_MAX_LEVEL;
            const cost = facilityUpgradeCost(player.class, level);
            const canAfford = player.funds >= cost;
            return (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-5 shadow-lg flex flex-col gap-3" key={id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-blue-900/30 text-blue-300 border border-blue-900/50">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h4 className="font-black text-white">{facility.name}</h4>
                      <div className="flex gap-1 mt-1">
                        {Array.from({ length: FACILITY_MAX_LEVEL }, (_, i) => (
                          <span key={i} className={`h-1.5 w-6 rounded-full ${i < level ? "bg-blue-500" : "bg-gray-700"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-gray-400 uppercase">Nível {level}</span>
                </div>
                <p className="text-xs text-gray-400">{facility.description}</p>
                <p className="text-sm text-green-300 font-bold">{facilityEffect(player, id)}</p>
                <button
                  disabled={maxed || !canAfford}
                  onClick={() => onUpgradeFacility(id)}
                  className={`mt-auto w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-2 active:scale-95 transition-all ${
                    maxed ? "bg-gray-800 text-gray-500" : canAfford ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {maxed ? "Nível máximo" : <>Ampliar para nível {level + 1} <span className="font-mono opacity-80">{formatMoney(cost)}</span></>}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Cada nível de instalação custa {formatMoney(25000 * (player.class === "HYPERCAR" ? 1 : 0.33))} de manutenção por corrida.</p>
      </section>

      <section>
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Equipe técnica</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {STAFF_ORDER.map(role => {
            const current = player.staff?.[role];
            const Icon = ROLE_ICONS[role];
            const market = game.staffMarket?.[role] || [];
            return (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col" key={role}>
                <div className="p-4 border-b border-gray-800 bg-gray-800/40">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-400 mb-2">
                    <Icon size={14} className="text-purple-400" /> {STAFF_ROLES[role].name}
                  </div>
                  {current && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="font-black text-white text-lg">{current.name}</span>
                        <Stars value={current.stars} size={14} />
                      </div>
                      <p className="text-xs text-green-300 font-bold mt-1">{staffEffect(player, role, current.stars)}</p>
                      <p className="text-[10px] text-gray-500 mt-1">Salário: {formatMoney(staffSalary(current.stars, player.class))}/corrida</p>
                    </>
                  )}
                </div>
                <div className="p-3 space-y-2 flex-1">
                  <p className="text-[10px] uppercase font-bold text-gray-500 px-1">Mercado</p>
                  {market.length === 0 && <p className="text-xs text-gray-600 px-1">Sem candidatos nesta temporada.</p>}
                  {market.map(candidate => {
                    const fee = staffHiringFee(candidate.stars, player.class);
                    const canAfford = player.funds >= fee;
                    return (
                      <div className="flex items-center justify-between gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2" key={candidate.id}>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-200 truncate">{candidate.name}</div>
                          <div className="flex items-center gap-2">
                            <Stars value={candidate.stars} size={10} />
                            <span className="text-[10px] text-gray-500">{formatMoney(staffSalary(candidate.stars, player.class))}/corrida</span>
                          </div>
                        </div>
                        <button
                          disabled={!canAfford}
                          onClick={() => onHireStaff(role, candidate)}
                          className="shrink-0 text-[10px] font-bold uppercase bg-gray-800 hover:bg-green-600 hover:text-white text-gray-300 border border-gray-700 px-2 py-1.5 rounded disabled:opacity-30 flex items-center gap-1"
                          title={`Luvas: ${formatMoney(fee)}`}
                        >
                          <UserPlus size={12} /> {formatMoney(fee)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Contratar custa 3 salários de luvas. O profissional substituído volta para o mercado. Os candidatos mudam a cada temporada.</p>
      </section>
    </div>
  );
};

export default FactoryTab;
