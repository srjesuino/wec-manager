import { SHARED_DEV_MULT } from "../data/constants.js";
import { upgradeCost, usesToken } from "./economy.js";

// ---------------------------------------------------------------------------
// Equipe do jogador com um ou dois carros
// playerTeam: carro principal + a organização (caixa, reputação, fábrica, staff, patrocínios, extrato)
// sisterTeam: segundo carro (opcional); tem carro, pilotos, pontos e estatísticas próprios
// ---------------------------------------------------------------------------

export const PLAYER_ID = "player";
export const SISTER_ID = "player2";

export const isPlayerId = id => id === PLAYER_ID || id === SISTER_ID;

export const playerEntries = game => [game.playerTeam, game.sisterTeam].filter(Boolean);

export const entryById = (game, id) => playerEntries(game).find(team => team.id === id) || null;

export const programType = game => {
  if (!game.sisterTeam) {
    return "SINGLE";
  }
  return game.sisterTeam.class === game.playerTeam.class ? "SAME_CLASS" : "DUAL_CLASS";
};

export const hasTwoCars = game => !!game.sisterTeam;

// Dois carros na mesma classe usam o mesmo projeto: cada upgrade vale para os dois
export const sharedDevelopment = game => programType(game) === "SAME_CLASS";

export const carLabel = team => `#${team.number}`;

// O segundo carro usa a fábrica da equipe (túnel de vento e centro de motores ficam no carro principal)
export const withTeamFacilities = (game, entry) => ({ ...entry, facilities: game.playerTeam.facilities });

// Custo de um upgrade para um dos carros do jogador (peças para os dois quando o P&D é compartilhado)
export const upgradeCostFor = (game, entry, part) =>
  Math.floor(upgradeCost(withTeamFacilities(game, entry), part) * (sharedDevelopment(game) ? SHARED_DEV_MULT : 1));

// Fichas de homologação: com P&D compartilhado o projeto (e as fichas) é um só, guardado no carro principal
export const tokenOwner = (game, entry) => (sharedDevelopment(game) ? game.playerTeam : entry);
export const tokensLeft = (game, entry) => tokenOwner(game, entry).devTokens ?? 0;
export const canUseToken = (game, entry, part) => !usesToken(part) || tokensLeft(game, entry) > 0;

// Atualiza um dos carros do jogador (e o outro também quando o projeto é compartilhado)
export const mapEntries = (game, fn) => ({
  ...game,
  playerTeam: fn(game.playerTeam),
  ...(game.sisterTeam ? { sisterTeam: fn(game.sisterTeam) } : {})
});

export const updateEntry = (game, id, fn) => ({
  ...game,
  ...(id === SISTER_ID && game.sisterTeam ? { sisterTeam: fn(game.sisterTeam) } : { playerTeam: fn(game.playerTeam) })
});

// Todos os pilotos do jogador, com o carro em que estão
export const playerDrivers = game => playerEntries(game).flatMap(team => team.drivers.map((driver, index) => ({ driver, team, index })));
