import { DRIVERS_PER_CAR, AI_TIERS } from "../data/constants.js";
import { clamp, randInt, computeOverall, calculateMarketValue, generateRookie } from "../utils/helpers.js";
import { driverWageFor, signingFee, econ } from "./economy.js";

// Evolução anual: jovens crescem até o potencial, veteranos perdem rendimento
export const developDriver = (driver, { simulatorLevel = 1, playerTeam = false } = {}) => {
  const age = driver.age + 1;
  let growth;
  if (age < 23) {
    growth = randInt(2, 5);
  } else if (age < 27) {
    growth = randInt(1, 3);
  } else if (age < 31) {
    growth = randInt(0, 1);
  } else if (age < 34) {
    growth = randInt(-1, 1);
  } else if (age < 37) {
    growth = -randInt(1, 3);
  } else {
    growth = -randInt(2, 5);
  }
  if (playerTeam && simulatorLevel >= 3 && age < 27) {
    growth += simulatorLevel >= 5 ? 2 : 1;
  }
  if (growth > 0) {
    growth = Math.min(growth, Math.max(0, (driver.potential ?? driver.rating) - driver.rating));
  }
  const attrs = { ...driver.attrs };
  attrs.pace = clamp(attrs.pace + growth, 35, 99);
  attrs.wet = clamp(attrs.wet + Math.round(growth * 0.8) + randInt(-1, 1), 35, 99);
  attrs.stamina = clamp(attrs.stamina + (age < 30 ? randInt(0, 2) : -randInt(0, 2)), 35, 99);
  attrs.consistency = clamp(attrs.consistency + (age < 33 ? randInt(0, 2) : randInt(-1, 1)), 35, 99);
  const rating = computeOverall(attrs);
  return {
    ...driver,
    age,
    attrs,
    rating,
    potential: Math.max(driver.potential ?? rating, rating),
    marketValue: calculateMarketValue(rating, age),
    morale: clamp(Math.round(((driver.morale ?? 75) + 75) / 2), 30, 100),
    seasonPoints: 0
  };
};

export const willRetire = driver => driver.age >= 36 && Math.random() < (driver.age - 35) * 0.15;

// Contrata um piloto (ajusta salário à categoria e define contrato)
export const signDriverTo = (driver, team, years = 2) => ({
  ...driver,
  teamId: team.id,
  wage: driverWageFor(driver, team.class),
  contractYears: years
});

// Preenche vagas de uma equipe da IA com o melhor piloto que ela consegue pagar
export const fillAiVacancies = (team, pool, takenNames, news) => {
  let next = { ...team, drivers: [...team.drivers] };
  let available = [...pool];
  const tier = AI_TIERS[team.tier ?? 2];
  const reserve = tier.annual * econ(team.class) * 0.2;
  const level = next.drivers.length ? next.drivers.reduce((sum, d) => sum + d.rating, 0) / next.drivers.length : 70;
  while (next.drivers.length < DRIVERS_PER_CAR) {
    const candidates = available
      .filter(driver => driver.rating <= level + 8 && signingFee(driver, next.class) <= next.funds - reserve)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
    let signed;
    if (candidates.length) {
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      available = available.filter(driver => driver.id !== choice.id);
      next.funds -= signingFee(choice, next.class);
      signed = signDriverTo(choice, next, randInt(1, 3));
      if (choice.rating >= 80 && news) {
        news.push({ driver: signed, team: next });
      }
    } else {
      signed = signDriverTo(generateRookie(takenNames), next, randInt(1, 2));
    }
    next.drivers.push(signed);
  }
  return { team: next, pool: available };
};
