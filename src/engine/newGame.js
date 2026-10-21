import {
  GAME_VERSION,
  SERIES_CONFIG,
  TEAM_NAMES,
  TEAM_DETAILS,
  AI_TIERS,
  DIFFICULTIES,
  DRIVERS_PER_CAR,
  PLAYER_COLORS,
  STAFF_ORDER,
  TRACKS,
  CLASSES,
  CLASS_RULES,
  DEFAULT_GRID
} from "../data/constants.js";
import { clamp, randInt, generateId, generateDriver, generateRookie, generateStaff, upgradeLegacyDriver } from "../utils/helpers.js";
import { generateSeasonStartNews } from "../utils/mediaEngine.js";
import { signDriverTo } from "./drivers.js";
import { driverWageFor, sponsorGoal, econ, homologationTokens, programStartBudget } from "./economy.js";
import { createObjective } from "./career.js";
import { PLAYER_ID, classPrograms, freeNumber, teamClasses } from "./team.js";
import { createAiProfile } from "./ai.js";

export const DEFAULT_SETTINGS = {
  raceSpeed: 1,
  aiNews: true
};

const defaultFacilities = () => ({
  windTunnel: 1,
  engineShop: 1,
  simulator: 1,
  hospitality: 1
});

const defaultStaff = () => Object.fromEntries(STAFF_ORDER.map(role => [role, generateStaff(role, 2)]));

// Candidatos para a equipe técnica (renovados a cada temporada)
export const generateStaffMarket = () =>
  Object.fromEntries(
    STAFF_ORDER.map(role => [role, [randInt(1, 2), randInt(2, 3), randInt(3, 4), randInt(4, 5)].map(stars => generateStaff(role, stars))])
  );

export const aiTier = index => (index < 3 ? 0 : index < 6 ? 1 : 2);

export const freshPlayerCar = difficulty => {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.NORMAL;
  return {
    engine: diff.startCar,
    aero: diff.startCar,
    chassis: diff.startCar,
    reliability: diff.startReliability,
    efficiency: diff.startCar,
    crew: diff.startCar
  };
};

// Projeto de uma equipe numa classe (carro, fichas, BoP e campeonato de equipes)
export const newProgram = car => ({ car, devTokens: null, bop: 0, points: 0, stats: { wins: 0, podiums: 0, poles: 0 } });

// Carro inscrito (número, pilotos e pontos do carro)
export const newEntry = (teamId, cls, number) => ({
  id: `car_${generateId()}`,
  teamId,
  class: cls,
  number: String(number),
  drivers: [],
  points: 0,
  stats: { wins: 0, podiums: 0, poles: 0 }
});

// Carro de nível "level" com pequenas variações por peça
export const carAtLevel = level => {
  const offset = () => Math.floor(Math.random() * 6) - 3;
  const part = () => clamp(level + offset(), 20, 99);
  return { engine: part(), aero: part(), chassis: part(), reliability: clamp(80 + offset(), 40, 99), efficiency: part(), crew: part() };
};

// Pilotos para um carro, em torno de um nível
export const lineupFor = (entry, level, takenNames, { rookies = false } = {}) =>
  Array.from({ length: DRIVERS_PER_CAR }, () =>
    signDriverTo(rookies ? generateRookie(takenNames) : generateDriver(Math.max(45, level - 5), Math.min(97, level + 5), null, takenNames), entry, randInt(1, 3))
  );

// Equipe da IA com os seus carros
// options: tier, cars, numbers, usedNumbers (Set), takenNames, id, color, ai, carLevel
export const createAiTeam = (cls, name, options = {}) => {
  const cfg = SERIES_CONFIG[cls];
  const tier = options.tier ?? 2;
  const tierData = AI_TIERS[tier];
  const ai = options.ai || createAiProfile(tier);
  const rules = CLASS_RULES[cls];
  const cars = clamp(options.cars ?? rules.minCars, rules.minCars, rules.maxCars);
  // Engenharia acima da média do nível = carro um pouco melhor desde o início
  const level = options.carLevel ?? cfg.aiLevels[tier] + Math.round((ai.engineering - tierData.engineering) * 30);
  const team = {
    id: options.id || `ai_${generateId()}`,
    name,
    class: cls,
    color: options.color || TEAM_DETAILS[name]?.color || "#9ca3af",
    tier,
    ai,
    funds: Math.floor(cfg.budget * tierData.fundsMult * (1 + (cars - 1) * 0.6)),
    support: Math.floor(tierData.support * cfg.economy),
    annualBudget: Math.floor(tierData.annual * cfg.economy),
    reputation: 85 - tier * 15,
    championships: 0,
    careerWins: 0,
    custom: !!options.custom,
    programs: { [cls]: newProgram(carAtLevel(level)) }
  };
  const used = options.usedNumbers || new Set();
  const preferred = options.numbers || TEAM_DETAILS[name]?.numbers || [];
  const entries = Array.from({ length: cars }, (_, i) => {
    let number = preferred[i] && !used.has(String(preferred[i])) ? String(preferred[i]) : null;
    if (!number) {
      number = String(preferred[i] || 40 + i);
      while (used.has(number)) {
        number = String((parseInt(number, 10) % 998) + 1);
      }
    }
    used.add(number);
    const entry = newEntry(team.id, cls, number);
    entry.drivers = lineupFor(entry, level, options.takenNames || new Set());
    return entry;
  });
  return { team, entries };
};

