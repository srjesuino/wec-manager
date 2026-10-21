import { AI_TIERS, CLASS_RULES, TEAM_NAMES, TEAM_DETAILS } from "../data/constants.js";
import { clamp } from "../utils/helpers.js";
import { carPerformance } from "./race.js";
import { homologationTokens, MAIN_PARTS } from "./economy.js";
import { INVESTMENT_RANGE, ENGINEERING_RANGE, profileOf } from "./ai.js";
import { createAiTeam, lineupFor, newEntry } from "./newGame.js";
import { PLAYER_ID, classPrograms, teamById, teamEntries, usedNumbers } from "./team.js";

// ---------------------------------------------------------------------------
// Editor de grid (sandbox): o jogador cria, edita e exclui equipes da IA
// Todas as funções devolvem { game, error } — com erro, o jogo volta igual.
// ---------------------------------------------------------------------------

export const SANDBOX_TIERS = AI_TIERS.map(tier => ({ id: tier.id, label: tier.label }));

const average = list => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0);

// Nível de carro sugerido para uma equipe nova: média das equipes da IA da classe, ajustada pelo perfil
export const suggestedCarLevel = (game, cls, tier = 2) => {
  const cars = classPrograms(game, cls)
    .filter(row => row.team.id !== PLAYER_ID)
    .map(row => average(MAIN_PARTS.map(part => row.program.car[part])));
  const base = cars.length ? average(cars) : 60;
  return clamp(Math.round(base + [4, 0, -6][tier]), 20, 99);
};

// Nomes conhecidos que ainda não estão no grid
export const unusedTeamNames = (game, cls) => {
  const used = new Set(game.teams.map(team => team.name.toLowerCase()));
  return TEAM_NAMES[cls].filter(name => !used.has(name.toLowerCase()));
};

const nameTaken = (game, name, exceptId = null) => {
  const wanted = name.trim().toLowerCase();
  return [game.playerTeam, ...game.teams].some(team => team.id !== exceptId && team.name.trim().toLowerCase() === wanted);
};

// Resumo de cada equipe da classe para a tela do editor
export const sandboxRows = (game, cls) =>
  classPrograms(game, cls).map(row => ({
    ...row,
    isPlayer: row.team.id === PLAYER_ID,
    carPerformance: Math.round(carPerformance(row.program.car)),
    driversRating: Math.round(average(row.entries.flatMap(entry => entry.drivers.map(driver => driver.rating)))),
    profile: row.team.id === PLAYER_ID ? null : profileOf(row.team)
  }));

// Fichas de homologação de um programa novo (comparado ao resto da classe)
const withTokens = (game, team, cls) => {
  const cars = classPrograms(game, cls).map(row => row.program.car);
  const program = team.programs[cls];
  return { ...team, programs: { ...team.programs, [cls]: { ...program, devTokens: homologationTokens(program.car, [...cars, program.car], false) } } };
};

// options: { name, cls, color, cars, tier, numbers: [..], investment, engineering, carLevel }
export const sandboxCreateTeam = (game, options) => {
  const cls = options.cls;
  const rules = CLASS_RULES[cls];
  const name = (options.name || "").trim();
  if (!rules) {
    return { game, error: "Classe inválida." };
  }
  if (!name) {
    return { game, error: "Dê um nome para a equipe." };
  }
  if (nameTaken(game, name)) {
    return { game, error: "Já existe uma equipe com esse nome." };
  }
  const cars = Number(options.cars ?? rules.minCars);
  if (cars < rules.minCars || cars > rules.maxCars) {
    return { game, error: rules.minCars === rules.maxCars ? `Na ${rules.label} a equipe inscreve ${rules.minCars} carros.` : `Na ${rules.label} a equipe tem de ${rules.minCars} a ${rules.maxCars} carros.` };
  }
  const used = usedNumbers(game);
  const numbers = (options.numbers || []).map(value => String(value).trim()).filter(Boolean);
  if (numbers.some(value => used.has(value)) || new Set(numbers).size !== numbers.length) {
    return { game, error: "Número de carro já usado no grid." };
  }
  const tier = clamp(Number(options.tier ?? 2), 0, 2);
  const ai = {
    investment: clamp(Number(options.investment ?? AI_TIERS[tier].investment), ...INVESTMENT_RANGE),
    engineering: clamp(Number(options.engineering ?? AI_TIERS[tier].engineering), ...ENGINEERING_RANGE)
  };
  const takenNames = new Set([...game.driversPool, ...game.entries.flatMap(entry => entry.drivers)].map(driver => driver.name));
  const created = createAiTeam(cls, name, {
    tier,
    cars,
    numbers: numbers.length ? numbers : TEAM_DETAILS[name]?.numbers,
    usedNumbers: used,
    takenNames,
    color: options.color,
    ai,
    carLevel: options.carLevel != null ? clamp(Number(options.carLevel), 20, 99) : suggestedCarLevel(game, cls, tier),
    custom: true
  });
  const team = withTokens(game, created.team, cls);
  return { game: { ...game, teams: [...game.teams, team], entries: [...game.entries, ...created.entries] }, team, error: null };
};

