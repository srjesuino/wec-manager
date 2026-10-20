import { SERIES_CONFIG, TEAM_NAMES, DIFFICULTIES, DRIVERS_PER_CAR } from "../data/constants.js";
import { generateRookie } from "../utils/helpers.js";
import {
  generateSeasonStartNews,
  generateTransferNews,
  generateRegulationNews,
  generatePromotionNews,
  generateProgramNews
} from "../utils/mediaEngine.js";
import { classStandings, seasonReview, promotionOffer, createObjective } from "./career.js";
import { developDriver, willRetire, fillAiVacancies, signDriverTo } from "./drivers.js";
import { developAiTeams } from "./ai.js";
import { CAR_PARTS, seasonPrize, driverWageFor, secondCarAnnualBudget, secondCarEntryFee } from "./economy.js";
import { createAiTeam, createSisterTeam, freshPlayerCar, generateStaffMarket } from "./newGame.js";
import { playerEntries, isPlayerId } from "./team.js";

// Regras do original: a cada 5 anos regulamento novo (reset), a cada 3 anos corte de 15 pontos
export const regulationFor = season => {
  if (season % 5 === 0) {
    return { type: "RESET", text: "⚠️ REGULAMENTO NOVO! RESET TOTAL!" };
  }
  if (season % 3 === 0) {
    return { type: "PENALTY", text: "⚠️ AJUSTE DE REGRAS (-15 Performance)" };
  }
  return { type: "STABLE", text: "Regulamento estável." };
};

const applyRegulation = (car, regulation) => {
  const next = { ...car };
  if (regulation.type === "STABLE") {
    return next;
  }
  CAR_PARTS.forEach(part => {
    next[part] = regulation.type === "RESET" ? 30 + Math.floor(Math.random() * 10) : Math.max(10, next[part] - 15);
  });
  if (regulation.type === "RESET") {
    next.reliability = Math.max(next.reliability, 45 + Math.floor(Math.random() * 10));
  }
  return next;
};

export const renewalWage = (driver, cls) => Math.floor(driverWageFor(driver, cls) * ((driver.morale ?? 75) < 50 ? 1.2 : 1));

const otherClass = cls => (cls === "HYPERCAR" ? "LMGT3" : "HYPERCAR");

// Opções para montar ou desfazer o segundo carro na virada da temporada
export const programOptions = game => {
  if (game.sisterTeam) {
    return { canDrop: true, expand: [] };
  }
  const cls = game.playerTeam.class;
  return {
    canDrop: false,
    expand: [
      { program: "SAME_CLASS", cls, fee: secondCarEntryFee(cls), annual: secondCarAnnualBudget(cls) },
      { program: "DUAL_CLASS", cls: otherClass(cls), fee: secondCarEntryFee(otherClass(cls)), annual: secondCarAnnualBudget(otherClass(cls)) }
    ]
  };
};

// Resumo exibido na tela de encerramento (não altera o jogo)
export const buildSeasonSummary = game => {
  const hyper = classStandings(game, "HYPERCAR");
  const gt3 = classStandings(game, "LMGT3");
  const review = seasonReview(game);
  const standingsOf = cls => (cls === "HYPERCAR" ? hyper : gt3);
  const entries = playerEntries(game);
  const champions = entries.filter(entry => standingsOf(entry.class)[0]?.id === entry.id);
  const prize = entries.reduce((sum, entry) => {
    const list = standingsOf(entry.class);
    return sum + seasonPrize(entry.class, list.findIndex(item => item.id === entry.id) + 1, list.length);
  }, 0);
  return {
    season: game.season,
    hyper,
    gt3,
    hyperChampion: hyper[0],
    gt3Champion: gt3[0],
    isPlayerChampion: champions.length > 0,
    championEntries: champions.map(entry => ({ id: entry.id, number: entry.number, class: entry.class, name: entry.name })),
    review,
    prize,
    expiring: entries.flatMap(entry =>
      entry.drivers
        .filter(driver => (driver.contractYears ?? 1) <= 1)
        .map(driver => ({ driver, newWage: renewalWage(driver, entry.class), car: entry.number, carId: entry.id }))
    ),
    promotion: promotionOffer(game, review.position),
    regulation: regulationFor(game.season + 1),
    program: programOptions(game)
  };
};

