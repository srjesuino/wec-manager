import { SERIES_CONFIG, FACILITY_ORDER, STAFF_ORDER } from "../data/constants.js";
import { calculateWage } from "../utils/helpers.js";

export const CAR_PARTS = ["engine", "aero", "chassis", "reliability", "efficiency", "crew"];
export const MAIN_PARTS = ["engine", "aero", "chassis"];
export const PART_CAP = 99;
export const UPGRADE_STEP = 2;

// Escala financeira da categoria (Hypercar = 1, LMGT3 = 0.33)
export const econ = cls => SERIES_CONFIG[cls]?.economy ?? 1;

// Qual instalação barateia cada peça
const PART_FACILITY = {
  engine: "engineShop",
  efficiency: "engineShop",
  reliability: "engineShop",
  aero: "windTunnel",
  chassis: "windTunnel",
  crew: null
};

export const facilityDiscount = (team, part) => {
  const facility = PART_FACILITY[part];
  if (!facility || !team.facilities) {
    return 0;
  }
  return (team.facilities[facility] - 1) * 0.06;
};

// Mesmo custo para jogador e IA: cresce exponencialmente com o nível da peça
// e fica bem mais caro acima de 80 (rendimento decrescente perto do limite).
export const upgradeCost = (team, part) => {
  const cfg = SERIES_CONFIG[team.class];
  const level = team.car[part] ?? 0;
  const nearCap = 1 + Math.max(0, level - 80) / 8;
  const cost = cfg.partsCostBase * Math.pow(cfg.upgradeGrowth, level) * nearCap * (1 - facilityDiscount(team, part));
  return Math.floor(cost);
};

// Chance de o upgrade render +3 (Diretor Técnico)
export const bonusUpgradeChance = team => {
  const stars = team.staff?.technicalDirector?.stars ?? 1;
  return Math.max(0, (stars - 1) * 0.12);
};

// ---------------------------------------------------------------------------
// Instalações e equipe técnica
// ---------------------------------------------------------------------------

export const facilityUpgradeCost = (cls, currentLevel) => Math.floor(3000000 * Math.pow(currentLevel, 1.6) * econ(cls));

export const facilityUpkeep = team => {
  if (!team.facilities) {
    return 0;
  }
  const levels = FACILITY_ORDER.reduce((sum, id) => sum + (team.facilities[id] || 1), 0);
  return Math.floor(levels * 25000 * econ(team.class));
};

const STAFF_SALARY = [0, 40000, 70000, 110000, 160000, 230000];
export const staffSalary = (stars, cls) => Math.floor(STAFF_SALARY[stars] * econ(cls));
export const staffHiringFee = (stars, cls) => staffSalary(stars, cls) * 3;

export const staffPayroll = team => {
  if (!team.staff) {
    return 0;
  }
  return STAFF_ORDER.reduce((sum, role) => sum + (team.staff[role] ? staffSalary(team.staff[role].stars, team.class) : 0), 0);
};

// ---------------------------------------------------------------------------
// Pilotos
// ---------------------------------------------------------------------------

export const driverWageFor = (driver, cls) => Math.floor(calculateWage(driver.rating) * econ(cls));
export const signingFee = (driver, cls) => Math.floor(driver.marketValue * econ(cls));
export const driversPayroll = team => team.drivers.reduce((sum, driver) => sum + (driver.wage || 0), 0);

// Multa para dispensar um piloto: metade do salário restante da temporada
export const releaseCost = (driver, racesLeft) => Math.floor((driver.wage || 0) * Math.max(1, racesLeft) * 0.5);

// Reputação exigida pelos pilotos de elite
export const requiredReputation = driver => (driver.rating >= 90 ? 65 : driver.rating >= 85 ? 45 : driver.rating >= 80 ? 25 : 0);

// ---------------------------------------------------------------------------
// Patrocínio e prêmios
// ---------------------------------------------------------------------------

export const sponsorSlots = team => ((team.facilities?.hospitality ?? 1) >= 4 ? 4 : 3);
export const sponsorMultiplier = team => 1 + ((team.facilities?.hospitality ?? 1) - 1) * 0.06;

export const sponsorGoal = (sponsor, cls) => {
  if (!sponsor.goal) {
    return null;
  }
  return typeof sponsor.goal === "number" ? sponsor.goal : sponsor.goal[cls];
};

// Contrato com valores já ajustados à categoria da equipe
export const sponsorOffer = (sponsor, cls) => {
  const scale = econ(cls);
  return {
    ...sponsor,
    signingBonus: Math.floor(sponsor.signingBonus * scale),
    perRacePayment: Math.floor(sponsor.perRacePayment * scale),
    bonus: sponsor.bonus ? Math.floor(sponsor.bonus * scale) : 0,
    maxRandom: sponsor.maxRandom ? Math.floor(sponsor.maxRandom * scale) : 0,
    goalPosition: sponsorGoal(sponsor, cls)
  };
};

// Quanto um patrocinador paga após uma corrida (classPos = posição na classe, null se abandonou)
export const sponsorPayout = (contract, { classPos, isLeMans, multiplier = 1 }) => {
  let payment = 0;
  let note = "";
  switch (contract.type) {
    case "GAMBLE":
      payment = Math.floor(Math.random() * contract.maxRandom);
      break;
    case "PERFORMANCE":
      if (classPos != null && classPos <= contract.goalPosition) {
        payment = contract.perRacePayment;
      } else {
        note = "meta não cumprida";
      }
      break;
    case "PODIUM":
      payment = contract.perRacePayment + (classPos != null && classPos <= 3 ? contract.bonus : 0);
      break;
    case "WIN":
      payment = contract.perRacePayment + (classPos === 1 ? contract.bonus : 0);
      break;
    case "LEMANS":
      payment = contract.perRacePayment + (isLeMans && classPos != null && classPos <= contract.goalPosition ? contract.bonus : 0);
      break;
    default:
      payment = contract.perRacePayment;
  }
  return {
    payment: Math.floor(payment * multiplier),
    note
  };
};

// Prêmio por corrida (por posição na classe)
export const racePrize = (cls, classPos, finished, multiplier = 1) => {
  const base = SERIES_CONFIG[cls].prizeBase;
  if (!finished) {
    return Math.floor(base * 0.1 * multiplier);
  }
  const value = classPos <= 10 ? (base * (16 - classPos)) / 15 : base * 0.2;
  return Math.floor(value * multiplier);
};

// Prêmio do campeonato (por posição final na classe)
export const seasonPrize = (cls, position, classSize) => (classSize - position + 1) * SERIES_CONFIG[cls].seasonPrizeStep;
