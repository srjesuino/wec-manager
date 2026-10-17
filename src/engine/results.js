import { POINTS_TABLE, POLE_POINTS } from "../data/constants.js";
import { clamp, toDisplayTime } from "../utils/helpers.js";
import { rankGrid } from "./race.js";
import { racePrize, sponsorPayout, sponsorMultiplier, driversPayroll, staffPayroll, facilityUpkeep } from "./economy.js";
import { developAiTeams } from "./ai.js";
import { reputationDelta, confidenceRaceDelta } from "./career.js";

export const racePoints = (classPos, multiplier = 1) =>
  classPos <= POINTS_TABLE.length ? Math.ceil(POINTS_TABLE[classPos - 1] * multiplier) : 0;

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
        isPlayer: car.isPlayer,
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
  return {
    season: game.season,
    raceIndex: game.raceIndex,
    track,
    classes,
    player: Object.values(classes).flat().find(result => result.isPlayer),
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

// Aplica o resultado da corrida: pontos, estatísticas, finanças, reputação e evolução da IA
export const applyRaceResults = (game, report) => {
  const track = report.track;
  const multiplier = track.pointsMultiplier || 1;
  const isLeMans = track.id === "lemans";
  const results = new Map(Object.values(report.classes).flat().map(result => [result.teamId, result]));
  const classSize = cls => report.classes[cls].length;

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
  const items = [];
  const prize = racePrize(player.class, playerResult.classPos, playerResult.finished, multiplier);
  items.push({
    label: playerResult.finished ? `Prêmio da corrida (P${playerResult.classPos})` : "Prêmio de largada (abandono)",
    amount: prize,
    type: "income"
  });
  const expiredSponsors = [];
  const sponsorMult = sponsorMultiplier(player);
  player.sponsors = player.sponsors
    .map(contract => {
      const { payment, note } = sponsorPayout(contract, {
        classPos: playerResult.finished ? playerResult.classPos : null,
        isLeMans,
        multiplier: sponsorMult
      });
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
  items.push({ label: "Salários dos pilotos", amount: -driversPayroll(player), type: "expense" });
  const staff = staffPayroll(player);
  if (staff) {
    items.push({ label: "Equipe técnica", amount: -staff, type: "expense" });
  }
  const upkeep = facilityUpkeep(player);
  if (upkeep) {
    items.push({ label: "Manutenção das instalações", amount: -upkeep, type: "expense" });
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
  const repDelta = reputationDelta(playerResult, classSize(player.class), isLeMans, player.facilities?.hospitality ?? 1, game.career.objective?.position);
  player.reputation = clamp(Math.round(((player.reputation ?? 30) + repDelta) * 10) / 10, 0, 100);
  const confDelta = confidenceRaceDelta(playerResult, game.career.objective, game.career.difficulty);
  const career = { ...game.career, confidence: clamp(game.career.confidence + confDelta, 0, 100) };

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
    player: {
      classPos: playerResult.classPos,
      finished: playerResult.finished,
      points: playerResult.points,
      dnfReason: playerResult.dnfReason
    }
  };

  return {
    game: {
      ...game,
      playerTeam: player,
      aiTeams,
      raceIndex: game.raceIndex + 1,
      archive: {
        ...game.archive,
        currentSeasonRaces: [...game.archive.currentSeasonRaces, raceRecord]
      },
      career
    },
    summary: {
      result: playerResult,
      items,
      net,
      prize,
      balance: player.funds,
      repDelta,
      reputation: player.reputation,
      confDelta,
      confidence: career.confidence,
      expiredSponsors,
      pointsTotal: player.points
    }
  };
};
