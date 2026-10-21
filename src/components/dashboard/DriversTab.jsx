import { useMemo, useState } from "react";
import { ArrowLeftRight, ArrowUp, Frown, Handshake, Lock, Meh, Smile, UserPlus, Users, X } from "lucide-react";
import { TRACKS, CLASS_RULES } from "../../data/constants";
import { ATTRIBUTE_LABELS, formatMoney } from "../../utils/helpers";
import { signingFee, driverWageFor, releaseCost, requiredReputation } from "../../engine/economy";
import { playerEntries, mainClass } from "../../engine/team";
import { CategoryBadge, ClassBadge, Flag, MeterBar } from "../ui/common";

const carLabel = entry => `#${entry.number} · ${CLASS_RULES[entry.class].label}`;

const MoraleIcon = ({ value }) => {
  if (value >= 70) {
    return <Smile size={14} className="text-green-400" />;
  }
  if (value >= 45) {
    return <Meh size={14} className="text-yellow-400" />;
  }
  return <Frown size={14} className="text-red-400" />;
};

// Potencial: exato com simulador nível 3+, senão uma faixa estimada pelos olheiros
const potentialLabel = (driver, simulatorLevel) => {
  const potential = driver.potential ?? driver.rating;
  if (potential <= driver.rating + 1 || driver.age >= 29) {
    return "—";
  }
  if (simulatorLevel >= 3) {
    return String(potential);
  }
  const low = Math.max(driver.rating, Math.floor((potential - 5) / 5) * 5);
  const high = Math.min(99, Math.ceil((potential + 5) / 5) * 5);
  return `${low}-${high}`;
};

