import { SERIES_CONFIG, TYRES, STRATEGIES } from "../data/constants.js";
import { clamp, randInt, randRange, surname, formatLapTime, toDisplayTime } from "../utils/helpers.js";

// ---------------------------------------------------------------------------
// Modelo de desempenho
// ---------------------------------------------------------------------------

// Peso de cada peça no ritmo, conforme o tipo de pista
const TRACK_WEIGHTS = {
  speed: { engine: 0.5, aero: 0.2, chassis: 0.3 },
  technical: { engine: 0.2, aero: 0.4, chassis: 0.4 },
  endurance: { engine: 0.34, aero: 0.3, chassis: 0.36 },
  balanced: { engine: 1 / 3, aero: 1 / 3, chassis: 1 / 3 }
};

export const carPerformance = (car, trackType = "balanced") => {
  const weights = TRACK_WEIGHTS[trackType] || TRACK_WEIGHTS.balanced;
  return car.engine * weights.engine + car.aero * weights.aero + car.chassis * weights.chassis;
};

// Ritmo do piloto: na pista molhada pesa a habilidade na chuva
export const driverPaceRating = (driver, wetness = 0) => {
  const pace = driver?.attrs?.pace ?? driver?.rating ?? 60;
  const wet = driver?.attrs?.wet ?? pace;
  const weight = clamp(wetness / 60, 0, 1);
  return pace * (1 - weight) + wet * weight;
};

const moraleFactor = driver => 1 + ((driver?.morale ?? 75) - 75) / 2500;

// Velocidade média (m/s) antes de pneus, combustível, tráfego etc.
export const basePace = (entry, track, wetness = 0, driverIdx = entry.currentDriverIdx) => {
  const cfg = SERIES_CONFIG[entry.class];
  const driver = entry.drivers[driverIdx];
  const pace =
    cfg.baseSpeed +
    carPerformance(entry.car, track.type) * 0.05 +
    driverPaceRating(driver, wetness) * 0.04 +
    (entry.setupBonus || 0) +
    (cfg.baseSpeed * (entry.bop || 0)) / 100;
  return pace * moraleFactor(driver);
};

export const fuelRate = (entry, track) => {
  const strategy = STRATEGIES[entry.strategy] || STRATEGIES.BALANCED;
  const efficiency = entry.car.efficiency ?? 30;
  return (0.13 - efficiency * 0.0006) * (SERIES_CONFIG[entry.class].fuelFactor ?? 1) * (track.fuelUse || 1) * strategy.fuel;
};

export const tyreRate = (entry, track, wetness, compound = entry.tyreCompound) => {
  const strategy = STRATEGIES[entry.strategy] || STRATEGIES.BALANCED;
  const tyre = TYRES[compound] || TYRES.MEDIUM;
  let rate =
    (0.065 - entry.car.chassis * 0.00018) *
    (SERIES_CONFIG[entry.class].tyreWearFactor ?? 1) *
    tyre.wear *
    (track.tyreWear || 1) *
    strategy.tyre;
  if (!tyre.dry && wetness < 10) {
    rate *= 3;
  }
  return rate;
};

export const tyreGrip = (compound, wear, wetness) => {
  const tyre = TYRES[compound] || TYRES.MEDIUM;
  let weather;
  if (tyre.dry) {
    weather = wetness < 20 ? 1 : wetness < 50 ? 0.85 : 0.6;
  } else {
    weather = wetness > 50 ? 1 : wetness > 20 ? 0.95 : 0.9;
  }
  let wearFactor = 1;
  if (wear < 0) {
    wearFactor = 0.85;
  } else if (wear < 15) {
    wearFactor = 0.975 - ((15 - wear) / 15) * 0.045;
  } else if (wear < 40) {
    wearFactor = 1 - ((40 - wear) / 25) * 0.025;
  }
  return tyre.grip * weather * wearFactor;
};

export const fatiguePenalty = fatigue => (fatigue > 55 ? ((fatigue - 55) / 45) * 0.02 : 0);
const staminaSeconds = driver => 2400 + (driver?.attrs?.stamina ?? driver?.rating ?? 60) * 30;
const varianceAmp = driver => 2.4 - (driver?.attrs?.consistency ?? driver?.rating ?? 60) / 60;

// ---------------------------------------------------------------------------
// Relógio da prova (ciclo dia/noite)
// ---------------------------------------------------------------------------

export const nightLevel = hour => {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h < 19) {
    return 0;
  }
  if (h >= 19 && h < 20.5) {
    return (h - 19) / 1.5;
  }
  if (h >= 5.5 && h < 7) {
    return (7 - h) / 1.5;
  }
  return 1;
};

export const raceProgress = state => {
  const leader = state.grid.find(car => car.status !== "DNF") || state.grid[0];
  return clamp(leader.distance / (state.totalLaps * state.track.length), 0, 1);
};

export const raceClock = state => (state.track.startHour ?? 12) + raceProgress(state) * (state.track.durationHours ?? 6);

// ---------------------------------------------------------------------------
// Estratégia: estimativas, pit stop e decisões automáticas
// ---------------------------------------------------------------------------

export const estimateStint = (entry, state) => {
  const pace = entry.pace > 20 ? entry.pace : basePace(entry, state.track, state.trackWetness);
  const lapTime = state.track.length / pace;
  const fuelPerLap = fuelRate(entry, state.track) * lapTime;
  const tyrePerLap = tyreRate(entry, state.track, state.trackWetness) * lapTime;
  return {
    lapTime,
    fuelPerLap,
    tyrePerLap,
    fuelLaps: entry.fuel / fuelPerLap,
    tyreLaps: Math.max(0, entry.tyreWear) / tyrePerLap,
    lapsToFinish: Math.max(0, state.totalLaps - entry.laps - entry.lapProgressPct)
  };
};

