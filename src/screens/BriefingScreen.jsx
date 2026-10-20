import { useState } from "react";
import { ArrowRight, CloudRain, CloudSun, Gauge, Headphones, Moon, Scale, Sun, Target, Trophy } from "lucide-react";
import { TRACKS, TRACK_TYPE_LABELS, WEATHER_SCENARIOS } from "../data/constants";
import { formatClock } from "../utils/helpers";
import { classStandings, playerStanding, objectiveFor } from "../engine/career";
import { isPlayerId, playerEntries } from "../engine/team";
import { bopWeight, classTeams } from "../engine/weekend";
import { TrackOutline } from "../components/TrackMap";
import { TeamStripe, CountryCode } from "../components/ui/common";
import { hasNightRacing } from "../components/dashboard/OverviewTab";

// Dica do engenheiro para o setup, conforme o tipo de pista
const SETUP_TIPS = {
  speed: "Pista de alta velocidade: comece com pouca asa, suspensão firme e câmbio longo.",
  technical: "Pista técnica: muita carga aerodinâmica, suspensão macia e câmbio curto.",
  endurance: "Pista de resistência: asa um pouco acima do meio, suspensão um pouco macia e câmbio um pouco longo.",
  balanced: "Pista equilibrada: parta do meio em tudo e ajuste com o piloto."
};

const level = (value, low, high, labels) => (value < low ? labels[0] : value > high ? labels[2] : labels[1]);

