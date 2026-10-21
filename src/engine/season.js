import {
  DIFFICULTIES,
  DRIVERS_PER_CAR,
  REGULATION_CYCLE,
  REGULATION_START,
  CLASSES,
  CLASS_RULES,
  BOARD_CUT_BUDGET,
  CONFIDENCE_AFTER_CUT
} from "../data/constants.js";
import { clamp, randInt, generateRookie } from "../utils/helpers.js";
import {
  generateSeasonStartNews,
  generateTransferNews,
  generateRegulationNews,
  generateProgramNews,
  generateAiProgramNews
} from "../utils/mediaEngine.js";
import { teamStandings, teamRanking, carStandings, seasonReview, hypercarInvite } from "./career.js";
import { developDriver, willRetire, fillAiVacancies, recruitStars, signDriverTo } from "./drivers.js";
import { developAiTeams, evolveAiProfiles, aiAnnualBudget, aiConceptOffset, profileOf, gaussian } from "./ai.js";
import { CAR_PARTS, seasonPrize, driverWageFor, carEntryFee, extraCarOperations, programAnnualBudget } from "./economy.js";
import { freshPlayerCar, generateStaffMarket, withHomologation, playerObjectives, newProgram, newEntry, lineupFor, DEFAULT_PLAYER_NUMBERS } from "./newGame.js";
import { PLAYER_ID, allowedCars, freeNumber, isPerCar, teamClasses } from "./team.js";

// Ciclos de regulamento: a cada REGULATION_CYCLE temporadas, carros novos para todos.
// No começo do ciclo quem acertou o conceito domina; perto do fim os custos altos fazem o grid se aproximar.
export const regulationFor = season => {
  const phase = (((season - REGULATION_START) % REGULATION_CYCLE) + REGULATION_CYCLE) % REGULATION_CYCLE;
  if (phase === 0) {
    return { type: "RESET", text: "⚠️ REGULAMENTO NOVO! Carros novos para todos — quem acertar o conceito sai na frente." };
  }
  const left = REGULATION_CYCLE - phase;
  return { type: "STABLE", text: `Regulamento estável (regulamento novo em ${left} temporada${left > 1 ? "s" : ""}).` };
};

// Carro do regulamento novo: base comum + qualidade do conceito (a equipe de pit continua a mesma)
const conceptCar = (car, offset, reliability) => {
  const next = { ...car };
  CAR_PARTS.filter(part => part !== "crew" && part !== "reliability").forEach(part => {
    next[part] = clamp(34 + offset + randInt(-2, 2), 20, 60);
  });
  next.reliability = clamp(Math.round(reliability), 40, 70);
  return next;
};

// Conceito do jogador: Diretor Técnico e fábrica (túnel de vento e centro de motores) pesam, mas sempre há sorte
export const playerConceptOffset = team => {
  const stars = team.staff?.technicalDirector?.stars ?? 2;
  const factory = ((team.facilities?.windTunnel ?? 1) + (team.facilities?.engineShop ?? 1)) / 2;
  return Math.round(clamp((stars - 3) * 2.5 + (factory - 2) * 2 + gaussian() * 5, -10, 14));
};

const conceptLabel = offset => (offset >= 6 ? "forte" : offset <= -4 ? "fraco" : "na média");

export const renewalWage = (driver, cls) => Math.floor(driverWageFor(driver, cls) * ((driver.morale ?? 75) < 50 ? 1.2 : 1));

// ---------------------------------------------------------------------------
// Programa do jogador na próxima temporada: quantos carros em cada classe
// ---------------------------------------------------------------------------

export const playerCarCounts = game =>
  Object.fromEntries(CLASSES.map(cls => [cls, game.entries.filter(entry => entry.teamId === PLAYER_ID && entry.class === cls).length]));