// Fichas de homologação da temporada para todos os programas do grid
export const withHomologation = (game, newRegulation = false) => {
  const tokens = new Map();
  CLASSES.forEach(cls => {
    const programs = classPrograms(game, cls);
    const cars = programs.map(item => item.program.car);
    programs.forEach(item => tokens.set(item.key, homologationTokens(item.program.car, cars, newRegulation)));
  });
  const apply = team => ({
    ...team,
    programs: Object.fromEntries(Object.entries(team.programs || {}).map(([cls, program]) => [cls, { ...program, devTokens: tokens.get(`${team.id}:${cls}`) ?? program.devTokens }]))
  });
  return { ...game, playerTeam: apply(game.playerTeam), teams: game.teams.map(apply) };
};

// Metas da diretoria para cada classe em que o jogador corre (lastPositions: { [classe]: posição anterior })
export const playerObjectives = (game, lastPositions = {}) =>
  Object.fromEntries(teamClasses(game.playerTeam).map(cls => [cls, createObjective(game, cls, lastPositions[cls] ?? null)]));

// Números padrão dos carros do jogador
export const DEFAULT_PLAYER_NUMBERS = { HYPERCAR: ["17", "18"], LMGT3: ["71", "72"] };

// Normaliza a escolha de carros (Hypercar 0–2, LMGT3 0 ou 2, pelo menos um carro)
export const normalizeCars = cars => {
  const result = {};
  CLASSES.forEach(cls => {
    const rules = CLASS_RULES[cls];
    const count = Number(cars?.[cls] || 0);
    result[cls] = count <= 0 ? 0 : clamp(Math.max(count, rules.minCars), rules.minCars, rules.maxCars);
  });
  if (!result.HYPERCAR && !result.LMGT3) {
    result.HYPERCAR = 1;
  }
  return result;
};

const createPlayerTeam = ({ teamName, color, difficulty, cars, numbers }, takenNames, usedNumbers) => {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.NORMAL;
  const classes = CLASSES.filter(cls => cars[cls] > 0);
  const main = classes.includes("HYPERCAR") ? "HYPERCAR" : "LMGT3";
  const team = {
    id: PLAYER_ID,
    name: teamName || "My Racing Team",
    color: color || PLAYER_COLORS[0],
    funds: Math.floor(classes.reduce((sum, cls) => sum + programStartBudget(cls, cars[cls]), 0) * diff.budgetMult),
    sponsors: [],
    championships: 0,
    careerWins: 0,
    reputation: SERIES_CONFIG[main].startReputation,
    facilities: defaultFacilities(),
    staff: defaultStaff(),
    ledger: [],
    programs: Object.fromEntries(classes.map(cls => [cls, newProgram(freshPlayerCar(difficulty))]))
  };
  const entries = classes.flatMap(cls =>
    Array.from({ length: cars[cls] }, (_, i) => {
      const wanted = numbers?.[cls]?.[i] || DEFAULT_PLAYER_NUMBERS[cls][i];
      let number = String(wanted);
      while (usedNumbers.has(number)) {
        number = String((parseInt(number, 10) % 998) + 1);
      }
      usedNumbers.add(number);
      const entry = newEntry(PLAYER_ID, cls, number);
      entry.drivers = lineupFor(entry, 70, takenNames);
      return entry;
    })
  );
  return { team, entries };
};

