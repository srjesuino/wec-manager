import { TRACKS } from "../data/constants.js";
import { clamp, pickRandom, surname } from "../utils/helpers.js";
import { PART_CAP, econ } from "./economy.js";
import { playerEntries, sharedDevelopment, SISTER_ID } from "./team.js";

// ---------------------------------------------------------------------------
// Eventos do paddock: dilemas entre as corridas, com escolhas e consequências
// O evento pendente fica salvo em game.pendingEvent (só dados); a regra de cada escolha está aqui.
// ---------------------------------------------------------------------------

const money = value => `$${(value / 1000000).toFixed(value >= 1000000 ? 1 : 2)}M`;

// Aplica uma mudança no carro de um dos carros do jogador (nos dois quando o projeto é compartilhado)
const tweakCar = (game, entryId, changes) => {
  const apply = team => {
    const car = { ...team.car };
    Object.entries(changes).forEach(([part, delta]) => {
      car[part] = clamp((car[part] ?? 30) + delta, 10, PART_CAP);
    });
    return { ...team, car };
  };
  const shared = sharedDevelopment(game);
  return {
    ...game,
    playerTeam: shared || entryId !== SISTER_ID ? apply(game.playerTeam) : game.playerTeam,
    ...(game.sisterTeam ? { sisterTeam: shared || entryId === SISTER_ID ? apply(game.sisterTeam) : game.sisterTeam } : {})
  };
};

const mapDrivers = (game, fn) => {
  const map = team => ({ ...team, drivers: team.drivers.map(driver => fn(driver, team)) });
  return { ...game, playerTeam: map(game.playerTeam), ...(game.sisterTeam ? { sisterTeam: map(game.sisterTeam) } : {}) };
};

const spend = (game, amount) => ({ ...game, playerTeam: { ...game.playerTeam, funds: game.playerTeam.funds - amount } });
const addReputation = (game, delta) => ({
  ...game,
  playerTeam: { ...game.playerTeam, reputation: clamp(Math.round(((game.playerTeam.reputation ?? 30) + delta) * 10) / 10, 0, 100) }
});
const carName = (game, entry) => (game.sisterTeam ? `#${entry.number}` : "o carro");