export const estimatePitTime = (entry, plan, state) => {
  const crewFactor = 1.15 - ((entry.car.crew ?? 30) / 99) * 0.35;
  const fuelNeeded = Math.max(0, 100 - entry.fuel);
  const swapping = plan.driverSwap != null && plan.driverSwap !== entry.currentDriverIdx;
  let stationary = Math.max((fuelNeeded / 100) * 25, swapping ? 5 : 0);
  if (plan.tyres || entry.puncture) {
    stationary += 12 * crewFactor;
  }
  if (plan.repair && entry.damage > 0) {
    stationary += entry.damage * 0.9 * crewFactor;
  }
  if (entry.problem) {
    stationary += entry.problem.repair;
  }
  stationary *= entry.pitStaffFactor ?? 1;
  const lane = state.track.pitLane * (state.neutral ? 0.45 : 1);
  return {
    stationary,
    lane,
    total: stationary + lane
  };
};

const tyreLife = (entry, state, compound, lapTime) => 92 / Math.max(0.0001, tyreRate(entry, state.track, 0, compound) * lapTime);

const pickDryCompound = (entry, state, stintLaps, lapTime) => {
  const style = entry.aiTyreStyle || "MEDIUM";
  const softLife = tyreLife(entry, state, "SOFT", lapTime);
  const mediumLife = tyreLife(entry, state, "MEDIUM", lapTime);
  if (style === "SOFT" && softLife >= stintLaps) {
    return "SOFT";
  }
  if (style !== "HARD" && mediumLife >= stintLaps) {
    return softLife >= stintLaps && stintLaps <= 6 ? "SOFT" : "MEDIUM";
  }
  return "HARD";
};

// Plano de pit stop que a IA (ou o box automático) escolheria agora
export const computeAutoPlan = (entry, state) => {
  const est = estimateStint(entry, state);
  const fullTankLaps = 100 / est.fuelPerLap;
  const nextStint = Math.min(Math.ceil(est.lapsToFinish), Math.ceil(fullTankLaps));
  const wetness = state.trackWetness;
  const current = TYRES[entry.tyreCompound] || TYRES.MEDIUM;
  const wantWet = wetness > 40 || (state.targetWetness > 55 && wetness > 25);
  let tyres = null;
  if (wantWet) {
    if (current.dry || entry.tyreWear < 45) {
      tyres = "WET";
    }
  } else if (!current.dry && wetness < 25) {
    tyres = pickDryCompound(entry, state, nextStint, est.lapTime);
  } else if (entry.puncture || entry.tyreWear - nextStint * est.tyrePerLap < 8) {
    tyres = current.dry ? pickDryCompound(entry, state, nextStint, est.lapTime) : "WET";
  }
  let driverSwap = null;
  if (entry.drivers.length > 1 && entry.fatigue[entry.currentDriverIdx] > 45 && est.lapsToFinish > 2) {
    let best = null;
    entry.drivers.forEach((driver, idx) => {
      if (idx === entry.currentDriverIdx) {
        return;
      }
      const score = driverPaceRating(driver, wetness) - entry.fatigue[idx] * 0.4;
      if (!best || score > best.score) {
        best = { idx, score };
      }
    });
    driverSwap = best ? best.idx : null;
  }
  return {
    tyres,
    driverSwap,
    repair: entry.damage > 0
  };
};

const autoPitDecision = (entry, state) => {
  if (entry.boxRequested || state.checkered) {
    return null;
  }
  const est = estimateStint(entry, state);
  const left = est.lapsToFinish;
  if (left <= 0.3) {
    return null;
  }
  const tyre = TYRES[entry.tyreCompound] || TYRES.MEDIUM;
  if (est.fuelLaps < 1.3 && est.fuelLaps < left) {
    return "fuel";
  }
  if (est.tyreLaps < 1.3 && est.tyreLaps < left) {
    return "tyres";
  }
  if (tyre.dry && state.trackWetness > 45) {
    return "weather";
  }
  if (!tyre.dry && state.trackWetness < 15 && left > 1.5) {
    return "weather";
  }
  if (entry.damage >= 25 && left > 2) {
    return "damage";
  }
  if (state.neutral && left > 3 && est.fuelLaps < left && (entry.fuel < 55 || entry.tyreWear < 40)) {
    return "neutral";
  }
  return null;
};

const aiDriveMode = (entry, state) => {
  const est = estimateStint(entry, state);
  if (est.lapsToFinish < 3) {
    entry.strategy = est.fuelLaps > est.lapsToFinish * 1.35 && est.tyreLaps > est.lapsToFinish * 1.5 ? "ATTACK" : "BALANCED";
  }
};

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

const MAX_EVENTS = 400;
const MAX_RADIO = 40;
const SC_SPEED = 42;
const FCY_SPEED = 36;

export const classLabel = cls => (cls === "HYPERCAR" ? "HYP" : "GT3");

const pushEvent = (s, text, type = "info", extra = {}) => {
  s.events.push({
    t: s.elapsed,
    lap: s.leaderLap,
    text,
    type,
    ...extra
  });
  if (s.events.length > MAX_EVENTS) {
    s.events.splice(0, s.events.length - MAX_EVENTS);
  }
};

