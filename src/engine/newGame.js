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
  TRACKS
} from "../data/constants.js";
import { clamp, randInt, generateDriver, generateRookie, generateStaff, upgradeLegacyDriver } from "../utils/helpers.js";
import { generateSeasonStartNews } from "../utils/mediaEngine.js";
import { signDriverTo } from "./drivers.js";
import { driverWageFor, sponsorGoal, econ, secondCarStartBudget } from "./economy.js";
import { createObjective } from "./career.js";
import { SISTER_ID } from "./team.js";

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

const aiTier = index => (index < 3 ? 0 : index < 6 ? 1 : 2);

// Equipe da IA: o índice define o nível (como no original: 3 de ponta, 3 de fábrica, o resto privadas)
export const createAiTeam = (cls, name, index, takenNames, id = `${cls.toLowerCase()}_ai_${index}`) => {
  const cfg = SERIES_CONFIG[cls];
  const tier = aiTier(index);
  const tierData = AI_TIERS[tier];
  const level = cfg.aiLevels[tier];
  const offset = () => Math.floor(Math.random() * 6) - 3;
  const part = () => clamp(level + offset(), 30, 99);
  const team = {
    id,
    name,
    class: cls,
    series: cls,
    color: TEAM_DETAILS[name]?.color ?? "#9ca3af",
    number: TEAM_DETAILS[name]?.number ?? String(40 + index),
    tier,
    funds: cfg.budget * tierData.fundsMult,
    points: 0,
    stats: { wins: 0, podiums: 0, poles: 0 },
    car: {
      engine: part(),
      aero: part(),
      chassis: part(),
      reliability: 80 + offset(),
      efficiency: part(),
      crew: part()
    },
    drivers: [],
    sponsors: [],
    championships: 0,
    careerWins: 0,
    support: Math.floor(tierData.support * cfg.economy),
    annualBudget: Math.floor(tierData.annual * cfg.economy),
    reputation: 85 - tier * 15,
    bop: 0
  };
  team.drivers = Array.from({ length: DRIVERS_PER_CAR }, () => signDriverTo(generateDriver(level - 5, level + 5, null, takenNames), team, randInt(1, 3)));
  return team;
};

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

const createPlayerTeam = ({ teamName, series, color, number, difficulty }, takenNames) => {
  const cfg = SERIES_CONFIG[series];
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.NORMAL;
  const team = {
    id: "player",
    name: teamName || "My Racing Team",
    class: series,
    series,
    color: color || PLAYER_COLORS[0],
    number: number || "17",
    funds: Math.floor(cfg.budget * diff.budgetMult),
    points: 0,
    stats: { wins: 0, podiums: 0, poles: 0 },
    car: freshPlayerCar(difficulty),
    drivers: [],
    sponsors: [],
    championships: 0,
    careerWins: 0,
    reputation: cfg.startReputation,
    facilities: defaultFacilities(),
    staff: defaultStaff(),
    ledger: [],
    bop: 0
  };
  team.drivers = Array.from({ length: DRIVERS_PER_CAR }, () => signDriverTo(generateDriver(65, 75, null, takenNames), team, randInt(1, 3)));
  return team;
};

// Nome padrão do segundo carro
export const defaultSisterName = (teamName, sameClass) => `${teamName || "My Racing Team"} ${sameClass ? "B" : "GT"}`;

export const nextCarNumber = number => String(((parseInt(number, 10) || 17) + 1) % 1000);

// Segundo carro do jogador: mesma organização, carro e pilotos próprios
export const createSisterTeam = (playerTeam, cls, { difficulty = "NORMAL", name, number, takenNames = new Set(), rookies = false } = {}) => {
  const team = {
    id: SISTER_ID,
    name: name || defaultSisterName(playerTeam.name, cls === playerTeam.class),
    class: cls,
    series: cls,
    color: playerTeam.color,
    number: number || nextCarNumber(playerTeam.number),
    points: 0,
    stats: { wins: 0, podiums: 0, poles: 0 },
    // Mesma classe = mesmo projeto do carro principal
    car: cls === playerTeam.class ? { ...playerTeam.car } : freshPlayerCar(difficulty),
    drivers: [],
    championships: 0,
    careerWins: 0,
    bop: 0
  };
  team.drivers = Array.from({ length: DRIVERS_PER_CAR }, () =>
    signDriverTo(rookies ? generateRookie(takenNames) : generateDriver(62, 72, null, takenNames), team, randInt(1, 3))
  );
  return team;
};

// Tira da lista os nomes de equipe da IA que dão lugar aos carros do jogador
const aiNamesFor = (cls, playerCars) => {
  const names = [...TEAM_NAMES[cls]];
  for (let i = 0; i < playerCars; i++) {
    names.pop();
  }
  return names;
};

