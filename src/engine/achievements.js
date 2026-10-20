import { ACHIEVEMENTS } from "../data/constants.js";

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(item => [item.id, item]));

// Registra as conquistas novas (as já desbloqueadas são ignoradas)
export const unlockAchievements = (career, ids, info) => {
  const achievements = { ...(career.achievements || {}) };
  const unlocked = [];
  ids.forEach(id => {
    if (achievements[id] || !ACHIEVEMENT_MAP[id]) {
      return;
    }
    achievements[id] = { ...info };
    unlocked.push(ACHIEVEMENT_MAP[id]);
  });
  return { career: { ...career, achievements }, unlocked };
};

// Conquistas de uma corrida (results = resultados dos carros do jogador)
export const raceAchievementIds = (report, results, { funds = 0, newRecord = false } = {}) => {
  const ids = [];
  const won = result => result.finished && result.classPos === 1;
  if (results.some(result => result.points > 0)) {
    ids.push("first_points");
  }
  if (results.some(result => result.finished && result.classPos <= 3)) {
    ids.push("first_podium");
  }
  if (results.some(won)) {
    ids.push("first_win");
  }
  if (results.some(result => result.pole)) {
    ids.push("pole");
  }
  if (report.track.id === "lemans" && results.some(won)) {
    ids.push("lemans_win");
  }
  if (report.rain && results.some(won)) {
    ids.push("rain_win");
  }
  if (results.some(result => result.finished && result.startClassPosition - result.classPos >= 6)) {
    ids.push("comeback");
  }
  if (results.some(result => won(result) && result.pole && result.fastestLap)) {
    ids.push("grand_slam");
  }
  if (results.length > 1) {
    const [a, b] = results;
    if (a.class === b.class) {
      const positions = [a, b].filter(result => result.finished).map(result => result.classPos).sort();
      if (positions.length === 2 && positions[0] === 1 && positions[1] === 2) {
        ids.push("one_two");
      }
      if (positions.length === 2 && positions[1] <= 3) {
        ids.push("both_podium");
      }
    } else if (won(a) && won(b)) {
      ids.push("double_win");
    }
  }
  if (newRecord) {
    ids.push("track_record");
  }
  if (funds >= 100000000) {
    ids.push("rich");
  }
  return ids;
};

// Conquistas do fim de temporada
export const seasonAchievementIds = (game, { titles = 0, promoted = false } = {}) => {
  const ids = [];
  const races = game.archive?.currentSeasonRaces || [];
  const finishedAll = races.length > 0 && races.every(race => (race.players || [race.player]).filter(Boolean).every(result => result.finished));
  if (finishedAll) {
    ids.push("survivor");
  }
  if (titles >= 1) {
    ids.push("title");
  }
  if (titles >= 2) {
    ids.push("double_title");
  }
  if (promoted) {
    ids.push("promotion");
  }
  if ((game.career.seasonsCompleted || 0) + 1 >= 5) {
    ids.push("veteran");
  }
  return ids;
};