// Ordem da corrida: voltas completadas, depois distância; quem já recebeu a bandeirada fica na ordem de chegada.
// Com o mesmo número de voltas, quem ainda não recebeu a bandeirada está na volta do líder (vai completar uma a mais).
export const rankGrid = grid =>
  [...grid].sort((a, b) => {
    const aOut = a.status === "DNF";
    const bOut = b.status === "DNF";
    if (aOut !== bOut) {
      return aOut ? 1 : -1;
    }
    if (b.laps !== a.laps) {
      return b.laps - a.laps;
    }
    if (a.finished !== b.finished) {
      return a.finished ? 1 : -1;
    }
    if (a.finished && b.finished) {
      return a.finishOrder - b.finishOrder;
    }
    return b.distance - a.distance;
  });

const assignPositions = grid => {
  const counters = {};
  grid.forEach((car, index) => {
    car.position = index + 1;
    counters[car.class] = (counters[car.class] || 0) + 1;
    car.classPosition = counters[car.class];
  });
};

const cloneRaceState = state => ({
  ...state,
  grid: state.grid.map(car => ({
    ...car,
    fatigue: [...car.fatigue],
    driveTime: [...car.driveTime],
    pitPlan: car.pitPlan ? { ...car.pitPlan } : null,
    problem: car.problem ? { ...car.problem } : null
  })),
  events: state.events.slice(),
  radio: state.radio.slice(),
  radioMemo: { ...state.radioMemo },
  fastestLaps: { ...state.fastestLaps },
  neutral: state.neutral ? { ...state.neutral } : null
});

const updateWeather = (s, dt) => {
  if (s.weatherTimer > 0) {
    s.weatherTimer -= dt;
  } else {
    s.weatherTimer = 180 + Math.random() * 300;
    const roll = Math.random();
    switch (s.weatherScenario) {
      case "SUNNY":
        s.targetWetness = roll > 0.98 ? Math.random() * 20 : 0;
        break;
      case "OVERCAST":
        s.targetWetness = roll > 0.7 ? Math.random() * 15 : 0;
        break;
      case "RAINY":
        s.targetWetness = roll > 0.2 ? 40 + Math.random() * 60 : 20 + Math.random() * 20;
        break;
      case "MIXED":
        s.targetWetness = roll > 0.5 ? Math.random() * 80 : 0;
        break;
      default:
        s.targetWetness = 0;
    }
  }
  const delta = s.targetWetness - s.trackWetness;
  const rate = Math.abs(delta) > 20 ? 0.3 : 0.1;
  if (Math.abs(delta) > 0.1) {
    s.trackWetness += (delta > 0 ? rate : -rate) * dt;
  } else {
    s.trackWetness = s.targetWetness;
  }
  s.trackWetness = clamp(s.trackWetness, 0, 100);
  if (s.trackWetness > 35 && s.weather === "SUN") {
    s.weather = "RAIN";
    pushEvent(s, "🌧️ A chuva está apertando! Pista molhada.", "weather", { important: true });
  } else if (s.trackWetness < 20 && s.weather === "RAIN") {
    s.weather = "SUN";
    pushEvent(s, "☀️ A chuva parou e o trilho seco aparece.", "weather", { important: true });
  }
};

const startNeutralization = (s, kind) => {
  if (s.checkered) {
    return;
  }
  const roll = Math.random();
  let type = null;
  if (kind === "crash") {
    type = roll < 0.7 ? "SC" : "FCY";
  } else if (kind === "stopped") {
    type = roll < 0.4 ? "SC" : "FCY";
  } else if (kind === "minor") {
    type = roll < 0.12 ? "FCY" : null;
  }
  if (!type) {
    return;
  }
  if (type === "SC") {
    if (s.neutral?.type === "SC") {
      return;
    }
    s.neutral = { type: "SC", lapsLeft: randInt(2, 3) };
    s.neutralId += 1;
    pushEvent(s, "⚠️ SAFETY CAR NA PISTA!", "flag", { important: true });
  } else if (!s.neutral) {
    s.neutral = { type: "FCY", timeLeft: randInt(60, 140) };
    s.neutralId += 1;
    pushEvent(s, "🟡 FULL COURSE YELLOW! Velocidade limitada em toda a pista.", "flag", { important: true });
  } else if (s.neutral.type === "FCY") {
    s.neutral.timeLeft += 40;
  }
};

const retire = (s, car, reason) => {
  car.status = "DNF";
  car.dnfReason = reason;
  car.speed = 0;
  car.boxRequested = false;
  pushEvent(s, `💥 ${car.teamName} (${classLabel(car.class)}): ${reason}! (DNF)`, "incident", { teamId: car.teamId, important: true });
};

