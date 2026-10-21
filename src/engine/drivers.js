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

// Contrata um piloto para um carro (ajusta salário à classe do carro e define contrato)
export const signDriverTo = (driver, entry, years = 2) => ({
  ...driver,
  teamId: entry.teamId ?? entry.id,
  entryId: entry.id,
  wage: driverWageFor(driver, entry.class),
  contractYears: years
});

const reserveOf = team => AI_TIERS[team.tier ?? 2].annual * econ(team.class) * 0.2;

// Fábricas ricas trocam o pior piloto por uma estrela do mercado (as de maior verba escolhem primeiro)
// Devolve equipes (caixa), carros (pilotos) e o mercado atualizados
export const recruitStars = (teams, entries, pool, news) => {
  let available = [...pool];
  const funds = new Map(teams.map(team => [team.id, team.funds]));
  const updatedEntries = new Map();
  [...teams]
    .sort((a, b) => (b.ai?.investment ?? 1) - (a.ai?.investment ?? 1))
    .forEach(team => {
      if ((team.ai?.investment ?? 1) < 1 && (team.tier ?? 2) > 0) {
        return;
      }
      const cars = entries.filter(entry => entry.teamId === team.id);
      const candidates = cars.flatMap(entry => entry.drivers.map(driver => ({ entry, driver })));
      if (!candidates.length) {
        return;
      }
      const { entry, driver: worst } = candidates.sort((a, b) => a.driver.rating - b.driver.rating)[0];
      const star = available
        .filter(driver => driver.rating >= worst.rating + 4 && signingFee(driver, team.class) <= funds.get(team.id) - reserveOf(team))
        .sort((a, b) => b.rating - a.rating)[0];
      if (!star) {
        return;
      }
      available = available.filter(driver => driver.id !== star.id);
      funds.set(team.id, funds.get(team.id) - signingFee(star, team.class));
      const signed = signDriverTo(star, entry, randInt(2, 3));
      const current = updatedEntries.get(entry.id) || entry;
      updatedEntries.set(entry.id, { ...current, drivers: [...current.drivers.filter(driver => driver.id !== worst.id), signed] });
      available.push({ ...worst, teamId: null, entryId: null, contractYears: 0 });
      if (news && star.rating >= 80) {
        news.push({ driver: signed, team });
      }
    });
  return {
    teams: teams.map(team => ({ ...team, funds: funds.get(team.id) })),
    entries: entries.map(entry => updatedEntries.get(entry.id) || entry),
    pool: available
  };
};

// Preenche as vagas dos carros de uma equipe da IA com o melhor piloto que ela consegue pagar
export const fillAiVacancies = (team, cars, pool, takenNames, news) => {
  let funds = team.funds;
  let available = [...pool];
  const reserve = reserveOf(team);
  const filled = cars.map(entry => {
    const drivers = [...entry.drivers];
    const all = cars.flatMap(car => car.drivers);
    const level = all.length ? all.reduce((sum, d) => sum + d.rating, 0) / all.length : 70;
    while (drivers.length < DRIVERS_PER_CAR) {
      const candidates = available
        .filter(driver => driver.rating <= level + 8 && signingFee(driver, entry.class) <= funds - reserve)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3);
      let signed;
      if (candidates.length) {
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        available = available.filter(driver => driver.id !== choice.id);
        funds -= signingFee(choice, entry.class);
        signed = signDriverTo(choice, entry, randInt(1, 3));
        if (choice.rating >= 80 && news) {
          news.push({ driver: signed, team });
        }
      } else {
        signed = signDriverTo(generateRookie(takenNames), entry, randInt(1, 2));
      }
      drivers.push(signed);
    }
    return { ...entry, drivers };
  });
  return { team: { ...team, funds }, entries: filled, pool: available };
};
