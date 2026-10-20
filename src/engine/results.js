import { POINTS_TABLE, POLE_POINTS, TWO_CAR_SPONSOR_BONUS } from "../data/constants.js";
import { clamp, toDisplayTime } from "../utils/helpers.js";
import { rankGrid } from "./race.js";
import {
  racePrize,
  sponsorPayout,
  sponsorMultiplier,
  sponsorGoal,
  driversPayroll,
  driversBacking,
  staffPayroll,
  facilityUpkeep,
  secondCarOperations
} from "./economy.js";
import { developAiTeams } from "./ai.js";
import { reputationDelta, confidenceRaceDelta } from "./career.js";
import { isPlayerId } from "./team.js";
import { raceAchievementIds, unlockAchievements } from "./achievements.js";

export const racePoints = (classPos, multiplier = 1) =>
  classPos <= POINTS_TABLE.length ? Math.ceil(POINTS_TABLE[classPos - 1] * multiplier) : 0;

// Piloto do dia: quem mais ganhou posições (com bônus para vitória e pódio) e pilotou mais tempo no carro
const pickDriverOfTheDay = results => {
  let best = null;
  results
    .filter(result => result.finished)
    .forEach(result => {
      const gained = result.startClassPosition - result.classPos;
      const score = gained * 2 + (result.classPos === 1 ? 4 : result.classPos <= 3 ? 2 : 0) + result.overtakes * 0.25 + Math.random() * 3;
      if (!best || score > best.score) {
        best = { result, score, gained };
      }
    });
  if (!best) {
    return null;
  }
  const driver = [...best.result.drivers].sort((a, b) => b.driveTime - a.driveTime)[0];
  return {
    teamId: best.result.teamId,
    teamName: best.result.teamName,
    class: best.result.class,
    isPlayer: best.result.isPlayer,
    driver: driver?.name,
    reason:
      best.gained > 0
        ? `de P${best.result.startClassPosition} para P${best.result.classPos} na classe`
        : best.result.classPos === 1
          ? "vitória de ponta a ponta"
          : `P${best.result.classPos} na classe`
  };
};

// Classificação final de cada classe (quem abandonou fica atrás de quem terminou e não pontua)
export const buildRaceReport = (raceState, game) => {
  const track = raceState.track;
  const multiplier = track.pointsMultiplier || 1;
  const ranked = rankGrid(raceState.grid);
  const classes = {};
  ["HYPERCAR", "LMGT3"].forEach(cls => {
    const cars = ranked.filter(car => car.class === cls);
    const winner = cars[0];
    classes[cls] = cars.map((car, index) => {
      const finished = car.status !== "DNF";
      const classPos = index + 1;
      let gap;
      if (!finished) {
        gap = car.dnfReason || "DNF";
      } else if (index === 0) {
        gap = "Vencedor";
      } else if (winner.laps - car.laps >= 1) {
        const laps = winner.laps - car.laps;
        gap = `+${laps} volta${laps > 1 ? "s" : ""}`;
      } else {
        gap = `+${toDisplayTime(Math.max(0, (car.finishTime ?? raceState.elapsed) - (winner.finishTime ?? raceState.elapsed)), track).toFixed(1)}s`;
      }
      return {
        teamId: car.teamId,
        teamName: car.teamName,
        class: cls,
        number: car.number,
        color: car.color,
        isPlayer: isPlayerId(car.teamId),
        classPos,
        overallPos: car.position,
        finished,
        dnfReason: car.dnfReason,
        laps: car.laps,
        pitStops: car.pitStops,
        bestLap: toDisplayTime(car.bestLap, track),
        startClassPosition: car.startClassPosition,
        pole: car.pole,
        points: (finished ? racePoints(classPos, multiplier) : 0) + (car.pole ? POLE_POINTS : 0),
        gap,
        overtakes: car.overtakes || 0,
        drivers: car.drivers.map((driver, i) => ({
          id: driver.id,
          name: driver.name,
          driveTime: car.driveTime[i]
        })),
        fastestLap: raceState.fastestLaps[cls]?.teamId === car.teamId
      };
    });
  });
  const all = Object.values(classes).flat();
  // Carro principal primeiro
  const players = all.filter(result => result.isPlayer).sort((a, b) => (a.teamId === "player" ? -1 : b.teamId === "player" ? 1 : 0));
  return {
    season: game.season,
    raceIndex: game.raceIndex,
    track,
    classes,
    player: players[0],
    players,
    driverOfTheDay: pickDriverOfTheDay(all),
    fastestLaps: Object.fromEntries(Object.entries(raceState.fastestLaps).map(([cls, lap]) => [cls, { ...lap, time: toDisplayTime(lap.time, track) }])),
    events: raceState.events,
    rain: raceState.events.some(event => event.type === "weather" && event.text.includes("chuva")),
    safetyCar: raceState.events.some(event => event.text.includes("SAFETY CAR")),
    neutralizations: raceState.neutralId,
    duration: raceState.elapsed
  };
};