const completeLap = (s, car, ctx, speed) => {
  // Instante exato em que cruzou a linha dentro deste segundo (dá décimos às voltas e às diferenças)
  const overshoot = car.distance - car.laps * ctx.L;
  const crossing = speed > 0 ? s.elapsed - Math.min(ctx.dt, Math.max(0, overshoot / speed)) : s.elapsed;
  const lapTime = crossing - car.lapStart;
  car.lapStart = crossing;
  car.tyreAge += 1;
  car.lastLap = lapTime;
  if (car.laps >= 2 && !car.pitThisLap) {
    if (car.bestLap == null || lapTime < car.bestLap) {
      car.bestLap = lapTime;
    }
    const fastest = s.fastestLaps[car.class];
    if (!fastest || lapTime < fastest.time) {
      s.fastestLaps[car.class] = {
        teamId: car.teamId,
        teamName: car.teamName,
        driver: car.drivers[car.currentDriverIdx].name,
        time: lapTime,
        lap: car.laps
      };
      if (car.laps > 3) {
        pushEvent(s, `⏱️ Volta mais rápida (${classLabel(car.class)}): ${car.teamName} — ${formatLapTime(toDisplayTime(lapTime, ctx.track))}`, "fastest", {
          teamId: car.teamId,
          important: car.isPlayer
        });
      }
    }
  }
  car.pitThisLap = false;
  if (s.neutral?.type === "SC" && car.teamId === ctx.leaderId) {
    s.neutral.lapsLeft -= 1;
    if (s.neutral.lapsLeft <= 0) {
      s.neutral = null;
      pushEvent(s, "🟢 Safety Car recolhido. RELARGADA!", "flag", { important: true });
    }
  }
  if (!s.checkered && car.laps >= s.totalLaps) {
    s.checkered = true;
    pushEvent(s, `🏁 Bandeira quadriculada! ${car.teamName} cruza a linha na frente.`, "finish", { important: true });
  }
  if (s.checkered) {
    car.finished = true;
    s.finishCount += 1;
    car.finishOrder = s.finishCount;
    car.finishTime = crossing;
    car.speed = 0;
  }
};

const moveCar = (s, car, distance, ctx, speed = 0) => {
  car.distance = distance;
  const lapsNow = Math.floor(car.distance / ctx.L);
  while (lapsNow > car.laps && !car.finished) {
    car.laps += 1;
    completeLap(s, car, ctx, speed);
  }
  car.lapProgressPct = (((car.distance % ctx.L) + ctx.L) % ctx.L) / ctx.L;
};

const driverError = (s, car, ctx) => {
  const name = surname(car.drivers[car.currentDriverIdx].name);
  const relevant = car.isPlayer || car.classPosition <= 3;
  const roll = Math.random();
  if (roll < 0.7) {
    car.stall = randRange(2, 5);
    pushEvent(s, `↪️ ${name} (${car.teamName}) escapa da pista e perde tempo.`, "incident", { teamId: car.teamId, important: car.isPlayer });
  } else if (roll < 0.92) {
    car.stall = randRange(6, 14);
    car.damage = Math.min(100, car.damage + randInt(0, 8));
    pushEvent(s, `🌀 ${name} (${car.teamName}) roda na pista!`, "incident", { teamId: car.teamId, important: relevant });
    ctx.incidents.push("minor");
  } else {
    const hit = randInt(25, 70);
    car.damage = Math.min(100, car.damage + hit);
    car.stall = randRange(8, 20);
    if (car.damage >= 80) {
      retire(s, car, "Acidente");
      ctx.incidents.push("crash");
      return;
    }
    pushEvent(s, `💥 Batida! ${name} (${car.teamName}) danifica o carro.`, "incident", { teamId: car.teamId, important: true });
    ctx.incidents.push(hit > 45 ? "crash" : "minor");
  }
};

// Disputa com o carro imediatamente à frente na pista
const interact = (s, car, speed, ctx) => {
  car.heldUp = false;
  const info = ctx.aheadOf.get(car.teamId);
  if (!info || info.gap > 25) {
    return speed;
  }
  const ahead = info.ahead;
  const aheadSpeed = ahead.speed > 1 ? ahead.speed : ahead.pace;
  if (car.class === "HYPERCAR" && ahead.cls === "LMGT3") {
    // O seu próprio GT3 abre caminho para o seu Hypercar
    return speed * (car.isPlayer && ahead.isPlayer ? 0.992 : 0.975);
  }
  if (car.class !== ahead.cls) {
    return speed;
  }
  const racing = Math.abs(ahead.distance - car.distance) < ctx.L / 2;
  if (!racing) {
    return speed * 0.99;
  }
  if (speed <= aheadSpeed) {
    return speed;
  }
  // Ordens de equipe: os seus carros não disputam posição entre si
  if (car.isPlayer && ahead.isPlayer && s.teamOrders === "HOLD") {
    car.heldUp = true;
    return Math.min(speed, aheadSpeed);
  }
  const myDriver = driverPaceRating(car.drivers[car.currentDriverIdx], s.trackWetness);
  const delta = (speed - aheadSpeed) / aheadSpeed;
  // Só tenta a ultrapassagem com vantagem real de ritmo (acima de 0,3%)
  let chance = ((delta - 0.003) * 4 + (myDriver - ahead.driverPace) / 600) * (ctx.track.overtaking || 1);
  if (car.strategy === "ATTACK") {
    chance += 0.02;
  }
  if (ahead.strategy === "ATTACK") {
    chance -= 0.01;
  }
  chance = clamp(chance, 0, 0.25);
  if (Math.random() < chance) {
    ctx.passes.push({ passerId: car.teamId, passedId: ahead.teamId });
    return speed;
  }
  if (Math.random() < 0.0008) {
    car.damage = Math.min(100, car.damage + randInt(3, 15));
    pushEvent(s, `💢 Toque! ${car.teamName} encosta em ${ahead.teamName} na disputa.`, "incident", { teamId: car.teamId, important: car.isPlayer });
    ctx.incidents.push("minor");
  }
  car.heldUp = true;
  return Math.min(speed, aheadSpeed);
};

