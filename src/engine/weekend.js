import { SERIES_CONFIG, TRACKS, WEATHER_SCENARIOS } from "../data/constants.js";
import { clamp, randRange, pickRandom, pickWeighted } from "../utils/helpers.js";
import { basePace, carPerformance, driverPaceRating } from "./race.js";

export const allTeams = game => [game.playerTeam, ...game.aiTeams];
export const classTeams = (game, cls) => allTeams(game).filter(team => team.class === cls);

// ---------------------------------------------------------------------------
// Balance of Performance: compensa 40% da diferença de carro em relação à média da classe (máx. ±2%)
// ---------------------------------------------------------------------------

export const BOP_LIMIT = 2;

export const computeBop = (teams, trackType) => {
  const result = {};
  ["HYPERCAR", "LMGT3"].forEach(cls => {
    const group = teams.filter(team => team.class === cls);
    if (!group.length) {
      return;
    }
    const perf = group.map(team => carPerformance(team.car, trackType));
    const avg = perf.reduce((sum, value) => sum + value, 0) / perf.length;
    group.forEach((team, i) => {
      result[team.id] = Math.round(clamp(-(perf[i] - avg) * 0.0333, -BOP_LIMIT, BOP_LIMIT) * 100) / 100;
    });
  });
  return result;
};

// Peso equivalente, só para exibição (penalidade = lastro positivo)
export const bopWeight = bop => Math.round(-bop * 25);

export const applyBop = (game, track) => {
  const enabled = game.career?.bopEnabled !== false;
  const bop = enabled ? computeBop(allTeams(game), track.type) : {};
  return {
    ...game,
    playerTeam: { ...game.playerTeam, bop: bop[game.playerTeam.id] || 0 },
    aiTeams: game.aiTeams.map(team => ({ ...team, bop: bop[team.id] || 0 }))
  };
};

// ---------------------------------------------------------------------------
// Fim de semana
// ---------------------------------------------------------------------------

export const createWeekend = game => {
  const track = TRACKS[game.raceIndex];
  const scenario = pickWeighted(track.weather);
  let startWetness = 0;
  if (scenario === "RAINY") {
    startWetness = randRange(40, 80);
  } else if (scenario === "MIXED" && Math.random() < 0.3) {
    startWetness = randRange(20, 45);
  }
  // Previsão com erro proporcional à chance real (o Engenheiro de Corrida reduz o erro)
  const engineer = game.playerTeam.staff?.raceEngineer?.stars ?? 2;
  const base = WEATHER_SCENARIOS[scenario].rain;
  const noise = (5 - engineer) * 0.12;
  const forecastRain = clamp(base + randRange(-noise, noise) * Math.max(base, 0.1), 0, 1);
  const aiSetup = {};
  game.aiTeams.forEach(team => {
    aiSetup[team.id] = randRange(0.4, 1.5);
  });
  return {
    trackIndex: game.raceIndex,
    track,
    scenario,
    startWetness,
    forecastRain,
    aiSetup,
    setupScore: 0,
    qualyScore: 0,
    qualifying: null,
    startTyre: startWetness > 30 ? "WET" : "MEDIUM"
  };
};

// Tentativas de setup: 4 + simulador nível 3 e 5 + engenheiro 4★
export const setupAttempts = team => {
  const simulator = team.facilities?.simulator ?? 1;
  const engineer = team.staff?.raceEngineer?.stars ?? 2;
  return 4 + (simulator >= 3 ? 1 : 0) + (simulator >= 5 ? 1 : 0) + (engineer >= 4 ? 1 : 0);
};

// Velocidade da barra da classificação (simulador deixa mais lenta)
export const qualifyingBarFactor = team => 1 - ((team.facilities?.simulator ?? 1) - 1) * 0.05;

export const computeQualifying = (game, weekend) => {
  const track = weekend.track;
  const wet = weekend.startWetness;
  const results = allTeams(game)
    .map(team => {
      const cfg = SERIES_CONFIG[team.class];
      const isPlayer = team.id === game.playerTeam.id;
      const bestIdx = team.drivers.reduce((best, driver, idx) => (driverPaceRating(driver, wet) > driverPaceRating(team.drivers[best], wet) ? idx : best), 0);
      const setupBonus = isPlayer ? (weekend.setupScore / 100) * 2 : weekend.aiSetup[team.id] ?? 0.9;
      const qualyBonus = isPlayer ? (weekend.qualyScore / 100) * 1.2 : Math.random() * 0.9;
      const speed =
        cfg.baseSpeed +
        carPerformance(team.car, track.type) * 0.05 +
        driverPaceRating(team.drivers[bestIdx], wet) * 0.04 +
        setupBonus * 0.6 +
        qualyBonus +
        (cfg.baseSpeed * (team.bop || 0)) / 100 +
        randRange(-0.25, 0.25);
      const wetFactor = wet > 30 ? 0.86 : 1;
      return {
        teamId: team.id,
        teamName: team.name,
        class: team.class,
        isPlayer,
        color: team.color,
        number: team.number,
        driver: team.drivers[bestIdx].name,
        setupBonus,
        speed,
        lapTime: (track.length / (speed * wetFactor * 1.02)) * (track.timeScale || 1)
      };
    })
    .sort((a, b) => b.speed - a.speed);
  const counters = {};
  const poleTime = {};
  results.forEach((entry, index) => {
    entry.position = index + 1;
    counters[entry.class] = (counters[entry.class] || 0) + 1;
    entry.classPosition = counters[entry.class];
    entry.pole = entry.classPosition === 1;
    if (entry.pole) {
      poleTime[entry.class] = entry.lapTime;
    }
    entry.gap = entry.lapTime - poleTime[entry.class];
  });
  return results;
};

