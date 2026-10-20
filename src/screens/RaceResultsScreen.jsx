import { useState } from "react";
import { ArrowRight, Crown, Flag, Medal, Star, Target, Timer, TriangleAlert, TrendingUp } from "lucide-react";
import { TRACKS } from "../data/constants";
import { formatLapTime, formatMoney, surname } from "../utils/helpers";
import { TeamStripe } from "../components/ui/common";

const Podium = ({ title, results, accent }) => {
  const finishers = results.filter(result => result.finished).slice(0, 3);
  const order = [finishers[1], finishers[0], finishers[2]];
  const heights = ["h-20", "h-28", "h-14"];
  const places = [2, 1, 3];
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className={`text-xs font-black uppercase tracking-widest mb-4 ${accent}`}>{title}</h3>
      <div className="flex items-end justify-center gap-2">
        {order.map((result, i) =>
          result ? (
            <div className="flex-1 flex flex-col items-center" key={result.teamId}>
              <TeamStripe color={result.color} />
              <span className={`text-xs font-bold text-center leading-tight mt-1 mb-2 ${result.isPlayer ? "text-blue-300" : "text-gray-200"}`}>{result.teamName}</span>
              <div className={`w-full ${heights[i]} rounded-t-lg flex items-start justify-center pt-2 font-black text-2xl ${places[i] === 1 ? "bg-yellow-500 text-black" : places[i] === 2 ? "bg-gray-400 text-black" : "bg-orange-700 text-white"}`}>
                {places[i]}
              </div>
            </div>
          ) : (
            <div className="flex-1" key={i} />
          )
        )}
      </div>
    </div>
  );
};

const classLabel = cls => (cls === "HYPERCAR" ? "Hypercar" : "LMGT3");

// Resultado de um carro no topo da tela (equipe com dois carros)
const CarHero = ({ result }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center flex-1 min-w-[150px]">
    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
      #{result.number} · {classLabel(result.class)}
    </div>
    <div className="text-4xl md:text-5xl font-black italic mt-1">{result.finished ? `P${result.classPos}` : "DNF"}</div>
    <div className="text-xs text-gray-400 font-bold">{result.finished ? `largou em P${result.startClassPosition}` : result.dnfReason}</div>
    <div className="flex flex-wrap justify-center gap-1 mt-2">
      <span className="px-2 py-0.5 rounded-full bg-yellow-500 text-black font-black text-xs">+{result.points} pts</span>
      {result.pole && (
        <span className="px-2 py-0.5 rounded-full bg-purple-600 font-black text-xs flex items-center gap-1">
          <Crown size={11} /> Pole
        </span>
      )}
      {result.fastestLap && (
        <span className="px-2 py-0.5 rounded-full bg-purple-900 text-purple-200 font-black text-xs flex items-center gap-1">
          <Timer size={11} /> VMR
        </span>
      )}
    </div>
  </div>
);

