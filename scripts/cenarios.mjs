// Testes de cenário do motor: promoção, demissão, migração de save antigo e consistência de pontos
import { TRACKS } from "../src/data/constants.js";
import { createNewGame, migrateSave } from "../src/engine/newGame.js";
import { buildSeasonSummary, startNextSeason } from "../src/engine/season.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd } from "../src/engine/race.js";
import { buildRaceReport, applyRaceResults } from "../src/engine/results.js";
import { classTeams } from "../src/engine/weekend.js";

let failures = 0;
const check = (label, condition, detail = "") => {
  console.log(`${condition ? "OK  " : "FALHA"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
};

const playSeason = game => {
  let g = game;
  while (g.raceIndex < TRACKS.length) {
    g = applyBop(g, TRACKS[g.raceIndex]);
    const weekend = createWeekend(g);
    weekend.setupScore = 85;
    weekend.qualyScore = 80;
    weekend.qualifying = computeQualifying(g, weekend);
    const race = createRaceState(g, weekend);
    race.grid.forEach(car => { if (car.isPlayer) car.autoStrategy = true; });
    g = applyRaceResults(g, buildRaceReport(simulateToEnd(race), g)).game;
  }
  return g;
};

// 1) Promoção: GT3 campeã recebe convite e, aceitando, vira Hypercar com grid consistente
{
  let game = createNewGame({ teamName: "Promo", series: "LMGT3", difficulty: "EASY" });
  game = playSeason(game);
  // força o título para testar o fluxo de promoção
  const rivalsMax = Math.max(...classTeams(game, "LMGT3").filter(t => t.id !== "player").map(t => t.points));
  game = { ...game, playerTeam: { ...game.playerTeam, points: rivalsMax + 10 } };
  const summary = buildSeasonSummary(game);
  check("campeã GT3 recebe convite", summary.promotion === true);
  const next = startNextSeason(game, { acceptPromotion: true });
  const g = next.game;
  check("jogador vira Hypercar", g.playerTeam.class === "HYPERCAR");
  check("Hypercar segue com 10 carros", classTeams(g, "HYPERCAR").length === 10, `${classTeams(g, "HYPERCAR").length}`);
  check("LMGT3 segue com 16 carros", classTeams(g, "LMGT3").length === 16, `${classTeams(g, "LMGT3").length}`);
  check("título contado", g.playerTeam.championships === 1);
  check("todos com 3 pilotos", [g.playerTeam, ...g.aiTeams].every(t => t.drivers.length === 3));
  const ids = [g.playerTeam, ...g.aiTeams].map(t => t.id);
  check("ids de equipe únicos", new Set(ids).size === ids.length);
  check("orçamento Hypercar aplicado", g.playerTeam.funds > 30000000, `$${(g.playerTeam.funds / 1e6).toFixed(1)}M`);
}

// 2) Demissão: confiança baixa + meta falhada no Normal = demitido; no Fácil, nunca
{
  for (const difficulty of ["NORMAL", "EASY"]) {
    let game = createNewGame({ teamName: "Fired", series: "HYPERCAR", difficulty });
    game = playSeason(game);
    game = {
      ...game,
      playerTeam: { ...game.playerTeam, points: 0 },
      career: { ...game.career, confidence: 10, objective: { position: 1, text: "Título" } }
    };
    const result = startNextSeason(game, {});
    check(`demissão no ${difficulty}`, result.fired === (difficulty === "NORMAL"));
  }
}

// 3) Save antigo (formato 3.x) migra e joga uma corrida
{
  const legacy = {
    season: 2026,
    activeSeries: "HYPERCAR",
    playerTeam: {
      id: "player", name: "Legacy", class: "HYPERCAR", funds: 30000000, points: 0, stats: { wins: 0, podiums: 0 },
      car: { engine: 40, aero: 40, chassis: 40, reliability: 70, efficiency: 40, crew: 40 },
      drivers: [{ id: "a", name: "Antonio Hartley", rating: 72, age: 25, wage: 1, marketValue: 30000000, morale: 80, teamId: "player", stats: { wins: 0, podiums: 0, titles: 0 } }],
      sponsors: [{ id: "lux_watch", name: "Kronos Watches", type: "PERFORMANCE", signingBonus: 250000, perRacePayment: 600000, goal: 10, duration: 4, remaining: 3 }],
      series: "HYPERCAR", championships: 0, careerWins: 3
    },
    aiTeams: createNewGame({ teamName: "x", series: "HYPERCAR" }).aiTeams.map(t => ({ ...t, drivers: t.drivers.slice(0, 2).map(d => ({ id: d.id, name: d.name, rating: d.rating, age: d.age })), color: undefined, number: undefined, tier: undefined })),
    driversPool: [{ id: "p1", name: "Mick Norris", rating: 88, age: 30, marketValue: 40000000 }],
    raceIndex: 7,
    archive: { history: [], currentSeasonRaces: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ track: "x" + i, winner: "a", podium: [], gt3Winner: "b", gt3Podium: [] })) },
    newsFeed: []
  };
  const game = migrateSave(legacy);
  check("save antigo vira 4.0", game.version === "4.0");
  check("save do fim de temporada vai para o encerramento", game.raceIndex === TRACKS.length);
  check("line-up completado com 3 pilotos", game.playerTeam.drivers.length === 3);
  check("valor de mercado recalculado", game.driversPool[0].marketValue < 15000000, `$${(game.driversPool[0].marketValue / 1e6).toFixed(1)}M`);
  check("meta de patrocínio antiga preservada", game.playerTeam.sponsors[0].goalPosition === 10);
  const next = startNextSeason(game, {});
  check("vira a temporada a partir do save antigo", !next.fired && next.game.season === 2027 && next.game.raceIndex === 0);
  const played = playSeason({ ...next.game, raceIndex: 6 });
  check("joga corridas depois da migração", played.raceIndex === TRACKS.length);
}

// 4) Pontos do campeonato batem com a soma das corridas
{
  let game = createNewGame({ teamName: "Pts", series: "HYPERCAR", difficulty: "NORMAL" });
  let total = 0;
  while (game.raceIndex < 4) {
    game = applyBop(game, TRACKS[game.raceIndex]);
    const weekend = createWeekend(game);
    weekend.setupScore = 70;
    weekend.qualyScore = 70;
    weekend.qualifying = computeQualifying(game, weekend);
    const race = createRaceState(game, weekend);
    race.grid.forEach(car => { if (car.isPlayer) car.autoStrategy = true; });
    const report = buildRaceReport(simulateToEnd(race), game);
    total += report.player.points;
    const sumClass = report.classes.HYPERCAR.reduce((s, r) => s + r.points, 0);
    const expected = { 1: 101, 1.5: 153, 2: 202 }[report.track.pointsMultiplier] + 1;
    check(`pontos distribuídos em ${report.track.id}`, sumClass === expected || sumClass === expected - 1 - report.classes.HYPERCAR.filter(r => !r.finished && r.classPos <= 10).length, `${sumClass} (esperado ~${expected})`);
    game = applyRaceResults(game, report).game;
  }
  check("pontos do jogador acumulam", game.playerTeam.points === total, `${game.playerTeam.points} vs ${total}`);
}

console.log(failures ? `\n${failures} falha(s)` : "\nTodos os cenários passaram.");
process.exit(failures ? 1 : 0);
