// Mede o equilíbrio de longo prazo: eras de campeões da IA e a curva de dificuldade de um jogador habilidoso.
// Uso: node scripts/equilibrio.mjs [temporadas] [HYPERCAR|LMGT3] [EASY|NORMAL|CLASSIC] [carreiras]
import { TRACKS, SPONSORS, STAFF_ORDER, FACILITY_MAX_LEVEL } from "../src/data/constants.js";
import { createNewGame } from "../src/engine/newGame.js";
import { applyBop, createWeekend, computeQualifying, createRaceState } from "../src/engine/weekend.js";
import { simulateToEnd, carPerformance } from "../src/engine/race.js";
import { buildRaceReport, applyRaceResults } from "../src/engine/results.js";
import { startNextSeason } from "../src/engine/season.js";
import { classStandings } from "../src/engine/career.js";
import { sponsorOffer, sponsorSlots, signingFee, requiredReputation, staffHiringFee, facilityUpgradeCost, MAIN_PARTS, PART_CAP } from "../src/engine/economy.js";
import { upgradeCostFor } from "../src/engine/team.js";
import { usesToken } from "../src/engine/economy.js";
import { signDriverTo } from "../src/engine/drivers.js";

const seasons = Number(process.argv[2] || 12);
const series = process.argv[3] || "HYPERCAR";
const difficulty = process.argv[4] || "NORMAL";
const careers = Number(process.argv[5] || 3);
const quiet = process.argv.includes("--resumo");

// Jogador habilidoso: patrocínios, staff, instalações, pilotos e todo o resto do caixa em P&D
const manage = (g, seasonStart) => {
  let player = { ...g.playerTeam, car: { ...g.playerTeam.car }, sponsors: [...g.playerTeam.sponsors], drivers: [...g.playerTeam.drivers] };
  let pool = g.driversPool;
  const active = new Set(player.sponsors.map(s => s.id));
  SPONSORS.filter(s => !active.has(s.id) && s.minReputation <= player.reputation)
    .sort((a, b) => b.perRacePayment + b.signingBonus / 6 - (a.perRacePayment + a.signingBonus / 6))
    .forEach(s => {
      if (player.sponsors.length < sponsorSlots(player)) {
        const offer = sponsorOffer(s, player.class);
        player.sponsors.push({ ...offer, remaining: offer.duration });
        player.funds += offer.signingBonus;
      }
    });
  if (seasonStart) {
    // Staff melhor que dê para pagar
    STAFF_ORDER.forEach(role => {
      const best = [...(g.staffMarket[role] || [])].sort((a, b) => b.stars - a.stars)[0];
      if (best && best.stars > (player.staff[role]?.stars ?? 0) && player.funds > staffHiringFee(best.stars, player.class) * 4) {
        player.funds -= staffHiringFee(best.stars, player.class);
        player.staff = { ...player.staff, [role]: best };
      }
    });
    // Uma instalação por temporada
    ["windTunnel", "engineShop", "simulator", "hospitality"].some(id => {
      const level = player.facilities[id];
      const cost = facilityUpgradeCost(player.class, level);
      if (level < FACILITY_MAX_LEVEL && player.funds > cost * 3) {
        player.funds -= cost;
        player.facilities = { ...player.facilities, [id]: level + 1 };
        return true;
      }
      return false;
    });
    // Troca o pior piloto por um melhor do mercado
    const worst = [...player.drivers].sort((a, b) => a.rating - b.rating)[0];
    const target = [...pool]
      .filter(d => d.rating >= worst.rating + 4 && requiredReputation(d) <= player.reputation && signingFee(d, player.class) < player.funds * 0.25)
      .sort((a, b) => b.rating - a.rating)[0];
    if (target) {
      player.funds -= signingFee(target, player.class);
      player.drivers = [...player.drivers.filter(d => d.id !== worst.id), signDriverTo(target, player, 2)];
      pool = [...pool.filter(d => d.id !== target.id), { ...worst, teamId: null, contractYears: 0 }];
    }
  }
  const reserve = 2.5e6 * (player.class === "HYPERCAR" ? 1 : 0.33);
  const view = { ...g, playerTeam: player };
  for (let i = 0; i < 60; i++) {
    const mainAvg = MAIN_PARTS.reduce((sum, p) => sum + player.car[p], 0) / 3;
    const support = ["reliability", "efficiency", "crew"].find(p => player.car[p] < mainAvg - 6);
    const part = support || [...MAIN_PARTS].sort((a, b) => player.car[a] - player.car[b])[0];
    const cost = upgradeCostFor(view, player, part);
    if (usesToken(part) && player.devTokens <= 0) break;
    if (player.car[part] >= PART_CAP || player.funds - cost < reserve) break;
    player.funds -= cost;
    if (usesToken(part)) player.devTokens -= 1;
    // Diretor Técnico: chance de +3
    const bonus = Math.random() < Math.max(0, ((player.staff?.technicalDirector?.stars ?? 1) - 1) * 0.12);
    player.car[part] = Math.min(PART_CAP, player.car[part] + (bonus ? 3 : 2));
  }
  return { ...g, playerTeam: player, driversPool: pool };
};