const archiveTeam = team => ({
  id: team.id,
  name: team.name,
  class: team.class,
  color: team.color,
  number: team.number,
  points: team.points,
  stats: { ...team.stats },
  drivers: team.drivers.map(driver => ({ id: driver.id, name: driver.name, nationality: driver.nationality, seasonPoints: driver.seasonPoints || 0 }))
});

// Equipe da IA que sai do grid para abrir vaga a um carro do jogador (a pior da classe)
const removeWeakestAi = (aiTeams, standings, cls) => {
  const weakest = standings.filter(team => team.class === cls && !isPlayerId(team.id)).slice(-1)[0];
  return aiTeams.filter(team => team.id !== weakest?.id);
};

// Equipe nova da IA ocupando a vaga que um carro do jogador deixou
const addAiTeam = (aiTeams, cls, takenNames, id) => {
  const used = new Set(aiTeams.filter(team => team.class === cls).map(team => team.name));
  const name = TEAM_NAMES[cls].find(item => !used.has(item)) || (cls === "HYPERCAR" ? "Privateer Hypercar" : "Privateer Racing");
  return [...aiTeams, createAiTeam(cls, name, 8, takenNames, id)];
};

// Vira a temporada: prêmios, arquivo, regulamento, pilotos, contratos, mercado, orçamento e diretoria
// decisions: { renew: {driverId: bool}, acceptPromotion, expand: "SAME_CLASS" | "DUAL_CLASS" | null, dropSister, sisterName }
export const startNextSeason = (game, decisions = {}) => {
  const summary = buildSeasonSummary(game);
  const { review, regulation } = summary;
  if (review.fired) {
    return { fired: true, summary };
  }
  const nextSeason = game.season + 1;
  const notes = [];
  const transferMoves = [];
  const entries = playerEntries(game);
  const takenNames = new Set([
    ...game.driversPool.map(driver => driver.name),
    ...[...entries, ...game.aiTeams].flatMap(team => team.drivers.map(driver => driver.name))
  ]);
  const standingsOf = cls => (cls === "HYPERCAR" ? summary.hyper : summary.gt3);
  const allStandings = [...summary.hyper, ...summary.gt3];
  const prizeFor = team => {
    const list = standingsOf(team.class);
    return seasonPrize(team.class, list.findIndex(item => item.id === team.id) + 1, list.length);
  };
  const champions = new Set([summary.hyperChampion?.id, summary.gt3Champion?.id]);
  const crown = driver => ({ ...driver, stats: { ...driver.stats, titles: (driver.stats?.titles || 0) + 1 } });
  const titles = entries.filter(entry => champions.has(entry.id)).length;

  const seasonRecord = {
    year: game.season,
    champion: summary.hyperChampion?.name,
    gt3Champion: summary.gt3Champion?.name,
    standings: [...entries, ...game.aiTeams].map(archiveTeam),
    races: [...game.archive.currentSeasonRaces]
  };

  // Mercado: pool envelhece, aposentadorias e novatos
  let pool = game.driversPool
    .map(driver => developDriver(driver))
    .filter(driver => driver.age <= 40 && !willRetire(driver));

  // Equipes da IA
  let aiTeams = game.aiTeams.map(team => {
    const drivers = [];
    team.drivers.forEach(original => {
      let driver = developDriver(champions.has(team.id) ? crown(original) : original);
      if (willRetire(driver)) {
        return;
      }
      if ((original.contractYears ?? 1) <= 1) {
        if (Math.random() < 0.6) {
          driver = { ...driver, contractYears: 1 + Math.floor(Math.random() * 3), wage: driverWageFor(driver, team.class) };
        } else {
          pool.push({ ...driver, teamId: null, contractYears: 0 });
          return;
        }
      } else {
        driver = { ...driver, contractYears: original.contractYears - 1 };
      }
      drivers.push(driver);
    });
    return {
      ...team,
      drivers,
      funds: team.funds + prizeFor(team) + (team.annualBudget || 0),
      car: applyRegulation(team.car, regulation),
      points: 0,
      stats: { wins: 0, podiums: 0, poles: 0 },
      championships: (team.championships || 0) + (champions.has(team.id) ? 1 : 0),
      bop: 0
    };
  });

  // Pilotos dos carros do jogador: evolução, aposentadoria e renovação de contrato
  const difficulty = DIFFICULTIES[game.career.difficulty] || DIFFICULTIES.NORMAL;
  const simulatorLevel = game.playerTeam.facilities?.simulator ?? 1;
  const carTag = entry => (entries.length > 1 ? ` (#${entry.number})` : "");
  const processDrivers = entry => {
    const isChampion = champions.has(entry.id);
    const kept = [];
    entry.drivers.forEach(original => {
      let driver = developDriver(isChampion ? crown(original) : original, { simulatorLevel, playerTeam: true });
      if (willRetire(driver)) {
        notes.push(`${driver.name}${carTag(entry)} anunciou a aposentadoria aos ${driver.age} anos.`);
        return;
      }
      if ((original.contractYears ?? 1) <= 1) {
        if (decisions.renew?.[original.id] === false) {
          pool.push({ ...driver, teamId: null, contractYears: 0 });
          notes.push(`${driver.name}${carTag(entry)} deixou a equipe ao fim do contrato.`);
          return;
        }
        driver = { ...driver, contractYears: 2, wage: renewalWage(original, entry.class) };
      } else {
        driver = { ...driver, contractYears: original.contractYears - 1 };
      }
      kept.push(driver);
    });
    return kept;
  };
  const resetEntry = entry => ({
    ...entry,
    points: 0,
    stats: { wins: 0, podiums: 0, poles: 0 },
    championships: (entry.championships || 0) + (champions.has(entry.id) ? 1 : 0),
    bop: 0,
    drivers: processDrivers(entry)
  });

  let player = resetEntry(game.playerTeam);
  player.funds = game.playerTeam.funds + entries.reduce((sum, entry) => sum + prizeFor(entry), 0);
  // Títulos da organização: o carro principal guarda o total da equipe
  player.championships = (game.playerTeam.championships || 0) + titles;
  let sister = game.sisterTeam ? resetEntry(game.sisterTeam) : null;
  if (sister) {
    sister.championships = (game.sisterTeam.championships || 0) + (champions.has(sister.id) ? 1 : 0);
  }

  // Promoção para a Hypercar (com dois GT3, os dois carros sobem)
  const promoted = summary.promotion && decisions.acceptPromotion;
  const promote = entry => {
    aiTeams = removeWeakestAi(aiTeams, allStandings.filter(team => aiTeams.some(ai => ai.id === team.id)), "HYPERCAR");
    aiTeams = addAiTeam(aiTeams, "LMGT3", takenNames, `lmgt3_ai_${nextSeason}_${entry.id}`);
    return {
      ...entry,
      class: "HYPERCAR",
      series: "HYPERCAR",
      drivers: entry.drivers.map(driver => ({ ...driver, wage: driverWageFor(driver, "HYPERCAR") }))
    };
  };
  if (promoted) {
    player = { ...promote(player), car: freshPlayerCar(game.career.difficulty), reputation: Math.max(30, (player.reputation ?? 30) - 15) };
    if (sister && sister.class === "LMGT3") {
      sister = { ...promote(sister), car: { ...player.car } };
    }
    notes.push(`Promoção aceita! A ${player.name} disputa a Hypercar em ${nextSeason}.`);
  } else {
    player.car = applyRegulation(player.car, regulation);
    if (sister) {
      // Mesma classe = mesmo projeto
      sister.car = sister.class === player.class ? { ...player.car } : applyRegulation(sister.car, regulation);
    }
  }

  // Programa de corrida: desfazer ou montar o segundo carro
  let programChange = null;
  if (sister && decisions.dropSister) {
    sister.drivers.forEach(driver => pool.push({ ...driver, teamId: null, contractYears: 0 }));
    aiTeams = addAiTeam(aiTeams, sister.class, takenNames, `${sister.class.toLowerCase()}_ai_${nextSeason}_r`);
    notes.push(`O carro #${sister.number} foi retirado do campeonato. Os pilotos dele foram liberados para o mercado.`);
    programChange = { type: "DROP", number: sister.number, cls: sister.class };
    sister = null;
  } else if (!sister && decisions.expand) {
    const cls = decisions.expand === "SAME_CLASS" ? player.class : otherClass(player.class);
    const fee = secondCarEntryFee(cls);
    if (player.funds >= fee) {
      player.funds -= fee;
      aiTeams = removeWeakestAi(aiTeams, [...allStandings.filter(team => aiTeams.some(ai => ai.id === team.id)), ...aiTeams.filter(ai => !allStandings.some(team => team.id === ai.id))], cls);
      sister = createSisterTeam(player, cls, { difficulty: game.career.difficulty, name: decisions.sisterName, takenNames });
      notes.push(`Novo carro! O #${sister.number} (${sister.name}) estreia na ${cls === "HYPERCAR" ? "Hypercar" : "LMGT3"} em ${nextSeason}. Inscrição: $${(fee / 1000000).toFixed(1)}M.`);
      programChange = { type: "EXPAND", number: sister.number, cls, name: sister.name };
    } else {
      notes.push("Sem caixa para inscrever o segundo carro: a expansão ficou para outro ano.");
    }
  }

  // Line-ups completos com a academia
  const fillLineup = entry => {
    while (entry.drivers.length < DRIVERS_PER_CAR) {
      const rookie = signDriverTo(generateRookie(takenNames), entry, 2);
      entry.drivers.push(rookie);
      notes.push(`${rookie.name} subiu da academia para completar o line-up${sister ? ` do #${entry.number}` : ""}.`);
    }
  };
  fillLineup(player);
  if (sister) {
    fillLineup(sister);
  }

  // Orçamento anual da diretoria (o segundo carro recebe uma fatia do orçamento da classe dele)
  const repFactor = 0.75 + (player.reputation ?? 30) / 200;
  const annualMain = SERIES_CONFIG[player.class].annualBudget;
  const annualSecond = sister ? secondCarAnnualBudget(sister.class) : 0;
  const annual = Math.floor((annualMain + annualSecond) * difficulty.budgetMult * repFactor * review.budgetFactor);
  player.funds += annual;
  notes.push(`Orçamento da diretoria para ${nextSeason}: $${(annual / 1000000).toFixed(1)}M.`);

  // Novatos e pilotos pagantes chegam ao mercado e as vagas da IA são preenchidas
  for (let i = 0; i < 6; i++) {
    pool.push(generateRookie(takenNames));
  }
  aiTeams = aiTeams.map(team => {
    const filled = fillAiVacancies(team, pool, takenNames, transferMoves);
    pool = filled.pool;
    return filled.team;
  });
  aiTeams = developAiTeams(aiTeams, 4);
  pool = pool.sort((a, b) => b.rating - a.rating).slice(0, 45);

  const reviewOf = id => review.entries.find(entry => entry.id === id);
  const career = {
    ...game.career,
    confidence: promoted ? Math.max(review.confidence, 60) : review.confidence,
    seasonsCompleted: (game.career.seasonsCompleted || 0) + 1,
    promotions: (game.career.promotions || 0) + (promoted ? 1 : 0)
  };

  const next = {
    ...game,
    season: nextSeason,
    raceIndex: 0,
    playerTeam: player,
    sisterTeam: sister,
    aiTeams,
    driversPool: pool,
    staffMarket: generateStaffMarket(),
    archive: {
      ...game.archive,
      history: [...game.archive.history, seasonRecord],
      currentSeasonRaces: []
    },
    career
  };
  next.career.objective = createObjective(next, promoted ? null : review.position);
  next.career.objective2 = sister
    ? createObjective(next, promoted || programChange?.type === "EXPAND" ? null : reviewOf(sister.id)?.position ?? null, sister)
    : null;
  next.newsFeed = [
    ...generateSeasonStartNews(nextSeason, player, next.career.objective, sister),
    ...(promoted ? generatePromotionNews(player, nextSeason) : []),
    ...(programChange ? generateProgramNews(player, programChange, nextSeason) : []),
    ...generateRegulationNews(regulation, nextSeason),
    ...generateTransferNews(transferMoves),
    ...game.newsFeed
  ].slice(0, 50);
  return { fired: false, game: next, notes, summary };
};
