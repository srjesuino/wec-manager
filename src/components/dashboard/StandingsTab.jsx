import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { carStandings, teamStandings } from "../../engine/career";
import { classEntries, entryView, mainClass, teamScoringText } from "../../engine/team";
import { Flag, TeamStripe } from "../ui/common";

const positionLabel = index =>
  index === 0 ? <span className="text-yellow-400 text-base">1º</span> : index === 1 ? <span className="text-gray-300 text-base">2º</span> : index === 2 ? <span className="text-orange-400 text-base">3º</span> : `${index + 1}º`;

const VIEW_LABELS = { teams: "EQUIPES", cars: "CARROS", drivers: "PILOTOS", HYPERCAR: "HYPERCAR", LMGT3: "LMGT3" };

const StandingsTab = ({ game }) => {
  const [standingsClass, setStandingsClass] = useState(() => mainClass(game.playerTeam));
  const [view, setView] = useState("teams");
  const teams = teamStandings(game, standingsClass);
  const cars = carStandings(game, standingsClass);
  const drivers = classEntries(game, standingsClass)
    .map(entry => entryView(game, entry))
    .flatMap(car => car.drivers.map(driver => ({ ...driver, car })))
    .sort((a, b) => (b.seasonPoints || 0) - (a.seasonPoints || 0) || b.rating - a.rating);
  const toggle = (value, current, setter, activeClass) => (
    <button onClick={() => setter(value)} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${current === value ? activeClass : "text-gray-400 hover:text-white"}`}>
      {VIEW_LABELS[value]}
    </button>
  );
  const pointsCell = points => (
    <td className="p-2 md:p-4 text-right">
      <span className="font-mono font-black text-sm md:text-xl text-white bg-gray-800 px-2 py-1 md:px-3 rounded border border-gray-700 block w-fit ml-auto">{points || 0}</span>
    </td>
  );
  const statCells = stats => (
    <>
      <td className="p-2 md:p-4 text-center text-gray-500 hidden md:table-cell">{stats?.wins || 0}</td>
      <td className="p-2 md:p-4 text-center text-gray-500 hidden md:table-cell">{stats?.podiums || 0}</td>
      <td className="p-2 md:p-4 text-center text-gray-500 hidden lg:table-cell">{stats?.poles || 0}</td>
    </>
  );
  const statHeaders = (
    <>
      <th className="p-2 md:p-4 text-center hidden md:table-cell">Vitórias</th>
      <th className="p-2 md:p-4 text-center hidden md:table-cell">Pódios</th>
      <th className="p-2 md:p-4 text-center hidden lg:table-cell">Poles</th>
    </>
  );
  const rowClass = isPlayer => `hover:bg-gray-800/30 transition-colors ${isPlayer ? "bg-blue-900/10 border-l-4 border-l-blue-500" : ""}`;
  return (
    <div className="h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 md:pb-0">
      <div className="p-4 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center shrink-0 flex-wrap gap-2">
        <h3 className="font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-yellow-500" size={20} /> <span className="hidden md:inline">Classificação {game.season}</span>
        </h3>
        <div className="flex gap-2 flex-wrap">
          <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800">
            {toggle("teams", view, setView, "bg-blue-600 text-white")}
            {toggle("cars", view, setView, "bg-blue-600 text-white")}
            {toggle("drivers", view, setView, "bg-blue-600 text-white")}
          </div>
          <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800">
            {toggle("HYPERCAR", standingsClass, setStandingsClass, "bg-red-600 text-white")}
            {toggle("LMGT3", standingsClass, setStandingsClass, "bg-yellow-600 text-white")}
          </div>
        </div>
      </div>
      <p className="px-4 py-2 text-[11px] text-gray-400 border-b border-gray-800 bg-gray-950/40 shrink-0">
        {view === "teams" ? teamScoringText(standingsClass, game.season) : view === "cars" ? "Cada carro pontua pela sua posição na classe (campeonato de pilotos)." : "Pilotos somam os pontos do carro em que correm."}
      </p>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {view === "teams" && (
          <table className="w-full text-left">
            <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 md:p-4 w-10 md:w-16 text-center">Pos</th>
                <th className="p-2 md:p-4">Equipe</th>
                {statHeaders}
                <th className="p-2 md:p-4 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {teams.map((row, index) => (
                <tr className={rowClass(row.isPlayer)} key={row.rowKey || row.key}>
                  <td className="p-2 md:p-4 text-center font-mono font-bold text-gray-400 text-xs md:text-sm">{positionLabel(index)}</td>
                  <td className="p-2 md:p-4">
                    <div className="flex items-center gap-2">
                      <TeamStripe color={row.team.color} />
                      <div className="min-w-0">
                        <div className={`font-bold text-xs md:text-base truncate max-w-[160px] md:max-w-none ${row.isPlayer ? "text-blue-400" : "text-white"}`}>{row.team.name}</div>
                        <div className="text-[10px] font-mono text-gray-500">
                          {row.entries.map(entry => `#${entry.number}`).join(" · ")}
                          {row.isPlayer && <span className="font-sans uppercase ml-1 md:hidden">· Você</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  {statCells(row.stats)}
                  {pointsCell(row.points)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {view === "cars" && (
          <table className="w-full text-left">
            <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 md:p-4 w-10 md:w-16 text-center">Pos</th>
                <th className="p-2 md:p-4">Carro</th>
                {statHeaders}
                <th className="p-2 md:p-4 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {cars.map((car, index) => (
                <tr className={rowClass(car.isPlayer)} key={car.id}>
                  <td className="p-2 md:p-4 text-center font-mono font-bold text-gray-400 text-xs md:text-sm">{positionLabel(index)}</td>
                  <td className="p-2 md:p-4">
                    <div className="flex items-center gap-2">
                      <TeamStripe color={car.color} />
                      <span className="text-[10px] font-mono text-gray-500 w-7 shrink-0">#{car.number}</span>
                      <div className="min-w-0">
                        <div className={`font-bold text-xs md:text-base truncate max-w-[140px] md:max-w-none ${car.isPlayer ? "text-blue-400" : "text-white"}`}>{car.name}</div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[180px] md:max-w-none">{car.drivers.map(driver => driver.name).join(" · ")}</div>
                      </div>
                    </div>
                  </td>
                  {statCells(car.stats)}
                  {pointsCell(car.points)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {view === "drivers" && (
          <table className="w-full text-left">
            <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 md:p-4 w-10 md:w-16 text-center">Pos</th>
                <th className="p-2 md:p-4">Piloto</th>
                <th className="p-2 md:p-4 hidden md:table-cell">Carro</th>
                <th className="p-2 md:p-4 text-center hidden md:table-cell">Rating</th>
                <th className="p-2 md:p-4 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {drivers.map((driver, index) => (
                <tr className={`hover:bg-gray-800/30 ${driver.car.isPlayer ? "bg-blue-900/10" : ""}`} key={driver.id}>
                  <td className="p-2 md:p-4 text-center font-mono font-bold text-gray-400 text-xs md:text-sm">{positionLabel(index)}</td>
                  <td className="p-2 md:p-4">
                    <div className={`font-bold ${driver.car.isPlayer ? "text-blue-300" : "text-white"}`}>
                      <Flag driver={driver} /> {driver.name}
                    </div>
                    <div className="text-[10px] text-gray-500 md:hidden">
                      {driver.car.name} #{driver.car.number}
                    </div>
                  </td>
                  <td className="p-2 md:p-4 hidden md:table-cell">
                    <span className="flex items-center gap-2 text-gray-400">
                      <TeamStripe color={driver.car.color} /> {driver.car.name} <span className="font-mono text-xs text-gray-500">#{driver.car.number}</span>
                    </span>
                  </td>
                  <td className="p-2 md:p-4 text-center text-gray-400 hidden md:table-cell">{driver.rating}</td>
                  <td className="p-2 md:p-4 text-right font-mono font-black text-white">{driver.seasonPoints || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StandingsTab;