const BriefingScreen = ({ game, weekend, onContinue }) => {
  const track = weekend.track;
  const player = game.playerTeam;
  const engineer = player.staff?.raceEngineer?.stars ?? 2;
  const rain = Math.round(weekend.forecastRain * 100);
  const entries = playerEntries(game);
  const twoCars = entries.length > 1;
  const playerClasses = [...new Set(entries.map(entry => entry.class))];
  const [bopClass, setBopClass] = useState(player.class);
  const standings = classStandings(game, bopClass);
  const rivals = classTeams(game, bopClass).sort((a, b) => (a.bop || 0) - (b.bop || 0));
  const seasonStarted = (game.archive.currentSeasonRaces || []).length > 0;
  const sponsorGoals = player.sponsors.filter(contract => contract.goalPosition && (contract.type === "PERFORMANCE" || (contract.type === "LEMANS" && track.id === "lemans")));
  const WeatherIcon = rain >= 50 ? CloudRain : rain >= 20 ? CloudSun : Sun;
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">
              Briefing · Etapa {weekend.trackIndex + 1} de {TRACKS.length} · {track.date}
            </p>
            <h1 className="text-3xl md:text-5xl font-black italic mt-1">
              <CountryCode code={track.code} title={track.country} /> {track.name}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {track.country} · largada às {formatClock(track.startHour)} · {track.durationHours}h de prova
            </p>
          </div>
          <button
            onClick={onContinue}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-black uppercase tracking-wider shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            Ir para os treinos <ArrowRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col md:flex-row gap-6">
            <div className="md:w-1/2 h-48 md:h-auto">
              <TrackOutline track={track} color={player.color} />
            </div>
            <div className="md:w-1/2 grid grid-cols-2 gap-3 text-sm content-start">
              {[
                ["Tipo", TRACK_TYPE_LABELS[track.type]],
                ["Extensão", `${(track.length / 1000).toFixed(3)} km`],
                ["Voltas", track.laps],
                ["Pontos", track.pointsMultiplier > 1 ? `x${track.pointsMultiplier}` : "Normal"],
                ["Desgaste de pneus", level(track.tyreWear, 0.97, 1.12, ["Baixo", "Médio", "Alto"])],
                ["Ultrapassagem", level(track.overtaking, 0.85, 1.15, ["Difícil", "Normal", "Fácil"])],
                ["Consumo", level(track.fuelUse, 0.99, 1.04, ["Baixo", "Normal", "Alto"])],
                ["Perda no pit", `~${track.pitLane}s + serviço`]
              ].map(([label, value]) => (
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3" key={label}>
                  <div className="text-[10px] uppercase font-bold text-gray-500">{label}</div>
                  <div className="font-bold text-white">{value}</div>
                </div>
              ))}
              <div className="col-span-2 text-xs text-gray-400">
                Destaque: <span className="text-white font-bold">{track.keyFeature}</span>. Curvas-chave: {track.corners.join(", ")}.
                {hasNightRacing(track) && (
                  <span className="flex items-center gap-1 text-indigo-300 font-bold mt-1">
                    <Moon size={12} /> Parte da prova será à noite: ritmo um pouco menor e mais erros.
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <WeatherIcon size={16} className="text-blue-300" /> Previsão do tempo
            </h3>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black">{rain}%</span>
              <span className="text-sm text-gray-400 pb-2">de chance de chuva</span>
            </div>
            {engineer >= 3 && <p className="text-sm text-gray-300">Cenário mais provável: {WEATHER_SCENARIOS[weekend.scenario].label.toLowerCase()}.</p>}
            {weekend.startWetness > 30 && (
              <p className="text-sm font-bold text-blue-300 flex items-center gap-2">
                <CloudRain size={14} /> Pista molhada para a classificação e a largada.
              </p>
            )}
            <p className="text-[11px] text-gray-500">A precisão da previsão melhora com um Engenheiro de Corrida melhor ({engineer}★).</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-3">
              <Headphones size={16} className="text-purple-300" /> Engenheiro
            </h3>
            <p className="text-sm text-gray-200">{engineer >= 2 ? SETUP_TIPS[track.type] : "Sem dados de setup de anos anteriores. Vamos descobrir nos treinos."}</p>
            <p className="text-[11px] text-gray-500 mt-3">
              Lembre: cada stint dura um tanque; pneus médios aguentam quase dois. Troque o piloto antes que a fadiga passe de 60%.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-3">
              <Target size={16} className="text-green-400" /> Metas
            </h3>
            <ul className="space-y-2 text-sm">
              {entries.map(entry => {
                const objective = objectiveFor(game, entry);
                return (
                  <li className="flex items-start gap-2" key={entry.id}>
                    <Trophy size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                    <span>
                      Diretoria{twoCars ? ` (#${entry.number} ${entry.class === "HYPERCAR" ? "HYP" : "GT3"})` : ""}: {objective?.text}.
                      {seasonStarted ? ` Agora: ${playerStanding(game, entry)}º.` : ""}
                    </span>
                  </li>
                );
              })}
              <li className="flex items-start gap-2">
                <Gauge size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <span>
                  {twoCars
                    ? `Terminar até ${entries.map(entry => `P${objectiveFor(game, entry)?.position} (#${entry.number})`).join(" e ")} na classe aumenta a confiança da diretoria.`
                    : `Terminar até P${objectiveFor(game, player)?.position} na classe aumenta a confiança da diretoria.`}
                </span>
              </li>
              {sponsorGoals.map(contract => (
                <li className="flex items-start gap-2" key={contract.id}>
                  <Target size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <span>
                    {contract.name}: Top {contract.goalPosition} na classe
                    {contract.type === "LEMANS" ? " em Le Mans (bônus grande)" : ""}.
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Scale size={16} className="text-green-400" /> BoP da classe
              </h3>
              {playerClasses.length > 1 && (
                <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
                  {["HYPERCAR", "LMGT3"].map(cls => (
                    <button
                      key={cls}
                      onClick={() => setBopClass(cls)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${bopClass === cls ? (cls === "HYPERCAR" ? "bg-red-600 text-white" : "bg-yellow-600 text-black") : "text-gray-400"}`}
                    >
                      {cls === "HYPERCAR" ? "HYP" : "GT3"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {game.career.bopEnabled === false ? (
              <p className="text-sm text-gray-400">BoP desligado nesta carreira.</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {rivals.map(team => (
                  <div className={`flex items-center justify-between text-xs px-2 py-1 rounded ${isPlayerId(team.id) ? "bg-blue-900/30" : ""}`} key={team.id}>
                    <span className="flex items-center gap-2 min-w-0">
                      <TeamStripe color={team.color} />
                      <span className={`truncate font-bold ${isPlayerId(team.id) ? "text-blue-300" : "text-gray-300"}`}>{team.name}</span>
                      <span className="text-gray-600">{standings.findIndex(item => item.id === team.id) + 1}º</span>
                    </span>
                    <span className={`font-mono font-bold ${(team.bop || 0) > 0 ? "text-green-400" : (team.bop || 0) < 0 ? "text-red-400" : "text-gray-500"}`}>
                      {(team.bop || 0) > 0 ? "+" : ""}
                      {(team.bop || 0).toFixed(2)}% · {bopWeight(team.bop || 0) > 0 ? "+" : ""}
                      {bopWeight(team.bop || 0)}kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BriefingScreen;
