// Simulação sem interface para testar o motor e calibrar o equilíbrio.
// Uso: node scripts/simular.mjs [temporadas] [HYPERCAR|LMGT3] [EASY|NORMAL|CLASSIC]
import { TRACKS, SPONSORS } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd } from "../src/engine/race.js";
import { buildRaceReport, applyRaceResults } from "../src/engine/results.js";
import { startNextSeason, buildSeasonSummary } from "../src/engine/season.js";
import { classStandings } from "../src/engine/career.js";
import { upgradeCost, sponsorOffer, sponsorSlots, MAIN_PARTS, PART_CAP } from "../src/engine/economy.js";

const seasons = Number(process.argv[2] || 2);
const series = process.argv[3] || "HYPERCAR";
const difficulty = process.argv[4] || "NORMAL";

let game = createNewGame({ teamName: "Iron Racing", series, difficulty });
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
  for (let i = 0; i < 30; i++) {
    const mainAvg = MAIN_PARTS.reduce((sum, p) => sum + player.car[p], 0) / 3;
    const support = ["reliability", "efficiency"].find(p => player.car[p] < mainAvg - 8);
    const part = support || [...MAIN_PARTS].sort((a, b) => player.car[a] - player.car[b])[0];
    const cost = upgradeCost(player, part);
    if (player.car[part] >= PART_CAP || player.funds - cost < 4e6 * (player.class === "HYPERCAR" ? 1 : 0.33)) break;
    player.funds -= cost;
    player.car[part] += 2;
  }
  return { ...g, playerTeam: player };
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
    race.grid.forEach(car => { if (car.isPlayer) car.autoStrategy = true; });
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
    const p = report.player;
    raceLog.push(`${report.track.id.padEnd(8)} Q P${String(weekend.qualifying.find(q => q.isPlayer).classPosition).padStart(2)} → ${p.finished ? "P" + String(p.classPos).padStart(2) : "DNF"}${p.finished ? "" : " (" + p.dnfReason + ")"} pits ${p.pitStops} net ${fmt(result.summary.net)} saldo ${fmt(game.playerTeam.funds)} rep ${game.playerTeam.reputation} conf ${game.career.confidence} [${ms}ms, ${race.elapsed}s, DNFs ${all.filter(r => !r.finished).length}]`);
  }
  const cls = game.playerTeam.class;
  const standings = classStandings(game, cls);
  console.log(`\n=== Temporada ${game.season} (${cls}, ${difficulty}) — objetivo: ${game.career.objective.text} ===`);
  raceLog.forEach(line => console.log("  " + line));
  console.log(`  DNFs/corrida ${(stats.dnf / 8).toFixed(1)} | pits médios ${avg(stats.pits).toFixed(1)} | ultrapassagens/corrida ${(stats.overtakes / 8).toFixed(0)} | neutralizações ${stats.neutral} | chuva em ${stats.rain} provas`);
  console.log(`  Volta rápida média HYP ${avg(stats.lapH).toFixed(1)}s GT3 ${avg(stats.lapG).toFixed(1)}s | duração média ${(avg(stats.duration) / 60).toFixed(0)} min simulados`);
  standings.slice(0, 10).forEach((team, i) => {
    const car = team.car;
    console.log(`   ${String(i + 1).padStart(2)}. ${team.name.padEnd(20)} ${String(team.points).padStart(4)} pts  V${team.stats.wins} P${team.stats.podiums}  carro ${car.engine}/${car.aero}/${car.chassis} rel ${car.reliability}  caixa ${fmt(team.funds)}`);
  });
  const summary = buildSeasonSummary(game);
  console.log(`  Diretoria: P${summary.review.position} (meta Top ${summary.review.objective.position}) → ${summary.review.verdict} confiança ${summary.review.confidence}${summary.promotion ? " | PROMOÇÃO OFERECIDA" : ""}`);
  const next = startNextSeason(game, { acceptPromotion: true });
  if (next.fired) {
    console.log("  >>> DEMITIDO");
    break;
  }
  next.notes.forEach(note => console.log("  • " + note));
  game = next.game;
}
