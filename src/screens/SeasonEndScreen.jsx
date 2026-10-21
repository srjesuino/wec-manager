import { useState } from "react";
import { Car, Crown, FileSignature, Flag, Medal, RotateCcw, Save, Scissors, Star, Target, TriangleAlert, Trophy } from "lucide-react";
import { CLASSES, CLASS_RULES, CONFIDENCE_AFTER_CUT } from "../data/constants";
import { formatMoney } from "../utils/helpers";
import { planEntryCost, validatePlan } from "../engine/season";
import { teamScoringText } from "../engine/team";
import { CategoryBadge, Flag as NationFlag, MeterBar, confidenceColor } from "../components/ui/common";

const ChampionCard = ({ title, team, car, icon: Icon, colorClass, borderClass }) => (
  <div className={`flex-1 bg-gray-900 border ${borderClass} rounded-xl p-6 relative overflow-hidden group shadow-2xl`}>
    <div className={`absolute top-0 right-0 p-8 opacity-10 ${colorClass} group-hover:opacity-20 transition-opacity`}>
      <Icon size={120} />
    </div>
    <div className="relative z-10 flex flex-col items-center text-center">
      <div className={`mb-4 p-3 rounded-full ${colorClass} bg-opacity-20 border-2 ${borderClass}`}>
        <Icon size={40} className={colorClass.replace("bg-", "text-")} />
      </div>
      <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-1">{title}</h3>
      <h2 className={`text-2xl md:text-3xl font-black italic mb-4 ${team?.isPlayer ? "text-blue-300" : "text-white"}`}>{team?.label || team?.name || "—"}</h2>
      <div className="grid grid-cols-2 gap-4 w-full mt-2 bg-black/20 p-3 rounded-lg">
        <div>
          <span className="text-[10px] text-gray-500 uppercase font-bold">Pontos</span>
          <div className="text-xl font-mono font-bold text-white">{team?.points ?? 0}</div>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 uppercase font-bold">Vitórias</span>
          <div className="text-xl font-mono font-bold text-white">{team?.stats?.wins || 0}</div>
        </div>
      </div>
      {car && (
        <div className="w-full mt-3 bg-black/20 rounded-lg p-3 text-left">
          <div className="text-[10px] text-gray-500 uppercase font-bold">Campeões de pilotos</div>
          <div className="flex justify-between items-baseline gap-2 mt-0.5">
            <span className={`font-black truncate ${car.isPlayer ? "text-blue-300" : "text-white"}`}>{car.name}</span>
            <span className="font-mono text-xs text-gray-400 shrink-0">{car.points} pts</span>
          </div>
          {car.drivers?.length > 0 && <div className="text-xs text-gray-400 mt-0.5">{car.drivers.join(" · ")}</div>}
        </div>
      )}
    </div>
  </div>
);

