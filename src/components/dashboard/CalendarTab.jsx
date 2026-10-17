import { CheckCheck, CirclePlay, Moon } from "lucide-react";
import { TRACKS, TRACK_TYPE_LABELS } from "../../data/constants";
import { hasNightRacing } from "./OverviewTab";
import { CountryCode } from "../ui/common";

const CalendarTab = ({ game }) => {
  const races = game.archive.currentSeasonRaces || [];
  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <p className="text-sm text-gray-400 mb-2">
        Mundial de Endurance {game.season} · {TRACKS.length} etapas. Le Mans vale pontos em dobro; Qatar e Bahrein valem 1,5x. A pole de cada classe vale 1 ponto.
      </p>
      {TRACKS.map((track, index) => {
        const result = races[index];
        const done = index < game.raceIndex;
        const next = index === game.raceIndex;
        const mine = result?.player;
        return (
          <div
            className={`flex flex-col md:flex-row md:items-center gap-3 md:gap-5 p-4 rounded-xl border transition-colors ${
              next ? "border-blue-500 bg-blue-900/10 shadow-lg shadow-blue-900/20" : done ? "border-gray-800 bg-gray-900/60" : "border-gray-800 bg-gray-900"
            }`}
            key={track.id}
          >
            <div className="flex items-center gap-4 md:w-80 shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 ${
                  done ? "bg-gray-800 text-gray-400" : next ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"
                }`}
              >
                {done ? <CheckCheck size={18} /> : next ? <CirclePlay size={18} /> : index + 1}
              </div>
              <div className="min-w-0">
                <div className="font-black text-white truncate">
                  <CountryCode code={track.code} title={track.country} /> {track.name}
                </div>
                <div className="text-[11px] text-gray-500">
                  {track.date} · {TRACK_TYPE_LABELS[track.type]} · {track.laps} voltas
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:w-48 shrink-0">
              {track.pointsMultiplier > 1 && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-yellow-500 text-black">x{track.pointsMultiplier} PONTOS</span>}
              {hasNightRacing(track) && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-900 text-indigo-200 flex items-center gap-1">
                  <Moon size={10} /> NOITE
                </span>
              )}
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-gray-800 text-gray-400">{track.durationHours}H</span>
            </div>
            <div className="flex-1 text-sm">
              {done && result ? (
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-6">
                  <span className="text-gray-400">
                    <span className="text-red-400 font-bold">HYP</span> {result.winner}
                  </span>
                  <span className="text-gray-400">
                    <span className="text-yellow-400 font-bold">GT3</span> {result.gt3Winner}
                  </span>
                  {mine && (
                    <span className={`font-bold ${!mine.finished ? "text-red-400" : mine.classPos <= 3 ? "text-green-400" : "text-blue-300"}`}>
                      Você: {mine.finished ? `P${mine.classPos}` : "DNF"} ({mine.points} pts)
                    </span>
                  )}
                </div>
              ) : next ? (
                <span className="text-blue-300 font-bold animate-pulse">PRÓXIMA ETAPA — destaque: {track.keyFeature}</span>
              ) : (
                <span className="text-gray-500">{track.keyFeature}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CalendarTab;
