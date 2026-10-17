// Conta os tipos de incidente numa temporada simulada (diagnóstico do motor)
import { TRACKS } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd } from "../src/engine/race.js";

let game = createNewGame({ teamName: "X", series: "HYPERCAR", difficulty: "NORMAL" });
const counts = {};
const kinds = ["Falha mecânica", "problema mecânico", "escapa", "roda na pista", "Batida", "Toque", "furado", "estourado", "Pane seca", "Acidente", "SAFETY CAR", "FULL COURSE", "ultrapassa", "BOX"];
for (let r = 0; r < TRACKS.length; r++) {
  game = { ...applyBop(game, TRACKS[r]), raceIndex: r };
  const weekend = createWeekend(game);
  weekend.setupScore = 80;
  weekend.qualyScore = 80;
  weekend.qualifying = computeQualifying(game, weekend);
  const race = simulateToEnd(createRaceState(game, weekend));
  const local = {};
  race.events.forEach(event => {
    const kind = kinds.find(k => event.text.includes(k)) || event.type;
    local[kind] = (local[kind] || 0) + 1;
    counts[kind] = (counts[kind] || 0) + 1;
  });
  console.log(TRACKS[r].id.padEnd(9), "DNF", race.grid.filter(c => c.status === "DNF").length, JSON.stringify(local));
}
console.log("\nTOTAL", JSON.stringify(counts));
