import { useState } from "react";
import { ChevronRight, CirclePlay, Megaphone, Moon, Newspaper, Scale, Star, Swords, Target, Trophy, Users, Wallet, Wrench } from "lucide-react";
import { TRACKS, TRACK_TYPE_LABELS, PART_INFO, DIFFICULTIES } from "../../data/constants";
import { formatMoney, surname } from "../../utils/helpers";
import { classStandings, playerStanding, objectiveFor } from "../../engine/career";
import { computeBop, allTeams, bopWeight } from "../../engine/weekend";
import { driversPayroll, staffPayroll, facilityUpkeep, secondCarOperations, CAR_PARTS } from "../../engine/economy";
import { playerEntries, isPlayerId, sharedDevelopment } from "../../engine/team";
import { ClassBadge, MeterBar, confidenceColor, Flag, CategoryBadge, TeamStripe, CountryCode } from "../ui/common";
import { TrackOutline } from "../TrackMap";

export const hasNightRacing = track => track.startHour + track.durationHours > 19.5;

const Card = ({ title, icon: Icon, iconClass = "text-blue-400", action, children, className = "" }) => (
  <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-5 shadow-lg ${className}`}>
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
        <Icon size={16} className={iconClass} /> {title}
      </h3>
      {action}
    </div>
    {children}
  </div>
);

const LinkButton = ({ onClick, label }) => (
  <button onClick={onClick} className="text-[10px] font-bold uppercase text-blue-400 hover:text-blue-300 flex items-center gap-1">
    {label} <ChevronRight size={12} />
  </button>
);

// Seletor compacto entre os carros do jogador
const CarSwitch = ({ entries, value, onChange }) =>
  entries.length > 1 ? (
    <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800">
      {entries.map(entry => (
        <button
          key={entry.id}
          onClick={() => onChange(entry.id)}
          className={`px-2 py-0.5 text-[10px] font-black rounded ${value === entry.id ? (entry.class === "HYPERCAR" ? "bg-red-600 text-white" : "bg-yellow-600 text-black") : "text-gray-400"}`}
        >
          #{entry.number}
        </button>
      ))}
    </div>
  ) : null;

// Evento do paddock pendente, com as escolhas
const PaddockEventCard = ({ event, funds, onResolve }) => (
  <div className="xl:col-span-3 bg-gradient-to-r from-amber-900/30 via-gray-900 to-gray-900 border-2 border-amber-600/60 rounded-xl p-4 md:p-5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-500">
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">
      <Megaphone size={14} /> Paddock · decisão pendente
    </div>
    <h3 className="text-xl md:text-2xl font-black italic text-white">{event.title}</h3>
    <p className="text-sm text-gray-300 mt-1 max-w-3xl">{event.body}</p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
      {event.choices.map(choice => {
        const blocked = choice.cost != null && choice.cost > funds;
        return (
          <button
            key={choice.id}
            disabled={blocked}
            onClick={() => onResolve(choice.id)}
            className="text-left p-3 rounded-lg border border-gray-700 bg-gray-950 hover:border-amber-500 hover:bg-amber-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <div className="font-bold text-white text-sm">{choice.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{blocked ? "Fundos insuficientes" : choice.detail}</div>
          </button>
        );
      })}
    </div>
    <p className="text-[10px] text-gray-500 mt-2">Se você for para a pista sem decidir, o evento é ignorado.</p>
  </div>
);

const OverviewTab = ({ game, onStartWeekend, setActiveTab, onResolveEvent }) => {
  const player = game.playerTeam;
  const sister = game.sisterTeam;
  const entries = playerEntries(game);
  const twoCars = entries.length > 1;
  const [carId, setCarId] = useState(player.id);
  const [lineupId, setLineupId] = useState(player.id);
  const selected = entries.find(entry => entry.id === carId) || player;
  const lineupEntry = entries.find(entry => entry.id === lineupId) || player;
  const track = TRACKS[game.raceIndex];
  const seasonStarted = (game.archive.currentSeasonRaces || []).length > 0;
  const bops = track && game.career.bopEnabled !== false ? computeBop(allTeams(game), track.type) : {};
  const perRaceCosts =
    entries.reduce((sum, entry) => sum + driversPayroll(entry), 0) + staffPayroll(player) + facilityUpkeep(player) + (sister ? secondCarOperations(sister.class) : 0);
  const sponsorIncome = player.sponsors.reduce((sum, contract) => sum + (contract.type === "GAMBLE" ? contract.maxRandom / 2 : contract.perRacePayment), 0);
  const lastLedger = player.ledger?.[player.ledger.length - 1];
  const unread = game.newsFeed.filter(item => !item.read).slice(0, 3);
  const rivals = allTeams(game).filter(team => team.class === selected.class && !isPlayerId(team.id));
  const classAvg = part => rivals.reduce((sum, team) => sum + team.car[part], 0) / Math.max(1, rivals.length);
  const sharedCar = sharedDevelopment(game);

  // Situação de cada carro no campeonato da sua classe
  const standingsInfo = entries.map(entry => {
    const standings = classStandings(game, entry.class);
    const position = playerStanding(game, entry);
    const leader = standings[0];
    const rival = position > 1 ? standings[position - 2] : standings[1];
    return { entry, standings, position, leader, rival, objective: objectiveFor(game, entry) };
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {game.pendingEvent && <PaddockEventCard event={game.pendingEvent} funds={player.funds} onResolve={onResolveEvent} />}
      {track && (
        <div className="xl:col-span-2 bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-2xl relative">
          <div className="absolute inset-y-0 right-0 w-full md:w-1/2 opacity-30 md:opacity-60 pointer-events-none">
            <TrackOutline track={track} color={player.color} />
          </div>
          <div className="relative z-10 p-5 md:p-6 flex flex-col gap-4 md:max-w-[55%]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400">
              <span>
                Etapa {game.raceIndex + 1} de {TRACKS.length}
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400">{track.date}</span>
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-black italic text-white leading-tight">
                <CountryCode code={track.code} title={track.country} /> {track.name}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {track.country} · {TRACK_TYPE_LABELS[track.type]} · {track.laps} voltas de {(track.length / 1000).toFixed(3)} km
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {track.pointsMultiplier > 1 && (
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-yellow-500 text-black">Pontos x{track.pointsMultiplier}</span>
              )}
              {hasNightRacing(track) && (
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-indigo-900 text-indigo-200 flex items-center gap-1">
                  <Moon size={10} /> Corrida noturna
                </span>
              )}
              <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-gray-800 text-gray-300">{track.durationHours}h de prova</span>
              {entries.map(entry => {
                const bop = bops[entry.id] || 0;
                return bop !== 0 ? (
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-1 rounded flex items-center gap-1 ${bop > 0 ? "bg-green-900 text-green-200" : "bg-red-900 text-red-200"}`}
                    key={entry.id}
                  >
                    <Scale size={10} /> {twoCars ? `#${entry.number} ` : ""}BoP {bop > 0 ? "+" : ""}
                    {bop.toFixed(2)}% ({bopWeight(bop) > 0 ? "+" : ""}
                    {bopWeight(bop)} kg)
                  </span>
                ) : null;
              })}
            </div>
            <p className="text-sm text-gray-300">
              Destaque: <span className="text-white font-bold">{track.keyFeature}</span>. Curvas-chave: {track.corners.join(", ")}.
            </p>
            <button
              onClick={onStartWeekend}
              className="w-full md:w-fit px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-wider shadow-lg shadow-blue-900/30 flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <CirclePlay size={22} /> Iniciar fim de semana
            </button>
          </div>
        </div>
      )}

      <Card title="Campeonato" icon={Trophy} iconClass="text-yellow-500" action={<LinkButton onClick={() => setActiveTab("standings")} label="Tabela" />}>
        <div className="space-y-4">
          {standingsInfo.map(({ entry, standings, position, leader, rival }) => (
            <div className={twoCars ? "bg-gray-950/60 border border-gray-800 rounded-lg p-3" : ""} key={entry.id}>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className={`${twoCars ? "text-4xl" : "text-5xl"} font-black italic text-white`}>{seasonStarted ? `${position}º` : "—"}</div>
                  <div className="text-xs text-gray-500 font-bold uppercase flex items-center gap-2 mt-1">
                    {twoCars && <span className="text-gray-300">#{entry.number}</span>} na classe <ClassBadge cls={entry.class} size="xs" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-mono font-black text-yellow-400">{entry.points}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">
                    {!seasonStarted ? "Temporada não começou" : leader && leader.id !== entry.id ? `-${leader.points - entry.points} do líder` : "Líder!"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                {[
                  ["Vitórias", entry.stats.wins],
                  ["Pódios", entry.stats.podiums],
                  ["Poles", entry.stats.poles || 0]
                ].map(([label, value]) => (
                  <div className="bg-gray-950 rounded-lg py-1.5 border border-gray-800" key={label}>
                    <div className="text-lg font-black text-white">{value}</div>
                    <div className="text-[9px] text-gray-500 uppercase font-bold">{label}</div>
                  </div>
                ))}
              </div>
              {seasonStarted && rival && (
                <div className="flex items-center justify-between text-xs bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 mb-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <Swords size={12} className="text-red-400 shrink-0" />
                    <span className="text-gray-500 uppercase font-bold text-[10px] shrink-0">Rival direto</span>
                    <TeamStripe color={rival.color} />
                    <span className="font-bold text-gray-200 truncate">{rival.name}</span>
                  </span>
                  <span className={`font-mono font-bold shrink-0 ${rival.points > entry.points ? "text-red-300" : "text-green-300"}`}>
                    {rival.points > entry.points ? `-${rival.points - entry.points}` : `+${entry.points - rival.points}`} pts
                  </span>
                </div>
              )}
              {!twoCars && (
                <div className="space-y-1">
                  {standings.slice(0, 5).map((team, index) => (
                    <div className={`flex items-center justify-between text-sm px-2 py-1 rounded ${isPlayerId(team.id) ? "bg-blue-900/30" : ""}`} key={team.id}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-gray-500 w-4">{index + 1}</span>
                        <TeamStripe color={team.color} />
                        <span className={`font-bold truncate ${isPlayerId(team.id) ? "text-blue-300" : "text-gray-200"}`}>{team.name}</span>
                      </span>
                      <span className="font-mono font-bold text-gray-400">{team.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Diretoria" icon={Target} iconClass="text-green-400">
        <div className="space-y-2 mb-4">
          {standingsInfo.map(({ entry, position, objective }) => {
            const onTrack = objective && position <= objective.position;
            return (
              <div key={entry.id}>
                <p className="text-white font-bold text-sm flex items-center gap-2">
                  {twoCars && <ClassBadge cls={entry.class} size="xs" />}
                  {twoCars && <span className="text-gray-400">#{entry.number}</span>}
                  {objective?.text}
                </p>
                <p className="text-xs text-gray-500">
                  {seasonStarted ? (
                    <>
                      Hoje: <span className={onTrack ? "text-green-400 font-bold" : "text-red-300 font-bold"}>{position}º</span>
                      {objective ? ` (meta: Top ${objective.position})` : ""}
                    </>
                  ) : (
                    "A temporada ainda não começou."
                  )}
                </p>
              </div>
            );
          })}
          <p className="text-[11px] text-gray-500">Dificuldade: {DIFFICULTIES[game.career.difficulty]?.label}.{twoCars ? " O segundo carro pesa 60% na avaliação." : ""}</p>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
              <span>Confiança da diretoria</span>
              <span>{game.career.confidence}%</span>
            </div>
            <MeterBar value={game.career.confidence} color={confidenceColor(game.career.confidence)} />
          </div>
          <div>
            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
              <span className="flex items-center gap-1">
                <Star size={10} /> Reputação
              </span>
              <span>{Math.round(player.reputation ?? 0)}/100</span>
            </div>
            <MeterBar value={player.reputation ?? 0} color="bg-yellow-500" />
          </div>
        </div>
        {DIFFICULTIES[game.career.difficulty]?.canBeFired && game.career.confidence < 30 && (
          <p className="mt-4 text-xs font-bold text-red-300 bg-red-900/20 border border-red-900/40 rounded p-2">
            Atenção: com confiança zerada no fim da temporada, você será demitido.
          </p>
        )}
      </Card>

      <Card title="Finanças" icon={Wallet} iconClass="text-green-500" action={<LinkButton onClick={() => setActiveTab("finances")} label="Detalhes" />}>
        <div className="text-3xl font-mono font-black text-green-400 mb-4">{formatMoney(player.funds)}</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Custos fixos por corrida{twoCars ? " (2 carros)" : ""}</span>
            <span className="font-mono text-red-300">-{formatMoney(perRaceCosts)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Patrocínios (estimado)</span>
            <span className="font-mono text-green-300">+{formatMoney(sponsorIncome)}</span>
          </div>
          {lastLedger && (
            <div className="flex justify-between border-t border-gray-800 pt-2">
              <span className="text-gray-400">Última corrida ({lastLedger.track})</span>
              <span className={`font-mono font-bold ${lastLedger.net >= 0 ? "text-green-400" : "text-red-400"}`}>
                {lastLedger.net >= 0 ? "+" : ""}
                {formatMoney(lastLedger.net)}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Carro"
        icon={Wrench}
        iconClass="text-cyan-400"
        action={
          <div className="flex items-center gap-2">
            {!sharedCar && <CarSwitch entries={entries} value={selected.id} onChange={setCarId} />}
            <LinkButton onClick={() => setActiveTab("car")} label="P&D" />
          </div>
        }
      >
        {sharedCar && <p className="text-[10px] text-cyan-300 font-bold mb-2">Projeto compartilhado pelos dois carros.</p>}
        <div className="space-y-2">
          {CAR_PARTS.map(part => (
            <div key={part}>
              <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-0.5">
                <span>{PART_INFO[part].label}</span>
                <span className="text-gray-300">
                  {selected.car[part]} <span className="text-gray-600">/ média {Math.round(classAvg(part))}</span>
                </span>
              </div>
              <MeterBar value={selected.car[part]} color={PART_INFO[part].color} height="h-1.5" />
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Line-up"
        icon={Users}
        iconClass="text-purple-400"
        action={
          <div className="flex items-center gap-2">
            <CarSwitch entries={entries} value={lineupEntry.id} onChange={setLineupId} />
            <LinkButton onClick={() => setActiveTab("drivers")} label="Pilotos" />
          </div>
        }
      >
        <div className="space-y-2">
          {lineupEntry.drivers.map((driver, index) => (
            <div className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-3 py-2" key={driver.id}>
              <div className="min-w-0">
                <div className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                  <Flag driver={driver} /> {driver.name}
                </div>
                <div className="text-[10px] text-gray-500 flex items-center gap-2">
                  {index === 0 && <span className="text-blue-400 font-bold">TITULAR</span>}
                  <CategoryBadge rating={driver.rating} />
                  {driver.age} anos · {driver.seasonPoints || 0} pts
                </div>
              </div>
              <div className="text-2xl font-black text-gray-300">{driver.rating}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Notícias" icon={Newspaper} iconClass="text-blue-400" action={<LinkButton onClick={() => setActiveTab("news")} label="Todas" />}>
        {unread.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma notícia nova. {surname(player.drivers[0].name)} segue treinando no simulador.</p>
        ) : (
          <div className="space-y-3">
            {unread.map(item => (
              <div className="border-l-2 border-blue-500 pl-3" key={item.id}>
                <div className="text-[10px] text-gray-500 font-bold uppercase">{item.source}</div>
                <div className="text-sm font-bold text-gray-200 leading-snug">{item.title || item.body}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default OverviewTab;
