import { useMemo, useState } from "react";
import {
  Calendar,
  ChartColumn,
  ChartPie,
  CircleX,
  Flag,
  Funnel,
  ListOrdered,
  Medal,
  Star,
  TrendingUp,
  Trophy
} from "lucide-react";
import { isPlayerId } from "../../engine/team";

const StatsModal = ({ archive, currentSeason, currentStandings, onClose }) => {
  const [selectedYear, setSelectedYear] = useState(currentSeason);
  const [activeTab, setActiveTab] = useState("standings");
  const [rankingSort, setRankingSort] = useState("wins");
  const [classFilter, setClassFilter] = useState("HYPERCAR");
  const seasonData =
    selectedYear === currentSeason
      ? {
          year: currentSeason,
          standings: currentStandings,
          races: archive.currentSeasonRaces || []
        }
      : archive.history.find(season => season.year === selectedYear);
  const filteredSeason = useMemo(
    () =>
      seasonData
        ? {
            ...seasonData,
            standings: (seasonData.standings || [])
              .filter(item => item.class === classFilter)
              .sort((a, b) => (b.points || 0) - (a.points || 0)),
            // Arquivos antigos não têm vencedor por equipe nem resultado de equipe do jogador
            races: (seasonData.races || []).map(race => ({
              ...race,
              displayWinner: classFilter === "HYPERCAR" ? race.winner : race.gt3Winner,
              displayPodium: (classFilter === "HYPERCAR" ? race.podium : race.gt3Podium) || [],
              displayTeamWinner: race.teamWinners?.[classFilter],
              displayPlayerTeam: race.playerTeams?.[classFilter]
            })),
            carChampion: seasonData.carChampions?.[classFilter]
          }
        : null,
    [seasonData, classFilter]
  );
  const careerStats = useMemo(() => {
    const stats = {};
    const addTeamStats = team => {
      if (team.class === classFilter) {
        stats[team.id] ||= {
          id: team.id,
          name: team.name,
          wins: 0,
          podiums: 0,
          titles: 0,
          class: team.class
        };
        stats[team.id].wins += team.stats?.wins || 0;
        stats[team.id].podiums += team.stats?.podiums || 0;
      }
    };
    archive.history.forEach(season => {
      const classStandings = (season.standings || [])
        .filter(item => item.class === classFilter)
        .sort((a, b) => (b.points || 0) - (a.points || 0));
      if (classStandings.length > 0) {
        const champion = classStandings[0];
        stats[champion.id] ||= {
          id: champion.id,
          name: champion.name,
          wins: 0,
          podiums: 0,
          titles: 0,
          class: champion.class
        };
        stats[champion.id].titles += 1;
      }
      (season.standings || []).forEach(addTeamStats);
    });
    currentStandings.forEach(addTeamStats);
    return Object.values(stats);
  }, [archive.history, currentStandings, classFilter]);
  const sortedRanking = useMemo(
    () => [...careerStats].sort((a, b) => b[rankingSort] - a[rankingSort]),
    [careerStats, rankingSort]
  );
  // Equipe do jogador na classe filtrada (arquivos antigos podem ter uma linha por carro: soma as linhas)
  const playerCareer = careerStats
    .filter(item => isPlayerId(item.id))
    .reduce(
      (total, item) => ({
        name: total.name || item.name,
        wins: total.wins + item.wins,
        podiums: total.podiums + item.podiums,
        titles: total.titles + item.titles
      }),
      { name: null, wins: 0, podiums: 0, titles: 0 }
    );
  playerCareer.name ||= "Player";
  if (filteredSeason) {
    return (
      <div className="fixed inset-0 bg-gray-950/95 z-50 overflow-y-auto flex items-start md:items-center justify-center p-0 md:p-4">
        <div className="w-full md:max-w-5xl bg-gray-900 md:border border-gray-700 md:rounded-xl shadow-2xl flex flex-col min-h-screen md:min-h-0 md:max-h-[90vh]">
          <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800 md:rounded-t-xl sticky top-0 z-10">
            <div>
              <h2 className="text-xl md:text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                CENTRO DE DADOS
              </h2>
              <p className="text-gray-400 text-xs md:text-sm">Análise Histórica e Telemetria</p>
            </div>
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full text-white">
              <CircleX size={24} />
            </button>
          </div>
          <div className="p-4 md:p-8 overflow-y-auto pb-20 md:pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-gray-800 pb-4">
              <div className="flex gap-2 overflow-x-auto custom-scrollbar w-full md:w-auto">
                {archive.history.map(item => (
                  <button
                    onClick={() => setSelectedYear(item.year)}
                    className={`px-4 py-2 rounded font-bold whitespace-nowrap text-sm ${selectedYear === item.year ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500 hover:bg-gray-700"}`}
                    key={item.year}
                  >
                    {item.year}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedYear(currentSeason)}
                  className={`px-4 py-2 rounded font-bold whitespace-nowrap text-sm ${selectedYear === currentSeason ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500 hover:bg-gray-700"}`}
                >
                  {currentSeason} (Atual)
                </button>
              </div>
              <div className="flex items-center gap-2 bg-gray-950 p-1.5 rounded-lg border border-gray-700">
                <Funnel size={16} className="text-gray-500 ml-2" />
                <button
                  onClick={() => setClassFilter("HYPERCAR")}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors ${classFilter === "HYPERCAR" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  HYPERCAR
                </button>
                <button
                  onClick={() => setClassFilter("LMGT3")}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors ${classFilter === "LMGT3" ? "bg-yellow-600 text-black" : "text-gray-400 hover:text-white"}`}
                >
                  LMGT3
                </button>
              </div>
            </div>
            <div className="flex gap-4 mb-6 border-b border-gray-800 overflow-x-auto">
              {["standings", "races", "analysis", "trophies"].map(item => (
                <button
                  onClick={() => setActiveTab(item)}
                  className={`flex items-center gap-2 pb-2 border-b-2 text-sm md:text-base whitespace-nowrap ${activeTab === item ? "border-blue-500 text-white" : "border-transparent text-gray-500"}`}
                  key={item}
                >
                  {item === "standings" && <TrendingUp size={16} />}
                  {item === "races" && <Flag size={16} />}
                  {item === "analysis" && <ChartColumn size={16} />}
                  {item === "trophies" && <Star size={16} />}
                  <span className="uppercase font-bold">
                    {item === "standings"
                      ? "Classificação"
                      : item === "races"
                        ? "Resultados"
                        : item === "analysis"
                          ? "Análise"
                          : "Hall da Fama"}
                  </span>
                </button>
              ))}
            </div>
            <div className="bg-gray-900/50 rounded-xl p-0 md:p-6 min-h-[300px] text-white">
              {activeTab === "standings" && (
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 px-2 md:px-0">
                    <Trophy className="text-yellow-500" size={20} /> Campeonato de Equipes ({classFilter})
                  </h3>
                  {filteredSeason.carChampion && (
                    <p className="text-xs text-gray-400 mb-3 px-2 md:px-0">
                      Campeões de pilotos: <span className="font-bold text-gray-200">{filteredSeason.carChampion}</span>
                    </p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                          <th className="p-3">Pos</th>
                          <th className="p-3">Equipe</th>
                          <th className="p-3 text-right">Pts</th>
                          <th className="p-3 text-right">Vitórias</th>
                          <th className="p-3 text-right">Pódios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSeason.standings.map((item, index) => (
                          <tr
                            className={`border-b border-gray-800 hover:bg-gray-800/50 ${isPlayerId(item.id) ? "bg-blue-900/10" : ""}`}
                            key={`${item.id}-${index}`}
                          >
                            <td className="p-3 font-mono text-gray-400 text-sm">{index + 1}</td>
                            <td
                              className={`p-3 font-bold text-sm ${isPlayerId(item.id) ? "text-blue-400" : "text-gray-200"}`}
                            >
                              {item.name}
                              {(item.number || item.numbers?.length > 0) && (
                                <span className="ml-2 text-[10px] font-mono text-gray-500">
                                  #{item.number ? String(item.number).split("/").join("/#") : item.numbers.join("/#")}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-yellow-500">
                              {item.points || 0}
                            </td>
                            <td className="p-3 text-right text-gray-400 text-sm">{item.stats?.wins || 0}</td>
                            <td className="p-3 text-right text-gray-400 text-sm">
                              {item.stats?.podiums || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeTab === "races" && (
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 px-2 md:px-0">
                    <Calendar className="text-blue-500" size={20} /> Vencedores {classFilter} - {selectedYear}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSeason.races.map((item, index) => (
                      <div
                        className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-sm"
                        key={index}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-sm text-gray-300 truncate max-w-[200px]">
                            {item.track}
                          </h4>
                          <span className="text-[10px] bg-gray-900 px-2 py-1 rounded text-gray-500">
                            R{index + 1}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded">
                            <span className="text-yellow-500 font-bold text-xs">Vencedor</span>
                            <span className="font-bold text-white truncate max-w-[150px] text-xs">
                              {item.displayWinner || "N/A"}
                            </span>
                          </div>
                          {item.displayTeamWinner && (
                            <div className="flex justify-between items-center px-2 text-xs">
                              <span className="text-gray-500">Equipe</span>
                              <span className="font-bold text-gray-300 truncate max-w-[150px]">{item.displayTeamWinner}</span>
                            </div>
                          )}
                          {item.displayPlayerTeam && (
                            <div className="flex justify-between items-center px-2 text-xs">
                              <span className="text-blue-400 font-bold">Sua equipe</span>
                              <span className="font-bold text-blue-300">
                                {item.displayPlayerTeam.position ? `${item.displayPlayerTeam.position}º` : "—"} · {item.displayPlayerTeam.points ?? 0} pts
                              </span>
                            </div>
                          )}
                          {item.displayPodium && item.displayPodium.length > 1 && (
                            <div className="flex justify-between px-1">
                              <span className="text-gray-500 text-[10px]">
                                P2: {item.displayPodium[1] || "-"}
                              </span>
                              <span className="text-gray-500 text-[10px]">
                                P3: {item.displayPodium[2] || "-"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredSeason.races.length === 0 && (
                      <p className="text-gray-500 italic px-2">
                        Nenhuma corrida realizada nesta temporada ainda.
                      </p>
                    )}
                  </div>
                </div>
              )}
              {activeTab === "analysis" && (
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-2 px-2 md:px-0">
                    <ChartPie className="text-purple-500" size={20} /> Domínio da Temporada ({classFilter})
                  </h3>
                  <div className="mb-8 px-2 md:px-0">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Vitórias por Equipe</h4>
                    <div className="space-y-4">
                      {filteredSeason.standings
                        .filter(item => item.stats?.wins > 0)
                        .sort((a, b) => b.stats.wins - a.stats.wins)
                        .map((item, index) => (
                          <div key={index}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-bold text-gray-300">{item.name}</span>
                              <span className="text-gray-400">{item.stats.wins} vitórias</span>
                            </div>
                            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{
                                  width: `${(item.stats.wins / Math.max(1, filteredSeason.races.length)) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      {filteredSeason.standings.filter(item => item.stats?.wins > 0).length === 0 && (
                        <p className="text-gray-500 text-sm">
                          Sem dados de vitórias suficientes para análise.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "trophies" && (
                <div className="animate-in fade-in">
                  <div className="flex flex-col items-center justify-center text-center mb-10">
                    <div className="mb-8">
                      <h3 className="text-2xl font-black italic text-yellow-500 mb-2 flex items-center justify-center gap-2">
                        <Star fill="currentColor" /> SUA CARREIRA ({classFilter})
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Estatísticas acumuladas de {playerCareer.name} nesta categoria.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl px-4">
                      <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group hover:bg-gray-800 transition-colors">
                        <div className="absolute inset-0 bg-yellow-500/5 group-hover:bg-yellow-500/10 transition-colors" />
                        <Medal size={48} className="text-yellow-400 mb-2 drop-shadow-lg" />
                        <span className="text-5xl font-black text-white">{playerCareer.wins}</span>
                        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider mt-1">
                          Vitórias
                        </span>
                      </div>
                      <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group hover:bg-gray-800 transition-colors">
                        <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
                        <Star size={48} className="text-blue-400 mb-2 drop-shadow-lg" />
                        <span className="text-5xl font-black text-white">{playerCareer.podiums}</span>
                        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider mt-1">
                          Pódios
                        </span>
                      </div>
                      <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group hover:bg-gray-800 transition-colors">
                        <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors" />
                        <Trophy size={48} className="text-purple-400 mb-2 drop-shadow-lg" />
                        <span className="text-5xl font-black text-white">{playerCareer.titles}</span>
                        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider mt-1">
                          Títulos
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full px-2 md:px-0">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <ListOrdered size={20} /> Rankings Históricos ({classFilter})
                      </h3>
                      <div className="flex bg-gray-800 rounded-lg p-1">
                        <button
                          onClick={() => setRankingSort("wins")}
                          className={`px-3 py-1 text-xs font-bold rounded ${rankingSort === "wins" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                        >
                          VITÓRIAS
                        </button>
                        <button
                          onClick={() => setRankingSort("podiums")}
                          className={`px-3 py-1 text-xs font-bold rounded ${rankingSort === "podiums" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                        >
                          PÓDIOS
                        </button>
                        <button
                          onClick={() => setRankingSort("titles")}
                          className={`px-3 py-1 text-xs font-bold rounded ${rankingSort === "titles" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                        >
                          TÍTULOS
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-800">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-800 text-gray-500 text-xs uppercase">
                            <th className="p-3 w-16 text-center">Pos</th>
                            <th className="p-3">Equipe</th>
                            <th className="p-3 text-right">
                              {rankingSort === "titles"
                                ? "Títulos"
                                : rankingSort === "wins"
                                  ? "Vitórias"
                                  : "Pódios"}
                            </th>
                            <th className="p-3 text-right hidden md:table-cell text-gray-600">
                              Total {rankingSort === "titles" ? "Vitórias" : "Títulos"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRanking.slice(0, 10).map((item, index) => (
                            <tr
                              className={`border-b border-gray-800 ${isPlayerId(item.id) ? "bg-blue-900/20" : "hover:bg-gray-800/30"}`}
                              key={item.id}
                            >
                              <td className="p-3 text-center font-mono font-bold text-gray-500">
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                              </td>
                              <td
                                className={`p-3 font-bold text-sm ${isPlayerId(item.id) ? "text-blue-400" : "text-gray-200"}`}
                              >
                                {item.name}
                                {isPlayerId(item.id) && (
                                  <span className="ml-2 text-[10px] bg-blue-900 text-blue-200 px-1 rounded">
                                    VOCÊ
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-white text-base">
                                {item[rankingSort]}
                              </td>
                              <td className="p-3 text-right hidden md:table-cell text-gray-500 text-sm">
                                {rankingSort === "titles" ? item.wins : item.titles}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {sortedRanking.length === 0 && (
                        <div className="p-4 text-center text-gray-500">
                          Nenhum dado histórico disponível para {classFilter}.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="p-8 text-center text-white bg-gray-900 h-screen flex items-center justify-center">
        Dados não encontrados.
        <button onClick={onClose} className="block mt-4 text-blue-500">
          Voltar
        </button>
      </div>
    );
  }
};
export default StatsModal;
