import { useState } from "react";
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatMoney } from "../../utils/helpers";
import { CLASS_RULES } from "../../data/constants";
import { driversPayroll, staffPayroll, facilityUpkeep, sponsorMultiplier, extraCarOperations } from "../../engine/economy";
import { mainClass, playerEntries, sponsorExposure } from "../../engine/team";

// Gráfico simples do saldo ao longo das corridas
const BalanceChart = ({ entries }) => {
  if (entries.length < 2) {
    return <p className="text-sm text-gray-500 py-10 text-center">O gráfico aparece depois de duas corridas.</p>;
  }
  const values = entries.map(entry => entry.balance);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 600;
  const height = 180;
  const x = i => 20 + (i / (entries.length - 1)) * (width - 40);
  const y = value => 15 + (1 - (value - min) / range) * (height - 30);
  const points = entries.map((entry, i) => `${x(i)},${y(entry.balance)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
      <line x1="20" x2={width - 20} y1={y(0)} y2={y(0)} stroke="#374151" strokeDasharray="4 4" />
      <polyline points={`${x(0)},${y(min)} ${points} ${x(entries.length - 1)},${y(min)}`} fill="rgba(34,197,94,0.08)" stroke="none" />
      <polyline points={points} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" />
      {entries.map((entry, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(entry.balance)} r="3.5" fill={entry.net >= 0 ? "#22c55e" : "#ef4444"} />
          <title>{`${entry.track} (${entry.season}): saldo ${formatMoney(entry.balance)}`}</title>
        </g>
      ))}
    </svg>
  );
};

const FinancesTab = ({ game }) => {
  const player = game.playerTeam;
  const [open, setOpen] = useState(null);
  const ledger = player.ledger || [];
  const seasonEntries = ledger.filter(entry => entry.season === game.season);
  const items = seasonEntries.flatMap(entry => entry.items);
  const income = items.filter(item => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const expenses = items.filter(item => item.amount < 0).reduce((sum, item) => sum + item.amount, 0);
  const cars = playerEntries(game);
  const multi = cars.length > 1;
  const scale = mainClass(player);
  const wages = driversPayroll(cars);
  const staff = staffPayroll(player, scale);
  const upkeep = facilityUpkeep(player, scale);
  // Todo carro além do primeiro paga operação extra (mesma ordem do motor: Hypercar primeiro)
  const extraCars = cars.slice(1);
  const operations = extraCars.reduce((sum, entry) => sum + extraCarOperations(entry.class), 0);
  const exposure = sponsorExposure(cars.length);
  const sponsorMult = sponsorMultiplier(player) * exposure;
  const sponsors = player.sponsors.reduce((sum, contract) => sum + (contract.type === "GAMBLE" ? contract.maxRandom / 2 : contract.perRacePayment), 0) * sponsorMult;
  const projected = sponsors - wages - staff - upkeep - operations;
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Saldo atual", formatMoney(player.funds), player.funds >= 0 ? "text-green-400" : "text-red-400", Wallet],
          [`Receitas ${game.season}`, formatMoney(income), "text-green-400", TrendingUp],
          [`Despesas ${game.season}`, formatMoney(expenses), "text-red-400", TrendingDown],
          ["Resultado por corrida (projeção)", `${projected >= 0 ? "+" : ""}${formatMoney(projected)}`, projected >= 0 ? "text-green-400" : "text-red-400", Wallet]
        ].map(([label, value, color, Icon]) => (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4" key={label}>
            <div className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1.5 mb-1">
              <Icon size={12} /> {label}
            </div>
            <div className={`text-xl md:text-2xl font-mono font-black ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Evolução do saldo</h3>
          <BalanceChart entries={ledger.slice(-16)} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Por corrida</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">
                Patrocínios (estimado){exposure > 1 && <span className="text-[10px] text-green-500"> +{Math.round((exposure - 1) * 100)}% exposição</span>}
              </span>
              <span className="font-mono text-green-300">+{formatMoney(sponsors)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Salários dos pilotos{multi ? ` (${cars.length} carros)` : ""}</span>
              <span className="font-mono text-red-300">-{formatMoney(wages)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Equipe técnica</span>
              <span className="font-mono text-red-300">-{formatMoney(staff)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Manutenção das instalações</span>
              <span className="font-mono text-red-300">-{formatMoney(upkeep)}</span>
            </div>
            {extraCars.map(entry => (
              <div className="flex justify-between" key={entry.id}>
                <span className="text-gray-400">
                  Operação do carro #{entry.number} <span className="text-[10px] text-gray-500">{CLASS_RULES[entry.class]?.short}</span>
                </span>
                <span className="font-mono text-red-300">-{formatMoney(extraCarOperations(entry.class))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-800 pt-2 font-bold">
              <span className="text-gray-300">Sem contar prêmios</span>
              <span className={`font-mono ${projected >= 0 ? "text-green-400" : "text-red-400"}`}>
                {projected >= 0 ? "+" : ""}
                {formatMoney(projected)}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-4">
            Prêmios de corrida e do campeonato, bônus dos patrocinadores e o orçamento anual do conselho entram à parte. Upgrades e contratações saem direto do saldo.
            {multi && " Equipe técnica e instalações são pagas uma vez e atendem todos os carros; cada carro além do primeiro custa operação extra."}
          </p>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest p-4 border-b border-gray-800">Extrato por corrida</h3>
        {ledger.length === 0 && <p className="p-6 text-sm text-gray-500">Nenhuma corrida disputada ainda.</p>}
        {[...ledger].reverse().map((entry, index) => {
          const key = `${entry.season}-${entry.raceIndex}`;
          const expanded = open === key;
          return (
            <div className="border-b border-gray-800 last:border-0" key={`${key}-${index}`}>
              <button onClick={() => setOpen(expanded ? null : key)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 text-left">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-200">
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {entry.track} <span className="text-gray-500 font-normal">· {entry.season}</span>
                </span>
                <span className="flex items-center gap-4">
                  <span className={`font-mono text-sm font-bold ${entry.net >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {entry.net >= 0 ? "+" : ""}
                    {formatMoney(entry.net)}
                  </span>
                  <span className="font-mono text-xs text-gray-500 hidden md:inline">saldo {formatMoney(entry.balance)}</span>
                </span>
              </button>
              {expanded && (
                <div className="px-10 pb-3 space-y-1">
                  {entry.items.map((item, i) => (
                    <div className="flex justify-between text-xs" key={i}>
                      <span className="text-gray-400">{item.label}</span>
                      <span className={`font-mono ${item.amount >= 0 ? "text-green-300" : "text-red-300"}`}>
                        {item.amount >= 0 ? "+" : ""}
                        {formatMoney(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FinancesTab;
