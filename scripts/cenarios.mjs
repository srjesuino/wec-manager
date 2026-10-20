// Testes de cenário do motor: promoção, demissão, migração de save antigo e consistência de pontos
import { TRACKS } from "../src/data/constants.js";
import { createNewGame, migrateSave } from "../src/engine/newGame.js";
import { buildSeasonSummary, startNextSeason } from "../src/engine/season.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd } from "../src/engine/race.js";
import { buildRaceReport, applyRaceResults, racePoints } from "../src/engine/results.js";
import { classTeams } from "../src/engine/weekend.js";
import { swapTeamCars, setTeamOrders, canSwapTeamCars } from "../src/engine/race.js";
import { rollPaddockEvent, resolvePaddockEvent } from "../src/engine/events.js";
import { upgradeCostFor } from "../src/engine/team.js";
import { upgradeCost } from "../src/engine/economy.js";

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
  check("save antigo vira 4.1", game.version === "4.1");
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
    // Tabela cheia + pole, menos os pontos das posições que ficaram com carros abandonados
    const full = { 1: 101, 1.5: 153, 2: 202 }[report.track.pointsMultiplier] + 1;
    const lost = report.classes.HYPERCAR.filter(r => !r.finished).reduce((sum, r) => sum + racePoints(r.classPos, report.track.pointsMultiplier), 0);
    const expected = full - lost;
    check(`pontos distribuídos em ${report.track.id}`, sumClass === expected || sumClass === expected - 1, `${sumClass} (esperado ${expected})`);
    game = applyRaceResults(game, report).game;
  }
  check("pontos do jogador acumulam", game.playerTeam.points === total, `${game.playerTeam.points} vs ${total}`);
}

// 5) Dois carros na mesma classe: grid do mesmo tamanho, dois carros pontuando, P&D compartilhado
{
  let game = createNewGame({ teamName: "Duo", series: "HYPERCAR", program: "SAME_CLASS" });
  check("mesma classe: Hypercar segue com 10 carros", classTeams(game, "HYPERCAR").length === 10, `${classTeams(game, "HYPERCAR").length}`);
  check("mesma classe: dois carros do jogador na Hypercar", classTeams(game, "HYPERCAR").filter(t => t.id.startsWith("player")).length === 2);
  check("mesma classe: números diferentes", game.playerTeam.number !== game.sisterTeam.number);
  check("mesma classe: P&D custa 50% a mais", upgradeCostFor(game, game.playerTeam, "engine") === Math.floor(upgradeCost(game.playerTeam, "engine") * 1.5));
  check("mesma classe: metas para os dois carros", !!game.career.objective && !!game.career.objective2);
  game = applyBop(game, TRACKS[0]);
  const weekend = createWeekend(game);
  weekend.setupScore = 80;
  weekend.qualyScore = 60;
  weekend.setupScores = { player: 80, player2: 40 };
  weekend.qualyScores = { player: 60, player2: 30 };
  weekend.qualifying = computeQualifying(game, weekend);
  check("classificação tem os dois carros do jogador", weekend.qualifying.filter(q => q.isPlayer).length === 2);
  let race = createRaceState(game, weekend);
  check("corrida tem os dois carros do jogador", race.grid.filter(c => c.isPlayer).length === 2);
  race = setTeamOrders(race, "HOLD");
  check("ordem de equipe registrada", race.teamOrders === "HOLD");
  // Coloca os dois carros lado a lado para testar a troca de posições
  const [a, b] = race.grid.filter(c => c.isPlayer);
  b.distance = a.distance - 20;
  b.laps = a.laps;
  check("troca de posições liberada com carros juntos", canSwapTeamCars(race));
  const swapped = swapTeamCars(race);
  const after = swapped.grid.filter(c => c.isPlayer).sort((x, y) => y.distance - x.distance);
  check("troca de posições inverte os carros", after[0].teamId === b.teamId);
  const report = buildRaceReport(simulateToEnd(race), game);
  check("relatório traz os dois carros", report.players.length === 2 && report.players[0].teamId === "player");
  const applied = applyRaceResults(game, report);
  check("pontos dos dois carros aplicados", applied.game.playerTeam.points === report.players[0].points && applied.game.sisterTeam.points === report.players[1].points);
  check("extrato tem a operação do 2º carro", applied.summary.items.some(item => item.label.startsWith("Operação do 2º carro")));
}