// patch: { name, color, cars, investment, engineering, numbers: { [idDoCarro]: número }, carLevel }
export const sandboxUpdateTeam = (game, teamId, patch) => {
  if (teamId === PLAYER_ID) {
    return { game, error: "A sua equipe é gerida na virada da temporada." };
  }
  const team = teamById(game, teamId);
  if (!team) {
    return { game, error: "Equipe não encontrada." };
  }
  const cls = team.class;
  const rules = CLASS_RULES[cls];
  let next = { ...team };
  if (patch.name != null) {
    const name = patch.name.trim();
    if (!name) {
      return { game, error: "Dê um nome para a equipe." };
    }
    if (nameTaken(game, name, teamId)) {
      return { game, error: "Já existe uma equipe com esse nome." };
    }
    next.name = name;
  }
  if (patch.color) {
    next.color = patch.color;
  }
  if (patch.investment != null || patch.engineering != null) {
    const profile = profileOf(team);
    next.ai = {
      ...profile,
      investment: clamp(Number(patch.investment ?? profile.investment), ...INVESTMENT_RANGE),
      engineering: clamp(Number(patch.engineering ?? profile.engineering), ...ENGINEERING_RANGE)
    };
  }
  if (patch.carLevel != null) {
    const level = clamp(Number(patch.carLevel), 20, 99);
    const program = next.programs[cls];
    const car = { ...program.car };
    ["engine", "aero", "chassis", "efficiency"].forEach(part => {
      car[part] = level;
    });
    next.programs = { ...next.programs, [cls]: { ...program, car } };
  }
  let entries = game.entries;
  let pool = game.driversPool;
  // Números dos carros
  if (patch.numbers) {
    const others = new Set(game.entries.filter(entry => entry.teamId !== teamId).map(entry => String(entry.number)));
    const mine = teamEntries(game, teamId).map(entry => String(patch.numbers[entry.id] ?? entry.number).trim());
    if (mine.some(value => !value || others.has(value)) || new Set(mine).size !== mine.length) {
      return { game, error: "Número de carro já usado no grid." };
    }
    entries = entries.map(entry => (entry.teamId === teamId && patch.numbers[entry.id] != null ? { ...entry, number: String(patch.numbers[entry.id]).trim() } : entry));
  }
  // Quantidade de carros (só a Hypercar permite 1 ou 2)
  if (patch.cars != null) {
    const target = Number(patch.cars);
    if (target < rules.minCars || target > rules.maxCars) {
      return { game, error: rules.minCars === rules.maxCars ? `Na ${rules.label} a equipe inscreve ${rules.minCars} carros.` : `Na ${rules.label} a equipe tem de ${rules.minCars} a ${rules.maxCars} carros.` };
    }
    let mine = entries.filter(entry => entry.teamId === teamId);
    while (mine.length > target) {
      const removed = mine[mine.length - 1];
      pool = [...pool, ...removed.drivers.map(driver => ({ ...driver, teamId: null, entryId: null, contractYears: 0 }))];
      entries = entries.filter(entry => entry.id !== removed.id);
      mine = mine.slice(0, -1);
    }
    if (mine.length < target) {
      const takenNames = new Set([...pool, ...entries.flatMap(entry => entry.drivers)].map(driver => driver.name));
      const level = Math.round(average(mine.flatMap(entry => entry.drivers.map(driver => driver.rating)))) || 70;
      const taken = new Set(entries.map(entry => String(entry.number)));
      for (let i = mine.length; i < target; i++) {
        let number = String((parseInt(mine[0]?.number, 10) || 40) + 1);
        while (taken.has(number)) {
          number = String((parseInt(number, 10) % 998) + 1);
        }
        taken.add(number);
        const entry = newEntry(teamId, cls, number);
        entry.drivers = lineupFor(entry, level, takenNames);
        entries = [...entries, entry];
      }
    }
  }
  return {
    game: { ...game, teams: game.teams.map(item => (item.id === teamId ? next : item)), entries, driversPool: pool },
    error: null
  };
};

export const sandboxDeleteTeam = (game, teamId) => {
  if (teamId === PLAYER_ID) {
    return { game, error: "Você não pode excluir a sua própria equipe." };
  }
  const team = teamById(game, teamId);
  if (!team) {
    return { game, error: "Equipe não encontrada." };
  }
  const cars = teamEntries(game, teamId);
  return {
    game: {
      ...game,
      teams: game.teams.filter(item => item.id !== teamId),
      entries: game.entries.filter(entry => entry.teamId !== teamId),
      driversPool: [...game.driversPool, ...cars.flatMap(entry => entry.drivers.map(driver => ({ ...driver, teamId: null, entryId: null, contractYears: 0 })))]
    },
    error: null
  };
};