// Grid padrão da IA (todas as equipes, independentemente de onde o jogador corre)
const createDefaultGrid = (takenNames, usedNumbers) => {
  const teams = [];
  const entries = [];
  CLASSES.forEach(cls => {
    DEFAULT_GRID[cls].forEach(({ name, cars }, index) => {
      const created = createAiTeam(cls, name, { tier: aiTier(index), cars, takenNames, usedNumbers, id: `${cls.toLowerCase()}_ai_${index}` });
      teams.push(created.team);
      entries.push(...created.entries);
    });
  });
  return { teams, entries };
};

// cars: { HYPERCAR: 0–2, LMGT3: 0 ou 2 }; numbers: { HYPERCAR: [...], LMGT3: [...] } (opcional)
// (series é aceito por compatibilidade: um Hypercar ou dois LMGT3)
// Temporada inicial de uma carreira nova
export const START_SEASON = 2025;

export const createNewGame = ({ teamName, series, cars, numbers, color, number, difficulty = "NORMAL", bopEnabled = true, season = START_SEASON }) => {
  const takenNames = new Set();
  const usedNumbers = new Set();
  const chosen = normalizeCars(cars || { [series || "HYPERCAR"]: series === "LMGT3" ? 2 : 1 });
  const playerNumbers = numbers || (number ? { HYPERCAR: [number, String(Number(number) + 1)], LMGT3: [number, String(Number(number) + 1)] } : null);
  const player = createPlayerTeam({ teamName, color, difficulty, cars: chosen, numbers: playerNumbers }, takenNames, usedNumbers);
  const grid = createDefaultGrid(takenNames, usedNumbers);
  const driversPool = [
    ...Array.from({ length: 25 }, () => ({ ...generateDriver(60, 95, null, takenNames), contractYears: 0 })),
    ...Array.from({ length: 5 }, () => generateRookie(takenNames))
  ];
  let game = {
    version: GAME_VERSION,
    season,
    playerTeam: player.team,
    teams: grid.teams,
    entries: [...player.entries, ...grid.entries],
    driversPool,
    staffMarket: generateStaffMarket(),
    raceIndex: 0,
    archive: {
      history: [],
      currentSeasonRaces: []
    },
    newsFeed: [],
    career: {
      difficulty,
      bopEnabled,
      confidence: 60,
      objectives: {},
      seasonsCompleted: 0,
      startSeason: season
    },
    settings: { ...DEFAULT_SETTINGS }
  };
  game = withHomologation(game);
  game.career.objectives = playerObjectives(game);
  game.newsFeed = generateSeasonStartNews(season, game);
  return game;
};

// ---------------------------------------------------------------------------
// Saves antigos
// 3.x → formato 4.0 (um carro por equipe) → 4.2 (equipes com programas e carros)
// ---------------------------------------------------------------------------

const upgradeTeamDrivers = (team, takenNames) => {
  const drivers = (team.drivers || []).map(driver => {
    const upgraded = upgradeLegacyDriver(driver);
    takenNames.add(upgraded.name);
    return { ...upgraded, teamId: team.id, wage: driverWageFor(upgraded, team.class) };
  });
  while (drivers.length < DRIVERS_PER_CAR) {
    drivers.push(signDriverTo(generateRookie(takenNames), team, 2));
  }
  return drivers;
};