const enterPit = (s, car) => {
  const plan = {
    tyres: null,
    driverSwap: null,
    repair: false,
    ...(car.pitPlan || {})
  };
  if (car.puncture && !plan.tyres) {
    plan.tyres = s.trackWetness > 40 ? "WET" : "MEDIUM";
  }
  const time = estimatePitTime(car, plan, s);
  const error = Math.random() < (car.pitErrorChance ?? 0.06) ? randRange(3, 9) : 0;
  car.status = "PIT";
  car.pitTimer = time.total + error;
  car.lastPitTime = car.pitTimer;
  car.speed = 0;
  car.pitStops += 1;
  car.pitThisLap = true;
  car.fuel = 100;
  const notes = [];
  if (plan.tyres) {
    car.tyreCompound = plan.tyres;
    car.tyreWear = 100;
    car.tyreAge = 0;
    notes.push(`pneus ${TYRES[plan.tyres].label.toLowerCase()}`);
  } else {
    notes.push("só combustível");
  }
  car.puncture = false;
  if (plan.driverSwap != null && plan.driverSwap !== car.currentDriverIdx && car.drivers[plan.driverSwap]) {
    car.currentDriverIdx = plan.driverSwap;
    car.stintTime = 0;
    notes.push(`entra ${surname(car.drivers[plan.driverSwap].name)}`);
  }
  if (plan.repair && car.damage > 0) {
    car.damage = 0;
    notes.push("reparos");
  }
  if (car.problem) {
    car.problem = null;
    notes.push("conserto mecânico");
  }
  car.boxRequested = false;
  car.forcedPit = false;
  car.pitPlan = null;
  pushEvent(s, `⬇️ BOX: ${car.teamName} — ${notes.join(", ")} (${toDisplayTime(car.pitTimer, s.track).toFixed(0)}s)${error ? " — erro no pit stop!" : ""}`, "pit", {
    teamId: car.teamId,
    important: car.isPlayer
  });
};

const updatePitCar = (s, car, ctx) => {
  car.pitTimer -= ctx.dt;
  car.speed = 0;
  car.fatigue = car.fatigue.map((fatigue, idx) => (idx === car.currentDriverIdx ? fatigue : Math.max(0, fatigue - (ctx.dt * 100) / 2400)));
  if (car.pitTimer <= 0) {
    car.status = "RUN";
    car.pitTimer = 0;
    car.speed = 60;
    if (car.isPlayer) {
      pushEvent(s, `⬆️ ${car.teamName} retorna à pista.`, "pit", { teamId: car.teamId, important: true });
    }
  }
};

const updateRunningCar = (s, car, ctx) => {
  const { track, dt, night } = ctx;
  const strategy = STRATEGIES[car.strategy] || STRATEGIES.BALANCED;
  const idx = car.currentDriverIdx;
  const driver = car.drivers[idx];
  const wetness = s.trackWetness;
  const neutral = s.neutral;
  const damageBefore = car.damage;

  // Quebra mecânica (confiabilidade)
  const relFactor = Math.pow(Math.max(1, 100 - car.car.reliability), 2.5) / 5000;
  const failChance = (neutral ? 0.000004 : 0.000025) * relFactor * strategy.risk * (1 + car.damage / 100);
  if (!car.problem && Math.random() < failChance * dt) {
    if (Math.random() < 0.55) {
      retire(s, car, "Falha mecânica");
      ctx.incidents.push("stopped");
      return;
    }
    car.problem = { repair: randInt(60, 200) };
    car.boxRequested = true;
    car.forcedPit = true;
    if (!car.pitPlan) {
      car.pitPlan = car.isPlayer && !car.autoStrategy ? { tyres: null, driverSwap: null, repair: true } : computeAutoPlan(car, s);
    }
    pushEvent(s, `🔧 ${car.teamName}: problema mecânico! Volta lenta para os boxes.`, "incident", { teamId: car.teamId, important: true });
  }

  // Erro do piloto
  const consistency = driver.attrs?.consistency ?? driver.rating;
  const fatigue = car.fatigue[idx];
  const errorChance =
    0.00008 *
    (1 + (100 - consistency) / 35) *
    (1 + Math.max(0, fatigue - 55) / 30) *
    (1 + wetness / 60) *
    strategy.error *
    (1 + night * 0.3) *
    (neutral ? 0.3 : 1) *
    (car.heldUp ? 1.2 : 1);
  if (car.stall <= 0 && Math.random() < errorChance * dt) {
    driverError(s, car, ctx);
    if (car.status === "DNF") {
      return;
    }
  }

  // Ritmo
  let pace = basePace(car, track, wetness);
  if (Math.random() < 0.05) {
    car.targetVariance = (Math.random() * 2 - 1) * varianceAmp(driver);
  }
  car.paceVariance += (car.targetVariance - car.paceVariance) * 0.1;
  pace += car.paceVariance;
  pace *= strategy.pace;
  pace *= tyreGrip(car.tyreCompound, car.tyreWear, wetness);
  pace *= 1 - (car.damage / 100) * 0.08;
  pace *= 1 - fatiguePenalty(fatigue);
  pace *= 1 - night * 0.006;
  if (car.fuel < 2) {
    pace *= 0.6;
  }
  if (car.puncture) {
    pace *= 0.35;
  } else if (car.problem) {
    pace *= 0.6;
  }
  car.pace = pace;

  let speed = pace;
  if (neutral?.type === "FCY") {
    speed = Math.min(speed, FCY_SPEED);
  } else if (neutral?.type === "SC") {
    speed = Math.min(speed, ctx.scSpeeds?.get(car.teamId) ?? SC_SPEED);
  } else {
    speed = interact(s, car, speed, ctx);
  }
  if (car.stall > 0) {
    speed *= 0.15;
    car.stall -= dt;
  }

  moveCar(s, car, car.distance + speed * dt, ctx, speed);
  if (car.finished) {
    return;
  }
  car.speed = speed * 3.6;

  // Consumo, desgaste e fadiga
  car.fuel -= fuelRate(car, track) * dt * (neutral ? 0.35 : 1);
  car.tyreWear -= tyreRate(car, track, wetness) * dt * (neutral ? 0.25 : 1);
  car.fatigue = car.fatigue.map((value, i) =>
    i === idx ? Math.min(100, value + (dt * 100) / staminaSeconds(car.drivers[i])) : Math.max(0, value - (dt * 100) / 2400)
  );
  car.driveTime[idx] += dt;
  car.stintTime += dt;

  // Estratégia automática (IA e jogador com box automático)
  if (!car.isPlayer || car.autoStrategy) {
    if (autoPitDecision(car, s)) {
      car.boxRequested = true;
      car.pitPlan = computeAutoPlan(car, s);
    }
  }
  if (!car.isPlayer) {
    aiDriveMode(car, s);
  }

  // Entrada nos boxes no fim da volta
  if (car.boxRequested && car.lapProgressPct > 0.96) {
    enterPit(s, car);
    return;
  }

  // Falhas
  if (car.fuel <= 0) {
    car.fuel = 0;
    retire(s, car, "Pane seca");
    ctx.incidents.push("stopped");
    return;
  }
  if (car.tyreWear <= -15 && !car.puncture) {
    if (Math.random() < 0.3) {
      retire(s, car, "Pneu estourado");
      ctx.incidents.push("crash");
      return;
    }
    car.puncture = true;
    car.damage = Math.min(100, car.damage + 10);
    car.boxRequested = true;
    car.forcedPit = true;
    car.pitPlan = {
      driverSwap: null,
      repair: true,
      ...(car.pitPlan || {}),
      tyres: car.pitPlan?.tyres || (wetness > 40 ? "WET" : "MEDIUM")
    };
    pushEvent(s, `💥 Pneu furado! ${car.teamName} volta devagar para os boxes.`, "incident", { teamId: car.teamId, important: true });
  }
  car.damageTaken = car.damage > damageBefore ? car.damage - damageBefore : 0;
};

