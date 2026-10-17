import { SERIES_CONFIG, TEAM_NAMES, DIFFICULTIES, DRIVERS_PER_CAR } from "../data/constants.js";
import { generateRookie } from "../utils/helpers.js";
import {
  generateSeasonStartNews,
  generateTransferNews,
  generateRegulationNews,
  generatePromotionNews
} from "../utils/mediaEngine.js";
import { classStandings, seasonReview, promotionOffer, createObjective } from "./career.js";
import { developDriver, willRetire, fillAiVacancies, signDriverTo } from "./drivers.js";
import { developAiTeams } from "./ai.js";
import { CAR_PARTS, seasonPrize, driverWageFor } from "./economy.js";
import { createAiTeam, freshPlayerCar, generateStaffMarket } from "./newGame.js";

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

// Resumo exibido na tela de encerramento (não altera o jogo)
export const buildSeasonSummary = game => {
  const hyper = classStandings(game, "HYPERCAR");
  const gt3 = classStandings(game, "LMGT3");
  const review = seasonReview(game);
  const cls = game.playerTeam.class;
  return {
    season: game.season,
    hyper,
    gt3,
    hyperChampion: hyper[0],
    gt3Champion: gt3[0],
    isPlayerChampion: review.position === 1,
    review,
    prize: seasonPrize(cls, review.position, cls === "HYPERCAR" ? hyper.length : gt3.length),
    expiring: game.playerTeam.drivers
      .filter(driver => (driver.contractYears ?? 1) <= 1)
      .map(driver => ({ driver, newWage: renewalWage(driver, cls) })),
    promotion: promotionOffer(game, review.position),
    regulation: regulationFor(game.season + 1)
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

// Vira a temporada: prêmios, arquivo, regulamento, pilotos, contratos, mercado, orçamento e diretoria
export const startNextSeason = (game, decisions = {}) => {
  const summary = buildSeasonSummary(game);
  const { review, regulation } = summary;
  if (review.fired) {
    return { fired: true, summary };
  }
  const nextSeason = game.season + 1;
  const notes = [];
  const transferMoves = [];
  const takenNames = new Set([
    ...game.driversPool.map(driver => driver.name),
    ...[game.playerTeam, ...game.aiTeams].flatMap(team => team.drivers.map(driver => driver.name))
  ]);
  const standingsOf = cls => (cls === "HYPERCAR" ? summary.hyper : summary.gt3);
  const prizeFor = team => {
    const list = standingsOf(team.class);
    return seasonPrize(team.class, list.findIndex(item => item.id === team.id) + 1, list.length);
  };
  const champions = new Set([summary.hyperChampion?.id, summary.gt3Champion?.id]);
  const crown = driver => ({ ...driver, stats: { ...driver.stats, titles: (driver.stats?.titles || 0) + 1 } });

  const seasonRecord = {
    year: game.season,
    champion: summary.hyperChampion?.name,
    gt3Champion: summary.gt3Champion?.name,
    standings: [game.playerTeam, ...game.aiTeams].map(archiveTeam),
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

  // Equipe do jogador
  const difficulty = DIFFICULTIES[game.career.difficulty] || DIFFICULTIES.NORMAL;
  const simulatorLevel = game.playerTeam.facilities?.simulator ?? 1;
  const isChampion = review.position === 1;
  let player = {
    ...game.playerTeam,
    funds: game.playerTeam.funds + prizeFor(game.playerTeam),
    championships: (game.playerTeam.championships || 0) + (isChampion ? 1 : 0),
    points: 0,
    stats: { wins: 0, podiums: 0, poles: 0 },
    bop: 0
  };
  const playerDrivers = [];
  game.playerTeam.drivers.forEach(original => {
    let driver = developDriver(isChampion ? crown(original) : original, { simulatorLevel, playerTeam: true });
    if (willRetire(driver)) {
      notes.push(`${driver.name} anunciou a aposentadoria aos ${driver.age} anos.`);
      return;
    }
    if ((original.contractYears ?? 1) <= 1) {
      if (decisions.renew?.[original.id] === false) {
        pool.push({ ...driver, teamId: null, contractYears: 0 });
        notes.push(`${driver.name} deixou a equipe ao fim do contrato.`);
        return;
      }
      driver = { ...driver, contractYears: 2, wage: renewalWage(original, player.class) };
    } else {
      driver = { ...driver, contractYears: original.contractYears - 1 };
    }
    playerDrivers.push(driver);
  });

  // Promoção para a Hypercar
  const promoted = summary.promotion && decisions.acceptPromotion;
  if (promoted) {
    const weakest = summary.hyper.filter(team => team.id !== player.id).slice(-1)[0];
    aiTeams = aiTeams.filter(team => team.id !== weakest?.id);
    const usedGt3 = new Set(aiTeams.filter(team => team.class === "LMGT3").map(team => team.name));
    const replacement = TEAM_NAMES.LMGT3.find(name => !usedGt3.has(name)) || "Privateer Racing";
    aiTeams.push(createAiTeam("LMGT3", replacement, 8, takenNames, `lmgt3_ai_${nextSeason}`));
    player = {
      ...player,
      class: "HYPERCAR",
      series: "HYPERCAR",
      car: freshPlayerCar(game.career.difficulty),
      reputation: Math.max(30, (player.reputation ?? 30) - 15)
    };
    notes.push(`Promoção aceita! A ${player.name} disputa a Hypercar em ${nextSeason}.`);
  } else {
    player.car = applyRegulation(player.car, regulation);
  }
  player.drivers = playerDrivers.map(driver => ({ ...driver, wage: promoted ? driverWageFor(driver, "HYPERCAR") : driver.wage }));
  while (player.drivers.length < DRIVERS_PER_CAR) {
    const rookie = signDriverTo(generateRookie(takenNames), player, 2);
    player.drivers.push(rookie);
    notes.push(`${rookie.name} subiu da academia para completar o line-up.`);
  }

  // Orçamento anual da diretoria
  const repFactor = 0.75 + (player.reputation ?? 30) / 200;
  const annual = Math.floor(SERIES_CONFIG[player.class].annualBudget * difficulty.budgetMult * repFactor * review.budgetFactor);
  player.funds += annual;
  notes.push(`Orçamento da diretoria para ${nextSeason}: $${(annual / 1000000).toFixed(1)}M.`);

  // Novatos chegam ao mercado e as vagas da IA são preenchidas
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

  const next = {
    ...game,
    season: nextSeason,
    raceIndex: 0,
    playerTeam: player,
    aiTeams,
    driversPool: pool,
    staffMarket: generateStaffMarket(),
    archive: {
      history: [...game.archive.history, seasonRecord],
      currentSeasonRaces: []
    },
    career: {
      ...game.career,
      confidence: promoted ? Math.max(review.confidence, 60) : review.confidence,
      seasonsCompleted: (game.career.seasonsCompleted || 0) + 1,
      promotions: (game.career.promotions || 0) + (promoted ? 1 : 0)
    }
  };
  next.career.objective = createObjective(next, promoted ? null : review.position);
  next.newsFeed = [
    ...generateSeasonStartNews(nextSeason, player, next.career.objective),
    ...(promoted ? generatePromotionNews(player, nextSeason) : []),
    ...generateRegulationNews(regulation, nextSeason),
    ...generateTransferNews(transferMoves),
    ...game.newsFeed
  ].slice(0, 50);
  return { fired: false, game: next, notes, summary };
};