// Opções por classe (quantidades permitidas, inscrição por carro novo, operação por carro extra e verba anual)
export const programOptions = game => {
  const current = playerCarCounts(game);
  const invite = hypercarInvite(game);
  return CLASSES.map(cls => ({
    cls,
    label: CLASS_RULES[cls].label,
    current: current[cls],
    // Entrar na Hypercar vindo só da LMGT3 exige o convite do ACO
    allowed: allowedCars(cls).filter(count => cls !== "HYPERCAR" || current.HYPERCAR > 0 || count === 0 || invite),
    needsInvite: cls === "HYPERCAR" && current.HYPERCAR === 0,
    invite,
    entryFee: carEntryFee(cls),
    operations: extraCarOperations(cls),
    annual: Object.fromEntries(allowedCars(cls).map(count => [count, programAnnualBudget(cls, count)]))
  }));
};

// Custo de inscrição dos carros novos de um plano ({ HYPERCAR: n, LMGT3: n })
export const planEntryCost = (game, plan) => {
  const current = playerCarCounts(game);
  return CLASSES.reduce((sum, cls) => sum + Math.max(0, (plan[cls] ?? current[cls]) - current[cls]) * carEntryFee(cls), 0);
};

export const validatePlan = (game, plan) => {
  const options = programOptions(game);
  for (const option of options) {
    const count = plan[option.cls] ?? option.current;
    if (!option.allowed.includes(count)) {
      return option.needsInvite && count > 0
        ? "Para entrar na Hypercar a equipe precisa do convite do ACO (título da LMGT3, ou Top 3 com reputação 55+)."
        : `Quantidade de carros inválida na ${option.label}.`;
    }
  }
  if (CLASSES.every(cls => (plan[cls] ?? 0) === 0)) {
    return "A equipe precisa de pelo menos um carro.";
  }
  return null;
};

// Corte do conselho: quando a confiança zera, o conselho tira um carro da classe que foi pior
// (na LMGT3 isso significa sair da classe, porque lá a equipe precisa de dois carros).
// Sem carro para cortar, o corte é no orçamento.
export const planBoardCut = (game, review) => {
  const current = playerCarCounts(game);
  const gap = cls => {
    const entry = review.entries.find(item => item.cls === cls);
    return entry ? entry.position - entry.objective.position : -99;
  };
  const order = CLASSES.filter(cls => current[cls] > 0).sort((a, b) => gap(b) - gap(a));
  for (const cls of order) {
    if (cls === "HYPERCAR" && current.HYPERCAR === 2) {
      return { type: "CAR", cls, plan: { ...current, HYPERCAR: 1 }, text: "O conselho cortou um dos Hypercars: a equipe segue com um carro na classe." };
    }
    if (cls === "HYPERCAR" && current.LMGT3 > 0) {
      return { type: "PROGRAM", cls, plan: { ...current, HYPERCAR: 0 }, text: "O conselho tirou a equipe da Hypercar: a operação fica só na LMGT3." };
    }
    if (cls === "LMGT3" && current.HYPERCAR > 0) {
      return { type: "PROGRAM", cls, plan: { ...current, LMGT3: 0 }, text: "O conselho fechou o programa da LMGT3 (a classe exige dois carros): a operação fica só na Hypercar." };
    }
  }
  return { type: "BUDGET", cls: null, plan: current, text: `Sem carro para cortar, o conselho reduziu o orçamento anual em ${Math.round((1 - BOARD_CUT_BUDGET) * 100)}%.` };
};

// Linha do campeonato de equipes para as telas e o arquivo
const standingRow = row => ({
  id: row.team.id,
  key: row.key,
  rowKey: row.rowKey,
  perCar: row.perCar,
  name: row.team.name,
  label: row.perCar ? `${row.team.name} #${row.entries[0]?.number}` : row.team.name,
  class: row.cls,
  color: row.team.color,
  isPlayer: row.isPlayer,
  points: row.points,
  stats: { ...row.stats },
  numbers: row.entries.map(entry => entry.number)
});