const playerRadio = (s, car, multi = false) => {
  const say = (key, text, tone, cooldown = 180) => {
    const memoKey = `${car.teamId}:${key}`;
    const last = s.radioMemo[memoKey];
    if (last != null && s.elapsed - last < cooldown) {
      return;
    }
    s.radioMemo[memoKey] = s.elapsed;
    s.radio.push({ t: s.elapsed, lap: Math.min(s.totalLaps, car.laps + 1), text: multi ? `#${car.number}: ${text}` : text, tone, teamId: car.teamId });
    if (s.radio.length > MAX_RADIO) {
      s.radio.shift();
    }
  };
  if (car.status === "DNF") {
    say("dnf", `Fim de prova para nós... ${car.dnfReason}.`, "danger", 1e9);
    return;
  }
  if (car.finished) {
    say("finish", `Bandeira quadriculada! Terminamos em P${car.classPosition} na classe.`, car.classPosition <= 3 ? "good" : "info", 1e9);
    return;
  }
  if (car.status === "PIT") {
    return;
  }
  const est = estimateStint(car, s);
  const left = est.lapsToFinish;
  const engineer = car.engineerLevel ?? 2;
  if (!car.boxRequested && !car.autoStrategy) {
    if (est.fuelLaps < 1.15 && est.fuelLaps < left) {
      say("fuel_crit", "BOX, BOX! Não temos combustível para outra volta!", "danger", 45);
    } else if (est.fuelLaps < 2.3 && est.fuelLaps < left) {
      say("fuel_low", `Combustível para ~${est.fuelLaps.toFixed(1)} voltas. Prepare o pit stop.`, "warn", 150);
    }
    if (car.tyreWear < 12) {
      say("tyre_crit", `Pneus em ${Math.max(0, Math.round(car.tyreWear))}%! Risco de furo.`, "danger", 60);
    } else if (car.tyreWear < 30) {
      say("tyre_low", `Pneus em ${Math.round(car.tyreWear)}%. Dá para mais ~${Math.floor(est.tyreLaps)} voltas.`, "warn", 400);
    }
  }
  const tyre = TYRES[car.tyreCompound] || TYRES.MEDIUM;
  if (tyre.dry && s.trackWetness > 35) {
    say("rain_slicks", "A pista está encharcada — precisamos de pneus de chuva!", "danger", 120);
  }
  if (!tyre.dry && s.trackWetness < 15 && left > 2) {
    say("dry_wets", "A pista está secando. Hora de voltar para os slicks.", "warn", 150);
  }
  if (engineer >= 2 && s.targetWetness - s.trackWetness > 25 && s.trackWetness < 25) {
    say("rain_coming", "Radar: chuva forte chegando nos próximos minutos.", "info", 500);
  }
  const fatigue = car.fatigue[car.currentDriverIdx];
  if (fatigue > 62 && car.drivers.length > 1) {
    say("fatigue", `${surname(car.drivers[car.currentDriverIdx].name)} está cansado (${Math.round(fatigue)}%). Troque de piloto no próximo pit.`, "warn", 500);
  }
  if (car.damageTaken > 0) {
    say("damage", `Temos dano no carro (−${(car.damage * 0.08).toFixed(1)}% de ritmo). Reparo no próximo pit?`, "danger", 20);
  }
  if (s.neutral && !car.boxRequested && left > 3) {
    say(`neutral_${s.neutralId}`, `${s.neutral.type === "SC" ? "Safety Car" : "Full Course Yellow"}! Parar agora custa bem menos tempo.`, "info", 1e9);
  }
  // Só anuncia mudanças de posição que se mantêm por 20s (evita o vaivém dos ciclos de pit stop)
  if (car.classPosition !== car.prevClassPosition) {
    car.prevClassPosition = car.classPosition;
    car.positionChangedAt = s.elapsed;
  }
  if (car.announcedPosition == null) {
    car.announcedPosition = car.classPosition;
  }
  if (car.classPosition !== car.announcedPosition && s.elapsed - (car.positionChangedAt ?? 0) >= 20) {
    if (car.classPosition < car.announcedPosition) {
      say("gain", `Ganhamos posição! P${car.classPosition} na classe.`, "good", 10);
    } else {
      say("loss", `Perdemos posição. Agora somos P${car.classPosition}.`, "warn", 10);
    }
    car.announcedPosition = car.classPosition;
  }
  if (s.leaderLap >= s.totalLaps) {
    say("last_lap", "Última volta! Traga o carro para casa.", "info", 1e9);
  }
};