const applyResultToTeam = (team, result, classSize) => {
  const next = {
    ...team,
    stats: { wins: 0, podiums: 0, poles: 0, ...team.stats }
  };
  next.points += result.points;
  if (result.finished && result.classPos === 1) {
    next.stats.wins += 1;
    next.careerWins = (next.careerWins || 0) + 1;
  }
  if (result.finished && result.classPos <= 3) {
    next.stats.podiums += 1;
  }
  if (result.pole) {
    next.stats.poles += 1;
  }
  const driveTimes = new Map(result.drivers.map(driver => [driver.id, driver.driveTime]));
  next.drivers = team.drivers.map(driver => {
    if (!(driveTimes.get(driver.id) > 0)) {
      return driver;
    }
    const stats = { wins: 0, podiums: 0, titles: 0, starts: 0, ...driver.stats };
    stats.starts += 1;
    if (result.finished && result.classPos === 1) {
      stats.wins += 1;
    }
    if (result.finished && result.classPos <= 3) {
      stats.podiums += 1;
    }
    let moraleDelta = -2;
    if (!result.finished) {
      moraleDelta = -4;
    } else if (result.classPos <= 3) {
      moraleDelta = 6;
    } else if (result.classPos <= Math.ceil(classSize / 2)) {
      moraleDelta = 1;
    }
    return {
      ...driver,
      stats,
      seasonPoints: (driver.seasonPoints || 0) + result.points,
      morale: clamp((driver.morale ?? 75) + moraleDelta, 20, 100)
    };
  });
  return next;
};

// Melhor pagamento de um patrocinador entre os carros do jogador (cada carro é avaliado pela meta da sua classe)
const sponsorPayoutFor = (contract, results, { isLeMans, multiplier }) => {
  if (contract.type === "GAMBLE" || results.length <= 1) {
    const result = results[0];
    return sponsorPayout(contract, { classPos: result?.finished ? result.classPos : null, isLeMans, multiplier });
  }
  return results
    .map(result =>
      sponsorPayout(
        { ...contract, goalPosition: contract.goal ? sponsorGoal(contract, result.class) ?? contract.goalPosition : contract.goalPosition },
        { classPos: result.finished ? result.classPos : null, isLeMans, multiplier }
      )
    )
    .reduce((best, payout) => (payout.payment > best.payment || (payout.payment === best.payment && !payout.note) ? payout : best));
};

// Recordes de volta por pista e classe
const updateTrackRecords = (records, report, season) => {
  const trackRecords = { ...(records?.[report.track.id] || {}) };
  const broken = [];
  Object.entries(report.fastestLaps || {}).forEach(([cls, lap]) => {
    if (!lap?.time) {
      return;
    }
    const previous = trackRecords[cls];
    if (!previous || lap.time < previous.time) {
      trackRecords[cls] = { time: lap.time, teamId: lap.teamId, teamName: lap.teamName, driver: lap.driver, season, isPlayer: isPlayerId(lap.teamId) };
      if (previous) {
        broken.push({ cls, ...trackRecords[cls], previous: previous.time });
      }
    }
  });
  return { records: { ...(records || {}), [report.track.id]: trackRecords }, broken };
};