// Resumo exibido na tela de encerramento (não altera o jogo)
export const buildSeasonSummary = game => {
  const hyper = teamStandings(game, "HYPERCAR").map(standingRow);
  const gt3 = teamStandings(game, "LMGT3").map(standingRow);
  const standingsOf = cls => (cls === "HYPERCAR" ? hyper : gt3);
  const review = seasonReview(game);
  const classes = teamClasses(game.playerTeam);
  const championClasses = classes.filter(cls => standingsOf(cls)[0]?.isPlayer);
  // Prêmio do campeonato pela posição da equipe (na regra PER_CAR, a do melhor carro entre as equipes)
  const prize = classes.reduce((sum, cls) => {
    const ranking = teamRanking(game, cls);
    return sum + seasonPrize(cls, ranking.findIndex(row => row.isPlayer) + 1, ranking.length);
  }, 0);
  const carChampion = cls => {
    const top = carStandings(game, cls)[0];
    return top ? { id: top.id, name: `${top.name} #${top.number}`, teamId: top.teamId, isPlayer: top.isPlayer, points: top.points, drivers: top.drivers.map(d => d.name) } : null;
  };
  return {
    season: game.season,
    hyper,
    gt3,
    hyperChampion: hyper[0],
    gt3Champion: gt3[0],
    carChampions: { HYPERCAR: carChampion("HYPERCAR"), LMGT3: carChampion("LMGT3") },
    isPlayerChampion: championClasses.length > 0,
    championClasses,
    review,
    prize,
    expiring: game.entries
      .filter(entry => entry.teamId === PLAYER_ID)
      .flatMap(entry =>
        entry.drivers
          .filter(driver => (driver.contractYears ?? 1) <= 1)
          .map(driver => ({ driver, newWage: renewalWage(driver, entry.class), car: entry.number, carId: entry.id, cls: entry.class }))
      ),
    invite: hypercarInvite(game),
    regulation: regulationFor(game.season + 1),
    program: programOptions(game),
    boardCut: review.boardCut ? planBoardCut(game, review) : null
  };
};

const archiveRow = (game, row) => ({
  ...standingRow(row),
  number: row.entries.map(entry => entry.number).join("/"),
  drivers: row.entries.flatMap(entry => entry.drivers.map(driver => ({ id: driver.id, name: driver.name, nationality: driver.nationality, seasonPoints: driver.seasonPoints || 0 })))
});

const resetProgramStats = program => ({ ...program, points: 0, stats: { wins: 0, podiums: 0, poles: 0 }, bop: 0 });
const resetEntryStats = entry => ({ ...entry, points: 0, stats: { wins: 0, podiums: 0, poles: 0 } });

