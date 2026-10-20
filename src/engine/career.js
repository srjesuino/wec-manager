import { DIFFICULTIES } from "../data/constants.js";
import { clamp } from "../utils/helpers.js";
import { carPerformance } from "./race.js";
import { classTeams, computeBop } from "./weekend.js";
import { isPlayerId, playerEntries, SISTER_ID } from "./team.js";

// Classificação por pontos, com desempate por vitórias e pódios
export const sortStandings = teams =>
  [...teams].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if ((b.stats?.wins || 0) !== (a.stats?.wins || 0)) {
      return (b.stats?.wins || 0) - (a.stats?.wins || 0);
    }
    return (b.stats?.podiums || 0) - (a.stats?.podiums || 0);
  });

export const classStandings = (game, cls) => sortStandings(classTeams(game, cls));

// Posição de um dos carros do jogador no campeonato da sua classe (padrão: carro principal)
export const playerStanding = (game, entry = game.playerTeam) => classStandings(game, entry.class).findIndex(team => team.id === entry.id) + 1;

// Objetivo da diretoria de cada carro
export const objectiveFor = (game, entry) => (entry?.id === SISTER_ID ? game.career.objective2 : game.career.objective);

// Força estimada (carro + BoP + pilotos) para prever o lugar da equipe na classe
export const teamStrength = (team, bop = 0) =>
  carPerformance(team.car) +
  bop * 12 +
  team.car.reliability * 0.15 +
  (team.drivers.reduce((sum, driver) => sum + driver.rating, 0) / team.drivers.length) * 0.6;

// Lugar previsto pela diretoria (o jogador ganha um pequeno bônus pelo trabalho de setup)
export const expectedRank = (game, entry = game.playerTeam) => {
  const teams = classTeams(game, entry.class);
  const bop = game.career?.bopEnabled !== false ? computeBop(teams, "balanced") : {};
  const strength = team => teamStrength(team, bop[team.id] || 0) + (isPlayerId(team.id) ? 6 : 0);
  const sorted = [...teams].sort((a, b) => strength(b) - strength(a));
  return sorted.findIndex(team => team.id === entry.id) + 1;
};

// Objetivo da diretoria para a temporada: o previsto pelo carro, e depois de uma temporada,
// pelo menos repetir (Fácil) ou melhorar em uma posição (Normal/Clássico) o resultado anterior
export const createObjective = (game, lastPosition = null, entry = game.playerTeam) => {
  const size = classTeams(game, entry.class).length;
  const difficulty = game.career.difficulty;
  const shift = { EASY: -1, NORMAL: 0, CLASSIC: 1 }[difficulty] ?? 0;
  const expected = expectedRank(game, entry) - shift;
  let position = expected;
  // Depois de uma temporada a diretoria quer repetir (Fácil) ou melhorar uma posição (Normal/Clássico),
  // mas nunca mais de 2 posições acima do que o carro promete
  if (lastPosition) {
    position = Math.max(Math.min(position, lastPosition > 1 && difficulty !== "EASY" ? lastPosition - 1 : lastPosition), expected - 2);
  }
  position = clamp(position, 1, size - 1);
  return {
    position,
    text: position === 1 ? "Conquistar o título da classe" : `Terminar o campeonato no Top ${position} da classe`
  };
};

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

// Avaliação de um carro: objetivo cumprido, quase ou longe
const entryVerdict = (position, objective) => {
  if (position <= objective.position) {
    return { met: true, delta: 15, budgetFactor: 1.15, tone: "good" };
  }
  if (position <= objective.position + 2) {
    return { met: false, delta: -5, budgetFactor: 1, tone: "warn" };
  }
  return { met: false, delta: -25, budgetFactor: 0.85, tone: "danger", failed: true };
};

// Avaliação de fim de temporada (com dois carros, o segundo pesa 60% na confiança e no orçamento)
export const seasonReview = game => {
  const difficulty = DIFFICULTIES[game.career.difficulty] || DIFFICULTIES.NORMAL;
  const entries = playerEntries(game)
    .map(entry => {
      const objective = objectiveFor(game, entry);
      if (!objective) {
        return null;
      }
      const position = playerStanding(game, entry);
      const verdict = entryVerdict(position, objective);
      const delta = verdict.failed ? -Math.round(25 * difficulty.confidenceMult) : verdict.delta;
      return { id: entry.id, number: entry.number, class: entry.class, name: entry.name, position, objective, ...verdict, delta };
    })
    .filter(Boolean);
  const [main, second] = entries;
  const weight = second ? 0.6 : 0;
  const delta = Math.round(main.delta + (second?.delta ?? 0) * weight);
  const budgetFactor = Math.round(((main.budgetFactor + (second?.budgetFactor ?? 0) * weight) / (1 + weight)) * 100) / 100;
  const allMet = entries.every(entry => entry.met);
  const anyMet = entries.some(entry => entry.met);
  let verdict;
  let tone;
  if (allMet) {
    verdict = second
      ? "A diretoria está radiante: os dois carros cumpriram as metas! Orçamento ampliado para a próxima temporada."
      : "A diretoria está muito satisfeita: objetivo cumprido! Orçamento ampliado para a próxima temporada.";
    tone = "good";
  } else if (second && anyMet) {
    verdict = `Temporada dividida: ${main.met ? `o #${main.number}` : `o #${second.number}`} cumpriu a meta, mas o outro carro ficou devendo.`;
    tone = "warn";
  } else if (entries.every(entry => !entry.failed)) {
    verdict = "Objetivo não alcançado por pouco. A diretoria espera evolução no próximo ano.";
    tone = "warn";
  } else {
    verdict = "Temporada decepcionante. A diretoria cortou parte do orçamento.";
    tone = "danger";
  }
  const confidence = clamp(game.career.confidence + delta, 0, 100);
  const fired = difficulty.canBeFired && confidence <= 0;
  return {
    position: main.position,
    objective: main.objective,
    met: main.met,
    entries,
    delta,
    confidence,
    budgetFactor,
    verdict: fired ? "A diretoria perdeu a paciência. Você foi demitido do comando da equipe." : verdict,
    tone: fired ? "danger" : tone,
    fired
  };
};

// Convite para subir da LMGT3 para a Hypercar
// (no programa duplo a equipe já está na Hypercar; com dois GT3, vale o melhor carro)
export const promotionOffer = (game, position) => {
  if (game.playerTeam.class !== "LMGT3" || (game.sisterTeam && game.sisterTeam.class !== "LMGT3")) {
    return false;
  }
  const best = Math.min(position, ...(game.sisterTeam ? [playerStanding(game, game.sisterTeam)] : []));
  return best === 1 || (best <= 3 && game.playerTeam.reputation >= 55);
};
