import { DIFFICULTIES, CLASS_RULES } from "../data/constants.js";
import { clamp } from "../utils/helpers.js";
import { carPerformance } from "./race.js";
import { computeBop } from "./weekend.js";
import { classPrograms, classEntries, entryView, teamClasses, PLAYER_ID } from "./team.js";

// ---------------------------------------------------------------------------
// Campeonatos
// Equipes (por classe): Hypercar conta só o melhor carro de cada equipe; LMGT3 soma os dois carros.
// Carros/pilotos (por classe): cada carro pontua pela sua posição na classe.
// ---------------------------------------------------------------------------

const byPoints = (a, b) => {
  if (b.points !== a.points) {
    return b.points - a.points;
  }
  if ((b.stats?.wins || 0) !== (a.stats?.wins || 0)) {
    return (b.stats?.wins || 0) - (a.stats?.wins || 0);
  }
  return (b.stats?.podiums || 0) - (a.stats?.podiums || 0);
};

// Linhas do campeonato de equipes: { key, team, program, cls, entries, points, stats, isPlayer }
export const teamStandings = (game, cls) =>
  classPrograms(game, cls)
    .map(row => ({ ...row, points: row.program.points || 0, stats: { wins: 0, podiums: 0, poles: 0, ...row.program.stats }, isPlayer: row.team.id === PLAYER_ID }))
    .sort(byPoints);

// Campeonato de carros (cada carro com nome/cor da equipe)
export const carStandings = (game, cls) => classEntries(game, cls).map(entry => entryView(game, entry)).sort(byPoints);

// Posição de um programa do jogador no campeonato de equipes da classe
export const playerStanding = (game, cls) => teamStandings(game, cls).findIndex(row => row.team.id === PLAYER_ID) + 1;

export const objectiveFor = (game, cls) => game.career.objectives?.[cls] || null;

// ---------------------------------------------------------------------------
// Diretoria: metas e avaliação
// ---------------------------------------------------------------------------

// Força estimada de um programa (carro + BoP + pilotos) para prever o lugar da equipe na classe.
// Na Hypercar vale o melhor carro; na LMGT3 a média dos dois.
export const programStrength = (row, bop = 0) => {
  const car = row.program.car;
  const lineups = row.entries.map(entry => entry.drivers.reduce((sum, driver) => sum + driver.rating, 0) / Math.max(1, entry.drivers.length));
  const drivers = lineups.length
    ? CLASS_RULES[row.cls].teamScoring === "BEST_CAR"
      ? Math.max(...lineups)
      : lineups.reduce((sum, value) => sum + value, 0) / lineups.length
    : 60;
  return carPerformance(car) + bop * 12 + car.reliability * 0.15 + drivers * 0.6;
};

// Lugar previsto pela diretoria (o jogador ganha um pequeno bônus pelo trabalho de setup)
export const expectedRank = (game, cls) => {
  const rows = classPrograms(game, cls);
  const bop = game.career?.bopEnabled !== false ? computeBop(game, "balanced") : {};
  const strength = row => programStrength(row, bop[row.key] || 0) + (row.team.id === PLAYER_ID ? 6 : 0);
  return [...rows].sort((a, b) => strength(b) - strength(a)).findIndex(row => row.team.id === PLAYER_ID) + 1;
};

// Meta da temporada para um programa do jogador: o previsto pelo carro e, depois de uma temporada, repetir (Fácil)
// ou melhorar uma posição (Normal/Clássico), mas nunca mais de 2 posições acima do que o carro promete
export const createObjective = (game, cls, lastPosition = null) => {
  const size = classPrograms(game, cls).length;
  const difficulty = game.career.difficulty;
  const shift = { EASY: -1, NORMAL: 0, CLASSIC: 1 }[difficulty] ?? 0;
  const expected = expectedRank(game, cls) - shift;
  let position = expected;
  if (lastPosition) {
    position = Math.max(Math.min(position, lastPosition > 1 && difficulty !== "EASY" ? lastPosition - 1 : lastPosition), expected - 2);
  }
  position = clamp(position, 1, Math.max(1, size - 1));
  const label = CLASS_RULES[cls].label;
  return {
    position,
    text: position === 1 ? `Conquistar o título de equipes da ${label}` : `Terminar no Top ${position} das equipes da ${label}`
  };
};

// Peso de cada classe na confiança e no orçamento: com dois programas a LMGT3 pesa 60%
export const classWeight = (game, cls) => (teamClasses(game.playerTeam).length > 1 && cls === "LMGT3" ? 0.6 : 1);

