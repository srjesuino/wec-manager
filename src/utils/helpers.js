import {
  FIRST_NAMES,
  LAST_NAMES,
  LASTNAME_NATIONALITY,
  NATIONALITIES,
  DRIVER_CATEGORIES,
  STAFF_FIRST_NAMES,
  STAFF_LAST_NAMES
} from "../data/constants.js";

// ---------------------------------------------------------------------------
// Aleatoriedade e números
// ---------------------------------------------------------------------------

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const randRange = (min, max) => min + Math.random() * (max - min);

// Sorteia um item de uma lista
export const pickRandom = list => list[Math.floor(Math.random() * list.length)];

// Sorteia uma chave de um objeto { chave: peso }
export const pickWeighted = weights => {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return key;
    }
  }
  return entries[entries.length - 1][0];
};

// ID único curto (timestamp + aleatório)
export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export const formatMoney = (value, digits = 1) => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1000000) {
    return `${sign}$${(abs / 1000000).toFixed(digits)}M`;
  }
  if (abs >= 1000) {
    return `${sign}$${Math.round(abs / 1000)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
};

export const formatLapTime = seconds => {
  if (seconds == null || !isFinite(seconds)) {
    return "--:--.-";
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
};

// Tempo simulado → tempo exibido (ver timeScale das pistas)
export const toDisplayTime = (seconds, track) => (seconds == null ? null : seconds * (track?.timeScale || 1));

export const formatClock = hour => {
  const h = ((hour % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const formatDuration = seconds => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
};

// "K. Giovinazzi" (o banco de nomes repete sobrenomes)
export const shortName = name => {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
};

export const surname = name => {
  const parts = name.split(" ");
  return parts.length > 2 ? parts.slice(1).join(" ") : parts[parts.length - 1];
};

// ---------------------------------------------------------------------------
// Pilotos
// ---------------------------------------------------------------------------

export const ATTRIBUTE_WEIGHTS = {
  pace: 0.45,
  consistency: 0.25,
  wet: 0.15,
  stamina: 0.15
};

export const ATTRIBUTE_LABELS = {
  pace: "Ritmo",
  consistency: "Consistência",
  wet: "Chuva",
  stamina: "Resistência"
};

export const computeOverall = attrs =>
  Math.round(Object.entries(ATTRIBUTE_WEIGHTS).reduce((sum, [key, weight]) => sum + attrs[key] * weight, 0));

// Valor de mercado do piloto (referência Hypercar): cresce com o rating, jovens valem mais e veteranos menos
export const calculateMarketValue = (rating, age) => {
  let value = Math.pow(rating / 100, 3.5) * 12000000;
  if (age < 25) {
    value *= 1.25;
  }
  if (age > 33) {
    value *= 0.75;
  }
  if (age > 36) {
    value *= 0.6;
  }
  return Math.floor(value);
};

// Salário por corrida (referência Hypercar)
export const calculateWage = rating => Math.floor(Math.pow(rating / 100, 3) * 600000);

export const driverCategory = rating => DRIVER_CATEGORIES.find(category => rating >= category.min);

export const nationalityOf = driver => NATIONALITIES[driver?.nationality] || { name: "Internacional", code: "INT" };

const nationalityFromName = name => {
  const last = name.split(" ").slice(1).join(" ");
  return LASTNAME_NATIONALITY[last] || "GB";
};

const randomDriverName = (takenNames = new Set()) => {
  let name = "";
  for (let attempt = 0; attempt < 25; attempt++) {
    name = `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`;
    if (!takenNames.has(name)) {
      break;
    }
  }
  takenNames.add(name);
  return name;
};

const potentialFor = (rating, age) => {
  if (age < 24) {
    return Math.min(99, rating + randInt(4, 16));
  }
  if (age < 29) {
    return Math.min(99, rating + randInt(0, 6));
  }
  return rating;
};

// Gera atributos em torno de um rating alvo
export const generateAttributes = target => ({
  pace: clamp(target + randInt(-5, 5), 35, 99),
  consistency: clamp(target + randInt(-8, 8), 35, 99),
  wet: clamp(target + randInt(-10, 10), 35, 99),
  stamina: clamp(target + randInt(-10, 10), 35, 99)
});

// Gera um piloto aleatório com rating entre minRating e maxRating
export const generateDriver = (minRating = 50, maxRating = 99, fixedAge = null, takenNames) => {
  const name = randomDriverName(takenNames);
  const target = Math.min(99, Math.max(minRating, Math.floor(Math.random() * (maxRating - minRating + 1)) + minRating));
  const age = fixedAge || 18 + Math.floor(Math.random() * 22);
  const attrs = generateAttributes(target);
  const rating = computeOverall(attrs);
  return {
    id: Math.random().toString(36).substr(2, 9),
    name,
    nationality: nationalityFromName(name),
    rating,
    attrs,
    potential: potentialFor(rating, age),
    age,
    wage: calculateWage(rating),
    marketValue: calculateMarketValue(rating, age),
    morale: 75,
    contractYears: randInt(1, 3),
    teamId: null,
    stats: {
      wins: 0,
      podiums: 0,
      titles: 0,
      starts: 0
    },
    seasonPoints: 0
  };
};

// Jovem promessa: rating modesto, potencial alto
export const generateRookie = takenNames => {
  const driver = generateDriver(55, 72, randInt(18, 21), takenNames);
  driver.potential = Math.min(99, driver.rating + randInt(10, 24));
  driver.contractYears = 0;
  return driver;
};

// Completa pilotos de saves antigos (só tinham rating) com atributos, nacionalidade etc.
export const upgradeLegacyDriver = driver => {
  if (driver.attrs) {
    return driver;
  }
  const attrs = generateAttributes(driver.rating);
  const rating = computeOverall(attrs);
  return {
    ...driver,
    attrs,
    rating,
    marketValue: calculateMarketValue(rating, driver.age),
    nationality: driver.nationality && NATIONALITIES[driver.nationality] ? driver.nationality : nationalityFromName(driver.name),
    potential: potentialFor(rating, driver.age),
    morale: driver.morale ?? 75,
    contractYears: driver.contractYears ?? randInt(1, 3),
    stats: {
      wins: 0,
      podiums: 0,
      titles: 0,
      starts: 0,
      ...driver.stats
    },
    seasonPoints: driver.seasonPoints ?? 0
  };
};

// ---------------------------------------------------------------------------
// Equipe técnica
// ---------------------------------------------------------------------------

export const generateStaff = (role, stars) => ({
  id: generateId(),
  role,
  name: `${pickRandom(STAFF_FIRST_NAMES)} ${pickRandom(STAFF_LAST_NAMES)}`,
  stars,
  age: randInt(32, 62)
});

// Engajamento simulado de um post (curtidas, compartilhamentos, comentários)
export const generateEngagement = dramaLevel => {
  const base = Math.max(10, dramaLevel * 50);
  return {
    likes: Math.floor(base + Math.random() * base * 2),
    shares: Math.floor(base / 5 + Math.random() * (base / 2)),
    comments: Math.floor(base / 10 + Math.random() * (base / 4))
  };
};