// Save 3.x no formato da 4.0
const legacyTo40 = raw => {
  const takenNames = new Set();
  const legacy = raw.playerTeam;
  const cls = legacy.class || raw.activeSeries || "HYPERCAR";
  const playerTeam = {
    ...legacy,
    class: cls,
    color: legacy.color || PLAYER_COLORS[0],
    number: legacy.number || "17",
    stats: { wins: 0, podiums: 0, poles: 0, ...legacy.stats },
    reputation: legacy.reputation ?? SERIES_CONFIG[cls].startReputation + Math.min(40, (legacy.careerWins || 0) * 2 + (legacy.championships || 0) * 10),
    facilities: legacy.facilities || defaultFacilities(),
    staff: legacy.staff || defaultStaff(),
    ledger: legacy.ledger || [],
    sponsors: (legacy.sponsors || []).map(contract => ({
      ...contract,
      goalPosition: contract.goalPosition ?? (typeof contract.goal === "number" ? contract.goal : sponsorGoal(contract, cls)),
      bonus: contract.bonus ?? 0,
      maxRandom: contract.maxRandom ?? (contract.type === "GAMBLE" ? Math.floor(800000 * econ(cls)) : 0)
    }))
  };
  playerTeam.drivers = upgradeTeamDrivers(playerTeam, takenNames);
  const aiTeams = (raw.aiTeams || []).map(team => {
    const names = TEAM_NAMES[team.class] || [];
    const index = Math.max(0, names.indexOf(team.name));
    const tier = team.tier ?? aiTier(index);
    const cfg = SERIES_CONFIG[team.class];
    const next = {
      ...team,
      color: team.color || TEAM_DETAILS[team.name]?.color || "#9ca3af",
      number: team.number || TEAM_DETAILS[team.name]?.numbers?.[0] || String(40 + index),
      tier,
      stats: { wins: 0, podiums: 0, poles: 0, ...team.stats },
      support: team.support ?? Math.floor(AI_TIERS[tier].support * cfg.economy),
      annualBudget: team.annualBudget ?? Math.floor(AI_TIERS[tier].annual * cfg.economy),
      reputation: team.reputation ?? 85 - tier * 15
    };
    next.drivers = upgradeTeamDrivers(next, takenNames);
    return next;
  });
  const driversPool = (raw.driversPool || []).map(driver => {
    const upgraded = upgradeLegacyDriver(driver);
    takenNames.add(upgraded.name);
    return { ...upgraded, teamId: null, contractYears: 0 };
  });
  const archive = raw.archive || { history: [], currentSeasonRaces: [] };
  const history = archive.history || [];
  // No original, o save do fim de temporada ficava com raceIndex na última etapa (e a repetia ao carregar)
  const raceIndex = Math.min(TRACKS.length, Math.max(raw.raceIndex || 0, (archive.currentSeasonRaces || []).length));
  return {
    season: raw.season || 2025,
    playerTeam,
    aiTeams,
    driversPool,
    staffMarket: raw.staffMarket || generateStaffMarket(),
    raceIndex,
    archive: { history, currentSeasonRaces: archive.currentSeasonRaces || [] },
    newsFeed: raw.newsFeed || [],
    career: {
      difficulty: "CLASSIC",
      bopEnabled: true,
      confidence: 60,
      seasonsCompleted: history.length,
      startSeason: (raw.season || 2025) - history.length
    },
    settings: { ...DEFAULT_SETTINGS }
  };
};

const statsOf = item => ({ wins: 0, podiums: 0, poles: 0, ...item?.stats });