// Vira a temporada: prêmios, arquivo, regulamento, pilotos, contratos, programa do jogador, mercado, orçamento e conselho
// decisions: { renew: { [idPiloto]: bool }, cars: { HYPERCAR: 0–2, LMGT3: 0 ou 2 }, numbers: { [classe]: [...] } }
export const startNextSeason = (game, decisions = {}) => {
  const summary = buildSeasonSummary(game);
  const { review, regulation } = summary;
  const nextSeason = game.season + 1;
  const reset = regulation.type === "RESET";
  const difficulty = DIFFICULTIES[game.career.difficulty] || DIFFICULTIES.NORMAL;
  const notes = [];
  const transferMoves = [];
  const takenNames = new Set([...game.driversPool, ...game.entries.flatMap(entry => entry.drivers)].map(driver => driver.name));
  const standingsOf = cls => teamStandings(game, cls);
  // Uma linha por equipe (prêmios e reação das matrizes)
  const rankingOf = cls => teamRanking(game, cls);
  const positionOf = (teamId, cls) => rankingOf(cls).findIndex(row => row.team.id === teamId) + 1;
  const prizeFor = (teamId, cls) => seasonPrize(cls, positionOf(teamId, cls), rankingOf(cls).length);
  const teamChampions = new Set(CLASSES.map(cls => standingsOf(cls)[0]?.key).filter(Boolean));
  const carChampionIds = new Set(CLASSES.map(cls => summary.carChampions[cls]?.id).filter(Boolean));
  const crown = driver => ({ ...driver, stats: { ...driver.stats, titles: (driver.stats?.titles || 0) + 1 } });

  const seasonRecord = {
    year: game.season,
    champion: summary.hyperChampion?.label,
    gt3Champion: summary.gt3Champion?.label,
    carChampions: { HYPERCAR: summary.carChampions.HYPERCAR?.name, LMGT3: summary.carChampions.LMGT3?.name },
    standings: CLASSES.flatMap(cls => standingsOf(cls).map(row => archiveRow(game, row))),
    races: [...game.archive.currentSeasonRaces]
  };

  // Mercado: pool envelhece, aposentadorias e novatos
  let pool = game.driversPool
    .map(driver => developDriver(driver))
    .filter(driver => driver.age <= 40 && !willRetire(driver));

  // Pilotos de um carro: evolução, aposentadoria e renovação de contrato
  const simulatorLevel = game.playerTeam.facilities?.simulator ?? 1;
  const processDrivers = (entry, isPlayer, carTag) => {
    const kept = [];
    entry.drivers.forEach(original => {
      let driver = developDriver(carChampionIds.has(entry.id) ? crown(original) : original, isPlayer ? { simulatorLevel, playerTeam: true } : {});
      if (willRetire(driver)) {
        if (isPlayer) {
          notes.push(`${driver.name}${carTag} anunciou a aposentadoria aos ${driver.age} anos.`);
        }
        return;
      }
      if ((original.contractYears ?? 1) <= 1) {
        const leaves = isPlayer ? decisions.renew?.[original.id] === false : Math.random() >= 0.6;
        if (leaves) {
          pool.push({ ...driver, teamId: null, entryId: null, contractYears: 0 });
          if (isPlayer) {
            notes.push(`${driver.name}${carTag} deixou a equipe ao fim do contrato.`);
          }
          return;
        }
        driver = isPlayer
          ? { ...driver, contractYears: 2, wage: renewalWage(original, entry.class) }
          : { ...driver, contractYears: 1 + Math.floor(Math.random() * 3), wage: driverWageFor(driver, entry.class) };
      } else {
        driver = { ...driver, contractYears: original.contractYears - 1 };
      }
      kept.push(driver);
    });
    return kept;
  };

  // A matriz e o departamento técnico de cada equipe da IA reagem à temporada
  const evolved = evolveAiProfiles(game.teams, rankingOf, { difficulty: game.career.difficulty });
  const concepts = [];
  const carsOf = (teamId, cls = null) => game.entries.filter(entry => entry.teamId === teamId && (!cls || entry.class === cls)).length;
  let aiTeams = evolved.aiTeams.map(team => {
    const cls = team.class;
    const program = resetProgramStats(team.programs[cls]);
    if (reset) {
      const offset = aiConceptOffset(team);
      concepts.push({ team, offset });
      program.car = conceptCar(program.car, offset, 52 + (profileOf(team).engineering - 1) * 30 + randInt(-4, 4));
    }
    return {
      ...team,
      funds: team.funds + prizeFor(team.id, cls) + aiAnnualBudget(team, carsOf(team.id), game.career.difficulty),
      championships: (team.championships || 0) + (teamChampions.has(`${team.id}:${cls}`) ? 1 : 0),
      programs: { ...team.programs, [cls]: program }
    };
  });

  // Equipe do jogador
  const myClasses = teamClasses(game.playerTeam);
  const titles = myClasses.filter(cls => teamChampions.has(`${PLAYER_ID}:${cls}`)).length;
  let player = {
    ...game.playerTeam,
    funds: game.playerTeam.funds + myClasses.reduce((sum, cls) => sum + prizeFor(PLAYER_ID, cls), 0),
    championships: (game.playerTeam.championships || 0) + titles,
    programs: Object.fromEntries(Object.entries(game.playerTeam.programs).map(([cls, program]) => [cls, resetProgramStats(program)]))
  };
  if (reset) {
    myClasses.forEach(cls => {
      const offset = playerConceptOffset(game.playerTeam);
      notes.push(`Regulamento novo: o conceito do ${myClasses.length > 1 ? `programa da ${CLASS_RULES[cls].label}` : "carro"} nasceu ${conceptLabel(offset)} (${offset >= 0 ? "+" : ""}${offset}).`);
      player.programs[cls] = { ...player.programs[cls], car: conceptCar(player.programs[cls].car, offset, 48 + (game.playerTeam.staff?.technicalDirector?.stars ?? 2) * 3 + randInt(-3, 3)) };
    });
  }

  // Carros: pilotos e pontos
  const multiPlayer = game.entries.filter(entry => entry.teamId === PLAYER_ID).length > 1;
  let entries = game.entries.map(entry => {
    const isPlayer = entry.teamId === PLAYER_ID;
    return resetEntryStats({ ...entry, drivers: processDrivers(entry, isPlayer, isPlayer && multiPlayer ? ` (#${entry.number})` : "") });
  });

  // Programa do jogador: o conselho corta (se a confiança zerou) ou o jogador muda a quantidade de carros
  const current = playerCarCounts(game);
  let cut = null;
  let plan = { ...current, ...(decisions.cars || {}) };
  if (summary.boardCut) {
    cut = summary.boardCut;
    plan = cut.plan;
    notes.push(cut.text);
  } else {
    const error = validatePlan(game, plan);
    if (error) {
      notes.push(`Mudança no programa recusada: ${error}`);
      plan = current;
    } else {
      const fee = planEntryCost(game, plan);
      if (fee > 0 && fee > player.funds) {
        notes.push("Sem caixa para inscrever os carros novos: o programa segue como estava.");
        plan = current;
      } else if (fee > 0) {
        player.funds -= fee;
        notes.push(`Inscrição dos carros novos: $${(fee / 1000000).toFixed(1)}M.`);
      }
    }
  }
  const changes = [];
  const seasonPoints = new Map(game.entries.map(entry => [entry.id, entry.points || 0]));
  CLASSES.forEach(cls => {
    const target = plan[cls] ?? 0;
    let mine = entries.filter(entry => entry.teamId === PLAYER_ID && entry.class === cls);
    // Sai o carro que fez menos pontos na temporada; os pilotos dele vão para o mercado
    while (mine.length > target) {
      const removed = [...mine].sort((a, b) => seasonPoints.get(a.id) - seasonPoints.get(b.id))[0];
      removed.drivers.forEach(driver => pool.push({ ...driver, teamId: null, entryId: null, contractYears: 0 }));
      entries = entries.filter(entry => entry.id !== removed.id);
      mine = mine.filter(entry => entry.id !== removed.id);
      changes.push({ type: cut ? "CUT" : "DROP", cls, number: removed.number });
    }
    if (target === 0 && player.programs[cls]) {
      const { [cls]: _closed, ...rest } = player.programs;
      player = { ...player, programs: rest };
    }
    if (target > 0 && !player.programs[cls]) {
      // Programa novo: carro de estreante (ou conceito do regulamento novo)
      const car = reset
        ? conceptCar(freshPlayerCar(game.career.difficulty), playerConceptOffset(game.playerTeam), 50)
        : freshPlayerCar(game.career.difficulty);
      player = { ...player, programs: { ...player.programs, [cls]: newProgram(car) } };
    }
    for (let i = mine.length; i < target; i++) {
      const wanted = decisions.numbers?.[cls]?.[i] || DEFAULT_PLAYER_NUMBERS[cls][i];
      const entry = newEntry(PLAYER_ID, cls, freeNumber({ entries }, wanted));
      entry.drivers = lineupFor(entry, 66, takenNames);
      entries = [...entries, entry];
      changes.push({ type: "EXPAND", cls, number: entry.number });
      notes.push(`Novo carro: o #${entry.number} estreia na ${CLASS_RULES[cls].label} em ${nextSeason}.`);
    }
  });

  // Line-ups completos: academia para o jogador, mercado para a IA
  entries = entries.map(entry => {
    if (entry.teamId !== PLAYER_ID || entry.drivers.length >= DRIVERS_PER_CAR) {
      return entry;
    }
    const drivers = [...entry.drivers];
    while (drivers.length < DRIVERS_PER_CAR) {
      const rookie = signDriverTo(generateRookie(takenNames), entry, 2);
      drivers.push(rookie);
      notes.push(`${rookie.name} subiu da academia para completar o line-up do #${entry.number}.`);
    }
    return { ...entry, drivers };
  });
  for (let i = 0; i < 6; i++) {
    pool.push(generateRookie(takenNames));
  }
  aiTeams = aiTeams.map(team => {
    const cars = entries.filter(entry => entry.teamId === team.id);
    const filled = fillAiVacancies(team, cars, pool, takenNames, transferMoves);
    pool = filled.pool;
    const byId = new Map(filled.entries.map(entry => [entry.id, entry]));
    entries = entries.map(entry => byId.get(entry.id) || entry);
    return filled.team;
  });
  // As fábricas com mais verba vão atrás das estrelas do mercado
  const recruited = recruitStars(aiTeams, entries, pool, transferMoves);
  aiTeams = recruited.teams;
  entries = recruited.entries;
  pool = recruited.pool.sort((a, b) => b.rating - a.rating).slice(0, 45);

  // Orçamento anual do conselho (cada programa conforme o número de carros)
  const repFactor = 0.75 + (player.reputation ?? 30) / 200;
  const programsBudget = CLASSES.reduce((sum, cls) => sum + programAnnualBudget(cls, plan[cls] ?? 0), 0);
  const annual = Math.floor(programsBudget * difficulty.budgetMult * repFactor * review.budgetFactor * (cut?.type === "BUDGET" ? BOARD_CUT_BUDGET : 1));
  player.funds += annual;
  notes.push(`Orçamento do conselho para ${nextSeason}: $${(annual / 1000000).toFixed(1)}M.`);

  let next = {
    ...game,
    season: nextSeason,
    raceIndex: 0,
    playerTeam: player,
    teams: aiTeams,
    entries,
    driversPool: pool,
    staffMarket: generateStaffMarket(),
    archive: {
      ...game.archive,
      history: [...game.archive.history, seasonRecord],
      currentSeasonRaces: []
    },
    career: {
      ...game.career,
      confidence: cut ? CONFIDENCE_AFTER_CUT : review.confidence,
      seasonsCompleted: (game.career.seasonsCompleted || 0) + 1,
      cuts: (game.career.cuts || 0) + (cut ? 1 : 0)
    }
  };
  // Fichas de homologação da nova temporada (mais no ano de regulamento novo)
  next = withHomologation(next, reset);
  // Desenvolvimento de inverno da IA (já com as fichas novas)
  next.teams = developAiTeams(next.teams, team => next.entries.filter(entry => entry.teamId === team.id).length, 0.25);
  // Metas: no regulamento novo (ou num programa novo, ou se a regra de pontuação da classe mudou) a diretoria
  // olha só para a força do carro
  const lastPositions = reset
    ? {}
    : Object.fromEntries(review.entries.filter(entry => isPerCar(entry.cls, game.season) === isPerCar(entry.cls, nextSeason)).map(entry => [entry.cls, entry.position]));
  next.career.objectives = playerObjectives(next, lastPositions);
  next.newsFeed = [
    ...generateSeasonStartNews(nextSeason, next),
    ...(changes.length || cut ? generateProgramNews(player, { changes, cut }, nextSeason) : []),
    ...generateRegulationNews(regulation, nextSeason),
    ...generateAiProgramNews(evolved.headlines, concepts, nextSeason),
    ...generateTransferNews(transferMoves),
    ...game.newsFeed
  ].slice(0, 50);
  return { game: next, notes, summary, cut };
};
