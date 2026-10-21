// Testes de cenário do motor: grid e regras de classe, pontuação de equipes, temporada, corte do conselho,
// programa do jogador, editor de grid, migração de saves e motor de equilíbrio
import { TRACKS, HOMOLOGATION, CLASSES } from "../src/data/constants.js";
import { createNewGame, migrateSave, normalizeCars } from "../src/engine/newGame.js";
import { buildSeasonSummary, startNextSeason, regulationFor, validatePlan, planEntryCost } from "../src/engine/season.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd, swapTeamCars, setTeamOrders, canSwapTeamCars } from "../src/engine/race.js";
import { buildRaceReport, applyRaceResults, teamRaceResults, racePoints } from "../src/engine/results.js";
import { teamStandings, teamRanking, createObjective } from "../src/engine/career.js";
import { developAiTeam, evolveAiProfiles, INVESTMENT_RANGE, ENGINEERING_RANGE } from "../src/engine/ai.js";
import { sandboxCreateTeam, sandboxUpdateTeam, sandboxDeleteTeam } from "../src/engine/sandbox.js";
import { classEntries, classPrograms, playerEntries, teamEntries, programUpgradeCost, teamScoring } from "../src/engine/team.js";
import { upgradeCost } from "../src/engine/economy.js";

let failures = 0;
const check = (label, condition, detail = "") => {
  console.log(`${condition ? "OK  " : "FALHA"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
};

const playRace = (g, setup = 85, qualy = 80) => {
  g = applyBop(g, TRACKS[g.raceIndex]);
  const weekend = createWeekend(g);
  weekend.setupScore = setup;
  weekend.qualyScore = qualy;
  weekend.qualifying = computeQualifying(g, weekend);
  const report = buildRaceReport(simulateToEnd(createRaceState(g, weekend)), g);
  return { report, ...applyRaceResults(g, report) };
};

const playSeason = game => {
  let g = game;
  while (g.raceIndex < TRACKS.length) {
    g = playRace(g).game;
  }
  return g;
};

const teamsIn = (g, cls) => classPrograms(g, cls).length;
const carsIn = (g, cls) => classEntries(g, cls).length;
const myCars = (g, cls) => playerEntries(g).filter(entry => entry.class === cls).length;

// 1) Grid padrão: a IA não sai quando o jogador entra; regras de carros por classe
{
  const single = createNewGame({ teamName: "Solo", cars: { HYPERCAR: 1 } });
  check("Hypercar: 10 equipes da IA + o jogador", teamsIn(single, "HYPERCAR") === 11, `${teamsIn(single, "HYPERCAR")}`);
  check("LMGT3: 9 equipes da IA com 2 carros cada", teamsIn(single, "LMGT3") === 9 && carsIn(single, "LMGT3") === 18);
  check("Hypercar: equipes com 1 ou 2 carros", classPrograms(single, "HYPERCAR").every(row => row.entries.length >= 1 && row.entries.length <= 2));
  const gt3 = createNewGame({ teamName: "GT", cars: { LMGT3: 2 } });
  check("jogador na LMGT3 inscreve 2 carros e a IA fica toda", myCars(gt3, "LMGT3") === 2 && teamsIn(gt3, "LMGT3") === 10 && teamsIn(gt3, "HYPERCAR") === 10);
  const full = createNewGame({ teamName: "Full", cars: { HYPERCAR: 2, LMGT3: 2 } });
  check("jogador com 4 carros (2 HYP + 2 GT3)", myCars(full, "HYPERCAR") === 2 && myCars(full, "LMGT3") === 2);
  check("LMGT3 com 1 carro vira 2", normalizeCars({ LMGT3: 1 }).LMGT3 === 2 && normalizeCars({}).HYPERCAR === 1);
  const numbers = full.entries.map(entry => entry.number);
  check("números de carro únicos no grid", new Set(numbers).size === numbers.length);
  check("todos os carros com 3 pilotos", full.entries.every(entry => entry.drivers.length === 3));
  check("metas para cada classe do jogador", !!full.career.objectives.HYPERCAR && !!full.career.objectives.LMGT3);
  check("P&D com 2 carros custa 50% a mais", programUpgradeCost(full, full.playerTeam, "HYPERCAR", "engine") === Math.floor(upgradeCost("HYPERCAR", full.playerTeam.programs.HYPERCAR.car, "engine", full.playerTeam.facilities) * 1.5));
  check("P&D com 1 carro custa o normal", programUpgradeCost(single, single.playerTeam, "HYPERCAR", "engine") === upgradeCost("HYPERCAR", single.playerTeam.programs.HYPERCAR.car, "engine", single.playerTeam.facilities));
}

// 2) Pontuação de equipes: na Hypercar os carros da equipe somam; na LMGT3 cada carro é uma linha até 2026
//    e os dois carros somam a partir de 2027
{
  const car = (teamId, classPos, finished = true, pole = false) => ({
    entryId: `${teamId}${classPos}`, teamId, teamName: teamId, color: "#fff", isPlayer: false, number: String(classPos), classPos, finished, pole,
    points: (finished ? racePoints(classPos) : 0) + (pole ? 1 : 0)
  });
  const results = [car("A", 1, true, true), car("A", 2), car("B", 3), car("C", 4), car("C", 5, false)];
  const hyp = teamRaceResults(results, "HYPERCAR", 1, 2025);
  const byTeam = id => hyp.find(row => row.teamId === id);
  check("Hypercar: equipe A soma os dois carros (25+1+18)", byTeam("A").points === 44 && byTeam("A").position === 1 && byTeam("A").win);
  check("Hypercar: equipe B (3º carro) é a 2ª equipe", byTeam("B").position === 2 && byTeam("B").points === 15);
  check("Hypercar: abandono não pontua", byTeam("C").position === 3 && byTeam("C").points === 12);
  const old = teamRaceResults(results, "LMGT3", 1, 2026);
  check("LMGT3 2026: cada carro é uma linha do campeonato de equipes", old.length === 5 && old.every(row => row.perCar && row.cars.length === 1));
  check("LMGT3 2026: o 2º carro da equipe A é a 2ª linha", old[1].teamId === "A" && old[1].points === 18 && old[1].position === 2);
  const gt3 = teamRaceResults(results, "LMGT3", 1, 2027);
  const gt = id => gt3.find(row => row.teamId === id);
  check("LMGT3 2027: equipe A soma os dois carros (25+1+18)", gt3.length === 3 && gt("A").points === 44);
  check("LMGT3 2027: abandono não pontua", gt("C").points === 12);
  check("regra da LMGT3 muda em 2027", teamScoring("LMGT3", 2026) === "PER_CAR" && teamScoring("LMGT3", 2027) === "COMBINED" && teamScoring("HYPERCAR", 2025) === "COMBINED");
}

// 3) Temporada completa: pontos de carros e de equipes batem com as corridas
{
  let g = createNewGame({ teamName: "Pts", cars: { HYPERCAR: 2, LMGT3: 2 } });
  const totals = { HYPERCAR: 0, LMGT3: 0 };
  const carTotals = {};
  while (g.raceIndex < 4) {
    const { report, game } = playRace(g);
    totals.HYPERCAR += report.playerTeams.HYPERCAR?.points || 0;
    report.players.forEach(result => {
      carTotals[result.entryId] = (carTotals[result.entryId] || 0) + result.points;
    });
    check(`dois carros do jogador por classe na corrida (${report.track.id})`, report.players.length === 4);
    check(`LMGT3 ${g.season}: uma linha por carro no resultado das equipes`, report.teams.LMGT3.length === carsIn(g, "LMGT3"));
    g = game;
  }
  const gt3Cars = playerEntries(g).filter(entry => entry.class === "LMGT3");
  check("pontos de equipe acumulam (Hypercar)", g.playerTeam.programs.HYPERCAR.points === totals.HYPERCAR, `${g.playerTeam.programs.HYPERCAR.points} vs ${totals.HYPERCAR}`);
  check("pontos de carro acumulam", playerEntries(g).every(entry => entry.points === carTotals[entry.id]));
  check("LMGT3 2025: classificação de equipes com uma linha por carro", teamStandings(g, "LMGT3").length === carsIn(g, "LMGT3") && teamStandings(g, "HYPERCAR").length === teamsIn(g, "HYPERCAR"));
  check("LMGT3 2025: linha do jogador é a do melhor carro", teamStandings(g, "LMGT3").find(row => row.isPlayer).points === Math.max(...gt3Cars.map(entry => entry.points)));
  check("LMGT3 2025: prêmio de fim de ano por equipe", teamRanking(g, "LMGT3").length === teamsIn(g, "LMGT3"));
  check("extrato com operação dos carros extras", g.playerTeam.ledger.at(-1).items.filter(item => item.label.startsWith("Operação do carro")).length === 3);
}

// 3b) Virada de 2026 para 2027: a LMGT3 passa a somar os dois carros e a meta muda de escala
{
  let g = createNewGame({ teamName: "Regra", cars: { LMGT3: 2 }, season: 2026 });
  check("meta de 2026 é por carro", g.career.objectives.LMGT3.perCar && g.career.objectives.LMGT3.text.includes("um carro"));
  g = playSeason(g);
  const summary = buildSeasonSummary(g);
  check("resumo de 2026 com uma linha por carro na LMGT3", summary.gt3.length === carsIn(g, "LMGT3") && summary.gt3[0].label.includes("#"));
  const { game: next } = startNextSeason(g, { renew: {} });
  check("temporada 2027", next.season === 2027);
  check("meta de 2027 é por equipe", !next.career.objectives.LMGT3.perCar && next.career.objectives.LMGT3.position === createObjective(next, "LMGT3").position);
  check("2027: uma linha por equipe na LMGT3", teamStandings(next, "LMGT3").length === teamsIn(next, "LMGT3"));
  check("arquivo de 2026 guarda os carros", next.archive.history.at(-1).standings.filter(row => row.class === "LMGT3").length === carsIn(g, "LMGT3"));
}

// 4) Ordens de equipe por classe
{
  let g = createNewGame({ teamName: "Orders", cars: { HYPERCAR: 2, LMGT3: 2 } });
  g = applyBop(g, TRACKS[0]);
  const weekend = createWeekend(g);
  weekend.setupScore = 80;
  weekend.qualyScore = 60;
  weekend.qualifying = computeQualifying(g, weekend);
  let race = createRaceState(g, weekend);
  race = setTeamOrders(race, "LMGT3", "HOLD");
  check("ordem de equipe só na classe escolhida", race.teamOrders.LMGT3 === "HOLD" && race.teamOrders.HYPERCAR === "FREE");
  const [a, b] = race.grid.filter(car => car.isPlayer && car.class === "HYPERCAR");
  b.distance = a.distance - 20;
  b.laps = a.laps;
  check("troca liberada com os Hypercars juntos", canSwapTeamCars(race, "HYPERCAR"));
  const swapped = swapTeamCars(race, "HYPERCAR").grid.filter(car => car.isPlayer && car.class === "HYPERCAR").sort((x, y) => y.distance - x.distance);
  check("troca inverte os Hypercars", swapped[0].entryId === b.entryId);
}

// 5) Corte do conselho no lugar da demissão
{
  const base = playSeason(createNewGame({ teamName: "Cut", cars: { HYPERCAR: 2, LMGT3: 2 }, difficulty: "NORMAL" }));
  const broke = { ...base, career: { ...base.career, confidence: 0, objectives: { HYPERCAR: { position: 1, text: "x" }, LMGT3: { position: 1, text: "x" } } } };
  const result = startNextSeason(broke, {});
  const counts = cls => myCars(result.game, cls);
  check("conselho corta em vez de demitir", !!result.cut && result.game.season === base.season + 1);
  check("corte tira carro(s) e mantém a equipe no grid", counts("HYPERCAR") + counts("LMGT3") < 4 && counts("HYPERCAR") + counts("LMGT3") >= 1, `${counts("HYPERCAR")} HYP, ${counts("LMGT3")} GT3`);
  check("LMGT3 nunca fica com 1 carro", [0, 2].includes(counts("LMGT3")));
  check("confiança volta depois do corte", result.game.career.confidence > 0);
  if (result.cut.type === "CAR") {
    const hyp = playerEntries(broke).filter(entry => entry.class === "HYPERCAR").sort((a, b) => b.points - a.points);
    check("corte tira o Hypercar que fez menos pontos", playerEntries(result.game).some(entry => entry.number === hyp[0].number) || hyp[0].points === hyp[1].points);
  }
  const solo = playSeason(createNewGame({ teamName: "Solo", cars: { HYPERCAR: 1 } }));
  const soloCut = startNextSeason({ ...solo, career: { ...solo.career, confidence: 0, objectives: { HYPERCAR: { position: 1, text: "x" } } } }, {});
  check("com um carro só, o corte é no orçamento", soloCut.cut?.type === "BUDGET" && myCars(soloCut.game, "HYPERCAR") === 1);
  const easy = playSeason(createNewGame({ teamName: "Easy", cars: { HYPERCAR: 2 }, difficulty: "EASY" }));
  const easyNext = startNextSeason({ ...easy, career: { ...easy.career, confidence: 0, objectives: { HYPERCAR: { position: 1, text: "x" } } } }, {});
  check("no Fácil o conselho nunca corta", !easyNext.cut && myCars(easyNext.game, "HYPERCAR") === 2);
}

// 6) Programa do jogador na virada: inscrever, retirar e regras
{
  const base = playSeason(createNewGame({ teamName: "Plan", cars: { HYPERCAR: 1 }, difficulty: "EASY" }));
  const rich = { ...base, playerTeam: { ...base.playerTeam, funds: 80000000 } };
  check("LMGT3 com 1 carro é recusado", !!validatePlan(rich, { HYPERCAR: 1, LMGT3: 1 }));
  check("equipe sem carro é recusada", !!validatePlan(rich, { HYPERCAR: 0, LMGT3: 0 }));
  check("inscrever 2 GT3 custa duas inscrições", planEntryCost(rich, { HYPERCAR: 1, LMGT3: 2 }) === 2 * 2000000);
  const grown = startNextSeason(rich, { cars: { HYPERCAR: 2, LMGT3: 2 } }).game;
  check("plano aplicado: 2 HYP + 2 GT3", myCars(grown, "HYPERCAR") === 2 && myCars(grown, "LMGT3") === 2);
  check("IA continua toda no grid", teamsIn(grown, "HYPERCAR") === 11 && teamsIn(grown, "LMGT3") === 10);
  check("programa novo da LMGT3 tem meta", !!grown.career.objectives.LMGT3);
  const shrunk = startNextSeason(playSeason(grown), { cars: { HYPERCAR: 0, LMGT3: 2 } }).game;
  check("sair da Hypercar mantém a LMGT3", myCars(shrunk, "HYPERCAR") === 0 && myCars(shrunk, "LMGT3") === 2 && !shrunk.playerTeam.programs.HYPERCAR);
  // Só LMGT3: para voltar à Hypercar precisa do convite do ACO
  const gtOnly = playSeason(shrunk);
  const noInvite = { ...gtOnly, playerTeam: { ...gtOnly.playerTeam, programs: { ...gtOnly.playerTeam.programs, LMGT3: { ...gtOnly.playerTeam.programs.LMGT3, points: 0 } } } };
  check("sem convite, Hypercar é recusada", !!validatePlan(noInvite, { HYPERCAR: 1, LMGT3: 2 }));
  const champ = { ...gtOnly, playerTeam: { ...gtOnly.playerTeam, programs: { ...gtOnly.playerTeam.programs, LMGT3: { ...gtOnly.playerTeam.programs.LMGT3, points: 9999 } } } };
  check("campeão da LMGT3 recebe o convite", buildSeasonSummary(champ).invite === true && !validatePlan(champ, { HYPERCAR: 1, LMGT3: 2 }));
  const titles = startNextSeason(champ, {}).game.playerTeam.championships;
  check("título de equipe somado na organização", titles >= 1);
}

// 7) Editor de grid
{
  let g = createNewGame({ teamName: "Sand", cars: { HYPERCAR: 1 } });
  const bad = sandboxCreateTeam(g, { name: "X", cls: "LMGT3", cars: 1 });
  check("editor: LMGT3 exige 2 carros", !!bad.error);
  const dup = sandboxCreateTeam(g, { name: "Toyota Gazoo", cls: "HYPERCAR", cars: 1 });
  check("editor: nome repetido é recusado", !!dup.error);
  const num = sandboxCreateTeam(g, { name: "Nova", cls: "HYPERCAR", cars: 1, numbers: ["7"] });
  check("editor: número repetido é recusado", !!num.error);
  const created = sandboxCreateTeam(g, { name: "Equipe Nova", cls: "HYPERCAR", cars: 2, tier: 0, numbers: ["101", "102"] });
  check("editor: cria equipe com 2 carros", !created.error && teamEntries(created.game, created.team.id).length === 2 && teamsIn(created.game, "HYPERCAR") === 12);
  g = created.game;
  const one = sandboxUpdateTeam(g, created.team.id, { cars: 1, name: "Equipe Renomeada", investment: 1.5 });
  check("editor: muda carros, nome e verba", !one.error && teamEntries(one.game, created.team.id).length === 1 && one.game.teams.find(t => t.id === created.team.id).ai.investment === 1.5);
  const gtTeam = g.teams.find(team => team.class === "LMGT3");
  check("editor: LMGT3 não pode ficar com 1 carro", !!sandboxUpdateTeam(g, gtTeam.id, { cars: 1 }).error);
  check("editor: não edita nem exclui a equipe do jogador", !!sandboxDeleteTeam(g, "player").error && !!sandboxUpdateTeam(g, "player", { name: "x" }).error);
  const removed = sandboxDeleteTeam(one.game, created.team.id);
  check("editor: exclui equipe e libera os pilotos", !removed.error && teamsIn(removed.game, "HYPERCAR") === 11 && removed.game.driversPool.length > one.game.driversPool.length);
  // Grid grande: 6 equipes novas e uma corrida inteira
  let big = g;
  for (let i = 0; i < 6; i++) {
    big = sandboxCreateTeam(big, { name: `Extra ${i}`, cls: i % 2 ? "LMGT3" : "HYPERCAR", cars: 2, tier: i % 3 }).game;
  }
  const raced = playRace(big);
  check("corrida com grid ampliado", raced.report.classes.HYPERCAR.length + raced.report.classes.LMGT3.length === big.entries.length, `${big.entries.length} carros`);
}

// 8) Saves antigos
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
    aiTeams: [
      { id: "h1", name: "Toyota Gazoo", class: "HYPERCAR", funds: 4e7, points: 10, car: { engine: 80, aero: 80, chassis: 80, reliability: 80, efficiency: 80, crew: 80 }, drivers: [{ id: "b", name: "Mick Stevens", rating: 85, age: 28 }] },
      { id: "g1", name: "Porsche", class: "LMGT3", funds: 1e7, points: 5, car: { engine: 70, aero: 70, chassis: 70, reliability: 80, efficiency: 70, crew: 70 }, drivers: [{ id: "c", name: "Nick Rast", rating: 75, age: 30 }] }
    ],
    driversPool: [{ id: "p1", name: "Mick Norris", rating: 88, age: 30, marketValue: 40000000 }],
    raceIndex: 7,
    archive: { history: [], currentSeasonRaces: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ track: "x" + i, winner: "a", podium: [], gt3Winner: "b", gt3Podium: [] })) },
    newsFeed: []
  };
  const game = migrateSave(legacy);
  check("save 3.x vira 4.2", game.version === "4.2");
  check("save do fim de temporada vai para o encerramento", game.raceIndex === TRACKS.length);
  check("save 3.x: GT3 da IA ganha o segundo carro", teamEntries(game, "g1").length === 2);
  check("save 3.x: line-ups completos", game.entries.every(entry => entry.drivers.length === 3));
  check("save 3.x: meta de patrocínio antiga preservada", game.playerTeam.sponsors[0].goalPosition === 10);
  const next = startNextSeason(game, {});
  check("vira a temporada a partir do save antigo", next.game.season === 2027 && next.game.raceIndex === 0);
  check("joga corridas depois da migração", playSeason({ ...next.game, raceIndex: 6 }).raceIndex === TRACKS.length);

  // Save 4.1: carro principal Hypercar + segundo carro LMGT3
  const ai = (id, name, cls, pts) => ({ id, name, class: cls, tier: 1, funds: 3e7, support: 1e6, annualBudget: 2e7, points: pts, stats: { wins: 1 }, number: id.slice(-2), color: "#fff",
    car: { engine: 80, aero: 80, chassis: 80, reliability: 80, efficiency: 80, crew: 80 }, program: { investment: 1.1, engineering: 1.05 },
    drivers: [1, 2, 3].map(i => ({ id: `${id}d${i}`, name: `${name} ${i}`, rating: 80, age: 30, wage: 100000, stats: {} })) });
  const v41 = {
    version: "4.1", season: 2027, raceIndex: 3,
    playerTeam: { ...ai("player", "Duo", "HYPERCAR", 40), number: "17", reputation: 50, facilities: { windTunnel: 2, engineShop: 1, simulator: 1, hospitality: 1 }, staff: {}, sponsors: [], ledger: [], careerWins: 2, championships: 0 },
    sisterTeam: { ...ai("player2", "Duo GT", "LMGT3", 22), number: "18" },
    aiTeams: [ai("hyp_01", "Toyota Gazoo", "HYPERCAR", 50), ai("gt3_02", "Porsche", "LMGT3", 30)],
    driversPool: [], archive: { history: [{ year: 2026, standings: [{ id: "player2", name: "Duo GT", class: "LMGT3", points: 10, stats: {} }], races: [] }], currentSeasonRaces: [] },
    newsFeed: [], career: { difficulty: "NORMAL", bopEnabled: true, confidence: 70, objective: { position: 3 }, objective2: { position: 5 } }, settings: {}
  };
  const migrated = migrateSave(v41);
  check("save 4.1 migra para equipes com programas", migrated.version === "4.2" && !!migrated.playerTeam.programs.HYPERCAR && !!migrated.playerTeam.programs.LMGT3);
  check("save 4.1: LMGT3 do jogador ganha o segundo carro", myCars(migrated, "LMGT3") === 2 && myCars(migrated, "HYPERCAR") === 1);
  check("save 4.1: pontos de equipe preservados", migrated.playerTeam.programs.HYPERCAR.points === 40 && migrated.playerTeam.programs.LMGT3.points === 22);
  check("save 4.1: histórico do segundo carro vira da equipe", migrated.archive.history[0].standings[0].id === "player");
  check("save 4.1 joga a temporada", playSeason(migrated).raceIndex === TRACKS.length);
}

// 9) Motor de equilíbrio: perfis da IA, homologação e ciclos de regulamento
{
  const game = createNewGame({ teamName: "Bal", cars: { HYPERCAR: 1 } });
  check("toda equipe da IA tem perfil", game.teams.every(t => t.ai && t.ai.investment > 0 && t.ai.engineering > 0));
  check("perfis variam entre as equipes", new Set(game.teams.map(t => t.ai.investment)).size > 5);
  check("todos os programas recebem fichas", [game.playerTeam, ...game.teams].every(t => Object.values(t.programs).every(p => p.devTokens >= HOMOLOGATION.base)));
  check("jogador atrás ganha fichas de recuperação", game.playerTeam.programs.HYPERCAR.devTokens > HOMOLOGATION.base, `${game.playerTeam.programs.HYPERCAR.devTokens}`);
  const team = game.teams[0];
  const broke = developAiTeam({ ...team, funds: 1e9, programs: { [team.class]: { ...team.programs[team.class], devTokens: 0 } } }, 2, 1);
  check("IA sem fichas não evolui peças homologadas", ["engine", "aero", "chassis", "reliability", "efficiency"].every(p => broke.programs[team.class].car[p] <= team.programs[team.class].car[p]));
  check("regulamento novo em 2028 e a cada 5 anos", regulationFor(2028).type === "RESET" && regulationFor(2033).type === "RESET" && regulationFor(2030).type === "STABLE");
  const evolved = evolveAiProfiles(game.teams, cls => teamStandings(game, cls), { difficulty: "NORMAL" }).aiTeams;
  check("perfis ficam dentro dos limites", evolved.every(t => t.ai.investment >= INVESTMENT_RANGE[0] && t.ai.investment <= INVESTMENT_RANGE[1] && t.ai.engineering >= ENGINEERING_RANGE[0] && t.ai.engineering <= ENGINEERING_RANGE[1]));
  const before = playSeason({ ...game, season: 2027 });
  const next = startNextSeason(before, {}).game;
  check("regulamento novo zera os carros", classPrograms(next, "HYPERCAR").every(row => row.program.car.engine <= 75));
  check("no regulamento novo a meta segue o carro novo", next.career.objectives.HYPERCAR.position === createObjective(next, "HYPERCAR").position);
}

console.log(failures ? `\n${failures} falha(s)` : "\nTodos os cenários passaram.");
process.exit(failures ? 1 : 0);
