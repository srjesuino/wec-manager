import { useCallback, useEffect, useState } from "react";
import { GAME_VERSION, SAVE_KEY, TRACKS, FACILITIES, FACILITY_MAX_LEVEL, STAFF_ROLES, PART_LABELS, CLASSES, CLASS_RULES } from "./data/constants";
import { formatMoney, generateId } from "./utils/helpers";
import { fetchAiMediaFeed, buildRaceContext, generateRaceMedia } from "./utils/mediaEngine";
import { createNewGame, migrateSave } from "./engine/newGame";
import { applyBop, createWeekend, computeQualifying, createRaceState, entrySetupScore } from "./engine/weekend";
import {
  advanceRace,
  simulateToEnd,
  requestPitStop,
  cancelPitStop,
  setPlayerStrategy,
  setPlayerAutoStrategy,
  setTeamOrders,
  swapTeamCars
} from "./engine/race";
import { buildRaceReport, applyRaceResults } from "./engine/results";
import { buildSeasonSummary, startNextSeason } from "./engine/season";
import { teamStandings } from "./engine/career";
import {
  PART_CAP,
  UPGRADE_STEP,
  usesToken,
  bonusUpgradeChance,
  facilityUpgradeCost,
  staffHiringFee,
  signingFee,
  releaseCost,
  requiredReputation,
  sponsorOffer,
  sponsorSlots
} from "./engine/economy";
import { signDriverTo } from "./engine/drivers";
import { entryById, playerEntries, programUpgradeCost, canUseToken, mainClass, gridViews, carsInProgram, PLAYER_ID } from "./engine/team";
import { sandboxCreateTeam, sandboxUpdateTeam, sandboxDeleteTeam } from "./engine/sandbox";
import MenuScreen from "./screens/MenuScreen";
import DashboardScreen from "./screens/DashboardScreen";
import BriefingScreen from "./screens/BriefingScreen";
import SetupScreen from "./screens/SetupScreen";
import QualifyingScreen from "./screens/QualifyingScreen";
import RaceScreen from "./screens/RaceScreen";
import RaceResultsScreen from "./screens/RaceResultsScreen";
import SeasonEndScreen from "./screens/SeasonEndScreen";
import Toasts from "./components/ui/Toasts";
import StatsModal from "./components/modals/StatsModal";
import HelpModal from "./components/modals/HelpModal";
import SettingsModal from "./components/modals/SettingsModal";

// Corridas restantes na temporada (para a multa de rescisão)
const racesLeft = game => Math.max(1, TRACKS.length - game.raceIndex);