// Rádio do muro quando os dois carros da equipe andam juntos na mesma classe
const teamRadio = (s, players) => {
  if (players.length < 2 || players[0].class !== players[1].class) {
    return;
  }
  const [a, b] = players;
  if (a.status !== "RUN" || b.status !== "RUN" || a.finished || b.finished) {
    return;
  }
  const close = Math.abs(a.distance - b.distance) < 60 && a.laps === b.laps;
  const key = "team:battle";
  const last = s.radioMemo[key];
  if (close && s.teamOrders !== "HOLD" && (last == null || s.elapsed - last > 400) && s.elapsed > 120) {
    s.radioMemo[key] = s.elapsed;
    s.radio.push({
      t: s.elapsed,
      lap: Math.min(s.totalLaps, Math.max(a.laps, b.laps) + 1),
      text: `Muro: #${a.number} e #${b.number} estão brigando roda a roda! Quer dar ordem de equipe?`,
      tone: "warn",
      teamId: null
    });
    if (s.radio.length > MAX_RADIO) {
      s.radio.shift();
    }
  }
};

// Avança 1 segundo de corrida (muta o estado recebido, que deve ser uma cópia)
const tick = s => {
  if (s.finished) {
    return;
  }
  const dt = 1;
  const track = s.track;
  const L = track.length;
  s.elapsed += dt;
  const leaderBefore = s.grid.find(car => car.status !== "DNF");
  s.leaderLap = Math.min(s.totalLaps, (leaderBefore?.laps ?? 0) + 1);
  const night = nightLevel(raceClock(s));
  s.night = night;

  updateWeather(s, dt);
  if (s.neutral?.type === "FCY") {
    s.neutral.timeLeft -= dt;
    if (s.neutral.timeLeft <= 0) {
      s.neutral = null;
      pushEvent(s, "🟢 Bandeira verde! Fim do Full Course Yellow.", "flag", { important: true });
    }
  }

  // Foto da pista antes de mover: quem está à frente de quem
  const movers = s.grid.filter(car => car.status === "RUN" && !car.finished);
  const snapshot = movers.map(car => ({
    teamId: car.teamId,
    teamName: car.teamName,
    distance: car.distance,
    posMod: ((car.distance % L) + L) % L,
    speed: car.speed / 3.6,
    pace: car.pace,
    cls: car.class,
    isPlayer: car.isPlayer,
    strategy: car.strategy,
    driverPace: driverPaceRating(car.drivers[car.currentDriverIdx], s.trackWetness)
  }));
  const physical = [...snapshot].sort((a, b) => b.posMod - a.posMod);
  const aheadOf = new Map();
  if (physical.length > 1) {
    physical.forEach((car, i) => {
      const ahead = physical[(i - 1 + physical.length) % physical.length];
      aheadOf.set(car.teamId, { ahead, gap: (ahead.posMod - car.posMod + L) % L });
    });
  }
  let scSpeeds = null;
  if (s.neutral?.type === "SC" && movers.length) {
    const leader = snapshot.reduce((best, car) => (car.distance > best.distance ? car : best), snapshot[0]);
    const train = snapshot.map(car => ({ id: car.teamId, d: (leader.posMod - car.posMod + L) % L })).sort((a, b) => a.d - b.d);
    scSpeeds = new Map();
    train.forEach((car, i) => {
      if (i === 0) {
        scSpeeds.set(car.id, SC_SPEED);
        return;
      }
      scSpeeds.set(car.id, SC_SPEED + clamp((car.d - train[i - 1].d - 18) / 12, -6, 16));
    });
  }
  const ctx = {
    track,
    L,
    dt,
    night,
    aheadOf,
    scSpeeds,
    passes: [],
    incidents: [],
    leaderId: leaderBefore?.teamId
  };

  for (const car of s.grid) {
    if (car.status === "DNF" || car.finished) {
      continue;
    }
    if (car.status === "PIT") {
      updatePitCar(s, car, ctx);
    } else {
      updateRunningCar(s, car, ctx);
    }
  }

  // Ultrapassagens concluídas neste segundo
  ctx.passes.forEach(({ passerId, passedId }) => {
    const passer = s.grid.find(car => car.teamId === passerId);
    const passed = s.grid.find(car => car.teamId === passedId);
    if (!passer || !passed || passer.status !== "RUN" || passed.status !== "RUN" || passer.finished || passed.finished) {
      return;
    }
    if (passer.distance < passed.distance && passed.distance - passer.distance < 40) {
      moveCar(s, passer, passed.distance + 2, ctx);
      passer.overtakes = (passer.overtakes || 0) + 1;
      if (passer.isPlayer || passed.isPlayer || passed.classPosition <= 3) {
        pushEvent(s, `🔄 ${passer.teamName} ultrapassa ${passed.teamName} pela P${passed.classPosition} (${classLabel(passed.class)}).`, "overtake", {
          teamId: passer.teamId,
          important: passer.isPlayer || passed.isPlayer
        });
      }
    }
  });

  ctx.incidents.forEach(kind => startNeutralization(s, kind));

  s.grid = rankGrid(s.grid);
  assignPositions(s.grid);

  const players = s.grid.filter(car => car.isPlayer);
  players.forEach(car => playerRadio(s, car, players.length > 1));
  teamRadio(s, players);

  if (s.checkered && s.grid.every(car => car.status === "DNF" || car.finished)) {
    s.finished = true;
    pushEvent(s, "🏁 FIM DE CORRIDA!", "finish", { important: true });
  } else if (s.elapsed > s.timeLimit) {
    s.grid.forEach(car => {
      if (car.status !== "DNF" && !car.finished) {
        car.finished = true;
        s.finishCount += 1;
        car.finishOrder = s.finishCount;
        car.finishTime = s.elapsed;
      }
    });
    s.grid = rankGrid(s.grid);
    assignPositions(s.grid);
    s.finished = true;
    pushEvent(s, "🏁 FIM DE CORRIDA! (tempo máximo)", "finish", { important: true });
  }
};