const TEMPLATES = {
  experimental_parts: {
    weight: 1,
    build: game => {
      const entry = pickRandom(playerEntries(game));
      return {
        title: "Peças experimentais",
        body: `Um fornecedor oferece um pacote de motor ainda em homologação para ${carName(game, entry)}. Mais potência, mas ninguém garante que aguenta uma corrida inteira.`,
        data: { entryId: entry.id },
        choices: [
          { id: "accept", label: "Instalar o pacote", detail: "Motor +4 · Confiabilidade −6" },
          { id: "decline", label: "Recusar", detail: "Nada muda" }
        ]
      };
    },
    resolve: (game, choice, data) =>
      choice === "accept"
        ? { game: tweakCar(game, data.entryId, { engine: 4, reliability: -6 }), message: "Pacote experimental instalado. Torça pela confiabilidade!" }
        : { game, message: "A equipe preferiu não arriscar." }
  },
  wind_tunnel: {
    weight: 1,
    build: game => {
      const entry = pickRandom(playerEntries(game));
      const cost = Math.floor(1200000 * econ(entry.class));
      return {
        title: "Horário extra no túnel de vento",
        body: `Uma equipe de F1 vendeu horas de túnel de vento que não vai usar. Os aerodinamicistas de ${carName(game, entry)} querem aproveitar.`,
        data: { entryId: entry.id, cost },
        choices: [
          { id: "buy", label: `Comprar (${money(cost)})`, detail: "Aerodinâmica +3", cost },
          { id: "decline", label: "Deixar passar", detail: "Nada muda" }
        ]
      };
    },
    resolve: (game, choice, data) =>
      choice === "buy"
        ? { game: tweakCar(spend(game, data.cost), data.entryId, { aero: 3 }), message: "Sessão no túnel concluída: aerodinâmica +3." }
        : { game, message: "O horário foi para outra equipe." }
  },
  driver_raise: {
    weight: 1,
    condition: game => playerEntries(game).some(team => team.drivers.some(driver => driver.rating >= 70)),
    build: game => {
      const candidates = playerEntries(game).flatMap(team => team.drivers.map(driver => ({ driver, team })));
      const { driver, team } = candidates.sort((a, b) => b.driver.rating - a.driver.rating)[0];
      const raise = Math.floor((driver.wage || 0) * 0.2);
      return {
        title: `${surname(driver.name)} pede aumento`,
        body: `${driver.name}${game.sisterTeam ? ` (#${team.number})` : ""} diz que está abaixo do mercado e quer 20% a mais por corrida. O empresário dele já conversou com rivais.`,
        data: { driverId: driver.id, raise },
        choices: [
          { id: "accept", label: `Dar o aumento (+${money(raise)}/corrida)`, detail: "Moral +15" },
          { id: "decline", label: "Negar", detail: "Moral −15" }
        ]
      };
    },
    resolve: (game, choice, data) => {
      const accepted = choice === "accept";
      return {
        game: mapDrivers(game, driver =>
          driver.id === data.driverId
            ? { ...driver, wage: (driver.wage || 0) + (accepted ? data.raise : 0), morale: clamp((driver.morale ?? 75) + (accepted ? 15 : -15), 20, 100) }
            : driver
        ),
        message: accepted ? "Aumento concedido: o piloto está motivado." : "Pedido negado. O clima nos boxes esfriou."
      };
    }
  },
  private_test: {
    weight: 1,
    condition: game => game.raceIndex < TRACKS.length,
    build: game => {
      const track = TRACKS[game.raceIndex];
      const cost = Math.floor(1500000 * econ(game.playerTeam.class) * (game.sisterTeam ? 1.4 : 1));
      return {
        title: "Teste privado",
        body: `Dá para alugar ${track.name.replace(/^\d+ Hours of /, "")} por um dia antes do fim de semana. Os engenheiros chegariam com o setup bem encaminhado.`,
        data: { cost },
        choices: [
          { id: "buy", label: `Alugar a pista (${money(cost)})`, detail: "Setup +12 pontos na próxima etapa", cost },
          { id: "decline", label: "Economizar", detail: "Nada muda" }
        ]
      };
    },
    resolve: (game, choice, data) =>
      choice === "buy"
        ? { game: { ...spend(game, data.cost), weekendBonus: { setup: 12 } }, message: "Teste agendado: o setup da próxima etapa começa adiantado." }
        : { game, message: "Sem teste privado desta vez." }
  },
  tv_documentary: {
    weight: 1,
    build: () => ({
      title: "Série documental",
      body: "Uma plataforma de streaming quer câmeras nos boxes pelo resto da temporada. Ótimo para a marca, péssimo para a concentração.",
      data: {},
      choices: [
        { id: "accept", label: "Liberar as câmeras", detail: "Reputação +3 · Moral dos pilotos −6" },
        { id: "decline", label: "Recusar", detail: "Nada muda" }
      ]
    }),
    resolve: (game, choice) =>
      choice === "accept"
        ? {
            game: mapDrivers(addReputation(game, 3), driver => ({ ...driver, morale: clamp((driver.morale ?? 75) - 6, 20, 100) })),
            message: "As câmeras chegaram. A equipe ficou famosa — e um pouco tensa."
          }
        : { game, message: "Os bastidores continuam fechados." }
  },
  fan_day: {
    weight: 1,
    build: game => {
      const cost = Math.floor(400000 * econ(game.playerTeam.class));
      return {
        title: "Dia dos fãs",
        body: "O fã-clube propõe um evento com autógrafos e voltas de táxi. Os pilotos adoram, o financeiro nem tanto.",
        data: { cost },
        choices: [
          { id: "accept", label: `Fazer o evento (${money(cost)})`, detail: "Reputação +1.5 · Moral +8", cost },
          { id: "decline", label: "Fica para depois", detail: "Nada muda" }
        ]
      };
    },
    resolve: (game, choice, data) =>
      choice === "accept"
        ? {
            game: mapDrivers(addReputation(spend(game, data.cost), 1.5), driver => ({ ...driver, morale: clamp((driver.morale ?? 75) + 8, 20, 100) })),
            message: "Festa nos boxes! Fãs felizes e pilotos sorrindo."
          }
        : { game, message: "O evento foi adiado." }
  },
  fia_inspection: {
    weight: 0.8,
    build: game => {
      const entry = pickRandom(playerEntries(game));
      const fine = Math.floor(800000 * econ(entry.class));
      return {
        title: "FIA questiona a asa traseira",
        body: `Os comissários acham que a asa de ${carName(game, entry)} flexiona demais em alta velocidade. Dá para contestar ou trocar a peça por uma mais rígida.`,
        data: { entryId: entry.id, fine },
        choices: [
          { id: "contest", label: "Contestar", detail: `50%: nada acontece · 50%: Aero −3 e multa de ${money(fine)}` },
          { id: "comply", label: "Trocar a peça", detail: "Aero −1" }
        ]
      };
    },
    resolve: (game, choice, data) => {
      if (choice === "comply") {
        return { game: tweakCar(game, data.entryId, { aero: -1 }), message: "Peça trocada. Assunto encerrado." };
      }
      if (Math.random() < 0.5) {
        return { game, message: "Recurso aceito! A asa segue como está." };
      }
      return { game: tweakCar(spend(game, data.fine), data.entryId, { aero: -3 }), message: "Recurso negado: multa e uma asa nova, mais lenta." };
    }
  },
  engineer_poached: {
    weight: 0.7,
    condition: game => (game.playerTeam.staff?.raceEngineer?.stars ?? 1) >= 3,
    build: game => {
      const engineer = game.playerTeam.staff.raceEngineer;
      const cost = Math.floor(900000 * engineer.stars * econ(game.playerTeam.class) * 0.5);
      return {
        title: "Assédio ao seu engenheiro",
        body: `Uma equipe de fábrica ofereceu o dobro do salário a ${engineer.name}, seu Engenheiro de Corrida. Para ficar, ele quer um bônus.`,
        data: { cost },
        choices: [
          { id: "pay", label: `Pagar o bônus (${money(cost)})`, detail: "Ele fica", cost },
          { id: "release", label: "Deixar ir", detail: `Engenheiro perde 1★ (vem um substituto) · recebe ${money(cost * 0.6)} de compensação` }
        ]
      };
    },
    resolve: (game, choice, data) => {
      if (choice === "pay") {
        return { game: spend(game, data.cost), message: "Bônus pago. O engenheiro segue com a equipe." };
      }
      const engineer = game.playerTeam.staff.raceEngineer;
      return {
        game: {
          ...game,
          playerTeam: {
            ...game.playerTeam,
            funds: game.playerTeam.funds + Math.floor(data.cost * 0.6),
            staff: { ...game.playerTeam.staff, raceEngineer: { ...engineer, name: `Assistente de ${surname(engineer.name)}`, stars: Math.max(1, engineer.stars - 1) } }
          }
        },
        message: "O engenheiro saiu. O assistente dele assume o rádio."
      };
    }
  },
  sponsor_livery: {
    weight: 0.8,
    build: game => {
      const amount = Math.floor(1000000 * econ(game.playerTeam.class) * (game.sisterTeam ? 1.3 : 1));
      return {
        title: "Pintura especial",
        body: "Uma marca de bebidas quer uma pintura especial na próxima etapa. Paga bem, mas os fãs odeiam quando a cor da equipe some.",
        data: { amount },
        choices: [
          { id: "accept", label: `Aceitar (+${money(amount)})`, detail: "Reputação −1" },
          { id: "decline", label: "Manter as cores da equipe", detail: "Reputação +0.5" }
        ]
      };
    },
    resolve: (game, choice, data) =>
      choice === "accept"
        ? { game: addReputation(spend(game, -data.amount), -1), message: "Contrato fechado. O carro vai ficar... diferente." }
        : { game: addReputation(game, 0.5), message: "Os fãs aprovaram a decisão." }
  },
  team_rivalry: {
    weight: 1.4,
    condition: game => !!game.sisterTeam && game.sisterTeam.class === game.playerTeam.class,
    build: game => ({
      title: "Clima pesado entre os carros",
      body: `Os pilotos do #${game.playerTeam.number} e do #${game.sisterTeam.number} trocaram farpas na imprensa. Todo mundo quer saber quem é o carro principal.`,
      data: {},
      choices: [
        { id: "hierarchy", label: `Definir o #${game.playerTeam.number} como prioridade`, detail: `Moral do #${game.playerTeam.number} +8 · #${game.sisterTeam.number} −12` },
        { id: "equal", label: "Tratamento igual", detail: "Moral de todos −4" },
        { id: "dinner", label: "Jantar de paz", detail: `${money(Math.floor(300000 * econ(game.playerTeam.class)))} · Moral de todos +5`, cost: Math.floor(300000 * econ(game.playerTeam.class)) }
      ]
    }),
    resolve: (game, choice) => {
      const delta = (driver, team) => {
        if (choice === "hierarchy") {
          return team.id === SISTER_ID ? -12 : 8;
        }
        return choice === "dinner" ? 5 : -4;
      };
      const base = choice === "dinner" ? spend(game, Math.floor(300000 * econ(game.playerTeam.class))) : game;
      return {
        game: mapDrivers(base, (driver, team) => ({ ...driver, morale: clamp((driver.morale ?? 75) + delta(driver, team), 20, 100) })),
        message: choice === "hierarchy" ? "Hierarquia definida. Nem todos gostaram." : choice === "dinner" ? "Depois da sobremesa, todos se abraçaram." : "Ninguém ficou feliz, mas ninguém ficou de fora."
      };
    }
  },
  tech_transfer: {
    weight: 1.4,
    condition: game => !!game.sisterTeam && game.sisterTeam.class !== game.playerTeam.class,
    build: game => {
      const gt3 = playerEntries(game).find(team => team.class === "LMGT3");
      const hyper = playerEntries(game).find(team => team.class === "HYPERCAR");
      return {
        title: "Transferência de tecnologia",
        body: `Os engenheiros do Hypercar #${hyper.number} podem passar uma semana ajudando o GT3 #${gt3.number} com a gestão de energia. O projeto principal atrasa um pouco.`,
        data: { gt3: gt3.id, hyper: hyper.id },
        choices: [
          { id: "accept", label: "Mandar os engenheiros", detail: `#${gt3.number}: Eficiência +3 · #${hyper.number}: Chassi −1` },
          { id: "decline", label: "Cada um no seu projeto", detail: "Nada muda" }
        ]
      };
    },
    resolve: (game, choice, data) =>
      choice === "accept"
        ? { game: tweakCar(tweakCar(game, data.gt3, { efficiency: 3 }), data.hyper, { chassis: -1 }), message: "Know-how compartilhado entre os programas." }
        : { game, message: "Os dois programas seguem separados." }
  }
};

// Sorteia um evento para depois da corrida (nem toda etapa tem)
export const rollPaddockEvent = (game, chance = 0.55) => {
  if (game.raceIndex >= TRACKS.length || Math.random() > chance) {
    return null;
  }
  const available = Object.entries(TEMPLATES).filter(([id, template]) => (!template.condition || template.condition(game)) && id !== game.lastEventId);
  const total = available.reduce((sum, [, template]) => sum + template.weight, 0);
  let roll = Math.random() * total;
  const [id, template] = available.find(([, item]) => (roll -= item.weight) <= 0) || available[0];
  return { templateId: id, ...template.build(game) };
};

// Aplica a escolha do jogador
export const resolvePaddockEvent = (game, choiceId) => {
  const event = game.pendingEvent;
  const template = event && TEMPLATES[event.templateId];
  if (!template) {
    return { game: { ...game, pendingEvent: null }, message: null };
  }
  const choice = event.choices.find(item => item.id === choiceId);
  if (choice?.cost && game.playerTeam.funds < choice.cost) {
    return { game, message: "Fundos insuficientes para esta escolha.", error: true };
  }
  const result = template.resolve(game, choiceId, event.data || {});
  return {
    game: { ...result.game, pendingEvent: null, lastEventId: event.templateId },
    message: result.message
  };
};