// Save 4.0/4.1 (cada equipe = um carro; o jogador com carro principal e talvez um segundo carro)
const from41 = old => {
  const takenNames = new Set([...(old.driversPool || []), ...[old.playerTeam, old.sisterTeam, ...(old.aiTeams || [])].filter(Boolean).flatMap(t => t.drivers || [])].map(d => d.name));
  const usedNumbers = new Set();
  const entries = [];
  const notes = [];
  const toEntry = (teamId, source) => {
    const number = usedNumbers.has(String(source.number)) ? String(Number(source.number) + 100) : String(source.number);
    usedNumbers.add(number);
    const entry = newEntry(teamId, source.class, number);
    entry.points = source.points || 0;
    entry.stats = statsOf(source);
    entry.drivers = (source.drivers || []).map(driver => ({ ...driver, teamId, entryId: entry.id }));
    return entry;
  };
  // Equipe do jogador
  const legacyPlayer = old.playerTeam;
  const playerCars = [legacyPlayer, old.sisterTeam].filter(Boolean);
  const programs = {};
  playerCars.forEach(source => {
    const cls = source.class;
    if (!programs[cls]) {
      programs[cls] = { ...newProgram({ ...source.car }), devTokens: source.devTokens ?? null, points: 0, stats: statsOf() };
    }
    const program = programs[cls];
    // Pontos de equipe: soma dos carros
    program.points += source.points || 0;
    ["wins", "podiums", "poles"].forEach(key => {
      program.stats[key] = Math.max(program.stats[key], statsOf(source)[key]);
    });
    entries.push(toEntry(PLAYER_ID, source));
  });
  const playerTeam = {
    id: PLAYER_ID,
    name: legacyPlayer.name,
    color: legacyPlayer.color || PLAYER_COLORS[0],
    funds: legacyPlayer.funds,
    sponsors: legacyPlayer.sponsors || [],
    championships: legacyPlayer.championships || 0,
    careerWins: legacyPlayer.careerWins || 0,
    reputation: legacyPlayer.reputation ?? 30,
    facilities: legacyPlayer.facilities || defaultFacilities(),
    staff: legacyPlayer.staff || defaultStaff(),
    ledger: legacyPlayer.ledger || [],
    programs
  };
  // Na LMGT3 a equipe precisa de dois carros
  if (programs.LMGT3 && entries.filter(entry => entry.class === "LMGT3").length < 2) {
    const entry = newEntry(PLAYER_ID, "LMGT3", freeNumber({ entries }, "72"));
    entry.drivers = lineupFor(entry, 68, takenNames);
    entries.push(entry);
    notes.push(`Regra nova da LMGT3: a equipe agora inscreve dois carros. O #${entry.number} estreia com pilotos novos.`);
  }
  // Equipes da IA
  const teams = (old.aiTeams || []).map(source => {
    const tier = source.tier ?? 2;
    const team = {
      id: source.id,
      name: source.name,
      class: source.class,
      color: source.color || TEAM_DETAILS[source.name]?.color || "#9ca3af",
      tier,
      ai: source.program?.investment ? source.program : createAiProfile(tier),
      funds: source.funds,
      support: source.support,
      annualBudget: source.annualBudget,
      reputation: source.reputation ?? 85 - tier * 15,
      championships: source.championships || 0,
      careerWins: source.careerWins || 0,
      programs: {
        [source.class]: { ...newProgram({ ...source.car }), devTokens: source.devTokens ?? null, points: source.points || 0, stats: statsOf(source) }
      }
    };
    entries.push(toEntry(team.id, source));
    if (source.class === "LMGT3") {
      const entry = newEntry(team.id, "LMGT3", freeNumber({ entries }, Number(source.number) + 1));
      const level = Math.round((source.drivers || []).reduce((sum, d) => sum + d.rating, 0) / Math.max(1, (source.drivers || []).length)) || 70;
      entry.drivers = lineupFor(entry, level, takenNames);
      entries.push(entry);
    }
    return team;
  });
  const history = (old.archive?.history || []).map(season => ({
    ...season,
    standings: (season.standings || []).map(row => (row.id === "player2" ? { ...row, id: PLAYER_ID } : row))
  }));
  let game = {
    version: GAME_VERSION,
    season: old.season || 2025,
    playerTeam,
    teams,
    entries,
    driversPool: (old.driversPool || []).map(driver => ({ ...driver, teamId: null, entryId: null })),
    staffMarket: old.staffMarket || generateStaffMarket(),
    raceIndex: old.raceIndex || 0,
    archive: { history, currentSeasonRaces: old.archive?.currentSeasonRaces || [] },
    newsFeed: [
      ...(notes.length
        ? [{ id: generateId(), type: "NEWS", source: "WEC Official", title: "Novas regras de inscrição", body: notes.join(" "), date: "Atualização", read: false, importance: "HIGH", tags: ["REGULAMENTO"] }]
        : []),
      ...(old.newsFeed || [])
    ],
    career: {
      difficulty: old.career?.difficulty || "NORMAL",
      bopEnabled: old.career?.bopEnabled !== false,
      confidence: old.career?.confidence ?? 60,
      seasonsCompleted: old.career?.seasonsCompleted || 0,
      startSeason: old.career?.startSeason || old.season || 2025,
      promotions: old.career?.promotions || 0,
      objectives: {}
    },
    settings: { ...DEFAULT_SETTINGS, ...old.settings }
  };
  game = withHomologation(game);
  game.career.objectives = playerObjectives(game);
  return game;
};

// Save 4.2: completa o que faltar
const normalizeSave = raw => {
  let game = {
    ...raw,
    teams: (raw.teams || []).map(team => (team.ai ? team : { ...team, ai: createAiProfile(team.tier ?? 2) })),
    archive: { history: [], currentSeasonRaces: [], ...raw.archive },
    career: { objectives: {}, ...raw.career },
    settings: { ...DEFAULT_SETTINGS, ...raw.settings }
  };
  if (Object.values(game.playerTeam.programs || {}).some(program => program.devTokens == null)) {
    game = withHomologation(game);
  }
  return game;
};

export const migrateSave = raw => {
  if (!raw || !raw.playerTeam) {
    throw new Error("Save inválido");
  }
  if (raw.version === GAME_VERSION) {
    return normalizeSave(raw);
  }
  if (raw.version === "4.0" || raw.version === "4.1") {
    return from41(raw);
  }
  return from41(legacyTo40(raw));
};
