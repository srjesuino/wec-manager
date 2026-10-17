import { AI_TIERS } from "../data/constants.js";
import { pickRandom } from "../utils/helpers.js";
import { MAIN_PARTS, PART_CAP, UPGRADE_STEP, econ, upgradeCost } from "./economy.js";

// Escolhe a peça a evoluir: confiabilidade primeiro se estiver baixa, depois o ponto fraco do carro
const choosePart = team => {
  if (team.car.reliability < 75) {
    return "reliability";
  }
  if (Math.random() < 0.65) {
    return MAIN_PARTS.reduce((lowest, part) => (team.car[part] < team.car[lowest] ? part : lowest), MAIN_PARTS[0]);
  }
  return pickRandom(["efficiency", "crew", "reliability", ...MAIN_PARTS]);
};

// A IA compra upgrades com o mesmo custo do jogador, mantendo uma reserva de caixa
export const developAiTeam = (team, maxUpgrades = 2) => {
  const tier = AI_TIERS[team.tier ?? 2];
  const reserve = tier.annual * econ(team.class) * 0.3;
  const next = { ...team, car: { ...team.car } };
  for (let i = 0; i < maxUpgrades; i++) {
    const part = choosePart(next);
    if (next.car[part] >= PART_CAP) {
      continue;
    }
    const cost = upgradeCost(next, part);
    if (next.funds - cost < reserve) {
      break;
    }
    next.funds -= cost;
    next.car[part] = Math.min(PART_CAP, next.car[part] + UPGRADE_STEP);
  }
  return next;
};

export const developAiTeams = (teams, maxUpgrades = 2) => teams.map(team => developAiTeam(team, maxUpgrades));