const raceSummaryOf = result =>
  result
    ? {
        teamId: result.teamId,
        number: result.number,
        class: result.class,
        classPos: result.classPos,
        finished: result.finished,
        points: result.points,
        dnfReason: result.dnfReason
      }
    : null;

// Aplica o resultado da corrida: pontos, estatísticas, finanças, reputação e evolução da IA
export const applyRaceResults = (game, report) => {
  const track = report.track;
  const multiplier = track.pointsMultiplier || 1;
  const isLeMans = track.id === "lemans";
  const results = new Map(Object.values(report.classes).flat().map(result => [result.teamId, result]));
  const classSize = cls => report.classes[cls].length;
  const twoCars = !!game.sisterTeam;

  let aiTeams = game.aiTeams.map(team => {
    const result = results.get(team.id);
    if (!result) {
      return team;
    }
    const next = applyResultToTeam(team, result, classSize(team.class));
    next.funds += racePrize(next.class, result.classPos, result.finished, multiplier) + (next.support || 0) - driversPayroll(next);
    return next;
  });
  aiTeams = developAiTeams(aiTeams, 2);

  const playerResult = results.get(game.playerTeam.id);
  const player = applyResultToTeam(game.playerTeam, playerResult, classSize(game.playerTeam.class));
  const sisterResult = twoCars ? results.get(game.sisterTeam.id) : null;
  let sister = null;
  if (twoCars) {
    sister = applyResultToTeam(game.sisterTeam, sisterResult, classSize(game.sisterTeam.class));
    // Vitórias de carreira são da equipe (organização)
    player.careerWins += sister.careerWins - (game.sisterTeam.careerWins || 0);
    sister.careerWins = game.sisterTeam.careerWins || 0;
  }
  const playerResults = [playerResult, sisterResult].filter(Boolean);
  const label = result => (twoCars ? ` #${result.number}` : "");

  const items = [];
  let prize = 0;
  playerResults.forEach(result => {
    const amount = racePrize(result.class, result.classPos, result.finished, multiplier);
    prize += amount;
    items.push({
      label: result.finished ? `Prêmio da corrida${label(result)} (P${result.classPos})` : `Prêmio de largada${label(result)} (abandono)`,
      amount,
      type: "income"
    });
  });
  const expiredSponsors = [];
  const sponsorMult = sponsorMultiplier(player) * (twoCars ? 1 + TWO_CAR_SPONSOR_BONUS : 1);
  player.sponsors = player.sponsors
    .map(contract => {
      const { payment, note } = sponsorPayoutFor(contract, playerResults, { isLeMans, multiplier: sponsorMult });
      items.push({ label: `${contract.name}${note ? ` (${note})` : ""}`, amount: payment, type: "sponsor" });
      return { ...contract, remaining: contract.remaining - 1 };
    })
    .filter(contract => {
      if (contract.remaining <= 0) {
        expiredSponsors.push(contract.name);
        return false;
      }
      return true;
    });
  [player, sister].filter(Boolean).forEach(team => {
    const backing = driversBacking(team);
    items.push({ label: `Salários dos pilotos${twoCars ? ` #${team.number}` : ""}`, amount: -(driversPayroll(team) + backing), type: "expense" });
    if (backing) {
      items.push({ label: `Pilotos pagantes${twoCars ? ` #${team.number}` : ""}`, amount: backing, type: "sponsor" });
    }
  });
  const staff = staffPayroll(player);
  if (staff) {
    items.push({ label: "Equipe técnica", amount: -staff, type: "expense" });
  }
  const upkeep = facilityUpkeep(player);
  if (upkeep) {
    items.push({ label: "Manutenção das instalações", amount: -upkeep, type: "expense" });
  }
  if (sister) {
    items.push({ label: `Operação do 2º carro (#${sister.number})`, amount: -secondCarOperations(sister.class), type: "expense" });
  }
  const net = items.reduce((sum, item) => sum + item.amount, 0);
  player.funds += net;
  player.ledger = [
    ...(player.ledger || []),
    {
      season: game.season,
      raceIndex: game.raceIndex,
      track: track.name,
      items,
      net,
      balance: player.funds
    }
  ].slice(-48);

  // Reputação e diretoria: o carro principal conta inteiro, o segundo carro conta 60%
  const hospitality = player.facilities?.hospitality ?? 1;
  const repMain = reputationDelta(playerResult, classSize(player.class), isLeMans, hospitality, game.career.objective?.position);
  const repSister = sister ? reputationDelta(sisterResult, classSize(sister.class), isLeMans, hospitality, game.career.objective2?.position) : 0;
  const repDelta = Math.round((repMain + repSister * 0.6) * 10) / 10;
  player.reputation = clamp(Math.round(((player.reputation ?? 30) + repDelta) * 10) / 10, 0, 100);
  const confMain = confidenceRaceDelta(playerResult, game.career.objective, game.career.difficulty);
  const confSister = sister && game.career.objective2 ? confidenceRaceDelta(sisterResult, game.career.objective2, game.career.difficulty) : 0;
  const confDelta = confMain + Math.round(confSister * 0.6);
  let career = { ...game.career, confidence: clamp(game.career.confidence + confDelta, 0, 100) };

  // Recordes da pista e conquistas
  const { records, broken } = updateTrackRecords(game.archive.trackRecords, report, game.season);
  const playerRecord = broken.find(record => record.isPlayer);
  const achievementIds = raceAchievementIds(report, playerResults, { funds: player.funds, newRecord: !!playerRecord });
  const unlockedResult = unlockAchievements(career, achievementIds, { season: game.season, track: track.name });
  career = unlockedResult.career;

  const hyper = report.classes.HYPERCAR;
  const gt3 = report.classes.LMGT3;
  const finishers = list => list.filter(result => result.finished);
  const raceRecord = {
    track: track.name,
    trackId: track.id,
    winner: finishers(hyper)[0]?.teamName || "N/A",
    podium: finishers(hyper).slice(0, 3).map(result => result.teamName),
    gt3Winner: finishers(gt3)[0]?.teamName || "N/A",
    gt3Podium: finishers(gt3).slice(0, 3).map(result => result.teamName),
    poles: {
      HYPERCAR: hyper.find(result => result.pole)?.teamName,
      LMGT3: gt3.find(result => result.pole)?.teamName
    },
    player: raceSummaryOf(playerResult),
    players: playerResults.map(raceSummaryOf),
    driverOfTheDay: report.driverOfTheDay ? { driver: report.driverOfTheDay.driver, teamName: report.driverOfTheDay.teamName } : null
  };

  return {
    game: {
      ...game,
      playerTeam: player,
      ...(sister ? { sisterTeam: sister } : {}),
      aiTeams,
      raceIndex: game.raceIndex + 1,
      archive: {
        ...game.archive,
        currentSeasonRaces: [...game.archive.currentSeasonRaces, raceRecord],
        trackRecords: records
      },
      career
    },
    summary: {
      result: playerResult,
      results: playerResults,
      items,
      net,
      prize,
      balance: player.funds,
      repDelta,
      reputation: player.reputation,
      confDelta,
      confidence: career.confidence,
      expiredSponsors,
      pointsTotal: player.points,
      pointsTotals: [player, sister].filter(Boolean).map(team => ({ id: team.id, number: team.number, class: team.class, points: team.points })),
      records: broken,
      achievements: unlockedResult.unlocked
    }
  };
};