// 6) Programa duplo: um carro em cada classe, temporada completa e virada com contratos dos dois carros
{
  let game = createNewGame({ teamName: "Dual", series: "LMGT3", program: "DUAL_CLASS", difficulty: "EASY" });
  check("programa duplo: carro principal na Hypercar", game.playerTeam.class === "HYPERCAR" && game.sisterTeam.class === "LMGT3");
  check("programa duplo: grids de 10 e 16", classTeams(game, "HYPERCAR").length === 10 && classTeams(game, "LMGT3").length === 16);
  check("programa duplo: carros independentes", game.playerTeam.car !== game.sisterTeam.car && upgradeCostFor(game, game.sisterTeam, "engine") === upgradeCost(game.sisterTeam, "engine"));
  game = playSeason(game);
  check("programa duplo: 8 corridas registradas com os dois carros", game.archive.currentSeasonRaces.every(r => r.players.length === 2));
  const summary = buildSeasonSummary(game);
  check("programa duplo: avaliação dos dois carros", summary.review.entries.length === 2);
  check("programa duplo: sem convite de promoção", summary.promotion === false);
  const renew = Object.fromEntries(summary.expiring.map(item => [item.driver.id, false]));
  const next = startNextSeason(game, { renew });
  const g = next.game;
  check("programa duplo: segue com dois carros", !!g.sisterTeam && g.sisterTeam.class === "LMGT3");
  check("programa duplo: todos com 3 pilotos", [g.playerTeam, g.sisterTeam, ...g.aiTeams].every(t => t.drivers.length === 3));
  check("programa duplo: grids mantidos", classTeams(g, "HYPERCAR").length === 10 && classTeams(g, "LMGT3").length === 16);
  const ids = [g.playerTeam, g.sisterTeam, ...g.aiTeams].map(t => t.id);
  check("programa duplo: ids únicos", new Set(ids).size === ids.length);
  // Retirar o segundo carro devolve a vaga para a IA
  const dropped = startNextSeason(game, { dropSister: true }).game;
  check("retirar o 2º carro", !dropped.sisterTeam && classTeams(dropped, "LMGT3").length === 16 && dropped.career.objective2 === null);
}

// 7) Expandir de um para dois carros na virada (e GT3 com dois carros sobe junto)
{
  let game = createNewGame({ teamName: "Grow", series: "LMGT3", difficulty: "EASY" });
  game = playSeason(game);
  game = { ...game, playerTeam: { ...game.playerTeam, funds: 50000000 } };
  const g = startNextSeason(game, { expand: "SAME_CLASS", sisterName: "Grow Junior" }).game;
  check("expansão cria o 2º carro", g.sisterTeam?.class === "LMGT3" && g.sisterTeam.name === "Grow Junior");
  check("expansão mantém 16 carros na GT3", classTeams(g, "LMGT3").length === 16);
  check("expansão cobra a inscrição", g.playerTeam.funds < 50000000 + 40000000);
  let duo = playSeason(g);
  const rivalsMax = Math.max(...classTeams(duo, "LMGT3").filter(t => !t.id.startsWith("player")).map(t => t.points));
  duo = { ...duo, sisterTeam: { ...duo.sisterTeam, points: rivalsMax + 10 } };
  const summary = buildSeasonSummary(duo);
  check("2º carro campeão conta como título da equipe", summary.isPlayerChampion && summary.promotion === true);
  const promoted = startNextSeason(duo, { acceptPromotion: true }).game;
  check("os dois GT3 sobem para a Hypercar", promoted.playerTeam.class === "HYPERCAR" && promoted.sisterTeam.class === "HYPERCAR");
  check("promoção dupla mantém os grids", classTeams(promoted, "HYPERCAR").length === 10 && classTeams(promoted, "LMGT3").length === 16);
  check("título somado na organização", promoted.playerTeam.championships === 1);
}

// 8) Eventos do paddock: toda escolha resolve sem quebrar o jogo
{
  const game = createNewGame({ teamName: "Events", series: "HYPERCAR", program: "SAME_CLASS" });
  let ok = true;
  for (let i = 0; i < 60; i++) {
    const event = rollPaddockEvent(game, 1);
    for (const choice of event.choices) {
      const result = resolvePaddockEvent({ ...game, pendingEvent: event }, choice.id);
      if (result.game.pendingEvent || !Number.isFinite(result.game.playerTeam.funds)) ok = false;
    }
  }
  check("eventos do paddock resolvem todas as escolhas", ok);
}

// 9) Save da 4.0 (sem segundo carro) abre na 4.1
{
  const old = { ...createNewGame({ teamName: "Old", series: "HYPERCAR" }), version: "4.0" };
  delete old.sisterTeam;
  delete old.career.achievements;
  delete old.archive.trackRecords;
  const game = migrateSave(old);
  check("save 4.0 migra sem segundo carro", game.version === "4.1" && game.sisterTeam === null && !!game.career.achievements && !!game.archive.trackRecords);
  check("save 4.0 joga corridas", playSeason(game).raceIndex === TRACKS.length);
}

console.log(failures ? `\n${failures} falha(s)` : "\nTodos os cenários passaram.");
process.exit(failures ? 1 : 0);