const RaceResultsScreen = ({ game, report, summary, onContinue }) => {
  const [view, setView] = useState(report.player.class);
  const players = report.players?.length ? report.players : [report.player];
  const twoCars = players.length > 1;
  const [carIdx, setCarIdx] = useState(0);
  const mine = players[carIdx] || report.player;
  const lead = report.player;
  const pointsTotals = summary.pointsTotals || [{ id: lead.teamId, number: lead.number, class: lead.class, points: summary.pointsTotal }];
  const rows = report.classes[view];
  const isLastRace = game.raceIndex >= TRACKS.length;
  const gainers = Object.values(report.classes)
    .flat()
    .filter(result => result.finished)
    .sort((a, b) => b.startClassPosition - b.classPos - (a.startClassPosition - a.classPos));
  const bestGainer = gainers[0] && gainers[0].startClassPosition - gainers[0].classPos > 0 ? gainers[0] : null;
  const dnfs = Object.values(report.classes)
    .flat()
    .filter(result => !result.finished);
  const totalDrive = mine.drivers.reduce((sum, driver) => sum + driver.driveTime, 0) || 1;
  const driverColors = ["bg-blue-500", "bg-purple-500", "bg-orange-500"];
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">
            {report.track.name} · Resultado final · {report.track.durationHours}h de prova
          </p>
          {twoCars ? (
            <div className="flex flex-wrap justify-center gap-3 mt-3 max-w-2xl mx-auto">
              {players.map(result => (
                <CarHero result={result} key={result.teamId} />
              ))}
            </div>
          ) : (
            <>
              <h1 className="text-5xl md:text-7xl font-black italic mt-2">{lead.finished ? `P${lead.classPos}` : "DNF"}</h1>
              <p className="text-gray-400 font-bold">
                {lead.finished ? `na classe ${classLabel(lead.class)} · largou em P${lead.startClassPosition}` : lead.dnfReason}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                <span className="px-3 py-1 rounded-full bg-yellow-500 text-black font-black text-sm">+{lead.points} pontos</span>
                {lead.pole && (
                  <span className="px-3 py-1 rounded-full bg-purple-600 font-black text-sm flex items-center gap-1">
                    <Crown size={14} /> Pole
                  </span>
                )}
                {lead.fastestLap && (
                  <span className="px-3 py-1 rounded-full bg-purple-900 text-purple-200 font-black text-sm flex items-center gap-1">
                    <Timer size={14} /> Volta mais rápida
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Podium title="Pódio Hypercar" results={report.classes.HYPERCAR} accent="text-red-400" />
          <Podium title="Pódio LMGT3" results={report.classes.LMGT3} accent="text-yellow-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Flag size={14} className="text-blue-400" /> Sua corrida
              </h3>
              {twoCars && (
                <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
                  {players.map((result, i) => (
                    <button
                      key={result.teamId}
                      onClick={() => setCarIdx(i)}
                      className={`px-2 py-0.5 text-[10px] font-black rounded ${carIdx === i ? "bg-blue-600 text-white" : "text-gray-400"}`}
                    >
                      #{result.number}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Pit stops", mine.pitStops],
                ["Ultrapass.", mine.overtakes],
                ["Melhor volta", formatLapTime(mine.bestLap)]
              ].map(([label, value]) => (
                <div className="bg-gray-950 border border-gray-800 rounded-lg py-2" key={label}>
                  <div className="text-lg font-black">{value}</div>
                  <div className="text-[9px] uppercase font-bold text-gray-500">{label}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Tempo ao volante</div>
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-800">
                {mine.drivers.map((driver, i) => (
                  <div className={driverColors[i % 3]} style={{ width: `${(driver.driveTime / totalDrive) * 100}%` }} key={driver.id} title={driver.name} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 mt-1">
                {mine.drivers.map((driver, i) => (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1" key={driver.id}>
                    <span className={`w-2 h-2 rounded-full ${driverColors[i % 3]}`} /> {surname(driver.name)} {Math.round((driver.driveTime / totalDrive) * 100)}%
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-2">
                <div className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                  <Star size={10} /> Reputação
                </div>
                <div className="font-bold">
                  {Math.round(summary.reputation)}{" "}
                  <span className={summary.repDelta >= 0 ? "text-green-400" : "text-red-400"}>
                    ({summary.repDelta >= 0 ? "+" : ""}
                    {summary.repDelta})
                  </span>
                </div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-2">
                <div className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                  <Target size={10} /> Diretoria
                </div>
                <div className="font-bold">
                  {summary.confidence}%{" "}
                  <span className={summary.confDelta >= 0 ? "text-green-400" : "text-red-400"}>
                    ({summary.confDelta >= 0 ? "+" : ""}
                    {summary.confDelta})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Financeiro da etapa</h3>
            <div className="space-y-1.5 text-sm">
              {summary.items.map((item, i) => (
                <div className="flex justify-between gap-2" key={i}>
                  <span className="text-gray-400 truncate">{item.label}</span>
                  <span className={`font-mono shrink-0 ${item.amount >= 0 ? "text-green-300" : "text-red-300"}`}>
                    {item.amount >= 0 ? "+" : ""}
                    {formatMoney(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-800 pt-2 font-bold">
                <span>Resultado</span>
                <span className={`font-mono ${summary.net >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {summary.net >= 0 ? "+" : ""}
                  {formatMoney(summary.net)}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Saldo</span>
                <span className="font-mono">{formatMoney(summary.balance)}</span>
              </div>
            </div>
            {summary.expiredSponsors.length > 0 && (
              <p className="mt-3 text-xs text-yellow-300 bg-yellow-900/20 border border-yellow-900/40 rounded p-2">
                Contrato encerrado: {summary.expiredSponsors.join(", ")}. Procure novos patrocinadores.
              </p>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3 text-sm">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Destaques</h3>
            {["HYPERCAR", "LMGT3"].map(cls =>
              report.fastestLaps[cls] ? (
                <p className="flex items-start gap-2" key={cls}>
                  <Timer size={14} className="text-purple-400 mt-0.5 shrink-0" />
                  <span>
                    Volta mais rápida {cls === "HYPERCAR" ? "HYP" : "GT3"}: <span className="font-bold">{report.fastestLaps[cls].teamName}</span> ({surname(report.fastestLaps[cls].driver)},{" "}
                    {formatLapTime(report.fastestLaps[cls].time)})
                  </span>
                </p>
              ) : null
            )}
            {bestGainer && (
              <p className="flex items-start gap-2">
                <TrendingUp size={14} className="text-green-400 mt-0.5 shrink-0" />
                <span>
                  Maior recuperação: <span className="font-bold">{bestGainer.teamName}</span> (P{bestGainer.startClassPosition} → P{bestGainer.classPos})
                </span>
              </p>
            )}
            {report.safetyCar && (
              <p className="flex items-start gap-2">
                <TriangleAlert size={14} className="text-yellow-400 mt-0.5 shrink-0" /> Houve Safety Car na prova.
              </p>
            )}
            {dnfs.length > 0 && (
              <p className="flex items-start gap-2">
                <TriangleAlert size={14} className="text-red-400 mt-0.5 shrink-0" />
                <span>Abandonos: {dnfs.map(result => `${result.teamName} (${result.dnfReason})`).join(", ")}</span>
              </p>
            )}
            <p className="flex items-start gap-2">
              <Medal size={14} className="text-yellow-400 mt-0.5 shrink-0" />
              <span>
                Pontos no campeonato:{" "}
                {twoCars ? pointsTotals.map(item => `#${item.number} (${item.class === "HYPERCAR" ? "HYP" : "GT3"}) ${item.points}`).join(" · ") : summary.pointsTotal}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-800 flex justify-between items-center">
            <h3 className="font-bold text-sm uppercase text-gray-300">Classificação final</h3>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[560px]">
              <thead className="text-[10px] uppercase text-gray-500 bg-gray-950">
                <tr>
                  <th className="p-2 text-center w-10">Pos</th>
                  <th className="p-2">Equipe</th>
                  <th className="p-2 text-center">Voltas</th>
                  <th className="p-2 text-right">Diferença</th>
                  <th className="p-2 text-center">Pits</th>
                  <th className="p-2 text-right">Melhor volta</th>
                  <th className="p-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map(result => (
                  <tr className={result.isPlayer ? "bg-blue-900/20" : ""} key={result.teamId}>
                    <td className="p-2 text-center font-mono font-bold text-gray-400">{result.finished ? result.classPos : "—"}</td>
                    <td className="p-2">
                      <span className="flex items-center gap-2">
                        <TeamStripe color={result.color} />
                        <span className="text-[10px] font-mono text-gray-500">#{result.number}</span>
                        <span className={`font-bold ${result.isPlayer ? "text-blue-300" : "text-gray-200"}`}>{result.teamName}</span>
                        {result.pole && <Crown size={12} className="text-purple-400" />}
                        {result.fastestLap && <Timer size={12} className="text-purple-400" />}
                      </span>
                    </td>
                    <td className="p-2 text-center font-mono text-gray-400">{result.laps}</td>
                    <td className={`p-2 text-right font-mono ${result.finished ? "text-gray-300" : "text-red-400"}`}>{result.gap}</td>
                    <td className="p-2 text-center font-mono text-gray-500">{result.pitStops}</td>
                    <td className="p-2 text-right font-mono text-gray-400">{formatLapTime(result.bestLap)}</td>
                    <td className="p-2 text-right font-mono font-black text-white">{result.points || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-center pb-6">
          <button
            onClick={onContinue}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-black text-lg uppercase tracking-wider shadow-lg shadow-blue-900/30 flex items-center gap-3 active:scale-95 transition-all"
          >
            {isLastRace ? "Encerrar temporada" : "Continuar"} <ArrowRight size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RaceResultsScreen;