// result: { finished, classPos (posição da equipe na classe), pole }
export const reputationDelta = (result, classSize, isLeMans, hospitality = 1, objectivePosition = null) => {
  let delta;
  if (!result.finished) {
    delta = -1.5;
  } else if (result.classPos === 1) {
    delta = isLeMans ? 8 : 4;
  } else if (result.classPos <= 3) {
    delta = isLeMans ? 4 : 2;
  } else if (result.classPos <= Math.ceil(classSize / 2)) {
    delta = 1;
  } else if (result.classPos <= Math.ceil(classSize * 0.75)) {
    delta = 0;
  } else {
    delta = -0.5;
  }
  if (result.pole) {
    delta += 1;
  }
  if (result.finished && objectivePosition != null && result.classPos <= objectivePosition) {
    delta += 0.5;
  }
  if (delta > 0) {
    delta *= 1 + (hospitality - 1) * 0.1;
  }
  return Math.round(delta * 10) / 10;
};

export const confidenceRaceDelta = (result, objective, difficulty) => {
  const mult = DIFFICULTIES[difficulty]?.confidenceMult ?? 1;
  if (!result.finished) {
    return -Math.round(3 * mult);
  }
  if (result.classPos <= objective.position) {
    return 2;
  }
  if (result.classPos > objective.position + 3) {
    return -Math.round(2 * mult);
  }
  return 0;
};

// Avaliação de um programa: meta cumprida, quase ou longe
const programVerdict = (position, objective) => {
  if (position <= objective.position) {
    return { met: true, delta: 15, budgetFactor: 1.15, tone: "good" };
  }
  if (position <= objective.position + 2) {
    return { met: false, delta: -5, budgetFactor: 1, tone: "warn" };
  }
  return { met: false, delta: -25, budgetFactor: 0.85, tone: "danger", failed: true };
};

// Avaliação de fim de temporada. O jogador é o dono da equipe: não é demitido.
// Se a confiança do conselho zerar (fora do Fácil), o conselho corta um carro (ou verba) — ver planBoardCut.
export const seasonReview = game => {
  const difficulty = DIFFICULTIES[game.career.difficulty] || DIFFICULTIES.NORMAL;
  const entries = teamClasses(game.playerTeam)
    .map(cls => {
      const objective = objectiveFor(game, cls);
      if (!objective) {
        return null;
      }
      const position = playerStanding(game, cls);
      const verdict = programVerdict(position, objective);
      const delta = verdict.failed ? -Math.round(25 * difficulty.confidenceMult) : verdict.delta;
      return { cls, label: CLASS_RULES[cls].label, position, objective, weight: classWeight(game, cls), ...verdict, delta };
    })
    .filter(Boolean);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const delta = Math.round(entries.reduce((sum, entry) => sum + entry.delta * entry.weight, 0));
  const budgetFactor = Math.round((entries.reduce((sum, entry) => sum + entry.budgetFactor * entry.weight, 0) / totalWeight) * 100) / 100;
  const allMet = entries.every(entry => entry.met);
  const anyMet = entries.some(entry => entry.met);
  let verdict;
  let tone;
  if (allMet) {
    verdict = entries.length > 1
      ? "O conselho está radiante: os dois programas cumpriram as metas! Orçamento ampliado para a próxima temporada."
      : "O conselho está muito satisfeito: meta cumprida! Orçamento ampliado para a próxima temporada.";
    tone = "good";
  } else if (entries.length > 1 && anyMet) {
    const good = entries.find(entry => entry.met);
    verdict = `Temporada dividida: o programa da ${good.label} cumpriu a meta, mas o outro ficou devendo.`;
    tone = "warn";
  } else if (entries.every(entry => !entry.failed)) {
    verdict = "Meta não alcançada por pouco. O conselho espera evolução no próximo ano.";
    tone = "warn";
  } else {
    verdict = "Temporada decepcionante. O conselho cortou parte do orçamento.";
    tone = "danger";
  }
  const confidence = clamp(game.career.confidence + delta, 0, 100);
  const boardCut = !!difficulty.boardCuts && confidence <= 0;
  const main = entries[0];
  return {
    position: main?.position,
    objective: main?.objective,
    met: main?.met,
    entries,
    delta,
    confidence,
    budgetFactor,
    verdict: boardCut ? "O conselho perdeu a paciência: a operação será reduzida na próxima temporada." : verdict,
    tone: boardCut ? "danger" : tone,
    boardCut
  };
};

// Convite do ACO para a Hypercar (para quem só corre na LMGT3)
export const hypercarInvite = game => {
  if (game.playerTeam.programs?.HYPERCAR || !game.playerTeam.programs?.LMGT3) {
    return false;
  }
  const position = playerStanding(game, "LMGT3");
  return position === 1 || (position <= 3 && (game.playerTeam.reputation ?? 0) >= 55);
};
