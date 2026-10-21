// Diagnóstico: força das equipes, BoP, meta do conselho e resultado com carros de nível fixo
import { TRACKS } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState, computeBop } from "../src/engine/weekend.js";
import { simulateToEnd } from "../src/engine/race.js";
import { buildRaceReport } from "../src/engine/results.js";
import { programStrength, expectedRank, createObjective } from "../src/engine/career.js";
import { classPrograms } from "../src/engine/team.js";

const game = createNewGame({ teamName: "Iron Racing", cars: { HYPERCAR: 1 }, difficulty: "NORMAL" });
const bop = computeBop(game, "balanced");
classPrograms(game, "HYPERCAR").forEach(row =>
  console.log(row.team.name.padEnd(20), "carros", row.entries.length, "força", programStrength(row, bop[row.key]).toFixed(1), "bop", bop[row.key], "pilotos", row.entries.map(e => e.drivers.map(d => d.rating).join("/")).join(" | "))
);
console.log("rank esperado", expectedRank(game, "HYPERCAR"), createObjective(game, "HYPERCAR"));

for (const level of [60, 75, 85, 95]) {
  const positions = [];
  for (let r = 0; r < 8; r++) {
    const car = { engine: level, aero: level, chassis: level, reliability: Math.max(75, level), efficiency: level, crew: level };
    let g = { ...game, raceIndex: r, playerTeam: { ...game.playerTeam, programs: { HYPERCAR: { ...game.playerTeam.programs.HYPERCAR, car } } } };
    g = applyBop(g, TRACKS[r]);
    const weekend = createWeekend(g);
    weekend.setupScore = 80;
    weekend.qualyScore = 75;
    weekend.qualifying = computeQualifying(g, weekend);
    const report = buildRaceReport(simulateToEnd(createRaceState(g, weekend)), g);
    positions.push(`Q${weekend.qualifying.find(q => q.isPlayer).classPosition}→${report.player.finished ? report.player.classPos : "DNF"}`);
  }
  console.log(`carro ${level}:`, positions.join("  "));
}