const summary = { titles: [], streaks: [], margins: [], playerPositions: [], playerTitles: 0, distinct: [] };
for (let c = 0; c < careers; c++) {
  let game = createNewGame({ teamName: "Iron Racing", series, difficulty });
  const champions = [];
  for (let s = 0; s < seasons; s++) {
    let first = true;
    while (game.raceIndex < TRACKS.length) {
      game = manage(game, first);
      first = false;
      game = applyBop(game, TRACKS[game.raceIndex]);
      const weekend = createWeekend(game);
      weekend.setupScore = 92 + Math.random() * 8;
      weekend.qualyScore = 75 + Math.random() * 20;
      weekend.qualifying = computeQualifying(game, weekend);
      const race = simulateToEnd(createRaceState(game, weekend));
      game = applyRaceResults(game, buildRaceReport(race, game)).game;
    }
    const cls = game.playerTeam.class;
    const standings = classStandings(game, cls);
    const pos = standings.findIndex(t => t.id === "player") + 1;
    const champ = standings[0];
    champions.push(champ.id === "player" ? "JOGADOR" : champ.name);
    summary.margins.push(champ.points - standings[1].points);
    summary.playerPositions[s] = [...(summary.playerPositions[s] || []), pos];
    if (champ.id === "player") summary.playerTitles += 1;
    if (!quiet) {
      const perf = t => Math.round(carPerformance(t.car));
      const top = standings
        .slice(0, 4)
        .map(t => `${t.id === "player" ? "*JOGADOR*" : t.name} ${t.points} (${perf(t)})`)
        .join(" | ");
      console.log(`C${c + 1} ${game.season} ${cls}: jogador P${pos} (${perf(game.playerTeam)}) · ${top}`);
      if (process.argv.includes("--detalhe")) {
        const drv = t => Math.round(t.drivers.reduce((sum, d) => sum + d.rating, 0) / t.drivers.length);
        const income = (game.playerTeam.ledger || []).filter(e => e.season === game.season).flatMap(e => e.items).filter(i => i.amount > 0).reduce((sum, i) => sum + i.amount, 0);
        const car = game.playerTeam.car;
        console.log(`     jogador: pilotos ${drv(game.playerTeam)} rep ${game.playerTeam.reputation} receitas ${(income / 1e6).toFixed(1)}M rel/efi/crew ${car.reliability}/${car.efficiency}/${car.crew}`);
        console.log(`     IA: ${standings.filter(t => t.id !== "player").slice(0, 5).map(t => `${t.name.split(" ")[0]} pil ${drv(t)} inv ${t.program?.investment} eng ${t.program?.engineering} caixa ${(t.funds / 1e6).toFixed(0)}M efi ${t.car.efficiency}`).join(" | ")}`);
      }
    }
    const next = startNextSeason(game, { acceptPromotion: false });
    if (next.fired) {
      console.log(`C${c + 1}: demitido em ${game.season}`);
      break;
    }
    game = next.game;
  }
  let streak = 1;
  let best = 1;
  for (let i = 1; i < champions.length; i++) {
    streak = champions[i] === champions[i - 1] ? streak + 1 : 1;
    best = Math.max(best, streak);
  }
  summary.streaks.push(best);
  summary.distinct.push(new Set(champions).size);
  console.log(`C${c + 1} campeões: ${champions.join(", ")}`);
}
const avg = list => (list.reduce((s, v) => s + v, 0) / Math.max(1, list.length)).toFixed(1);
console.log(`\nResumo (${careers} carreiras, ${seasons} temporadas, ${series}, ${difficulty})`);
console.log(`  campeões diferentes por carreira: ${summary.distinct.join(", ")} · maior sequência: ${summary.streaks.join(", ")} · margem média do campeão: ${avg(summary.margins)} pts`);
console.log(`  títulos do jogador: ${summary.playerTitles}`);
console.log(`  posição média do jogador por temporada: ${summary.playerPositions.map((list, i) => `T${i + 1}:${avg(list)}`).join(" ")}`);
