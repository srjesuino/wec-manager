// Jogador simulado para os scripts: patrocínios, staff, fábrica, pilotos e P&D de cada programa
import { SPONSORS, STAFF_ORDER, FACILITY_MAX_LEVEL, CLASSES } from "../src/data/constants.js";
import { sponsorOffer, sponsorSlots, signingFee, requiredReputation, staffHiringFee, facilityUpgradeCost, usesToken, MAIN_PARTS, PART_CAP } from "../src/engine/economy.js";
import { programUpgradeCost, mainClass, playerEntries } from "../src/engine/team.js";
import { signDriverTo } from "../src/engine/drivers.js";

// "Cars" no formato dos scripts: H1, H2, G2, H1G2, H2G2
export const parseCars = text => ({ HYPERCAR: Number((/H(\d)/.exec(text || "H1") || [])[1] || 0), LMGT3: Number((/G(\d)/.exec(text || "") || [])[1] || 0) });

// skilled: também contrata staff, amplia a fábrica e troca o pior piloto no início da temporada
export const managePlayer = (g, { skilled = false, seasonStart = false } = {}) => {
  let player = { ...g.playerTeam, sponsors: [...g.playerTeam.sponsors], programs: { ...g.playerTeam.programs } };
  let entries = g.entries;
  let pool = g.driversPool;
  const scale = mainClass(player);
  const active = new Set(player.sponsors.map(s => s.id));
  SPONSORS.filter(s => !active.has(s.id) && s.minReputation <= player.reputation)
    .sort((a, b) => b.perRacePayment + b.signingBonus / 6 - (a.perRacePayment + a.signingBonus / 6))
    .forEach(s => {
      if (player.sponsors.length < sponsorSlots(player)) {
        const offer = sponsorOffer(s, scale);
        player.sponsors.push({ ...offer, remaining: offer.duration });
        player.funds += offer.signingBonus;
      }
    });
  if (skilled && seasonStart) {
    STAFF_ORDER.forEach(role => {
      const best = [...(g.staffMarket[role] || [])].sort((a, b) => b.stars - a.stars)[0];
      if (best && best.stars > (player.staff[role]?.stars ?? 0) && player.funds > staffHiringFee(best.stars, scale) * 4) {
        player.funds -= staffHiringFee(best.stars, scale);
        player.staff = { ...player.staff, [role]: best };
      }
    });
    ["windTunnel", "engineShop", "simulator", "hospitality"].some(id => {
      const level = player.facilities[id];
      const cost = facilityUpgradeCost(scale, level);
      if (level < FACILITY_MAX_LEVEL && player.funds > cost * 3) {
        player.funds -= cost;
        player.facilities = { ...player.facilities, [id]: level + 1 };
        return true;
      }
      return false;
    });
    playerEntries(g).forEach(entry => {
      const current = entries.find(item => item.id === entry.id);
      const worst = [...current.drivers].sort((a, b) => a.rating - b.rating)[0];
      const target = [...pool]
        .filter(d => d.rating >= worst.rating + 4 && requiredReputation(d) <= player.reputation && signingFee(d, entry.class) < player.funds * 0.2)
        .sort((a, b) => b.rating - a.rating)[0];
      if (target) {
        player.funds -= signingFee(target, entry.class);
        entries = entries.map(item => (item.id === entry.id ? { ...item, drivers: [...item.drivers.filter(d => d.id !== worst.id), signDriverTo(target, item, 2)] } : item));
        pool = [...pool.filter(d => d.id !== target.id), { ...worst, teamId: null, entryId: null, contractYears: 0 }];
      }
    });
  }
  // P&D: a peça mais fraca de cada programa, alternando as classes
  const classes = CLASSES.filter(cls => player.programs[cls]);
  const reserve = 2.5e6 * (scale === "HYPERCAR" ? 1 : 0.33) * (1 + (playerEntries(g).length - 1) * 0.3);
  const tdBonus = Math.max(0, ((player.staff?.technicalDirector?.stars ?? 1) - 1) * 0.12);
  for (let i = 0, misses = 0; i < 80 && misses < classes.length; i++) {
    const cls = classes[i % classes.length];
    const program = player.programs[cls];
    const car = program.car;
    const mainAvg = MAIN_PARTS.reduce((sum, p) => sum + car[p], 0) / 3;
    const support = ["reliability", "efficiency", "crew"].find(p => car[p] < mainAvg - 6);
    const part = support || [...MAIN_PARTS].sort((a, b) => car[a] - car[b])[0];
    const cost = programUpgradeCost({ ...g, entries }, player, cls, part);
    if ((usesToken(part) && program.devTokens <= 0) || car[part] >= PART_CAP || player.funds - cost < reserve) {
      misses += 1;
      continue;
    }
    player.funds -= cost;
    player.programs[cls] = {
      ...program,
      car: { ...car, [part]: Math.min(PART_CAP, car[part] + (skilled && Math.random() < tdBonus ? 3 : 2)) },
      devTokens: usesToken(part) ? program.devTokens - 1 : program.devTokens
    };
  }
  return { ...g, playerTeam: player, entries, driversPool: pool };
};
