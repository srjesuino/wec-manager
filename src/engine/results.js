import { POINTS_TABLE, POLE_POINTS, CLASSES, CLASS_RULES } from "../data/constants.js";
import { clamp, toDisplayTime } from "../utils/helpers.js";
import { rankGrid } from "./race.js";
import {
  racePrize,
  sponsorPayout,
  sponsorMultiplier,
  sponsorGoal,
  driversPayroll,
  staffPayroll,
  facilityUpkeep,
  extraCarOperations
} from "./economy.js";
import { developAiTeams, aiRaceSupport } from "./ai.js";
import { reputationDelta, confidenceRaceDelta, classWeight } from "./career.js";
import { PLAYER_ID, mainClass, playerEntries, sponsorExposure } from "./team.js";

export const racePoints = (classPos, multiplier = 1) =>
  classPos <= POINTS_TABLE.length ? Math.ceil(POINTS_TABLE[classPos - 1] * multiplier) : 0;

// Resultado das equipes numa classe a partir do resultado dos carros
// Hypercar: só o melhor carro de cada equipe conta, e a ordem é refeita entre as equipes.
// LMGT3: os pontos dos dois carros são somados.
export const teamRaceResults = (carResults, cls, multiplier = 1) => {
  const groups = new Map();
  carResults.forEach(result => {
    if (!groups.has(result.teamId)) {
      groups.set(result.teamId, []);
    }
    groups.get(result.teamId).push(result);
  });
  const rows = [...groups.values()].map(cars => {
    const best = cars.find(car => car.finished) || cars[0];
    return {
      teamId: best.teamId,
      teamName: best.teamName,
      color: best.color,
      isPlayer: best.isPlayer,
      cars: cars.map(car => car.entryId),
      numbers: cars.map(car => car.number),
      finished: cars.some(car => car.finished),
      pole: cars.some(car => car.pole),
      bestClassPos: best.classPos,
      carPoints: cars.reduce((sum, car) => sum + car.points, 0),
      anyWin: cars.some(car => car.finished && car.classPos === 1),
      anyPodium: cars.some(car => car.finished && car.classPos <= 3)
    };
  });
  if (CLASS_RULES[cls].teamScoring === "BEST_CAR") {
    rows.sort((a, b) => (a.finished !== b.finished ? (a.finished ? -1 : 1) : a.bestClassPos - b.bestClassPos));
    rows.forEach((row, index) => {
      row.position = index + 1;
      row.points = (row.finished ? racePoints(row.position, multiplier) : 0) + (row.pole ? POLE_POINTS : 0);
      row.win = row.finished && row.position === 1;
      row.podium = row.finished && row.position <= 3;
    });
  } else {
    rows.sort((a, b) => b.carPoints - a.carPoints || a.bestClassPos - b.bestClassPos);
    rows.forEach((row, index) => {
      row.position = index + 1;
      row.points = row.carPoints;
      row.win = row.anyWin;
      row.podium = row.anyPodium;
    });
  }
  return rows;
};

// Classificação final de cada classe (quem abandonou fica atrás de quem terminou e não pontua)
export const buildRaceReport = (raceState, game) => {
  const track = raceState.track;
  const multiplier = track.pointsMultiplier || 1;
  const ranked = rankGrid(raceState.grid);
  const classes = {};
  const teams = {};
  CLASSES.forEach(cls => {
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
        entryId: car.entryId,
        teamId: car.teamId,
        teamName: car.teamName,
        class: cls,
        number: car.number,
        color: car.color,
        isPlayer: car.teamId === PLAYER_ID,
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
        fastestLap: raceState.fastestLaps[cls]?.entryId === car.entryId
      };
    });
    teams[cls] = teamRaceResults(classes[cls], cls, multiplier);
  });
  // Carros do jogador: Hypercar primeiro
  const players = CLASSES.flatMap(cls => classes[cls].filter(result => result.isPlayer));
  return {
    season: game.season,
    raceIndex: game.raceIndex,
    track,
    classes,
    teams,
    player: players[0],
    players,
    playerTeams: Object.fromEntries(CLASSES.map(cls => [cls, teams[cls].find(row => row.isPlayer)]).filter(([, row]) => row)),
    fastestLaps: Object.fromEntries(Object.entries(raceState.fastestLaps).map(([cls, lap]) => [cls, { ...lap, time: toDisplayTime(lap.time, track) }])),
    events: raceState.events,
    rain: raceState.events.some(event => event.type === "weather" && event.text.includes("chuva")),
    safetyCar: raceState.events.some(event => event.text.includes("SAFETY CAR")),
    neutralizations: raceState.neutralId,
    duration: raceState.elapsed
  };
};