const DriverCard = ({ driver, index, entry, onSetStarter, otherEntries, onSwap }) => (
  <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 rounded-xl border border-gray-700 shadow-xl relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <Users size={64} />
    </div>
    <div className="relative z-10">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {index === 0 ? (
              <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded">TITULAR</span>
            ) : (
              <button onClick={() => onSetStarter(driver.id)} className="text-[9px] font-black bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                <ArrowUp size={10} /> Largar com ele
              </button>
            )}
            <CategoryBadge rating={driver.rating} />
          </div>
          <h4 className="text-xl font-black text-white leading-tight truncate">
            <Flag driver={driver} /> {driver.name}
          </h4>
          <span className="text-xs text-gray-400 font-bold">
            {driver.age} anos · contrato: {driver.contractYears ?? 1} temp.
          </span>
        </div>
        <div className="text-4xl font-black text-gray-600">{driver.rating}</div>
      </div>
      <div className="mt-4 space-y-1.5">
        {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => (
          <div className="flex items-center gap-2" key={key}>
            <span className="text-[10px] text-gray-500 uppercase font-bold w-24">{label}</span>
            <div className="flex-1">
              <MeterBar value={driver.attrs?.[key] ?? driver.rating} color={key === "wet" ? "bg-blue-500" : key === "stamina" ? "bg-orange-500" : key === "consistency" ? "bg-purple-500" : "bg-red-500"} height="h-1.5" />
            </div>
            <span className="text-xs font-mono font-bold text-gray-300 w-6 text-right">{driver.attrs?.[key] ?? driver.rating}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm bg-black/20 p-3 rounded-lg">
        <div>
          <span className="text-[10px] text-gray-500 uppercase block">Moral</span>
          <span className="font-bold text-gray-200 flex items-center gap-1">
            <MoraleIcon value={driver.morale ?? 75} /> {driver.morale ?? 75}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 uppercase block">Pontos</span>
          <span className="font-bold text-yellow-400">{driver.seasonPoints || 0}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase block">Salário</span>
          <span className="font-bold text-red-300 font-mono">{formatMoney(driver.wage || driverWageFor(driver, entry.class))}</span>
        </div>
      </div>
      {otherEntries.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <ArrowLeftRight size={12} className="text-gray-500 shrink-0" />
          <select
            value=""
            onChange={e => e.target.value && onSwap(driver.id, e.target.value)}
            className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-lg text-[11px] font-bold text-gray-300 px-2 py-1.5"
            aria-label={`Trocar ${driver.name} de carro`}
          >
            <option value="">Trocar de carro com...</option>
            {otherEntries.map(other => (
              <optgroup label={carLabel(other)} key={other.id}>
                {other.drivers.map(item => (
                  <option value={item.id} key={item.id}>
                    {item.name} ({item.rating})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <div className="mt-2 text-[10px] text-gray-500">
        Carreira: {driver.stats?.starts || 0} largadas · {driver.stats?.wins || 0} vitórias · {driver.stats?.podiums || 0} pódios · {driver.stats?.titles || 0} títulos
      </div>
    </div>
  </div>
);

const SignModal = ({ driver, entries, funds, racesLeft, onConfirm, onClose }) => {
  const twoCars = entries.length > 1;
  const main = entries[0];
  const fee = signingFee(driver, main.class);
  const wage = driverWageFor(driver, main.class);
  return (
    <div className="fixed inset-0 bg-gray-950/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] overflow-y-auto"
        onClick={event => event.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-800 flex justify-between items-start">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500">Contratação</p>
            <h3 className="text-xl font-black text-white">
              <Flag driver={driver} /> {driver.name} <span className="text-gray-500">({driver.rating})</span>
            </h3>
            <p className="text-xs text-gray-400">
              Luvas {formatMoney(fee)} · salário {formatMoney(wage)}/corrida · contrato de 2 temporadas
            </p>
            {twoCars && <p className="text-[10px] text-gray-500 mt-1">Luvas e salário seguem a classe do carro em que ele vai correr.</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-800 text-gray-300" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs font-bold uppercase text-gray-500">Quem deixa a equipe?</p>
          {entries.map(entry => {
            const carFee = signingFee(driver, entry.class);
            return (
              <div className="space-y-2" key={entry.id}>
                {twoCars && (
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400">
                    <ClassBadge cls={entry.class} size="xs" /> {carLabel(entry)} · luvas {formatMoney(carFee)}
                  </div>
                )}
                {entry.drivers.map(current => {
                  const penalty = releaseCost(current, racesLeft);
                  const total = carFee + penalty;
                  const canAfford = funds >= total;
                  return (
                    <button
                      key={current.id}
                      disabled={!canAfford}
                      onClick={() => onConfirm(driver, current.id)}
                      className="w-full flex items-center justify-between gap-3 bg-gray-950 border border-gray-800 hover:border-red-500/60 rounded-lg px-4 py-3 text-left disabled:opacity-40"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {current.name} <span className="text-gray-500">({current.rating})</span>
                        </div>
                        <div className="text-[10px] text-gray-500">Multa rescisória {formatMoney(penalty)}</div>
                      </div>
                      <span className="font-mono text-sm font-bold text-red-300">-{formatMoney(total)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SORTS = {
  rating: { label: "Rating", fn: (a, b) => b.rating - a.rating },
  potential: { label: "Potencial", fn: (a, b) => (b.potential ?? b.rating) - (a.potential ?? a.rating) },
  price: { label: "Mais baratos", fn: (a, b) => a.marketValue - b.marketValue },
  age: { label: "Mais jovens", fn: (a, b) => a.age - b.age }
};

const DriversTab = ({ game, onSignDriver, onSetStarter, onSwapDrivers }) => {
  const player = game.playerTeam;
  const entries = playerEntries(game);
  const twoCars = entries.length > 1;
  const [sort, setSort] = useState("rating");
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [pending, setPending] = useState(null);
  const simulatorLevel = player.facilities?.simulator ?? 1;
  const racesLeft = Math.max(1, TRACKS.length - game.raceIndex);
  // Preços do mercado na escala da organização (Hypercar se tiver programa lá)
  const scale = mainClass(player);
  const market = useMemo(
    () =>
      [...game.driversPool]
        .filter(driver => !onlyAffordable || signingFee(driver, scale) <= player.funds)
        .sort(SORTS[sort].fn),
    [game.driversPool, onlyAffordable, sort, scale, player.funds]
  );
  return (
    <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 md:pb-0">
      <div className="xl:w-[38%] space-y-4">
        {entries.map(entry => {
          const otherEntries = entries.filter(item => item.id !== entry.id);
          return (
            <div className="space-y-4" key={entry.id}>
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <ClassBadge cls={entry.class} size="xs" /> {carLabel(entry)}
                <span className="text-gray-600 normal-case tracking-normal">({entry.drivers.length} pilotos)</span>
              </h3>
              {entry.drivers.map((driver, index) => (
                <DriverCard
                  driver={driver}
                  index={index}
                  entry={entry}
                  onSetStarter={onSetStarter}
                  otherEntries={otherEntries}
                  onSwap={onSwapDrivers}
                  key={driver.id}
                />
              ))}
            </div>
          );
        })}
        <p className="text-[11px] text-gray-500">
          O titular larga a corrida. Os outros entram nas trocas de piloto durante os pit stops.
          {twoCars ? " Trocar pilotos de carro não muda o salário do contrato; contratações pagam as luvas na classe do carro." : ""}
        </p>
      </div>
      <div className="xl:flex-1 bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden h-auto xl:h-[calc(100vh-11rem)]">
        <div className="p-4 border-b border-gray-800 bg-gray-800/50 sticky top-0 z-20 backdrop-blur-sm flex flex-wrap gap-3 justify-between items-center">
          <h3 className="text-gray-200 font-bold flex items-center gap-2">
            <Handshake size={18} className="text-green-500" /> Mercado de Transferências
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 px-2 py-1.5"
              aria-label="Ordenar mercado"
            >
              {Object.entries(SORTS).map(([key, option]) => (
                <option value={key} key={key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setOnlyAffordable(!onlyAffordable)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${onlyAffordable ? "bg-green-700 border-green-600 text-white" : "bg-gray-950 border-gray-700 text-gray-400"}`}
            >
              Cabe no orçamento
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-visible xl:overflow-y-auto p-0 xl:p-2 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="text-[10px] text-gray-500 uppercase font-bold sticky top-0 bg-gray-900 z-10 shadow-sm">
              <tr>
                <th className="p-3 bg-gray-900">Piloto</th>
                <th className="p-3 text-center bg-gray-900">Rating</th>
                <th className="p-3 text-center hidden md:table-cell bg-gray-900">Potencial</th>
                <th className="p-3 text-center hidden lg:table-cell bg-gray-900">R/C/Ch/Res</th>
                <th className="p-3 text-right bg-gray-900">Luvas</th>
                <th className="p-3 bg-gray-900" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {market.map(driver => {
                const fee = signingFee(driver, scale);
                const repNeeded = requiredReputation(driver);
                const locked = (player.reputation ?? 0) < repNeeded;
                return (
                  <tr className="hover:bg-gray-800/50 transition-colors group" key={driver.id}>
                    <td className="p-3">
                      <div className="font-bold text-gray-200 flex items-center gap-1.5">
                        <Flag driver={driver} /> {driver.name}
                      </div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                        <CategoryBadge rating={driver.rating} /> {driver.age} anos · {formatMoney(driverWageFor(driver, scale))}/corrida
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-1 rounded font-bold text-xs ${
                          driver.rating >= 90 ? "bg-purple-900 text-purple-200" : driver.rating >= 80 ? "bg-green-900 text-green-200" : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {driver.rating}
                      </span>
                    </td>
                    <td className="p-3 text-center text-gray-400 font-mono text-xs hidden md:table-cell">{potentialLabel(driver, simulatorLevel)}</td>
                    <td className="p-3 text-center text-gray-500 font-mono text-[11px] hidden lg:table-cell">
                      {driver.attrs ? `${driver.attrs.pace}/${driver.attrs.consistency}/${driver.attrs.wet}/${driver.attrs.stamina}` : "—"}
                    </td>
                    <td className="p-3 text-right font-mono text-green-400 font-bold">{formatMoney(fee)}</td>
                    <td className="p-3 text-right">
                      {locked ? (
                        <span className="text-[10px] text-gray-500 font-bold flex items-center justify-end gap-1" title="Reputação insuficiente">
                          <Lock size={12} /> Rep {repNeeded}
                        </span>
                      ) : (
                        <button
                          disabled={player.funds < fee}
                          onClick={() => setPending(driver)}
                          className="text-xs bg-gray-800 hover:bg-green-600 hover:text-white text-gray-400 border border-gray-700 px-3 py-1.5 rounded transition-all disabled:opacity-20 flex items-center gap-1 ml-auto"
                        >
                          <UserPlus size={12} /> Contratar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {market.length === 0 && <p className="p-6 text-center text-gray-500 text-sm">Nenhum piloto disponível com esse filtro.</p>}
        </div>
      </div>
      {pending && (
        <SignModal
          driver={pending}
          entries={entries}
          funds={player.funds}
          racesLeft={racesLeft}
          onClose={() => setPending(null)}
          onConfirm={(driver, replaceId) => {
            onSignDriver(driver, replaceId);
            setPending(null);
          }}
        />
      )}
    </div>
  );
};

export default DriversTab;
