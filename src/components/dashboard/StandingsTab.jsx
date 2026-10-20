import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { classStandings } from "../../engine/career";
import { classTeams } from "../../engine/weekend";
import { Flag, TeamStripe } from "../ui/common";
import { isPlayerId } from "../../engine/team";

const positionLabel = index =>
  index === 0 ? <span className="text-yellow-400 text-base">1º</span> : index === 1 ? <span className="text-gray-300 text-base">2º</span> : index === 2 ? <span className="text-orange-400 text-base">3º</span> : `${index + 1}º`;

const StandingsTab = ({ game }) => {
  const [standingsClass, setStandingsClass] = useState(game.playerTeam.class);
  const [view, setView] = useState("teams");
  const sortedTeams = classStandings(game, standingsClass);
  const drivers = classTeams(game, standingsClass)
    .flatMap(team => team.drivers.map(driver => ({ ...driver, team })))
    .sort((a, b) => (b.seasonPoints || 0) - (a.seasonPoints || 0) || b.rating - a.rating);
  const toggle = (value, current, setter, activeClass) => (
    <button onClick={() => setter(value)} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${current === value ? activeClass : "text-gray-400 hover:text-white"}`}>
      {value === "HYPERCAR" ? "HYPERCAR" : value === "LMGT3" ? "LMGT3" : value === "teams" ? "EQUIPES" : "PILOTOS"}
    </button>
  );
  return (
    <div className="h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 md:pb-0">
      <div className="p-4 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center shrink-0 flex-wrap gap-2">
        <h3 className="font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-yellow-500" size={20} /> <span className="hidden md:inline">Classificação {game.season}</span>
        </h3>
        <div className="flex gap-2 flex-wrap">
          <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800">
            {toggle("teams", view, setView, "bg-blue-600 text-white")}
            {toggle("drivers", view, setView, "bg-blue-600 text-white")}
          </div>
          <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800">
            {toggle("HYPERCAR", standingsClass, setStandingsClass, "bg-red-600 text-white")}
            {toggle("LMGT3", standingsClass, setStandingsClass, "bg-yellow-600 text-white")}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {view === "teams" ? (
          <table className="w-full text-left">
            <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 md:p-4 w-10 md:w-16 text-center">Pos</th>
                <th className="p-2 md:p-4">Equipe</th>
                <th className="p-2 md:p-4 text-center hidden md:table-cell">Vitórias</th>
                <th className="p-2 md:p-4 text-center hidden md:table-cell">Pódios</th>
                <th className="p-2 md:p-4 text-center hidden lg:table-cell">Poles</th>
                <th className="p-2 md:p-4 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {sortedTeams.map((team, index) => (
                <tr className={`hover:bg-gray-800/30 transition-colors ${isPlayerId(team.id) ? "bg-blue-900/10 border-l-4 border-l-blue-500" : ""}`} key={team.id}>
                  <td className="p-2 md:p-4 text-center font-mono font-bold text-gray-400 text-xs md:text-sm">{positionLabel(index)}</td>
                  <td className="p-2 md:p-4">
                    <div className="flex items-center gap-2">
                      <TeamStripe color={team.color} />
                      <span className="text-[10px] font-mono text-gray-500 w-6">#{team.number}</span>
                      <div className="min-w-0">
                        <div className={`font-bold text-xs md:text-base truncate max-w-[140px] md:max-w-none ${isPlayerId(team.id) ? "text-blue-400" : "text-white"}`}>{team.name}</div>
                        {isPlayerId(team.id) && <div className="text-[8px] text-gray-500 uppercase mt-0.5 md:hidden">Você</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-2 md:p-4 text-center text-gray-500 hidden md:table-cell">{team.stats.wins}</td>
                  <td className="p-2 md:p-4 text-center text-gray-500 hidden md:table-cell">{team.stats.podiums}</td>
                  <td className="p-2 md:p-4 text-center text-gray-500 hidden lg:table-cell">{team.stats.poles || 0}</td>
                  <td className="p-2 md:p-4 text-right">
                    <span className="font-mono font-black text-sm md:text-xl text-white bg-gray-800 px-2 py-1 md:px-3 rounded border border-gray-700 block w-fit ml-auto">{team.points}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 md:p-4 w-10 md:w-16 text-center">Pos</th>
                <th className="p-2 md:p-4">Piloto</th>
                <th className="p-2 md:p-4 hidden md:table-cell">Equipe</th>
                <th className="p-2 md:p-4 text-center hidden md:table-cell">Rating</th>
                <th className="p-2 md:p-4 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {drivers.map((driver, index) => (
                <tr className={`hover:bg-gray-800/30 ${isPlayerId(driver.team.id) ? "bg-blue-900/10" : ""}`} key={driver.id}>
                  <td className="p-2 md:p-4 text-center font-mono font-bold text-gray-400 text-xs md:text-sm">{positionLabel(index)}</td>
                  <td className="p-2 md:p-4">
                    <div className={`font-bold ${isPlayerId(driver.team.id) ? "text-blue-300" : "text-white"}`}>
                      <Flag driver={driver} /> {driver.name}
                    </div>
                    <div className="text-[10px] text-gray-500 md:hidden">{driver.team.name}</div>
                  </td>
                  <td className="p-2 md:p-4 hidden md:table-cell">
                    <span className="flex items-center gap-2 text-gray-400">
                      <TeamStripe color={driver.team.color} /> {driver.team.name}
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