// Monta o estado inicial da corrida a partir do grid da classificação
export const createRaceState = (game, weekend) => {
  const track = weekend.track;
  const wet = weekend.startWetness;
  const byId = new Map(allTeams(game).map(team => [team.id, team]));
  const player = game.playerTeam;
  const engineerStars = player.staff?.raceEngineer?.stars ?? 2;
  const crewStars = player.staff?.crewChief?.stars ?? 2;
  const grid = weekend.qualifying.map((q, index) => {
    const team = byId.get(q.teamId);
    const isPlayer = team.id === player.id;
    const drivers = team.drivers.map(driver => ({
      id: driver.id,
      name: driver.name,
      nationality: driver.nationality,
      rating: driver.rating,
      attrs: driver.attrs,
      morale: driver.morale
    }));
    const tyreStyle = pickRandom(["SOFT", "MEDIUM", "MEDIUM", "HARD"]);
    const entry = {
      teamId: team.id,
      teamName: team.name,
      class: team.class,
      isPlayer,
      color: team.color,
      number: team.number,
      car: { ...team.car },
      bop: team.bop || 0,
      drivers,
      currentDriverIdx: 0,
      fatigue: drivers.map(() => 0),
      driveTime: drivers.map(() => 0),
      setupBonus: q.setupBonus,
      startPosition: index + 1,
      startClassPosition: q.classPosition,
      pole: q.pole,
      distance: -index * 15,
      laps: 0,
      speed: 0,
      pace: 0,
      status: "RUN",
      finished: false,
      finishOrder: null,
      finishTime: null,
      tyreCompound: isPlayer ? weekend.startTyre : wet > 30 ? "WET" : tyreStyle === "HARD" ? "MEDIUM" : tyreStyle,
      tyreWear: 100,
      tyreAge: 0,
      fuel: 100,
      pitStops: 0,
      pitTimer: 0,
      lastPitTime: 0,
      pitPlan: null,
      boxRequested: false,
      forcedPit: false,
      problem: null,
      puncture: false,
      damage: 0,
      damageTaken: 0,
      stall: 0,
      strategy: "BALANCED",
      autoStrategy: !isPlayer,
      aiTyreStyle: tyreStyle,
      lapProgressPct: 0,
      paceVariance: 0,
      targetVariance: 0,
      lapStart: 0,
      lastLap: null,
      bestLap: null,
      pitThisLap: false,
      stintTime: 0,
      position: index + 1,
      classPosition: q.classPosition,
      prevClassPosition: q.classPosition,
      heldUp: false,
      dnfReason: null,
      overtakes: 0,
      pitErrorChance: isPlayer ? Math.max(0.02, 0.1 - crewStars * 0.016) : 0.06,
      pitStaffFactor: isPlayer ? 1.08 - crewStars * 0.04 : 1,
      engineerLevel: isPlayer ? engineerStars : 0
    };
    entry.pace = basePace(entry, track, wet);
    entry.speed = entry.pace * 3.6 * 0.9;
    return entry;
  });
  const playerQ = weekend.qualifying.find(q => q.isPlayer);
  return {
    track,
    totalLaps: track.laps,
    grid,
    weather: wet > 30 ? "RAIN" : "SUN",
    weatherScenario: weekend.scenario,
    trackWetness: wet,
    targetWetness: wet,
    weatherTimer: 300,
    neutral: null,
    neutralId: 0,
    events: [{
      t: 0,
      lap: 1,
      text: `Grid definido. Largada P${playerQ?.classPosition ?? "-"} na classe. Clima previsto: ${WEATHER_SCENARIOS[weekend.scenario].label}.`,
      type: "info",
      important: true
    }],
    radio: [],
    radioMemo: {},
    fastestLaps: {},
    elapsed: 0,
    leaderLap: 1,
    checkered: false,
    finished: false,
    finishCount: 0,
    timeLimit: track.laps * (track.length / 25) + 900,
    night: 0
  };
};
