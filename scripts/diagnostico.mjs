// Diagnóstico: força das equipes, BoP, meta da diretoria e resultado com carros de nível fixo
import { TRACKS } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState, computeBop, classTeams } from "../src/engine/weekend.js";
import { simulateToEnd } from "../src/engine/race.js";
import { buildRaceReport } from "../src/engine/results.js";
import { teamStrength, expectedRank, createObjective } from "../src/engine/career.js";

const game = createNewGame({ teamName: "Iron Racing", series: "HYPERCAR", difficulty: "NORMAL" });
const teams = classTeams(game, "HYPERCAR");
const bop = computeBop(teams, "balanced");
teams.forEach(team =>
  console.log(team.name.padEnd(20), "força", teamStrength(team, bop[team.id]).toFixed(1), "bop", bop[team.id], "pilotos", team.drivers.map(d => d.rating).join("/"))
);
console.log("rank esperado", expectedRank(game), createObjective(game));

for (const level of [60, 75, 85, 95]) {
  const positions = [];
  for (let r = 0; r < 8; r++) {
    let g = {
      ...game,
      raceIndex: r,
      playerTeam: {
        ...game.playerTeam,
        car: { engine: level, aero: level, chassis: level, reliability: Math.max(75, level), efficiency: level, crew: level }
      }
    };
    g = applyBop(g, TRACKS[r]);
    const weekend = createWeekend(g);
    weekend.setupScore = 80;
    weekend.qualyScore = 75;
    weekend.qualifying = computeQualifying(g, weekend);
    let race = createRaceState(g, weekend);
    race.grid.forEach(car => { if (car.isPlayer) car.autoStrategy = true; });
    race = simulateToEnd(race);
    const report = buildRaceReport(race, g);
    positions.push(`Q${weekend.qualifying.find(q => q.isPlayer).classPosition}→${report.player.finished ? report.player.classPos : "DNF"}`);
  }
  console.log(`carro ${level}:`, positions.join("  "));
}
