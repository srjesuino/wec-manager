// Mede o equilíbrio de longo prazo: eras de campeões (equipes) e a curva de dificuldade de um jogador habilidoso.
// Uso: node scripts/equilibrio.mjs [temporadas] [carros: H1|H2|G2|H1G2|H2G2] [EASY|NORMAL|CLASSIC] [carreiras] [--resumo]
import { TRACKS } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd, carPerformance } from "../src/engine/race.js";
import { buildRaceReport, applyRaceResults } from "../src/engine/results.js";
import { startNextSeason } from "../src/engine/season.js";
import { teamStandings } from "../src/engine/career.js";
import { teamClasses } from "../src/engine/team.js";
import { managePlayer, parseCars } from "./politica.mjs";

const seasons = Number(process.argv[2] || 12);
const cars = parseCars(process.argv[3] || "H1");
const difficulty = process.argv[4] || "NORMAL";
const careers = Number(process.argv[5] || 3);
const quiet = process.argv.includes("--resumo");

const summary = { streaks: [], margins: [], playerPositions: [], playerTitles: 0, distinct: [], cuts: 0 };
for (let c = 0; c < careers; c++) {
  let game = createNewGame({ teamName: "Iron Racing", cars, difficulty });
  const mainCls = teamClasses(game.playerTeam)[0];
  const champions = [];
  for (let s = 0; s < seasons; s++) {
    let first = true;
    while (game.raceIndex < TRACKS.length) {
      game = managePlayer(game, { skilled: true, seasonStart: first });
      first = false;
      game = applyBop(game, TRACKS[game.raceIndex]);
      const weekend = createWeekend(game);
      weekend.setupScore = 92 + Math.random() * 8;
      weekend.qualyScore = 75 + Math.random() * 20;
      weekend.qualifying = computeQualifying(game, weekend);
      const race = simulateToEnd(createRaceState(game, weekend));
      game = applyRaceResults(game, buildRaceReport(race, game)).game;
    }
    const cls = teamClasses(game.playerTeam).includes(mainCls) ? mainCls : teamClasses(game.playerTeam)[0];
    const standings = teamStandings(game, cls);
    const pos = standings.findIndex(row => row.isPlayer) + 1;
    const champ = standings[0];
    champions.push(champ.isPlayer ? "JOGADOR" : champ.team.name);
    summary.margins.push(champ.points - standings[1].points);
    summary.playerPositions[s] = [...(summary.playerPositions[s] || []), pos];
    if (champ.isPlayer) summary.playerTitles += 1;
    if (!quiet) {
      const perf = row => Math.round(carPerformance(row.program.car));
      const top = standings
        .slice(0, 4)
        .map(row => `${row.isPlayer ? "*JOGADOR*" : row.team.name} ${row.points} (${perf(row)})`)
        .join(" | ");
      console.log(`C${c + 1} ${game.season} ${cls}: jogador P${pos} (${perf(standings[pos - 1])}) · ${top}`);
    }
    const next = startNextSeason(game, {});
    if (next.cut) {
      summary.cuts += 1;
      if (!quiet) console.log(`   corte do conselho: ${next.cut.text}`);
    }
    game = next.game;
  }
  let streak = 1;
  let best = 1;
  for (let i = 1; i < champions.length; i++) {
    streak = champions[i] === champions[i - 1] ? streak + 1 : 1;
    best = Math.max(best, streak);
  }
  summary.streaks.push(best);
  summary.distinct.push(new Set(champions).size);
  console.log(`C${c + 1} campeões de equipes: ${champions.join(", ")}`);
}
const avg = list => (list.reduce((s, v) => s + v, 0) / Math.max(1, list.length)).toFixed(1);
console.log(`\nResumo (${careers} carreiras, ${seasons} temporadas, ${JSON.stringify(cars)}, ${difficulty})`);
console.log(`  campeões diferentes por carreira: ${summary.distinct.join(", ")} · maior sequência: ${summary.streaks.join(", ")} · margem média do campeão: ${avg(summary.margins)} pts`);
console.log(`  títulos do jogador: ${summary.playerTitles} · cortes do conselho: ${summary.cuts}`);
console.log(`  posição média do jogador por temporada: ${summary.playerPositions.map((list, i) => `T${i + 1}:${avg(list)}`).join(" ")}`);