function App() {
  const [screen, setScreen] = useState("menu");
  const [game, setGame] = useState(null);
  const [weekend, setWeekend] = useState(null);
  const [raceState, setRaceState] = useState(null);
  const [raceResult, setRaceResult] = useState(null);
  // Carro do jogador em foco no setup e na classificação (id do carro)
  const [weekendCar, setWeekendCar] = useState(null);
  const [seasonSummary, setSeasonSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [hasAutoSave, setHasAutoSave] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isNewsLoading, setIsNewsLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Notificações (no original eram geradas mas nunca exibidas)
  // -------------------------------------------------------------------------
  const notify = useCallback((text, type = "info") => {
    const id = generateId();
    setToasts(prev => [...prev.slice(-4), { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), 4500);
  }, []);
  const dismissToast = id => setToasts(prev => prev.filter(toast => toast.id !== id));

  // -------------------------------------------------------------------------
  // Tela cheia
  // -------------------------------------------------------------------------
  const toggleFullScreen = () => {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    } else {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullScreen(true);
        })
        .catch(error => {
          console.log(`Error attempting to enable full-screen mode: ${error.message}`);
        });
    }
  };
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  // -------------------------------------------------------------------------
  // Save / load
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (localStorage.getItem(SAVE_KEY)) {
      setHasAutoSave(true);
    }
  }, []);
  useEffect(() => {
    if (game && ["dashboard", "seasonEnd", "raceResults"].includes(screen)) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ ...game, timestamp: new Date().toISOString() }));
        setHasAutoSave(true);
      } catch (error) {
        console.error("Erro no autosave:", error);
      }
    }
  }, [game, screen]);

  const applySaveData = data => {
    try {
      const loaded = migrateSave(data);
      setGame(loaded);
      setWeekend(null);
      setRaceState(null);
      setRaceResult(null);
      if (loaded.raceIndex >= TRACKS.length) {
        setSeasonSummary(buildSeasonSummary(loaded));
        setScreen("seasonEnd");
      } else {
        setActiveTab("overview");
        setScreen("dashboard");
      }
      notify("Jogo carregado com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao carregar save:", error);
      alert("Arquivo de save inválido ou corrompido.");
    }
  };
  const loadAutoSave = () => {
    const savedData = localStorage.getItem(SAVE_KEY);
    if (savedData) {
      applySaveData(JSON.parse(savedData));
    }
  };
  const exportSaveFile = () => {
    if (!game) {
      return;
    }
    const saveData = { ...game, version: GAME_VERSION, timestamp: new Date().toISOString() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saveData));
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", dataStr);
    downloadLink.setAttribute("download", `wec_save_${game.playerTeam.name.replace(/\s+/g, "_")}_S${game.season}.json`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    notify("Save exportado.", "success");
  };
  const importSaveFile = event => {
    const reader = new FileReader();
    const file = event.target.files[0];
    if (file) {
      reader.readAsText(file, "UTF-8");
      reader.onload = loadEvent => {
        try {
          applySaveData(JSON.parse(loadEvent.target.result));
        } catch {
          alert("Erro ao ler o arquivo. Certifique-se que é um .json válido.");
        }
      };
    }
  };
  const resetSave = () => {
    localStorage.removeItem(SAVE_KEY);
    setHasAutoSave(false);
    setGame(null);
    setModal(null);
    setScreen("menu");
  };

  // -------------------------------------------------------------------------
  // Nova carreira
  // -------------------------------------------------------------------------
  const initGame = options => {
    const newGame = createNewGame(options);
    setGame(newGame);
    setActiveTab("overview");
    setScreen("dashboard");
    notify(`WEC Temporada ${newGame.season}. Grid multiclasse definido!`, "success");
    Object.values(newGame.career.objectives).forEach(objective => notify(`Meta do conselho: ${objective.text}.`));
  };

  // -------------------------------------------------------------------------
  // Gestão
  // -------------------------------------------------------------------------
  const updatePlayer = update => setGame(g => ({ ...g, playerTeam: { ...g.playerTeam, ...update(g.playerTeam) } }));
  const updateEntries = (g, fn) => ({ ...g, entries: g.entries.map(fn) });

  // P&D do programa de uma classe (vale para todos os carros da equipe na classe)
  const buyUpgrade = (part, cls) => {
    const team = game.playerTeam;
    const program = team.programs?.[cls];
    if (!program || program.car[part] >= PART_CAP) {
      return;
    }
    if (!canUseToken(team, cls, part)) {
      notify("Sem fichas de homologação nesta temporada: a peça só pode evoluir na próxima.", "error");
      return;
    }
    const cost = programUpgradeCost(game, team, cls, part);
    if (team.funds < cost) {
      notify("Fundos insuficientes para este upgrade.", "error");
      return;
    }
    const step = Math.random() < bonusUpgradeChance(team) ? UPGRADE_STEP + 1 : UPGRADE_STEP;
    const level = Math.min(PART_CAP, program.car[part] + step);
    setGame(g => {
      const current = g.playerTeam.programs[cls];
      return {
        ...g,
        playerTeam: {
          ...g.playerTeam,
          funds: g.playerTeam.funds - cost,
          programs: {
            ...g.playerTeam.programs,
            [cls]: { ...current, car: { ...current.car, [part]: level }, devTokens: usesToken(part) ? Math.max(0, (current.devTokens ?? 0) - 1) : current.devTokens }
          }
        }
      };
    });
    const label = Object.keys(team.programs).length > 1 || carsInProgram(game, PLAYER_ID, cls) > 1 ? ` (${CLASS_RULES[cls].label})` : "";
    notify(
      `P&D${label}: ${PART_LABELS[part]} ${program.car[part]} → ${level}${step > UPGRADE_STEP ? " (bônus do Diretor Técnico!)" : ""}. Saldo: ${formatMoney(team.funds - cost)}`,
      "success"
    );
  };

  const upgradeFacility = id => {
    const team = game.playerTeam;
    const level = team.facilities[id];
    if (level >= FACILITY_MAX_LEVEL) {
      return;
    }
    const cost = facilityUpgradeCost(mainClass(team), level);
    if (team.funds < cost) {
      notify("Fundos insuficientes para ampliar esta instalação.", "error");
      return;
    }
    updatePlayer(t => ({ funds: t.funds - cost, facilities: { ...t.facilities, [id]: level + 1 } }));
    notify(`${FACILITIES[id].name} ampliado para o nível ${level + 1}.`, "success");
  };

  const hireStaff = (role, candidate) => {
    const team = game.playerTeam;
    const fee = staffHiringFee(candidate.stars, mainClass(team));
    if (team.funds < fee) {
      notify("Fundos insuficientes para contratar.", "error");
      return;
    }
    setGame(g => ({
      ...g,
      playerTeam: { ...g.playerTeam, funds: g.playerTeam.funds - fee, staff: { ...g.playerTeam.staff, [role]: candidate } },
      staffMarket: {
        ...g.staffMarket,
        [role]: [...g.staffMarket[role].filter(c => c.id !== candidate.id), g.playerTeam.staff[role]].filter(Boolean)
      }
    }));
    notify(`${candidate.name} é o novo ${STAFF_ROLES[role].name}.`, "success");
  };

  // Carro do jogador que tem o piloto
  const entryWithDriver = (g, driverId) => playerEntries(g).find(entry => entry.drivers.some(d => d.id === driverId));

  const signDriver = (driver, replaceId) => {
    const team = game.playerTeam;
    const entry = entryWithDriver(game, replaceId);
    if (!entry) {
      return;
    }
    const fee = signingFee(driver, entry.class);
    const leaving = entry.drivers.find(d => d.id === replaceId);
    const penalty = leaving ? releaseCost(leaving, racesLeft(game)) : 0;
    if ((team.reputation ?? 0) < requiredReputation(driver)) {
      notify(`${driver.name} só aceita equipes com reputação ${requiredReputation(driver)}+.`, "error");
      return;
    }
    if (team.funds < fee + penalty) {
      notify("Fundos insuficientes para esta contratação.", "error");
      return;
    }
    const signed = signDriverTo(driver, entry, 2);
    setGame(g => {
      const withLineup = updateEntries(g, current => {
        if (current.id !== entry.id) {
          return current;
        }
        const drivers = current.drivers.filter(d => d.id !== replaceId);
        return { ...current, drivers: current.drivers[0]?.id === replaceId ? [signed, ...drivers] : [...drivers, signed] };
      });
      return {
        ...withLineup,
        playerTeam: { ...withLineup.playerTeam, funds: withLineup.playerTeam.funds - fee - penalty },
        driversPool: [...g.driversPool.filter(d => d.id !== driver.id), ...(leaving ? [{ ...leaving, teamId: null, entryId: null, contractYears: 0 }] : [])]
      };
    });
    notify(`Contratado para o #${entry.number}: ${driver.name}${leaving ? ` (sai ${leaving.name})` : ""}.`, "success");
  };

  const setStarter = driverId => {
    setGame(g => {
      const entry = entryWithDriver(g, driverId);
      if (!entry) {
        return g;
      }
      const starter = entry.drivers.find(d => d.id === driverId);
      return updateEntries(g, current => (current.id === entry.id ? { ...current, drivers: [starter, ...current.drivers.filter(d => d.id !== driverId)] } : current));
    });
  };

  // Troca dois pilotos de carro; o salário de contrato não muda
  const swapDrivers = (driverId, otherId) => {
    const a = entryWithDriver(game, driverId);
    const b = entryWithDriver(game, otherId);
    if (!a || !b || a.id === b.id) {
      return;
    }
    const driverA = a.drivers.find(d => d.id === driverId);
    const driverB = b.drivers.find(d => d.id === otherId);
    setGame(g =>
      updateEntries(g, entry => {
        if (entry.id === a.id) {
          return { ...entry, drivers: entry.drivers.map(d => (d.id === driverId ? { ...driverB, entryId: a.id } : d)) };
        }
        if (entry.id === b.id) {
          return { ...entry, drivers: entry.drivers.map(d => (d.id === otherId ? { ...driverA, entryId: b.id } : d)) };
        }
        return entry;
      })
    );
    notify(`${driverA.name} vai para o #${b.number} e ${driverB.name} para o #${a.number}.`, "success");
  };

  const signSponsor = sponsor => {
    const team = game.playerTeam;
    if (team.sponsors.length >= sponsorSlots(team)) {
      notify(`Limite de ${sponsorSlots(team)} patrocinadores atingido.`, "error");
      return;
    }
    if ((team.reputation ?? 0) < (sponsor.minReputation ?? 0)) {
      notify(`${sponsor.name} exige reputação ${sponsor.minReputation}+.`, "error");
      return;
    }
    const offer = sponsorOffer(sponsor, mainClass(team));
    updatePlayer(t => ({ funds: t.funds + offer.signingBonus, sponsors: [...t.sponsors, { ...offer, remaining: offer.duration }] }));
    notify(`Contrato assinado com ${sponsor.name}. Bônus: ${formatMoney(offer.signingBonus)}.`, "success");
  };

  // Editor de grid (sandbox)
  const applySandbox = (result, message) => {
    if (result.error) {
      notify(result.error, "error");
      return false;
    }
    setGame(result.game);
    notify(message, "success");
    return true;
  };
  const createTeam = options => applySandbox(sandboxCreateTeam(game, options), `${options.name} entra no grid da ${CLASS_RULES[options.cls]?.label}.`);
  const editTeam = (teamId, patch) => applySandbox(sandboxUpdateTeam(game, teamId, patch), "Equipe atualizada.");
  const deleteTeam = teamId => {
    const team = game.teams.find(item => item.id === teamId);
    return applySandbox(sandboxDeleteTeam(game, teamId), `${team?.name ?? "Equipe"} saiu do grid.`);
  };

  const markAllRead = () => {
    setGame(g => ({ ...g, newsFeed: g.newsFeed.map(item => ({ ...item, read: true })) }));
  };

  const updateSettings = patch => setGame(g => ({ ...g, settings: { ...g.settings, ...patch } }));

  // -------------------------------------------------------------------------
  // Fim de semana
  // -------------------------------------------------------------------------
  const startWeekend = () => {
    if (!game || game.raceIndex >= TRACKS.length) {
      return;
    }
    const withBop = applyBop(game, TRACKS[game.raceIndex]);
    setGame(withBop);
    setWeekend(createWeekend(withBop));
    setWeekendCar(playerEntries(withBop)[0]?.id ?? null);
    setScreen("briefing");
  };

  // Próximo carro do jogador que ainda não fez a etapa (setup ou volta lançada)
  const nextCarWithout = (key, next) => playerEntries(game).find(entry => next[key]?.[entry.id] == null);
  const firstCarId = game ? playerEntries(game)[0]?.id : null;

  const onSetupComplete = score => {
    const next = {
      ...weekend,
      setupScores: { ...weekend.setupScores, [weekendCar]: score },
      ...(weekendCar === firstCarId ? { setupScore: score } : {})
    };
    setWeekend(next);
    const label = playerEntries(game).length > 1 ? ` #${entryById(game, weekendCar)?.number}` : "";
    notify(`Setup${label} finalizado. Eficiência: ${score.toFixed(1)}%`);
    const pending = nextCarWithout("setupScores", next);
    if (pending) {
      setWeekendCar(pending.id);
      return;
    }
    setWeekendCar(firstCarId);
    setScreen("qualy");
  };

  const onQualyComplete = score => {
    const next = {
      ...weekend,
      qualyScores: { ...weekend.qualyScores, [weekendCar]: score },
      ...(weekendCar === firstCarId ? { qualyScore: score } : {})
    };
    const pending = nextCarWithout("qualyScores", next);
    if (pending) {
      setWeekend(next);
      setWeekendCar(pending.id);
      return;
    }
    next.qualifying = computeQualifying(game, next);
    setWeekend(next);
  };

  // Dados de setup de um carro irmão já acertado (mesma classe = mais confiáveis)
  const setupCopyFor = entry => {
    const done = playerEntries(game).filter(other => other.id !== entry.id && weekend?.setupScores?.[other.id] != null);
    const options = done.map(other => ({ number: other.number, score: entrySetupScore(weekend, other.id) * (other.class === entry.class ? 0.92 : 0.75) }));
    return options.sort((a, b) => b.score - a.score)[0] || null;
  };

  // startTyre: um composto para todos os carros ou { [id do carro]: composto }
  const startRace = startTyre => {
    const tyres = typeof startTyre === "string" ? Object.fromEntries(playerEntries(game).map(entry => [entry.id, startTyre])) : startTyre;
    const next = { ...weekend, startTyre: tyres[firstCarId] ?? weekend.startTyre, startTyres: tyres };
    setWeekend(next);
    setRaceState(createRaceState(game, next));
    setScreen("race");
  };

  // -------------------------------------------------------------------------
  // Corrida
  // -------------------------------------------------------------------------
  const advance = useCallback(ticks => setRaceState(s => (s ? advanceRace(s, ticks) : s)), []);
  const simulateRest = () => setRaceState(simulateToEnd(raceState));
  const requestPit = (plan, entryId) => setRaceState(s => requestPitStop(s, plan, entryId));
  const cancelPit = entryId => setRaceState(s => cancelPitStop(s, entryId));
  const changeStrategy = (strategy, entryId) => setRaceState(s => setPlayerStrategy(s, strategy, entryId));
  const toggleAutoStrategy = (enabled, entryId) => setRaceState(s => setPlayerAutoStrategy(s, enabled, entryId));
  const changeTeamOrders = (cls, orders) => setRaceState(s => setTeamOrders(s, cls, orders));
  const swapCars = cls => setRaceState(s => swapTeamCars(s, cls));

  const generateNews = (report, nextGame) => {
    setIsNewsLoading(true);
    setTimeout(async () => {
      try {
        const allTeams = gridViews(nextGame);
        let media = null;
        if (nextGame.settings?.aiNews !== false) {
          media = await fetchAiMediaFeed(buildRaceContext(report, nextGame.playerTeam));
        }
        if (!media) {
          media = generateRaceMedia(report, nextGame.playerTeam, allTeams);
        }
        setGame(g => (g ? { ...g, newsFeed: [...media, ...g.newsFeed].slice(0, 50) } : g));
      } catch (error) {
        console.error("Background News Gen Failed", error);
      } finally {
        setIsNewsLoading(false);
      }
    }, 100);
  };

  const finishRace = () => {
    const report = buildRaceReport(raceState, game);
    const { game: nextGame, summary } = applyRaceResults(game, report);
    setGame(nextGame);
    setRaceResult({ report, summary });
    setScreen("raceResults");
    generateNews(report, nextGame);
  };

  const continueAfterRace = () => {
    setRaceState(null);
    setWeekend(null);
    setRaceResult(null);
    if (game.raceIndex >= TRACKS.length) {
      setSeasonSummary(buildSeasonSummary(game));
      setScreen("seasonEnd");
    } else {
      setActiveTab("news");
      setScreen("dashboard");
    }
  };

  // -------------------------------------------------------------------------
  // Temporada
  // -------------------------------------------------------------------------
  // decisions: { renew, cars: { HYPERCAR, LMGT3 }, numbers }
  const confirmSeasonEnd = decisions => {
    const result = startNextSeason(game, decisions);
    const nextGame = result.notes.length
      ? {
          ...result.game,
          newsFeed: [
            {
              id: generateId(),
              type: "NEWS",
              source: "Intertemporada",
              title: `Resumo do inverno ${result.game.season}`,
              body: result.notes.join(" "),
              date: "Pré-Temporada",
              read: false,
              importance: "MEDIUM",
              tags: ["EQUIPE"]
            },
            ...result.game.newsFeed
          ]
        }
      : result.game;
    setGame(nextGame);
    setSeasonSummary(null);
    setActiveTab("overview");
    setScreen("dashboard");
    const champions = result.summary.championClasses || [];
    notify(
      champions.length
        ? `Temporada encerrada. VOCÊ FOI CAMPEÃO DE EQUIPES ${champions.length > 1 ? "NAS DUAS CLASSES" : `DA ${CLASS_RULES[champions[0]].label.toUpperCase()}`}!`
        : `Temporada encerrada. Campeões de equipes: ${result.summary.hyperChampion?.name ?? "—"} (Hypercar) e ${result.summary.gt3Champion?.name ?? "—"} (LMGT3).`,
      "success"
    );
    if (result.cut) {
      notify(result.cut.text, "error");
    }
    notify(result.summary.regulation.text, result.summary.regulation.type === "STABLE" ? "info" : "warn");
  };

  // -------------------------------------------------------------------------
  // Telas
  // -------------------------------------------------------------------------
  let content = null;
  if (screen === "menu") {
    content = (
      <MenuScreen
        initGame={initGame}
        importSaveFile={importSaveFile}
        loadAutoSave={loadAutoSave}
        hasAutoSave={hasAutoSave}
        openHelp={() => setModal("help")}
      />
    );
  } else if (screen === "dashboard" && game) {
    content = (
      <DashboardScreen
        game={game}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isNewsLoading={isNewsLoading}
        isFullScreen={isFullScreen}
        toggleFullScreen={toggleFullScreen}
        openModal={setModal}
        actions={{
          startWeekend,
          buyUpgrade,
          upgradeFacility,
          hireStaff,
          signDriver,
          setStarter,
          swapDrivers,
          signSponsor,
          createTeam,
          editTeam,
          deleteTeam,
          markAllRead,
          exportSaveFile
        }}
      />
    );
  } else if (screen === "briefing" && weekend) {
    content = <BriefingScreen game={game} weekend={weekend} onContinue={() => setScreen("setup")} />;
  } else if (screen === "setup" && weekend) {
    const entry = entryById(game, weekendCar) || playerEntries(game)[0];
    content = <SetupScreen key={entry.id} game={game} weekend={weekend} entry={entry} copyFrom={setupCopyFor(entry)} onSetupComplete={onSetupComplete} />;
  } else if (screen === "qualy" && weekend) {
    const entry = entryById(game, weekendCar) || playerEntries(game)[0];
    content = (
      <QualifyingScreen
        key={weekend.qualifying ? "results" : weekendCar}
        game={game}
        weekend={weekend}
        entry={entry}
        autoLap={entry.id !== firstCarId}
        onQualyComplete={onQualyComplete}
        onStartRace={startRace}
      />
    );
  } else if (screen === "race" && raceState) {
    content = (
      <RaceScreen
        raceState={raceState}
        game={game}
        advance={advance}
        simulateRest={simulateRest}
        requestPit={requestPit}
        cancelPit={cancelPit}
        changeStrategy={changeStrategy}
        toggleAutoStrategy={toggleAutoStrategy}
        changeTeamOrders={changeTeamOrders}
        swapCars={swapCars}
        endRace={finishRace}
      />
    );
  } else if (screen === "raceResults" && raceResult) {
    content = <RaceResultsScreen game={game} report={raceResult.report} summary={raceResult.summary} onContinue={continueAfterRace} />;
  } else if (screen === "seasonEnd" && game) {
    content = <SeasonEndScreen game={game} summary={seasonSummary || buildSeasonSummary(game)} onConfirm={confirmSeasonEnd} exportSaveFile={exportSaveFile} />;
  }

  return (
    <>
      {content}
      {modal === "stats" && game && (
        <StatsModal
          archive={game.archive}
          currentSeason={game.season}
          currentStandings={CLASSES.flatMap(cls =>
            teamStandings(game, cls).map(row => ({ id: row.team.id, name: row.team.name, class: cls, color: row.team.color, points: row.points, stats: row.stats })))}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "settings" && game && (
        <SettingsModal
          settings={game.settings}
          career={game.career}
          onChange={updateSettings}
          onReset={resetSave}
          onMenu={() => {
            setModal(null);
            setScreen("menu");
          }}
          onClose={() => setModal(null)}
        />
      )}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default App;
