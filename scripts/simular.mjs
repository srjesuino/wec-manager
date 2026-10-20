// Simulação sem interface para testar o motor e calibrar o equilíbrio.
// Uso: node scripts/simular.mjs [temporadas] [HYPERCAR|LMGT3] [EASY|NORMAL|CLASSIC] [SINGLE|SAME_CLASS|DUAL_CLASS]
import { TRACKS, SPONSORS } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd } from "../src/engine/race.js";
import { buildRaceReport, applyRaceResults } from "../src/engine/results.js";
import { startNextSeason, buildSeasonSummary } from "../src/engine/season.js";
import { classStandings } from "../src/engine/career.js";
import { sponsorOffer, sponsorSlots, MAIN_PARTS, PART_CAP } from "../src/engine/economy.js";
import { upgradeCostFor, sharedDevelopment } from "../src/engine/team.js";

const seasons = Number(process.argv[2] || 2);
const series = process.argv[3] || "HYPERCAR";
const difficulty = process.argv[4] || "NORMAL";
const program = process.argv[5] || "SINGLE";

let game = createNewGame({ teamName: "Iron Racing", series, difficulty, program });
const fmt = value => `${(value / 1e6).toFixed(1)}M`;
const avg = list => list.reduce((s, v) => s + v, 0) / Math.max(1, list.length);

// Política simples do "jogador": patrocinadores disponíveis e upgrades da peça mais fraca
const managePlayer = g => {
  let player = { ...g.playerTeam, car: { ...g.playerTeam.car }, sponsors: [...g.playerTeam.sponsors] };
  const active = new Set(player.sponsors.map(s => s.id));
  SPONSORS.filter(s => !active.has(s.id) && s.minReputation <= player.reputation)
    .sort((a, b) => b.perRacePayment + b.signingBonus / 6 - (a.perRacePayment + a.signingBonus / 6))
    .forEach(s => {
      if (player.sponsors.length < sponsorSlots(player)) {
        const offer = sponsorOffer(s, player.class);
        player.sponsors.push({ ...offer, remaining: offer.duration });
        player.funds += offer.signingBonus;
      }
    });
  // Upgrades: a peça mais fraca de cada carro (um projeto só quando o P&D é compartilhado)
  let sister = g.sisterTeam ? { ...g.sisterTeam, car: { ...g.sisterTeam.car } } : null;
  const shared = sharedDevelopment(g);
  const cars = shared || !sister ? ["main"] : ["main", "sister"];
  const reserve = 4e6 * (player.class === "HYPERCAR" ? 1 : 0.33) * (sister ? 1.4 : 1);
  for (let i = 0; i < 40; i++) {
    const which = cars[i % cars.length];
    const entry = which === "main" ? player : sister;
    const mainAvg = MAIN_PARTS.reduce((sum, p) => sum + entry.car[p], 0) / 3;
    const support = ["reliability", "efficiency"].find(p => entry.car[p] < mainAvg - 8);
    const part = support || [...MAIN_PARTS].sort((a, b) => entry.car[a] - entry.car[b])[0];
    const cost = upgradeCostFor({ ...g, playerTeam: player, sisterTeam: sister }, entry, part);
    if (entry.car[part] >= PART_CAP || player.funds - cost < reserve) break;
    player.funds -= cost;
    entry.car[part] += 2;
    if (shared && sister) sister.car[part] = entry.car[part];
  }
  return { ...g, playerTeam: player, ...(sister ? { sisterTeam: sister } : {}) };
};

for (let s = 0; s < seasons; s++) {
  const raceLog = [];
  const stats = { dnf: 0, pits: [], overtakes: 0, neutral: 0, duration: [], lapH: [], lapG: [], rain: 0 };
  while (game.raceIndex < TRACKS.length) {
    game = managePlayer(game);
    game = applyBop(game, TRACKS[game.raceIndex]);
    const weekend = createWeekend(game);
    weekend.setupScore = 60 + Math.random() * 35;
    weekend.qualyScore = 50 + Math.random() * 45;
    weekend.qualifying = computeQualifying(game, weekend);
    const t0 = Date.now();
    let race = createRaceState(game, weekend);
    race = simulateToEnd(race);
    const ms = Date.now() - t0;
    const report = buildRaceReport(race, game);
    const all = Object.values(report.classes).flat();
    stats.dnf += all.filter(r => !r.finished).length;
    stats.pits.push(avg(all.map(r => r.pitStops)));
    stats.overtakes += all.reduce((sum, r) => sum + r.overtakes, 0);
    stats.neutral += report.neutralizations;
    stats.duration.push(race.elapsed);
    if (report.rain) stats.rain += 1;
    if (report.fastestLaps.HYPERCAR) stats.lapH.push(report.fastestLaps.HYPERCAR.time);
    if (report.fastestLaps.LMGT3) stats.lapG.push(report.fastestLaps.LMGT3.time);
    const result = applyRaceResults(game, report);
    game = result.game;
    const cars = report.players
      .map(p => `#${p.number} Q P${String(weekend.qualifying.find(q => q.teamId === p.teamId).classPosition).padStart(2)} → ${p.finished ? "P" + String(p.classPos).padStart(2) : "DNF"}${p.finished ? "" : " (" + p.dnfReason + ")"} pits ${p.pitStops}`)
      .join(" | ");
    raceLog.push(`${report.track.id.padEnd(8)} ${cars} net ${fmt(result.summary.net)} saldo ${fmt(game.playerTeam.funds)} rep ${game.playerTeam.reputation} conf ${game.career.confidence} [${ms}ms, ${race.elapsed}s, DNFs ${all.filter(r => !r.finished).length}]`);
  }
  const cls = game.playerTeam.class;
  const standings = classStandings(game, cls);
  console.log(`\n=== Temporada ${game.season} (${cls}, ${difficulty}, ${program}) — objetivo: ${game.career.objective.text}${game.career.objective2 ? ` / #${game.sisterTeam.number}: ${game.career.objective2.text}` : ""} ===`);
  raceLog.forEach(line => console.log("  " + line));
  console.log(`  DNFs/corrida ${(stats.dnf / 8).toFixed(1)} | pits médios ${avg(stats.pits).toFixed(1)} | ultrapassagens/corrida ${(stats.overtakes / 8).toFixed(0)} | neutralizações ${stats.neutral} | chuva em ${stats.rain} provas`);
  console.log(`  Volta rápida média HYP ${avg(stats.lapH).toFixed(1)}s GT3 ${avg(stats.lapG).toFixed(1)}s | duração média ${(avg(stats.duration) / 60).toFixed(0)} min simulados`);
  standings.slice(0, 10).forEach((team, i) => {
    const car = team.car;
    console.log(`   ${String(i + 1).padStart(2)}. ${team.name.padEnd(20)} ${String(team.points).padStart(4)} pts  V${team.stats.wins} P${team.stats.podiums}  carro ${car.engine}/${car.aero}/${car.chassis} rel ${car.reliability}  caixa ${team.funds == null ? "(equipe)" : fmt(team.funds)}`);
  });
  const summary = buildSeasonSummary(game);
  console.log(`  Diretoria: ${summary.review.entries.map(e => `#${e.number} P${e.position} (meta Top ${e.objective.position})`).join(" · ")} → ${summary.review.verdict} confiança ${summary.review.confidence}${summary.promotion ? " | PROMOÇÃO OFERECIDA" : ""}`);
  const next = startNextSeason(game, { acceptPromotion: true });
  if (next.fired) {
    console.log("  >>> DEMITIDO");
    break;
  }
  next.notes.forEach(note => console.log("  • " + note));
  game = next.game;
}