// Pontos, estatísticas e moral dos pilotos de um carro
const applyResultToEntry = (entry, result, classSize) => {
  const stats = { wins: 0, podiums: 0, poles: 0, ...entry.stats };
  if (result.finished && result.classPos === 1) {
    stats.wins += 1;
  }
  if (result.finished && result.classPos <= 3) {
    stats.podiums += 1;
  }
  if (result.pole) {
    stats.poles += 1;
  }
  const driveTimes = new Map(result.drivers.map(driver => [driver.id, driver.driveTime]));
  const drivers = entry.drivers.map(driver => {
    if (!(driveTimes.get(driver.id) > 0)) {
      return driver;
    }
    const driverStats = { wins: 0, podiums: 0, titles: 0, starts: 0, ...driver.stats };
    driverStats.starts += 1;
    if (result.finished && result.classPos === 1) {
      driverStats.wins += 1;
    }
    if (result.finished && result.classPos <= 3) {
      driverStats.podiums += 1;
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
      stats: driverStats,
      seasonPoints: (driver.seasonPoints || 0) + result.points,
      morale: clamp((driver.morale ?? 75) + moraleDelta, 20, 100)
    };
  });
  return { ...entry, points: (entry.points || 0) + result.points, stats, drivers };
};

// Pontos e estatísticas de equipe nos programas (campeonato de equipes) e vitórias de carreira da organização
const applyTeamResults = (team, teamResults) => {
  let careerWins = team.careerWins || 0;
  const programs = { ...team.programs };
  Object.entries(teamResults).forEach(([cls, row]) => {
    const program = programs[cls];
    if (!program || !row) {
      return;
    }
    const stats = { wins: 0, podiums: 0, poles: 0, ...program.stats };
    if (row.win) {
      stats.wins += 1;
      careerWins += 1;
    }
    if (row.podium) {
      stats.podiums += 1;
    }
    if (row.pole) {
      stats.poles += 1;
    }
    programs[cls] = { ...program, points: (program.points || 0) + row.points, stats };
  });
  return { ...team, programs, careerWins };
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

const raceSummaryOf = result =>
  result
    ? {
        entryId: result.entryId,
        number: result.number,
        class: result.class,
        classPos: result.classPos,
        finished: result.finished,
        points: result.points,
        dnfReason: result.dnfReason
      }
    : null;

// Aplica o resultado da corrida: pontos (carros e equipes), estatísticas, finanças, reputação e evolução da IA
export const applyRaceResults = (game, report) => {
  const track = report.track;
  const multiplier = track.pointsMultiplier || 1;
  const isLeMans = track.id === "lemans";
  const results = new Map(Object.values(report.classes).flat().map(result => [result.entryId, result]));
  const classSize = cls => report.classes[cls].length;
  const teamsInClass = cls => report.teams[cls].length;
  const teamResultsOf = teamId =>
    Object.fromEntries(CLASSES.map(cls => [cls, report.teams[cls].find(row => row.teamId === teamId)]).filter(([, row]) => row));

  // Carros
  const entries = game.entries.map(entry => {
    const result = results.get(entry.id);
    return result ? applyResultToEntry(entry, result, classSize(entry.class)) : entry;
  });
  const carsOf = team => entries.filter(entry => entry.teamId === team.id).length;

  // Equipes da IA: pontos de equipe, prêmios, repasse da matriz e salários; depois o P&D
  let aiTeams = game.teams.map(team => {
    const next = applyTeamResults(team, teamResultsOf(team.id));
    const cars = entries.filter(entry => entry.teamId === team.id);
    const prizes = cars.reduce((sum, entry) => {
      const result = results.get(entry.id);
      return sum + (result ? racePrize(entry.class, result.classPos, result.finished, multiplier) : 0);
    }, 0);
    next.funds += prizes + aiRaceSupport(next, cars.length, game.career.difficulty) - driversPayroll(cars);
    return next;
  });
  aiTeams = developAiTeams(aiTeams, carsOf, 0.3);

  // Equipe do jogador
  const playerTeamResults = teamResultsOf(PLAYER_ID);
  const player = applyTeamResults(game.playerTeam, playerTeamResults);
  const myCars = playerEntries({ ...game, entries });
  const multi = myCars.length > 1;
  const playerResults = myCars.map(entry => results.get(entry.id)).filter(Boolean);
  const label = result => (multi ? ` #${result.number}` : "");
  const scale = mainClass(player);

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
  const sponsorMult = sponsorMultiplier(player) * sponsorExposure(myCars.length);
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
  myCars.forEach(entry => {
    items.push({ label: `Salários dos pilotos${multi ? ` #${entry.number}` : ""}`, amount: -driversPayroll(entry), type: "expense" });
  });
  const staff = staffPayroll(player, scale);
  if (staff) {
    items.push({ label: "Equipe técnica", amount: -staff, type: "expense" });
  }
  const upkeep = facilityUpkeep(player, scale);
  if (upkeep) {
    items.push({ label: "Manutenção das instalações", amount: -upkeep, type: "expense" });
  }
  // Todo carro além do primeiro custa logística e mecânicos extras
  myCars.slice(1).forEach(entry => {
    items.push({ label: `Operação do carro #${entry.number}`, amount: -extraCarOperations(entry.class), type: "expense" });
  });
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

  // Reputação e conselho: o resultado da equipe em cada classe (com dois programas, a LMGT3 pesa 60%)
  const hospitality = player.facilities?.hospitality ?? 1;
  let repTotal = 0;
  let confTotal = 0;
  Object.entries(playerTeamResults).forEach(([cls, row]) => {
    const weight = classWeight(game, cls);
    const outcome = { finished: row.finished, classPos: row.position, pole: row.pole };
    const objective = game.career.objectives?.[cls];
    repTotal += reputationDelta(outcome, teamsInClass(cls), isLeMans, hospitality, objective?.position) * weight;
    if (objective) {
      confTotal += confidenceRaceDelta(outcome, objective, game.career.difficulty) * weight;
    }
  });
  const repDelta = Math.round(repTotal * 10) / 10;
  player.reputation = clamp(Math.round(((player.reputation ?? 30) + repDelta) * 10) / 10, 0, 100);
  const confDelta = Math.round(confTotal);
  const career = { ...game.career, confidence: clamp(game.career.confidence + confDelta, 0, 100) };

  const hyper = report.classes.HYPERCAR;
  const gt3 = report.classes.LMGT3;
  const finishers = list => list.filter(result => result.finished);
  const carName = result => `${result.teamName} #${result.number}`;
  const raceRecord = {
    track: track.name,
    trackId: track.id,
    winner: finishers(hyper)[0] ? carName(finishers(hyper)[0]) : "N/A",
    podium: finishers(hyper).slice(0, 3).map(carName),
    gt3Winner: finishers(gt3)[0] ? carName(finishers(gt3)[0]) : "N/A",
    gt3Podium: finishers(gt3).slice(0, 3).map(carName),
    teamWinners: Object.fromEntries(CLASSES.map(cls => [cls, report.teams[cls][0]?.teamName || "N/A"])),
    poles: {
      HYPERCAR: hyper.find(result => result.pole) ? carName(hyper.find(result => result.pole)) : undefined,
      LMGT3: gt3.find(result => result.pole) ? carName(gt3.find(result => result.pole)) : undefined
    },
    player: raceSummaryOf(playerResults[0]),
    players: playerResults.map(raceSummaryOf),
    playerTeams: Object.fromEntries(Object.entries(playerTeamResults).map(([cls, row]) => [cls, { position: row.position, points: row.points, finished: row.finished }]))
  };

  const nextGame = {
    ...game,
    playerTeam: player,
    teams: aiTeams,
    entries,
    raceIndex: game.raceIndex + 1,
    archive: {
      ...game.archive,
      currentSeasonRaces: [...game.archive.currentSeasonRaces, raceRecord]
    },
    career
  };
  return {
    game: nextGame,
    summary: {
      result: playerResults[0],
      results: playerResults,
      teamResults: playerTeamResults,
      items,
      net,
      prize,
      balance: player.funds,
      repDelta,
      reputation: player.reputation,
      confDelta,
      confidence: career.confidence,
      expiredSponsors,
      // Pontos acumulados: por equipe em cada classe e por carro
      teamPoints: Object.fromEntries(Object.keys(player.programs).map(cls => [cls, player.programs[cls].points])),
      pointsTotals: myCars.map(entry => {
        const updated = entries.find(item => item.id === entry.id);
        return { id: entry.id, number: entry.number, class: entry.class, points: updated.points };
      })
    }
  };
};
