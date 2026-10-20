import { useCallback, useEffect, useState } from "react";
import { GAME_VERSION, SAVE_KEY, TRACKS, FACILITIES, FACILITY_MAX_LEVEL, STAFF_ROLES, PART_LABELS } from "./data/constants";
import { formatMoney, generateId } from "./utils/helpers";
import { fetchAiMediaFeed, buildRaceContext, generateRaceMedia } from "./utils/mediaEngine";
import { createNewGame, migrateSave } from "./engine/newGame";
import { applyBop, createWeekend, computeQualifying, createRaceState, allTeams, entrySetupScore } from "./engine/weekend";
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
import { entryById, playerEntries, sharedDevelopment, upgradeCostFor, canUseToken, tokenOwner, PLAYER_ID, SISTER_ID } from "./engine/team";
import MenuScreen from "./screens/MenuScreen";
import DashboardScreen from "./screens/DashboardScreen";
import BriefingScreen from "./screens/BriefingScreen";
import SetupScreen from "./screens/SetupScreen";
import QualifyingScreen from "./screens/QualifyingScreen";
import RaceScreen from "./screens/RaceScreen";
import RaceResultsScreen from "./screens/RaceResultsScreen";
import SeasonEndScreen from "./screens/SeasonEndScreen";
import FiredScreen from "./screens/FiredScreen";
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
  // Carro do jogador em foco no setup e na classificação (equipe com dois carros)
  const [weekendCar, setWeekendCar] = useState(PLAYER_ID);
  const [seasonSummary, setSeasonSummary] = useState(null);
  const [firedSummary, setFiredSummary] = useState(null);
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
    notify(`Meta da diretoria${newGame.sisterTeam ? ` (#${newGame.playerTeam.number})` : ""}: ${newGame.career.objective.text}.`);
    if (newGame.sisterTeam) {
      notify(`Meta da diretoria (#${newGame.sisterTeam.number}): ${newGame.career.objective2.text}.`);
    }
  };

  // -------------------------------------------------------------------------
  // Gestão
  // -------------------------------------------------------------------------
  const updatePlayer = update => setGame(g => ({ ...g, playerTeam: { ...g.playerTeam, ...update(g.playerTeam) } }));

  const buyUpgrade = (part, entryId = PLAYER_ID) => {
    const entry = entryById(game, entryId) || game.playerTeam;
    const funds = game.playerTeam.funds;
    const cost = upgradeCostFor(game, entry, part);
    if (entry.car[part] >= PART_CAP) {
      return;
    }
    if (!canUseToken(game, entry, part)) {
      notify("Sem fichas de homologação nesta temporada: a peça só pode evoluir na próxima.", "error");
      return;
    }
    if (funds < cost) {
      notify("Fundos insuficientes para este upgrade.", "error");
      return;
    }
    const step = Math.random() < bonusUpgradeChance(game.playerTeam) ? UPGRADE_STEP + 1 : UPGRADE_STEP;
    const level = Math.min(PART_CAP, entry.car[part] + step);
    const shared = sharedDevelopment(game);
    const ownerId = tokenOwner(game, entry).id;
    setGame(g => {
      const upgrade = team => ({
        ...team,
        car: { ...team.car, [part]: level },
        ...(team.id === ownerId && usesToken(part) ? { devTokens: Math.max(0, (team.devTokens ?? 0) - 1) } : {})
      });
      const touches = id => shared || id === entry.id;
      const playerTeam = touches(PLAYER_ID) ? upgrade(g.playerTeam) : g.playerTeam;
      return {
        ...g,
        playerTeam: { ...playerTeam, funds: g.playerTeam.funds - cost },
        ...(g.sisterTeam ? { sisterTeam: touches(SISTER_ID) ? upgrade(g.sisterTeam) : g.sisterTeam } : {})
      };
    });
    const label = g => (g.sisterTeam ? (shared ? " (os dois carros)" : ` #${entry.number}`) : "");
    notify(
      `P&D${label(game)}: ${PART_LABELS[part]} ${entry.car[part]} → ${level}${step > UPGRADE_STEP ? " (bônus do Diretor Técnico!)" : ""}. Saldo: ${formatMoney(funds - cost)}`,
      "success"
    );
  };

  const upgradeFacility = id => {
    const team = game.playerTeam;
    const level = team.facilities[id];
    if (level >= FACILITY_MAX_LEVEL) {
      return;
    }
    const cost = facilityUpgradeCost(team.class, level);
    if (team.funds < cost) {
      notify("Fundos insuficientes para ampliar esta instalação.", "error");
      return;
    }
    updatePlayer(t => ({ funds: t.funds - cost, facilities: { ...t.facilities, [id]: level + 1 } }));
    notify(`${FACILITIES[id].name} ampliado para o nível ${level + 1}.`, "success");
  };

  const hireStaff = (role, candidate) => {
    const team = game.playerTeam;
    const fee = staffHiringFee(candidate.stars, team.class);
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

  // Atualiza o carro (principal ou segundo) que tem o piloto
  const entryWithDriver = (g, driverId) => playerEntries(g).find(team => team.drivers.some(d => d.id === driverId));
  const setEntry = (g, id, patch) => (id === SISTER_ID ? { ...g, sisterTeam: { ...g.sisterTeam, ...patch } } : { ...g, playerTeam: { ...g.playerTeam, ...patch } });

  const signDriver = (driver, replaceId) => {
    const team = game.playerTeam;
    const entry = entryWithDriver(game, replaceId) || team;
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
      const current = entryWithDriver(g, replaceId) || g.playerTeam;
      const drivers = current.drivers.filter(d => d.id !== replaceId);
      const lineup = leaving && current.drivers[0]?.id === replaceId ? [signed, ...drivers] : [...drivers, signed];
      const withLineup = setEntry(g, current.id, { drivers: lineup });
      return {
        ...withLineup,
        playerTeam: { ...withLineup.playerTeam, funds: withLineup.playerTeam.funds - fee - penalty },
        driversPool: [
          ...g.driversPool.filter(d => d.id !== driver.id),
          ...(leaving ? [{ ...leaving, teamId: null, contractYears: 0 }] : [])
        ]
      };
    });
    notify(`Contratado${game.sisterTeam ? ` para o #${entry.number}` : ""}: ${driver.name}${leaving ? ` (sai ${leaving.name})` : ""}.`, "success");
  };

  const setStarter = driverId => {
    setGame(g => {
      const entry = entryWithDriver(g, driverId);
      if (!entry) {
        return g;
      }
      const starter = entry.drivers.find(d => d.id === driverId);
      return setEntry(g, entry.id, { drivers: [starter, ...entry.drivers.filter(d => d.id !== driverId)] });
    });
  };

  // Troca dois pilotos de carro (só com dois carros); o salário de contrato não muda
  const swapDrivers = (driverId, otherId) => {
    if (!game.sisterTeam) {
      return;
    }
    const a = entryWithDriver(game, driverId);
    const b = entryWithDriver(game, otherId);
    if (!a || !b || a.id === b.id) {
      return;
    }
    const driverA = a.drivers.find(d => d.id === driverId);
    const driverB = b.drivers.find(d => d.id === otherId);
    setGame(g => {
      const swapIn = (team, outId, incoming) => team.drivers.map(d => (d.id === outId ? { ...incoming, teamId: team.id } : d));
      const first = setEntry(g, a.id, { drivers: swapIn(a, driverId, driverB) });
      return setEntry(first, b.id, { drivers: swapIn(b, otherId, driverA) });
    });
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
    const offer = sponsorOffer(sponsor, team.class);
    updatePlayer(t => ({ funds: t.funds + offer.signingBonus, sponsors: [...t.sponsors, { ...offer, remaining: offer.duration }] }));
    notify(`Contrato assinado com ${sponsor.name}. Bônus: ${formatMoney(offer.signingBonus)}.`, "success");
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
    setWeekendCar(PLAYER_ID);
    setScreen("briefing");
  };

  // Próximo carro do jogador que ainda não fez a etapa (setup ou volta lançada)
  const nextCarWithout = (key, next) => playerEntries(game).find(team => next[key]?.[team.id] == null);

  const onSetupComplete = score => {
    const next = {
      ...weekend,
      setupScores: { ...weekend.setupScores, [weekendCar]: score },
      ...(weekendCar === PLAYER_ID ? { setupScore: score } : {})
    };
    setWeekend(next);
    const label = game.sisterTeam ? ` #${entryById(game, weekendCar)?.number}` : "";
    notify(`Setup${label} finalizado. Eficiência: ${score.toFixed(1)}%`);
    const pending = nextCarWithout("setupScores", next);
    if (pending) {
      setWeekendCar(pending.id);
      return;
    }
    setWeekendCar(PLAYER_ID);
    setScreen("qualy");
  };

  const onQualyComplete = score => {
    const next = {
      ...weekend,
      qualyScores: { ...weekend.qualyScores, [weekendCar]: score },
      ...(weekendCar === PLAYER_ID ? { qualyScore: score } : {})
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

  // startTyre: um composto (um carro) ou { [id do carro]: composto }
  const startRace = startTyre => {
    const tyres = typeof startTyre === "string" ? { [PLAYER_ID]: startTyre } : startTyre;
    const next = { ...weekend, startTyre: tyres[PLAYER_ID] ?? weekend.startTyre, startTyres: tyres };
    setWeekend(next);
    setRaceState(createRaceState(game, next));
    setScreen("race");
  };

  // -------------------------------------------------------------------------
  // Corrida
  // -------------------------------------------------------------------------
  const advance = useCallback(ticks => setRaceState(s => (s ? advanceRace(s, ticks) : s)), []);
  const simulateRest = () => setRaceState(simulateToEnd(raceState));
  const requestPit = (plan, teamId) => setRaceState(s => requestPitStop(s, plan, teamId));
  const cancelPit = teamId => setRaceState(s => cancelPitStop(s, teamId));
  const changeStrategy = (strategy, teamId) => setRaceState(s => setPlayerStrategy(s, strategy, teamId));
  const toggleAutoStrategy = (enabled, teamId) => setRaceState(s => setPlayerAutoStrategy(s, enabled, teamId));
  const changeTeamOrders = orders => setRaceState(s => setTeamOrders(s, orders));
  const swapCars = () => setRaceState(s => swapTeamCars(s));

  const generateNews = (report, nextGame) => {
    setIsNewsLoading(true);
    setTimeout(async () => {
      try {
        const allTeams = [nextGame.playerTeam, ...nextGame.aiTeams];
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
  const confirmSeasonEnd = decisions => {
    const result = startNextSeason(game, decisions);
    if (result.fired) {
      setFiredSummary({ ...result.summary, game });
      localStorage.removeItem(SAVE_KEY);
      setHasAutoSave(false);
      setScreen("fired");
      return;
    }
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
    const champions = result.summary.championEntries || [];
    notify(
      `Temporada encerrada. ${
        champions.length
          ? `VOCÊ FOI CAMPEÃO${champions.length > 1 ? " NAS DUAS CLASSES" : ""}!`
          : `Campeão da classe: ${(game.playerTeam.class === "HYPERCAR" ? result.summary.hyperChampion : result.summary.gt3Champion)?.name}`
      }`,
      "success"
    );
    notify(result.summary.regulation.text, result.summary.regulation.type === "STABLE" ? "info" : "warn");
  };

  const newCareer = () => {
    setFiredSummary(null);
    setGame(null);
    setScreen("menu");
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
          markAllRead,
          exportSaveFile
        }}
      />
    );
  } else if (screen === "briefing" && weekend) {
    content = <BriefingScreen game={game} weekend={weekend} onContinue={() => setScreen("setup")} />;
  } else if (screen === "setup" && weekend) {
    const entry = entryById(game, weekendCar) || game.playerTeam;
    const mainScore = entrySetupScore(weekend, PLAYER_ID);
    content = (
      <SetupScreen
        key={entry.id}
        game={game}
        weekend={weekend}
        entry={entry}
        copyFrom={entry.id !== PLAYER_ID && weekend.setupScores?.[PLAYER_ID] != null ? { number: game.playerTeam.number, score: mainScore * (entry.class === game.playerTeam.class ? 0.92 : 0.75) } : null}
        onSetupComplete={onSetupComplete}
      />
    );
  } else if (screen === "qualy" && weekend) {
    content = (
      <QualifyingScreen
        key={weekend.qualifying ? "results" : weekendCar}
        game={game}
        weekend={weekend}
        entry={entryById(game, weekendCar) || game.playerTeam}
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
  } else if (screen === "fired" && firedSummary) {
    content = <FiredScreen summary={firedSummary} onNewCareer={newCareer} />;
  }

  return (
    <>
      {content}
      {modal === "stats" && game && (
        <StatsModal
          archive={game.archive}
          currentSeason={game.season}
          currentStandings={allTeams(game)}
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
