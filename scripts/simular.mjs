// Simulação sem interface para testar o motor e calibrar o equilíbrio.
// Uso: node scripts/simular.mjs [temporadas] [carros: H1|H2|G2|H1G2|H2G2] [EASY|NORMAL|CLASSIC]
import { TRACKS } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd, carPerformance } from "../src/engine/race.js";
import { buildRaceReport, applyRaceResults } from "../src/engine/results.js";
import { startNextSeason, buildSeasonSummary } from "../src/engine/season.js";
import { teamStandings } from "../src/engine/career.js";
import { teamClasses } from "../src/engine/team.js";
import { managePlayer, parseCars } from "./politica.mjs";

const seasons = Number(process.argv[2] || 2);
const cars = parseCars(process.argv[3] || "H1");
const difficulty = process.argv[4] || "NORMAL";

let game = createNewGame({ teamName: "Iron Racing", cars, difficulty });
const fmt = value => `${(value / 1e6).toFixed(1)}M`;
const avg = list => list.reduce((s, v) => s + v, 0) / Math.max(1, list.length);

for (let s = 0; s < seasons; s++) {
  const raceLog = [];
  const stats = { dnf: 0, pits: [], overtakes: 0, neutral: 0, duration: [], rain: 0, cars: 0 };
  while (game.raceIndex < TRACKS.length) {
    game = managePlayer(game);
    game = applyBop(game, TRACKS[game.raceIndex]);
    const weekend = createWeekend(game);
    weekend.setupScore = 60 + Math.random() * 35;
    weekend.qualyScore = 50 + Math.random() * 45;
    weekend.qualifying = computeQualifying(game, weekend);
    const t0 = Date.now();
    const race = simulateToEnd(createRaceState(game, weekend));
    const ms = Date.now() - t0;
    const report = buildRaceReport(race, game);
    const all = Object.values(report.classes).flat();
    stats.cars = all.length;
    stats.dnf += all.filter(r => !r.finished).length;
    stats.pits.push(avg(all.map(r => r.pitStops)));
    stats.overtakes += all.reduce((sum, r) => sum + r.overtakes, 0);
    stats.neutral += report.neutralizations;
    stats.duration.push(race.elapsed);
    if (report.rain) stats.rain += 1;
    const result = applyRaceResults(game, report);
    game = result.game;
    const mine = report.players.map(p => `#${p.number} ${p.finished ? "P" + String(p.classPos).padStart(2) : "DNF"}`).join(" ");
    const teams = Object.entries(report.playerTeams).map(([cls, row]) => `${cls === "HYPERCAR" ? "HYP" : "GT3"} eq. P${row.position} +${row.points}`).join(" ");
    raceLog.push(`${report.track.id.padEnd(8)} ${mine} | ${teams} | net ${fmt(result.summary.net)} saldo ${fmt(game.playerTeam.funds)} rep ${game.playerTeam.reputation} conf ${game.career.confidence} [${ms}ms]`);
  }
  console.log(`\n=== Temporada ${game.season} (${difficulty}) — ${Object.values(game.career.objectives).map(o => o.text).join(" / ")} ===`);
  raceLog.forEach(line => console.log("  " + line));
  console.log(`  ${stats.cars} carros | DNFs/corrida ${(stats.dnf / 8).toFixed(1)} | pits médios ${avg(stats.pits).toFixed(1)} | ultrapassagens/corrida ${(stats.overtakes / 8).toFixed(0)} | neutralizações ${stats.neutral} | chuva em ${stats.rain} provas`);
  teamClasses(game.playerTeam).forEach(cls => {
    console.log(`  Equipes ${cls}:`);
    teamStandings(game, cls).slice(0, 6).forEach((row, i) => {
      console.log(`   ${String(i + 1).padStart(2)}. ${row.team.name.padEnd(20)} ${String(row.points).padStart(4)} pts  V${row.stats.wins} P${row.stats.podiums}  carros ${row.entries.length}  projeto ${Math.round(carPerformance(row.program.car))}  ${row.isPlayer ? "" : `caixa ${fmt(row.team.funds)}`}`);
    });
  });
  const summary = buildSeasonSummary(game);
  console.log(`  Conselho: ${summary.review.entries.map(e => `${e.label} P${e.position} (meta Top ${e.objective.position})`).join(" · ")} → ${summary.review.verdict} confiança ${summary.review.confidence}${summary.boardCut ? ` | CORTE: ${summary.boardCut.text}` : ""}`);
  const next = startNextSeason(game, {});
  next.notes.forEach(note => console.log("  • " + note));
  game = next.game;
}
