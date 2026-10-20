import {
  ArrowUpCircle,
  Award,
  Briefcase,
  CloudRain,
  Crown,
  Flag,
  Lock,
  Medal,
  Moon,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap
} from "lucide-react";
import { ACHIEVEMENTS, TRACKS } from "../../data/constants";
import { formatLapTime } from "../../utils/helpers";
import { CountryCode, MeterBar } from "../ui/common";

const ICONS = { ArrowUpCircle, Briefcase, CloudRain, Crown, Flag, Medal, Moon, ShieldCheck, Sparkles, Timer, TrendingUp, Trophy, Users, Wallet, Zap };

const CLASSES = [
  ["HYPERCAR", "HYP", "text-red-400"],
  ["LMGT3", "GT3", "text-yellow-400"]
];

const AchievementsTab = ({ game }) => {
  const unlocked = game.career.achievements || {};
  const records = game.archive.trackRecords || {};
  const count = ACHIEVEMENTS.filter(item => unlocked[item.id]).length;
  const playerRecords = Object.values(records).flatMap(byClass => Object.values(byClass)).filter(record => record?.isPlayer).length;
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 md:pb-0">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <h3 className="text-white font-bold uppercase text-sm flex items-center gap-2">
            <Award size={16} className="text-yellow-400" /> Conquistas da carreira
          </h3>
          <div className="w-full md:w-64">
            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
              <span>Progresso</span>
              <span>
                {count}/{ACHIEVEMENTS.length}
              </span>
            </div>
            <MeterBar value={count} max={ACHIEVEMENTS.length} color="bg-yellow-500" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ACHIEVEMENTS.map(item => {
            const info = unlocked[item.id];
            const Icon = ICONS[item.icon] || Trophy;
            return (
              <div
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  info ? "bg-gradient-to-br from-yellow-900/20 to-gray-900 border-yellow-700/50" : "bg-gray-900 border-gray-800 opacity-60"
                }`}
                key={item.id}
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${info ? "bg-yellow-500 text-black" : "bg-gray-800 text-gray-600"}`}>
                  {info ? <Icon size={20} /> : <Lock size={20} />}
                </div>
                <div className="min-w-0">
                  <div className={`font-black ${info ? "text-white" : "text-gray-400"}`}>{item.title}</div>
                  <p className="text-xs text-gray-400 leading-snug">{item.description}</p>
                  {info && (
                    <p className="text-[10px] text-yellow-300 font-bold mt-1">
                      {info.season}
                      {info.track ? ` · ${info.track}` : ""}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-white font-bold uppercase text-sm mb-1 flex items-center gap-2">
          <Timer size={16} className="text-purple-400" /> Recordes de pista
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Melhor volta de corrida em cada pista desde o início da carreira.{playerRecords > 0 ? ` Sua equipe tem ${playerRecords} recorde${playerRecords > 1 ? "s" : ""}.` : ""}
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[520px]">
              <thead className="text-[10px] uppercase text-gray-500 bg-gray-950">
                <tr>
                  <th className="p-3">Pista</th>
                  {CLASSES.map(([cls, label]) => (
                    <th className="p-3" key={cls}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {TRACKS.map(track => (
                  <tr key={track.id}>
                    <td className="p-3 font-bold text-gray-200 whitespace-nowrap">
                      <CountryCode code={track.code} title={track.country} /> {track.name}
                    </td>
                    {CLASSES.map(([cls, , color]) => {
                      const record = records[track.id]?.[cls];
                      return (
                        <td className={`p-3 ${record?.isPlayer ? "bg-blue-900/20" : ""}`} key={cls}>
                          {record ? (
                            <div>
                              <div className={`font-mono font-bold ${record.isPlayer ? "text-blue-300" : color}`}>{formatLapTime(record.time)}</div>
                              <div className="text-[10px] text-gray-500 truncate max-w-[200px]">
                                {record.teamName}
                                {record.driver ? ` · ${record.driver}` : ""} · {record.season}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AchievementsTab;