export const createNewGame = ({
  teamName,
  series,
  color,
  number,
  difficulty = "NORMAL",
  bopEnabled = true,
  season = 2025,
  program = "SINGLE",
  sisterName,
  sisterNumber
}) => {
  const takenNames = new Set();
  // No programa duplo o carro principal é o Hypercar e o segundo carro corre na LMGT3
  const mainClass = program === "DUAL_CLASS" ? "HYPERCAR" : series;
  const playerTeam = createPlayerTeam({ teamName, series: mainClass, color, number, difficulty }, takenNames);
  let sisterTeam = null;
  if (program === "SAME_CLASS" || program === "DUAL_CLASS") {
    const sisterClass = program === "DUAL_CLASS" ? "LMGT3" : mainClass;
    sisterTeam = createSisterTeam(playerTeam, sisterClass, { difficulty, name: sisterName, number: sisterNumber, takenNames });
    const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.NORMAL;
    playerTeam.funds += Math.floor(secondCarStartBudget(sisterClass) * diff.budgetMult);
  }
  const carsIn = cls => [playerTeam, sisterTeam].filter(team => team?.class === cls).length;
  const hyperNames = aiNamesFor("HYPERCAR", carsIn("HYPERCAR"));
  const gt3Names = aiNamesFor("LMGT3", carsIn("LMGT3"));
  const aiTeams = [
    ...hyperNames.map((name, index) => createAiTeam("HYPERCAR", name, index, takenNames)),
    ...gt3Names.map((name, index) => createAiTeam("LMGT3", name, index, takenNames))
  ];
  const driversPool = [
    ...Array.from({ length: 25 }, () => ({ ...generateDriver(60, 95, null, takenNames), contractYears: 0 })),
    ...Array.from({ length: 5 }, () => generateRookie(takenNames))
  ];
  const game = {
    version: GAME_VERSION,
    season,
    playerTeam,
    sisterTeam,
    aiTeams,
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
      objective: null,
      objective2: null,
      seasonsCompleted: 0,
      startSeason: season
    },
    settings: { ...DEFAULT_SETTINGS }
  };
  game.career.objective = createObjective(game);
  game.career.objective2 = sisterTeam ? createObjective(game, null, sisterTeam) : null;
  game.newsFeed = generateSeasonStartNews(season, playerTeam, game.career.objective, sisterTeam);
  return game;
};

// ---------------------------------------------------------------------------
// Saves antigos (v3.x): completa os dados que não existiam
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

// Saves da 4.x: completa os campos novos (segundo carro)
const normalizeSave = raw => {
  const game = {
    ...raw,
    version: GAME_VERSION,
    sisterTeam: raw.sisterTeam || null,
    archive: { history: [], currentSeasonRaces: [], ...raw.archive },
    career: { objective2: null, ...raw.career },
    settings: { ...DEFAULT_SETTINGS, ...raw.settings }
  };
  if (game.sisterTeam && !game.career.objective2) {
    game.career.objective2 = createObjective(game, null, game.sisterTeam);
  }
  return game;
};

export const migrateSave = raw => {
  if (!raw || !raw.playerTeam) {
    throw new Error("Save inválido");
  }
  if (raw.version === GAME_VERSION || raw.version === "4.0") {
    return normalizeSave(raw);
  }
  const takenNames = new Set();
  const legacy = raw.playerTeam;
  const cls = legacy.class || raw.activeSeries || "HYPERCAR";
  const playerTeam = {
    ...legacy,
    class: cls,
    series: cls,
    color: legacy.color || PLAYER_COLORS[0],
    number: legacy.number || "17",
    stats: { wins: 0, podiums: 0, poles: 0, ...legacy.stats },
    reputation: legacy.reputation ?? SERIES_CONFIG[cls].startReputation + Math.min(40, (legacy.careerWins || 0) * 2 + (legacy.championships || 0) * 10),
    facilities: legacy.facilities || defaultFacilities(),
    staff: legacy.staff || defaultStaff(),
    ledger: legacy.ledger || [],
    bop: 0,
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
      number: team.number || TEAM_DETAILS[team.name]?.number || String(40 + index),
      tier,
      stats: { wins: 0, podiums: 0, poles: 0, ...team.stats },
      support: team.support ?? Math.floor(AI_TIERS[tier].support * cfg.economy),
      annualBudget: team.annualBudget ?? Math.floor(AI_TIERS[tier].annual * cfg.economy),
      reputation: team.reputation ?? 85 - tier * 15,
      bop: 0
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
  const game = {
    version: GAME_VERSION,
    season: raw.season || 2025,
    playerTeam,
    aiTeams,
    driversPool,
    staffMarket: raw.staffMarket || generateStaffMarket(),
    raceIndex,
    sisterTeam: null,
    archive: {
      history,
      currentSeasonRaces: archive.currentSeasonRaces || []
    },
    newsFeed: raw.newsFeed || [],
    career: {
      difficulty: "CLASSIC",
      bopEnabled: true,
      confidence: 60,
      objective: null,
      objective2: null,
      seasonsCompleted: history.length,
      startSeason: (raw.season || 2025) - history.length
    },
    settings: { ...DEFAULT_SETTINGS }
  };
  game.career.objective = createObjective(game);
  return game;
};