const TopThree = ({ title, list, accent }) => (
  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
    <h4 className={`${accent} font-black italic mb-3 border-b border-gray-800 pb-2`}>{title}</h4>
    {list.length === 0 && <p className="text-sm text-gray-500">Sem equipes na classe.</p>}
    {list.slice(0, 3).map((team, index) => (
      <div className="flex justify-between items-center gap-2 py-2 text-sm border-b border-gray-800/50 last:border-0" key={team.rowKey || team.key || team.id}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono font-bold text-gray-500 w-4">{index + 1}</span>
          <span className={`font-bold truncate ${team.isPlayer ? "text-blue-400" : "text-white"}`}>{team.name}</span>
          {team.numbers?.length > 0 && <span className="text-[10px] text-gray-500 font-mono shrink-0">#{team.numbers.join("/#")}</span>}
          {team.perCar && <span className="text-[9px] text-gray-600 uppercase shrink-0">carro</span>}
        </div>
        <span className="font-mono font-bold text-gray-400 shrink-0">{team.points} pts</span>
      </div>
    ))}
  </div>
);

const SeasonEndScreen = ({ game, summary, onConfirm, exportSaveFile }) => {
  const player = game.playerTeam;
  const { review, expiring, regulation } = summary;
  const boardCut = summary.boardCut || null;
  const options = summary.program || [];
  const championClasses = summary.championClasses || [];
  const reviewEntries = review.entries || [];
  const current = Object.fromEntries(options.map(option => [option.cls, option.current]));
  const [renew, setRenew] = useState(() => Object.fromEntries(expiring.map(item => [item.driver.id, true])));
  const [cars, setCars] = useState(() => (boardCut ? { ...boardCut.plan } : { ...current }));
  const [numbers, setNumbers] = useState({});
  const plan = boardCut ? boardCut.plan : cars;
  const entryCost = boardCut ? 0 : planEntryCost(game, plan);
  const planError = boardCut ? null : validatePlan(game, plan);
  const noCash = !planError && entryCost > 0 && entryCost > player.funds;
  const canConfirm = !planError && !noCash;
  const multiCar = options.reduce((sum, option) => sum + option.current, 0) > 1;
  const careerWins = player.careerWins || 0;
  const totalTitles = (player.championships || 0) + championClasses.length;
  const label = cls => CLASS_RULES[cls]?.label || cls;
  const playerRows = cls => (cls === "HYPERCAR" ? summary.hyper : summary.gt3).filter(row => row.isPlayer);
  // Pontos da equipe na classe (na regra PER_CAR, a soma das linhas dos carros)
  const playerPoints = cls => playerRows(cls).reduce((sum, row) => sum + (row.points || 0), 0);
  const playerClassList = CLASSES.filter(cls => playerRows(cls).length > 0);
  const toneClass = { good: "border-green-600/60 bg-green-900/10", warn: "border-yellow-600/60 bg-yellow-900/10", danger: "border-red-600/60 bg-red-900/10" }[review.tone];
  const setNumber = (cls, slot, value) =>
    setNumbers(prev => {
      const list = [...(prev[cls] || [])];
      list[slot] = value.replace(/\D/g, "").slice(0, 3);
      return { ...prev, [cls]: list };
    });
  const confirm = () => {
    const chosen = Object.fromEntries(
      Object.entries(numbers)
        .map(([cls, list]) => [cls, list.map(value => (value ? value : undefined))])
        .filter(([, list]) => list.some(Boolean))
    );
    onConfirm({ renew, cars: { HYPERCAR: plan.HYPERCAR ?? 0, LMGT3: plan.LMGT3 ?? 0 }, ...(Object.keys(chosen).length ? { numbers: chosen } : {}) });
  };
  // Na regra PER_CAR o campeão de equipes é uma inscrição (um carro): cita o número
  const championText = () => {
    const titles = championClasses.map(cls => {
      const row = (cls === "HYPERCAR" ? summary.hyper : summary.gt3)[0];
      return `${label(cls)}${row?.perCar ? ` (com o #${row.numbers?.[0]})` : ""}`;
    });
    return `A ${player.name} conquistou o título de equipes da ${titles.join(" e da ")}!`;
  };
  const playerCarTitles = CLASSES.map(cls => summary.carChampions?.[cls]).filter(car => car?.isPlayer);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-10 px-4 font-sans overflow-y-auto">
      <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter mb-2">TEMPORADA {game.season}</h1>
        <p className="text-gray-400 text-sm md:text-base font-bold uppercase tracking-[0.3em]">Encerramento Oficial</p>
      </div>
      {championClasses.length > 0 && (
        <div className="w-full max-w-4xl mb-12 animate-in zoom-in duration-500">
          <div className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/10 to-yellow-600/20 border border-yellow-500/50 rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.2)]">
            <Crown size={64} className="text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />
            <h2 className="text-3xl md:text-5xl font-black italic text-white mb-2 relative z-10">PARABÉNS, CHEFE!</h2>
            <p className="text-yellow-200 font-bold text-lg relative z-10">{championText()}</p>
            {playerCarTitles.length > 0 && (
              <p className="text-yellow-100/80 text-sm mt-2 relative z-10">
                Título de pilotos: {playerCarTitles.map(car => `${car.name} (${car.drivers?.join(", ")})`).join(" e ")}.
              </p>
            )}
          </div>
        </div>
      )}
      {championClasses.length === 0 && playerCarTitles.length > 0 && (
        <div className="w-full max-w-4xl mb-10 bg-blue-900/20 border border-blue-500/40 rounded-xl p-4 text-center">
          <Medal className="mx-auto text-blue-300 mb-1" size={28} />
          <p className="font-bold text-blue-100">
            Título de pilotos para {playerCarTitles.map(car => car.name).join(" e ")}! O campeonato de equipes ficou com outra equipe.
          </p>
        </div>
      )}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
        <ChampionCard
          title="Campeã de equipes · Hypercar"
          team={summary.hyperChampion}
          car={summary.carChampions?.HYPERCAR}
          icon={Trophy}
          colorClass="bg-red-600"
          borderClass="border-red-600"
        />
        <ChampionCard
          title="Campeã de equipes · LMGT3"
          team={summary.gt3Champion}
          car={summary.carChampions?.LMGT3}
          icon={Medal}
          colorClass="bg-yellow-500"
          borderClass="border-yellow-500"
        />
      </div>
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 mb-8 grid grid-cols-3 items-center gap-2">
        <div className="text-center group">
          <Star className="mx-auto text-blue-500 mb-2 group-hover:scale-110 transition-transform" size={28} />
          <div className="text-2xl md:text-3xl font-black text-white">{careerWins}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Vitórias na carreira</div>
        </div>
        <div className="text-center group border-x border-gray-800 px-1">
          <Flag className="mx-auto text-green-500 mb-2 group-hover:scale-110 transition-transform" size={28} />
          <div className="text-2xl md:text-3xl font-black text-white">
            {playerClassList.length > 0 ? playerClassList.map(playerPoints).join(" / ") : 0}
          </div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">
            {playerClassList.length > 1 ? `Pontos ${playerClassList.map(cls => CLASS_RULES[cls].short).join(" / ")}` : "Pontos da equipe"}
          </div>
        </div>
        <div className="text-center group">
          <Trophy className="mx-auto text-purple-500 mb-2 group-hover:scale-110 transition-transform" size={28} />
          <div className="text-2xl md:text-3xl font-black text-white">{totalTitles}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Títulos mundiais</div>
        </div>
      </div>
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <TopThree title="TOP 3 EQUIPES HYPERCAR" list={summary.hyper} accent="text-red-500" />
        <TopThree title="TOP 3 EQUIPES LMGT3" list={summary.gt3} accent="text-yellow-500" />
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className={`rounded-xl p-5 md:p-6 border-2 ${toneClass}`}>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-3">
            <Target size={16} /> Avaliação do conselho
          </h3>
          <div className="space-y-1.5">
            {reviewEntries.map(entry => (
              <div className="flex items-center justify-between gap-2 text-sm bg-black/20 rounded px-2 py-1.5" key={entry.cls}>
                <span className="text-gray-300 min-w-0">
                  <span className="font-black text-white">{entry.label}</span> · meta Top {entry.objective?.position}
                  {reviewEntries.length > 1 && <span className="text-[10px] text-gray-500"> (peso {Math.round((entry.weight ?? 1) * 100)}%)</span>}
                </span>
                <span className={`font-black shrink-0 ${entry.met ? "text-green-400" : entry.tone === "warn" ? "text-yellow-400" : "text-red-400"}`}>
                  {entry.position}º {entry.met ? "✓" : "✗"}
                </span>
              </div>
            ))}
          </div>
          <p className="font-bold text-white mt-3">{review.verdict}</p>
          <div className="mt-4">
            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
              <span>Confiança</span>
              <span>
                {game.career.confidence}% → {review.confidence}%
              </span>
            </div>
            <MeterBar value={review.confidence} color={confidenceColor(review.confidence)} />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Prêmio do campeonato: <span className="text-green-400 font-bold">{formatMoney(summary.prize)}</span> · Orçamento do conselho{" "}
            {review.budgetFactor > 1
              ? `ampliado em ${Math.round((review.budgetFactor - 1) * 100)}%`
              : review.budgetFactor < 1
                ? `reduzido em ${Math.round((1 - review.budgetFactor) * 100)}%`
                : "mantido"}
            .
          </p>
        </div>
        <div className="rounded-xl p-5 md:p-6 border border-gray-800 bg-gray-900">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-3">
            <FileSignature size={16} className="text-blue-400" /> Contratos que terminam
          </h3>
          {expiring.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum contrato de piloto termina agora.</p>
          ) : (
            <div className="space-y-2">
              {expiring.map(({ driver, newWage, car, cls }) => (
                <div className="flex items-center justify-between gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2" key={driver.id}>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">
                      {multiCar && car && (
                        <span className="text-[10px] font-black bg-gray-800 text-gray-300 px-1 rounded mr-1">
                          #{car} {CLASS_RULES[cls]?.short}
                        </span>
                      )}
                      <NationFlag driver={driver} /> {driver.name} <span className="text-gray-500">({driver.rating})</span>
                    </div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-2">
                      <CategoryBadge rating={driver.rating} /> {driver.age} anos · pede {formatMoney(newWage)}/corrida por 2 temporadas
                    </div>
                  </div>
                  <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-700 shrink-0">
                    <button
                      onClick={() => setRenew({ ...renew, [driver.id]: true })}
                      className={`px-2 py-1 text-[10px] font-bold rounded ${renew[driver.id] ? "bg-green-600 text-white" : "text-gray-400"}`}
                    >
                      Renovar
                    </button>
                    <button
                      onClick={() => setRenew({ ...renew, [driver.id]: false })}
                      className={`px-2 py-1 text-[10px] font-bold rounded ${!renew[driver.id] ? "bg-red-600 text-white" : "text-gray-400"}`}
                    >
                      Liberar
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-gray-500">Vagas abertas são preenchidas por um piloto da academia; depois você pode contratar no mercado.</p>
            </div>
          )}
        </div>

        {boardCut && (
          <div className="lg:col-span-2 rounded-xl p-5 md:p-6 border-2 border-red-600/70 bg-red-950/30">
            <h3 className="text-xs font-black uppercase tracking-widest text-red-300 flex items-center gap-2 mb-2">
              <Scissors size={16} /> Corte do conselho
            </h3>
            <p className="font-bold text-white">{boardCut.text}</p>
            <p className="text-xs text-red-100/70 mt-2">
              Você é o dono e segue no comando da equipe. Com a confiança em zero, o conselho corta carros (ou verba) em vez de trocar o chefe. A confiança volta a{" "}
              {CONFIDENCE_AFTER_CUT}% e o programa abaixo fica travado nesta virada de temporada.
            </p>
          </div>
        )}

        {options.length > 0 && (
          <div className="lg:col-span-2 rounded-xl p-5 md:p-6 border border-gray-800 bg-gray-900">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-1">
              <Car size={16} className="text-cyan-400" /> Programa da equipe
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {boardCut
                ? "O conselho definiu quantos carros a equipe inscreve na próxima temporada."
                : "Escolha quantos carros a equipe inscreve em cada classe. Carros novos pagam inscrição ao virar o ano."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {options.map(option => {
                const chosen = plan[option.cls] ?? option.current;
                const added = Math.max(0, chosen - option.current);
                const allCounts = [...new Set([...(option.allowed || []), ...Object.keys(option.annual || {}).map(Number)])].sort((a, b) => a - b);
                return (
                  <div className={`rounded-xl p-4 border-2 ${chosen > 0 ? "border-cyan-600/60 bg-cyan-950/20" : "border-gray-700 bg-gray-950"}`} key={option.cls}>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-black text-white">{option.label}</span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">
                        Hoje: {option.current} {option.current === 1 ? "carro" : "carros"}
                      </span>
                    </div>
                    <div className="flex gap-1.5 mt-3" role="radiogroup" aria-label={`Carros na ${option.label}`}>
                      {allCounts.map(count => {
                        const allowed = option.allowed?.includes(count);
                        const selected = chosen === count;
                        return (
                          <button
                            key={count}
                            role="radio"
                            aria-checked={selected}
                            disabled={!!boardCut || !allowed}
                            onClick={() => setCars(prev => ({ ...prev, [option.cls]: count }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-black border transition-colors disabled:cursor-not-allowed ${
                              selected ? "bg-cyan-600 border-cyan-400 text-white" : allowed && !boardCut ? "bg-gray-900 border-gray-700 text-gray-300 hover:border-cyan-500" : "bg-gray-900 border-gray-800 text-gray-600"
                            }`}
                          >
                            {count === 0 ? "Fora" : `${count} ${count === 1 ? "carro" : "carros"}`}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      {[
                        ["Inscrição", `${formatMoney(option.entryFee)}/carro novo`, "text-red-300"],
                        ["Operação extra", `${formatMoney(option.operations)}/corr.`, "text-red-300"],
                        ["Verba anual", chosen > 0 ? `+${formatMoney(option.annual?.[chosen] ?? 0)}` : "—", "text-green-300"]
                      ].map(([title, value, color]) => (
                        <div className="bg-gray-900 rounded p-1.5" key={title}>
                          <div className="text-[9px] uppercase font-bold text-gray-500">{title}</div>
                          <div className={`text-[11px] font-mono font-bold ${color}`}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                      {option.cls === "HYPERCAR"
                        ? "Hypercar: 1 ou 2 carros. A operação extra vale para o segundo carro."
                        : "LMGT3: a classe exige dois carros por equipe."}{" "}
                      Em {game.season + 1}: {teamScoringText(option.cls, game.season + 1)}
                    </p>
                    {option.needsInvite && (
                      <p className={`text-[11px] mt-2 font-bold ${option.invite ? "text-green-400" : "text-yellow-400"}`}>
                        {option.invite
                          ? "Convite do ACO recebido: a equipe pode estrear na Hypercar."
                          : "Sem convite do ACO: é preciso ser campeão da LMGT3, ou Top 3 com reputação 55+."}
                      </p>
                    )}
                    {!boardCut && added > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Número {added > 1 ? "dos carros novos" : "do carro novo"}</span>
                        {Array.from({ length: added }, (_, i) => option.current + i).map(slot => (
                          <input
                            key={slot}
                            type="text"
                            inputMode="numeric"
                            value={numbers[option.cls]?.[slot] ?? ""}
                            onChange={e => setNumber(option.cls, slot, e.target.value)}
                            placeholder="auto"
                            aria-label={`Número do carro novo ${slot + 1} na ${option.label}`}
                            className="w-16 bg-gray-900 border border-gray-700 focus:border-cyan-500 outline-none rounded px-2 py-1 text-sm font-mono font-bold text-white text-center"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!boardCut && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-gray-400">
                  Inscrições novas: <span className={`font-mono font-bold ${entryCost > 0 ? "text-red-300" : "text-gray-300"}`}>{formatMoney(entryCost)}</span>
                  <span className="text-gray-500"> · caixa {formatMoney(player.funds)}</span>
                </span>
                {planError && <span className="text-red-400 font-bold text-xs">{planError}</span>}
                {noCash && <span className="text-red-400 font-bold text-xs">Caixa insuficiente para inscrever os carros novos.</span>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 pb-6">
        <div className="bg-gray-800/50 px-4 py-2 rounded text-xs text-gray-400 border border-gray-700 text-center max-w-xl">
          <span className="text-white font-bold">{regulation.text}</span> Ao avançar, os pilotos envelhecem 1 ano, contratos são renovados e a IA vai ao mercado.
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={exportSaveFile} className="px-5 py-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-full font-bold flex items-center gap-2 border border-gray-700">
            <Save size={18} /> Exportar save
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="group relative px-8 py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:hover:scale-100 disabled:cursor-not-allowed text-white rounded-full font-black text-lg md:text-xl shadow-lg shadow-red-900/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <RotateCcw size={24} className="group-hover:rotate-180 transition-transform duration-500" />
            INICIAR TEMPORADA {game.season + 1}
          </button>
        </div>
        {!canConfirm && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <TriangleAlert size={14} /> Ajuste o programa da equipe para continuar.
          </p>
        )}
      </div>
    </div>
  );
};

export default SeasonEndScreen;