// Avança N segundos de corrida e devolve um novo estado
export const advanceRace = (state, ticks = 1) => {
  if (state.finished) {
    return state;
  }
  const s = cloneRaceState(state);
  for (let i = 0; i < ticks && !s.finished; i++) {
    tick(s);
  }
  return s;
};

// Simula até a bandeirada (o box automático assume o carro do jogador)
export const simulateToEnd = state => {
  const s = cloneRaceState(state);
  s.grid.forEach(car => {
    if (car.isPlayer) {
      car.autoStrategy = true;
    }
  });
  let guard = 0;
  while (!s.finished && guard < 200000) {
    tick(s);
    guard += 1;
  }
  return s;
};

// ---------------------------------------------------------------------------
// Comandos do jogador durante a corrida
// ---------------------------------------------------------------------------

// teamId escolhe qual dos carros do jogador recebe o comando (padrão: o primeiro)
const updatePlayer = (state, update, teamId = null) => {
  const target = teamId ?? state.grid.find(car => car.isPlayer)?.teamId;
  return {
    ...state,
    grid: state.grid.map(car => (car.isPlayer && car.teamId === target ? { ...car, ...update(car) } : car))
  };
};

export const requestPitStop = (state, plan, teamId) =>
  updatePlayer(state, car => (car.status === "RUN" && !car.finished ? { boxRequested: true, pitPlan: { ...plan } } : {}), teamId);

export const cancelPitStop = (state, teamId) => updatePlayer(state, car => (car.forcedPit ? {} : { boxRequested: false, pitPlan: null }), teamId);

export const setPlayerStrategy = (state, strategy, teamId) => updatePlayer(state, () => ({ strategy }), teamId);

export const setPlayerAutoStrategy = (state, enabled, teamId) =>
  updatePlayer(
    state,
    car => ({
      autoStrategy: enabled,
      ...(enabled ? {} : car.forcedPit ? {} : { boxRequested: false, pitPlan: null })
    }),
    teamId
  );

export const setTeamOrders = (state, orders) => {
  const players = state.grid.filter(car => car.isPlayer);
  const text =
    orders === "HOLD"
      ? `Ordem de equipe: ${players.map(car => `#${car.number}`).join(" e ")} mantêm as posições.`
      : "Ordem de equipe retirada: disputa livre entre os carros da equipe.";
  return {
    ...state,
    teamOrders: orders,
    radio: [...state.radio, { t: state.elapsed, lap: state.leaderLap, text: `Muro: ${text}`, tone: "info", teamId: null }].slice(-MAX_RADIO)
  };
};

// Ordem de equipe pontual: o carro de trás passa o da frente (se estiverem perto, na mesma volta e classe)
export const canSwapTeamCars = state => {
  const players = state.grid.filter(car => car.isPlayer);
  if (players.length < 2) {
    return false;
  }
  const [a, b] = players;
  return (
    a.class === b.class &&
    a.status === "RUN" &&
    b.status === "RUN" &&
    !a.finished &&
    !b.finished &&
    a.laps === b.laps &&
    Math.abs(a.distance - b.distance) < 150
  );
};

export const swapTeamCars = state => {
  if (!canSwapTeamCars(state)) {
    return state;
  }
  const s = cloneRaceState(state);
  const [front, back] = s.grid.filter(car => car.isPlayer).sort((a, b) => b.distance - a.distance);
  const frontDistance = front.distance;
  front.distance = back.distance - 3;
  back.distance = frontDistance;
  front.lapProgressPct = (((front.distance % s.track.length) + s.track.length) % s.track.length) / s.track.length;
  back.lapProgressPct = (((back.distance % s.track.length) + s.track.length) % s.track.length) / s.track.length;
  s.grid = rankGrid(s.grid);
  assignPositions(s.grid);
  pushEvent(s, `🔁 Ordem de equipe: #${front.number} abre passagem para #${back.number}.`, "overtake", { teamId: back.teamId, important: true });
  s.radio.push({ t: s.elapsed, lap: s.leaderLap, text: `Muro: #${front.number}, deixe o #${back.number} passar. Obrigado!`, tone: "info", teamId: null });
  if (s.radio.length > MAX_RADIO) {
    s.radio.shift();
  }
  return s;
};
