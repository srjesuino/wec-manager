import { AI_TIERS, DIFFICULTIES } from "../data/constants.js";
import { clamp, pickRandom, randRange } from "../utils/helpers.js";
import { MAIN_PARTS, PART_CAP, UPGRADE_STEP, econ, upgradeCost, usesToken } from "./economy.js";

// ---------------------------------------------------------------------------
// Programa de cada equipe da IA
// investment: verba da matriz (multiplica orçamento anual e repasse por corrida)
// engineering: qualidade técnica (rendimento do P&D, acerto nos fins de semana e conceito do regulamento novo)
// Os dois mudam a cada temporada: é isso que cria eras de domínio, quedas e voltas por cima.
// ---------------------------------------------------------------------------

const round2 = value => Math.round(value * 100) / 100;

// Normal padrão (Box-Muller)
export const gaussian = () => {
  let u = 0;
  let v = 0;
  while (!u) {
    u = Math.random();
  }
  while (!v) {
    v = Math.random();
  }
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const INVESTMENT_RANGE = [0.6, 1.7];
export const ENGINEERING_RANGE = [0.75, 1.35];

export const createAiProgram = tier => {
  const base = AI_TIERS[tier] || AI_TIERS[2];
  return {
    investment: round2(clamp(base.investment + gaussian() * 0.1, ...INVESTMENT_RANGE)),
    engineering: round2(clamp(base.engineering + gaussian() * 0.07, ...ENGINEERING_RANGE))
  };
};

export const programOf = team => team.program || { investment: 1, engineering: 1 };

const difficultyOf = difficulty => DIFFICULTIES[difficulty] || DIFFICULTIES.NORMAL;

// Verba anual e repasse por corrida da matriz
export const aiAnnualBudget = (team, difficulty) =>
  Math.floor((team.annualBudget || 0) * programOf(team).investment * (difficultyOf(difficulty).aiBudget ?? 1));
export const aiRaceSupport = (team, difficulty) =>
  Math.floor((team.support || 0) * programOf(team).investment * (difficultyOf(difficulty).aiBudget ?? 1));

// Acerto do carro no fim de semana (o jogador vai de 0,3 a 1,3 conforme o setup)
export const aiSetupBonus = (team, difficulty) =>
  clamp(0.25 + 0.72 * programOf(team).engineering + (difficultyOf(difficulty).aiSetup ?? 0) + randRange(-0.25, 0.25), 0.3, 1.3);

// Volta lançada na classificação (o jogador vai de 0,2 a 1,0 conforme o minigame)
export const aiQualyBonus = team => clamp(0.2 + Math.random() * 0.6 + (programOf(team).engineering - 1) * 0.6, 0, 1.1);

// ---------------------------------------------------------------------------
// Desenvolvimento durante a temporada
// ---------------------------------------------------------------------------

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

// Engenharia boa às vezes tira +3 de um upgrade; fraca às vezes só +1
const upgradeStep = engineering => {
  const roll = Math.random();
  if (roll < clamp((engineering - 0.95) * 1.3, 0, 0.45)) {
    return UPGRADE_STEP + 1;
  }
  if (roll > 1 - clamp((1 - engineering) * 1.6, 0, 0.4)) {
    return UPGRADE_STEP - 1;
  }
  return UPGRADE_STEP;
};

// Caixa mínimo que a equipe guarda (salários e imprevistos)
const reserveFor = team => (AI_TIERS[team.tier ?? 2] || AI_TIERS[2]).annual * econ(team.class) * 0.12;

// A IA investe uma parte do caixa acima da reserva a cada corrida, com o mesmo custo de upgrade do jogador
export const developAiTeam = (team, share = 0.3, maxUpgrades = 8) => {
  const next = { ...team, car: { ...team.car } };
  const { engineering } = programOf(team);
  let budget = Math.max(0, next.funds - reserveFor(team)) * share;
  const hasTokens = () => (next.devTokens ?? Infinity) > 0;
  for (let i = 0; i < maxUpgrades; i++) {
    // Sem fichas de homologação, só dá para treinar a equipe de pit
    const part = hasTokens() ? choosePart(next) : "crew";
    if (next.car[part] >= PART_CAP) {
      continue;
    }
    const cost = upgradeCost(next, part);
    if (cost > budget) {
      break;
    }
    budget -= cost;
    next.funds -= cost;
    next.car[part] = Math.min(PART_CAP, next.car[part] + upgradeStep(engineering));
    if (usesToken(part) && next.devTokens != null) {
      next.devTokens -= 1;
    }
  }
  // Pacote de evolução (usa uma ficha): às vezes funciona muito bem, às vezes cria problemas
  if (hasTokens() && Math.random() < 0.04) {
    if (next.devTokens != null) {
      next.devTokens -= 1;
    }
    const part = pickRandom(MAIN_PARTS);
    if (Math.random() < 0.35 + (engineering - 1)) {
      next.car[part] = Math.min(PART_CAP, next.car[part] + 3);
    } else {
      next.car.reliability = Math.max(40, next.car.reliability - 3);
    }
  }
  return next;
};

export const developAiTeams = (teams, share, maxUpgrades) => teams.map(team => developAiTeam(team, share, maxUpgrades));

// ---------------------------------------------------------------------------
// Virada da temporada: a matriz e o departamento técnico reagem aos resultados
// ---------------------------------------------------------------------------

// standingsOf(cls): classificação final da classe (com os carros do jogador)
// Devolve as equipes com o programa atualizado e as manchetes das mudanças grandes
export const evolveAiPrograms = (aiTeams, standingsOf, { difficulty, isPlayer }) => {
  const reaction = difficultyOf(difficulty).rivalReaction ?? 1;
  const headlines = [];
  const teams = aiTeams.map(team => {
    const standings = standingsOf(team.class);
    const position = standings.findIndex(item => item.id === team.id) + 1;
    const rivals = standings.filter(item => !isPlayer(item.id));
    const program = programOf(team);
    // Posição que a matriz espera, pela força do programa entre as equipes da IA da classe
    const strength = item => programOf(item).investment * 0.5 + programOf(item).engineering;
    const expected = [...rivals].sort((a, b) => strength(b) - strength(a)).findIndex(item => item.id === team.id) + 1;
    // Carros do jogador à frente empurram a expectativa para baixo, mas também irritam a matriz
    const playerAhead = standings.slice(0, Math.max(0, position - 1)).filter(item => isPlayer(item.id)).length;
    const gap = position - playerAhead - expected;
    let investment = program.investment + gaussian() * 0.04;
    let engineering = program.engineering + gaussian() * 0.025 + (program.investment - 1) * 0.03;
    let change = null;
    if (gap >= 3 && Math.random() < 0.65) {
      investment += randRange(0.06, 0.16) * reaction;
      change = "UP";
    } else if (gap >= 4 && team.tier === 2 && program.investment < 1 && Math.random() < 0.15) {
      investment -= 0.15;
      change = "CUT";
    }
    // Títulos seguidos: a equipe perde gente para os rivais e a matriz começa a olhar para outros programas
    const streak = position === 1 ? (program.streak || 0) + 1 : 0;
    if (position === 1 && Math.random() < 0.5) {
      engineering -= randRange(0.02, 0.06);
    }
    if (streak >= 2 && Math.random() < 0.2 * streak) {
      investment -= randRange(0.08, 0.18);
      change = "CUT";
    }
    // Anos seguidos no fundo do grid: novo parceiro técnico ou reestruturação com mais verba
    let slump = position > standings.length / 2 ? (program.slump || 0) + 1 : 0;
    if (slump >= 2 && Math.random() < 0.35) {
      investment += randRange(0.15, 0.3);
      engineering += randRange(0.03, 0.08);
      slump = 0;
      change = "BOOST";
    }
    // Uma equipe independente na frente das fábricas faz a matriz abrir o cofre (ainda mais se ela foi campeã)
    if (team.tier <= 1 && playerAhead > 0 && standings.slice(0, 3).some(item => isPlayer(item.id))) {
      investment += (isPlayer(standings[0].id) ? randRange(0.06, 0.14) : randRange(0.03, 0.08)) * reaction;
      change = change || "UP";
    }
    investment = round2(clamp(investment, ...INVESTMENT_RANGE));
    engineering = round2(clamp(engineering, ...ENGINEERING_RANGE));
    const delta = investment - program.investment;
    if (change === "BOOST") {
      headlines.push({ team, type: "BOOST", delta });
    } else if (change === "UP" && delta >= 0.1) {
      headlines.push({ team, type: "UP", delta });
    } else if (change === "CUT" || delta <= -0.12) {
      headlines.push({ team, type: "CUT", delta });
    }
    return { ...team, program: { investment, engineering, streak, slump } };
  });
  return { aiTeams: teams, headlines };
};

// Qualidade do conceito no regulamento novo (pontos somados às peças no reset)
export const aiConceptOffset = team => {
  const { investment, engineering } = programOf(team);
  return Math.round(clamp((engineering - 1) * 30 + (investment - 1) * 8 + gaussian() * 5, -10, 14));
};
