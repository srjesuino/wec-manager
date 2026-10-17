// Diagnóstico: a posição do jogador na bandeirada bate com a classificação final?
import { TRACKS } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { advanceRace } from "../src/engine/race.js";

for (let run = 0; run < 6; run++) {
  let game = createNewGame({ teamName: "X", series: run % 2 ? "LMGT3" : "HYPERCAR", difficulty: "NORMAL" });
  game = applyBop(game, TRACKS[0]);
  const weekend = createWeekend(game);
  weekend.setupScore = 80;
  weekend.qualyScore = 80;
  weekend.qualifying = computeQualifying(game, weekend);
  let race = createRaceState(game, weekend);
  race.grid.forEach(car => { if (car.isPlayer) car.autoStrategy = true; });
  let atFinish = null;
  while (!race.finished) {
    race = advanceRace(race, 1);
    const me = race.grid.find(car => car.isPlayer);
    if (me.finished && atFinish == null) {
      atFinish = { classPos: me.classPosition, order: me.finishOrder, laps: me.laps };
      const ahead = race.grid.filter(car => car.class === me.class && car.classPosition < me.classPosition);
      atFinish.ahead = ahead.map(car => `${car.teamName}:${car.laps}${car.finished ? "F" + car.finishOrder : ""}`).join(" ");
    }
  }
  const me = race.grid.find(car => car.isPlayer);
  const classCars = race.grid.filter(car => car.class === me.class);
  console.log(`run ${run}: na bandeirada P${atFinish?.classPos} (ordem ${atFinish?.order}, ${atFinish?.laps}v) → final P${me.classPosition}`);
  if (atFinish && atFinish.classPos !== me.classPosition) {
    console.log("   à frente na hora:", atFinish.ahead);
    console.log("   final:", classCars.slice(0, me.classPosition).map(car => `${car.teamName}:${car.laps}${car.finished ? "F" + car.finishOrder : ""}${car.status === "DNF" ? "DNF" : ""}`).join(" "));
  }
}
