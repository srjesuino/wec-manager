import { CLASSES, CLASS_RULES, SHARED_DEV_MULT, EXTRA_CAR_SPONSOR_BONUS, MAX_SPONSOR_EXPOSURE } from "../data/constants.js";
import { upgradeCost, usesToken } from "./economy.js";

// ---------------------------------------------------------------------------
// Modelo do grid
// equipe (team): organização — nome, cor, caixa, títulos; a do jogador tem fábrica, staff, patrocínios e extrato
// programa (team.programs[classe]): a equipe numa classe — projeto do carro, fichas de homologação, BoP e
//   pontos do campeonato de equipes. A IA corre em uma classe; o jogador pode ter as duas.
// carro (entry, em game.entries): número, pilotos e pontos do carro (campeonato de carros/pilotos)
// ---------------------------------------------------------------------------

export const PLAYER_ID = "player";

export const isPlayerId = id => id === PLAYER_ID;
export const isPlayerEntry = entry => entry?.teamId === PLAYER_ID;

export const allTeams = game => [game.playerTeam, ...game.teams];
export const teamById = (game, id) => (id === PLAYER_ID ? game.playerTeam : game.teams.find(team => team.id === id)) || null;

export const programKey = (teamId, cls) => `${teamId}:${cls}`;
export const teamClasses = team => CLASSES.filter(cls => team?.programs?.[cls]);
export const programOf = (team, cls) => team?.programs?.[cls] || null;

// Classe que define a escala econômica da organização (Hypercar se tiver programa lá)
export const mainClass = team => (team?.programs?.HYPERCAR ? "HYPERCAR" : team?.programs?.LMGT3 ? "LMGT3" : team?.class || "HYPERCAR");

export const entryById = (game, id) => game.entries.find(entry => entry.id === id) || null;
export const teamEntries = (game, teamId, cls = null) =>
  game.entries.filter(entry => entry.teamId === teamId && (!cls || entry.class === cls));
export const classEntries = (game, cls) => game.entries.filter(entry => entry.class === cls);

// Carros do jogador: Hypercar primeiro, depois LMGT3, na ordem em que foram inscritos
export const playerEntries = game =>
  CLASSES.flatMap(cls => game.entries.filter(entry => entry.teamId === PLAYER_ID && entry.class === cls));
export const playerClasses = game => teamClasses(game.playerTeam);
export const playerCarCount = game => playerEntries(game).length;

// Carro com os dados da equipe e do programa (o que o fim de semana, a corrida e as telas usam)
export const entryView = (game, entry) => {
  const team = teamById(game, entry.teamId);
  const program = programOf(team, entry.class);
  return {
    ...entry,
    name: team?.name ?? "?",
    color: team?.color ?? "#9ca3af",
    car: program?.car ?? {},
    bop: program?.bop ?? 0,
    tier: team?.tier,
    isPlayer: entry.teamId === PLAYER_ID
  };
};
export const gridViews = game => game.entries.map(entry => entryView(game, entry));
export const entryLabel = (game, entry) => `${teamById(game, entry.teamId)?.name ?? "?"} #${entry.number}`;

// Programas de uma classe (linhas do campeonato de equipes)
export const classPrograms = (game, cls) =>
  allTeams(game)
    .filter(team => team.programs?.[cls])
    .map(team => ({ key: programKey(team.id, cls), team, program: team.programs[cls], cls, entries: teamEntries(game, team.id, cls) }));

// Números já usados no grid (para inscrever carros novos sem repetir)
export const usedNumbers = game => new Set(game.entries.map(entry => String(entry.number)));
export const freeNumber = (game, preferred = null, extraUsed = []) => {
  const used = new Set([...usedNumbers(game), ...extraUsed.map(String)]);
  if (preferred && !used.has(String(preferred))) {
    return String(preferred);
  }
  let n = parseInt(preferred, 10) || 17;
  for (let i = 0; i < 1000; i++) {
    const candidate = String(((n + i) % 999) + 1);
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return String(n);
};

// ---------------------------------------------------------------------------
// Desenvolvimento (mesmo projeto para todos os carros da equipe na classe)
// ---------------------------------------------------------------------------

export const carsInProgram = (game, teamId, cls) => teamEntries(game, teamId, cls).length;

// Custo de um upgrade no programa: peças para todos os carros (2 carros = +50%)
export const programUpgradeCost = (game, team, cls, part) => {
  const program = programOf(team, cls);
  const base = upgradeCost(cls, program.car, part, team.facilities);
  return Math.floor(base * (carsInProgram(game, team.id, cls) > 1 ? SHARED_DEV_MULT : 1));
};

export const tokensLeft = team => cls => programOf(team, cls)?.devTokens ?? 0;
export const canUseToken = (team, cls, part) => !usesToken(part) || (programOf(team, cls)?.devTokens ?? 0) > 0;

// Bônus de exposição dos patrocinadores por carro extra na pista
export const sponsorExposure = carCount => 1 + Math.min(MAX_SPONSOR_EXPOSURE, Math.max(0, carCount - 1) * EXTRA_CAR_SPONSOR_BONUS);

// Quantidades de carro permitidas por classe
export const allowedCars = cls => {
  const rules = CLASS_RULES[cls];
  return [0, ...Array.from({ length: rules.maxCars - rules.minCars + 1 }, (_, i) => rules.minCars + i)];
};
export const validCarCount = (cls, count) => allowedCars(cls).includes(count);

// Atualiza uma equipe (a do jogador ou da IA)
export const updateTeam = (game, teamId, fn) =>
  teamId === PLAYER_ID ? { ...game, playerTeam: fn(game.playerTeam) } : { ...game, teams: game.teams.map(team => (team.id === teamId ? fn(team) : team)) };

export const updateProgram = (game, teamId, cls, fn) =>
  updateTeam(game, teamId, team => ({ ...team, programs: { ...team.programs, [cls]: fn(team.programs[cls]) } }));

export const updateEntry = (game, entryId, fn) => ({ ...game, entries: game.entries.map(entry => (entry.id === entryId ? fn(entry) : entry)) });
