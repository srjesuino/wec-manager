import { DIFFICULTIES } from "../data/constants.js";
import { clamp } from "../utils/helpers.js";
import { carPerformance } from "./race.js";
import { classTeams, computeBop } from "./weekend.js";

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

export const playerStanding = game =>
  classStandings(game, game.playerTeam.class).findIndex(team => team.id === game.playerTeam.id) + 1;

// Força estimada (carro + BoP + pilotos) para prever o lugar da equipe na classe
export const teamStrength = (team, bop = 0) =>
  carPerformance(team.car) +
  bop * 12 +
  team.car.reliability * 0.15 +
  (team.drivers.reduce((sum, driver) => sum + driver.rating, 0) / team.drivers.length) * 0.6;

// Lugar previsto pela diretoria (o jogador ganha um pequeno bônus pelo trabalho de setup)
export const expectedRank = game => {
  const teams = classTeams(game, game.playerTeam.class);
  const bop = game.career?.bopEnabled !== false ? computeBop(teams, "balanced") : {};
  const strength = team => teamStrength(team, bop[team.id] || 0) + (team.id === game.playerTeam.id ? 6 : 0);
  const sorted = [...teams].sort((a, b) => strength(b) - strength(a));
  return sorted.findIndex(team => team.id === game.playerTeam.id) + 1;
};

// Objetivo da diretoria para a temporada: o previsto pelo carro, e depois de uma temporada,
// pelo menos repetir (Fácil) ou melhorar em uma posição (Normal/Clássico) o resultado anterior
export const createObjective = (game, lastPosition = null) => {
  const size = classTeams(game, game.playerTeam.class).length;
  const difficulty = game.career.difficulty;
  const shift = { EASY: -1, NORMAL: 0, CLASSIC: 1 }[difficulty] ?? 0;
  let position = expectedRank(game) - shift;
  if (lastPosition) {
    position = Math.min(position, lastPosition > 1 && difficulty !== "EASY" ? lastPosition - 1 : lastPosition);
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

// Avaliação de fim de temporada
export const seasonReview = game => {
  const position = playerStanding(game);
  const objective = game.career.objective;
  const difficulty = DIFFICULTIES[game.career.difficulty] || DIFFICULTIES.NORMAL;
  let delta;
  let budgetFactor;
  let verdict;
  let tone;
  if (position <= objective.position) {
    delta = 15;
    budgetFactor = 1.15;
    verdict = "A diretoria está muito satisfeita: objetivo cumprido! Orçamento ampliado para a próxima temporada.";
    tone = "good";
  } else if (position <= objective.position + 2) {
    delta = -5;
    budgetFactor = 1;
    verdict = "Objetivo não alcançado por pouco. A diretoria espera evolução no próximo ano.";
    tone = "warn";
  } else {
    delta = -Math.round(25 * difficulty.confidenceMult);
    budgetFactor = 0.85;
    verdict = "Temporada decepcionante. A diretoria cortou parte do orçamento.";
    tone = "danger";
  }
  const confidence = clamp(game.career.confidence + delta, 0, 100);
  const fired = difficulty.canBeFired && confidence <= 0;
  return {
    position,
    objective,
    met: position <= objective.position,
    delta,
    confidence,
    budgetFactor,
    verdict: fired ? "A diretoria perdeu a paciência. Você foi demitido do comando da equipe." : verdict,
    tone: fired ? "danger" : tone,
    fired
  };
};

// Convite para subir da LMGT3 para a Hypercar
export const promotionOffer = (game, position) =>
  game.playerTeam.class === "LMGT3" && (position === 1 || (position <= 3 && game.playerTeam.reputation >= 55));
