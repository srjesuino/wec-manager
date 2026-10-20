import { useState } from "react";
import { ArrowUpCircle, Car, Crown, FileSignature, Flag, Medal, RotateCcw, Save, Star, Target, TriangleAlert, Trophy } from "lucide-react";
import { formatMoney } from "../utils/helpers";
import { isPlayerId } from "../engine/team";
import { secondCarOperations } from "../engine/economy";
import { defaultSisterName } from "../engine/newGame";
import { CategoryBadge, Flag as NationFlag, MeterBar, confidenceColor } from "../components/ui/common";

const ChampionCard = ({ title, team, icon: Icon, colorClass, borderClass }) => (
  <div className={`flex-1 bg-gray-900 border ${borderClass} rounded-xl p-6 relative overflow-hidden group shadow-2xl`}>
    <div className={`absolute top-0 right-0 p-8 opacity-10 ${colorClass} group-hover:opacity-20 transition-opacity`}>
      <Icon size={120} />
    </div>
    <div className="relative z-10 flex flex-col items-center text-center">
      <div className={`mb-4 p-3 rounded-full ${colorClass} bg-opacity-20 border-2 ${borderClass}`}>
        <Icon size={40} className={colorClass.replace("bg-", "text-")} />
      </div>
      <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-1">{title}</h3>
      <h2 className="text-2xl md:text-3xl font-black italic text-white mb-4">{team?.name}</h2>
      <div className="grid grid-cols-2 gap-4 w-full mt-2 bg-black/20 p-3 rounded-lg">
        <div>
          <span className="text-[10px] text-gray-500 uppercase font-bold">Pontos</span>
          <div className="text-xl font-mono font-bold text-white">{team?.points}</div>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 uppercase font-bold">Vitórias</span>
          <div className="text-xl font-mono font-bold text-white">{team?.stats?.wins || 0}</div>
        </div>
      </div>
    </div>
  </div>
);

const TopThree = ({ title, list, accent }) => (
  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
    <h4 className={`${accent} font-black italic mb-3 border-b border-gray-800 pb-2`}>{title}</h4>
    {list.slice(0, 3).map((team, index) => (
      <div className="flex justify-between items-center py-2 text-sm border-b border-gray-800/50 last:border-0" key={team.id}>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-gray-500 w-4">{index + 1}</span>
          <span className={`font-bold ${isPlayerId(team.id) ? "text-blue-400" : "text-white"}`}>{team.name}</span>
        </div>
        <span className="font-mono font-bold text-gray-400">{team.points} pts</span>
      </div>
    ))}
  </div>
);

const SeasonEndScreen = ({ game, summary, onConfirm, exportSaveFile }) => {
  const player = game.playerTeam;
  const sister = game.sisterTeam;
  const { review, isPlayerChampion, expiring, promotion, regulation } = summary;
  const program = summary.program || { canDrop: false, expand: [] };
  const championEntries = summary.championEntries || (isPlayerChampion ? [{ id: player.id, number: player.number, class: player.class, name: player.name }] : []);
  const reviewEntries = review.entries || [];
  const [renew, setRenew] = useState(() => Object.fromEntries(expiring.map(item => [item.driver.id, true])));
  const [acceptPromotion, setAcceptPromotion] = useState(false);
  const [expand, setExpand] = useState(null);
  const [dropSister, setDropSister] = useState(false);
  const [sisterNames, setSisterNames] = useState({});
  const careerWins = player.careerWins || 0;
  const totalTitles = (player.championships || 0) + championEntries.length;
  const classLabel = cls => (cls === "HYPERCAR" ? "Hypercar" : "LMGT3");
  const nameFor = option => sisterNames[option.program] ?? defaultSisterName(player.name, option.cls === player.class);
  const selectedOption = program.expand.find(option => option.program === expand);
  const decisions = () => ({
    renew,
    acceptPromotion,
    expand: selectedOption ? expand : null,
    dropSister: program.canDrop && dropSister,
    sisterName: selectedOption ? nameFor(selectedOption).trim() || undefined : undefined
  });
  const toneClass = { good: "border-green-600/60 bg-green-900/10", warn: "border-yellow-600/60 bg-yellow-900/10", danger: "border-red-600/60 bg-red-900/10" }[review.tone];
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-10 px-4 font-sans overflow-y-auto">
      <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter mb-2">TEMPORADA {game.season}</h1>
        <p className="text-gray-400 text-sm md:text-base font-bold uppercase tracking-[0.3em]">Encerramento Oficial</p>
      </div>
      {isPlayerChampion && (
        <div className="w-full max-w-4xl mb-12 animate-in zoom-in duration-500">
          <div className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/10 to-yellow-600/20 border border-yellow-500/50 rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.2)]">
            <Crown size={64} className="text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />
            <h2 className="text-3xl md:text-5xl font-black italic text-white mb-2 relative z-10">PARABÉNS, CHEFE!</h2>
            <p className="text-yellow-200 font-bold text-lg relative z-10">
              {championEntries.length > 1
                ? `A ${player.name} conquistou os títulos mundiais da Hypercar e da LMGT3!`
                : sister
                  ? `O #${championEntries[0]?.number} da ${player.name} conquistou o título mundial da classe ${classLabel(championEntries[0]?.class)}!`
                  : `A ${player.name} conquistou o título mundial da classe ${player.class}!`}
            </p>
          </div>
        </div>
      )}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
        <ChampionCard title="Campeão Mundial Hypercar" team={summary.hyperChampion} icon={Trophy} colorClass="bg-red-600" borderClass="border-red-600" />
        <ChampionCard title="Campeão Mundial LMGT3" team={summary.gt3Champion} icon={Medal} colorClass="bg-yellow-500" borderClass="border-yellow-500" />
      </div>
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8 flex justify-around items-center">
        <div className="text-center group">
          <Star className="mx-auto text-blue-500 mb-2 group-hover:scale-110 transition-transform" size={32} />
          <div className="text-3xl font-black text-white">{careerWins}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Vitórias na Carreira</div>
        </div>
        <div className="w-px h-16 bg-gray-800" />
        <div className="text-center group">
          <Flag className="mx-auto text-green-500 mb-2 group-hover:scale-110 transition-transform" size={32} />
          <div className="text-3xl font-black text-white">{sister ? `${player.points} / ${sister.points}` : player.points}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">
            {sister ? `Pontos #${player.number} / #${sister.number}` : "Pontos nesta Temporada"}
          </div>
        </div>
        <div className="w-px h-16 bg-gray-800" />
        <div className="text-center group">
          <Trophy className="mx-auto text-purple-500 mb-2 group-hover:scale-110 transition-transform" size={32} />
          <div className="text-3xl font-black text-white">{totalTitles}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Títulos Mundiais</div>
        </div>
      </div>
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <TopThree title="TOP 3 HYPERCAR" list={summary.hyper} accent="text-red-500" />
        <TopThree title="TOP 3 LMGT3" list={summary.gt3} accent="text-yellow-500" />
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className={`rounded-xl p-6 border-2 ${toneClass}`}>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-3">
            <Target size={16} /> Avaliação da diretoria
          </h3>
          {reviewEntries.length > 1 ? (
            <div className="space-y-1.5">
              {reviewEntries.map(entry => (
                <div className="flex items-center justify-between gap-2 text-sm bg-black/20 rounded px-2 py-1" key={entry.id}>
                  <span className="text-gray-300 min-w-0">
                    <span className="font-black text-white">#{entry.number}</span> {classLabel(entry.class)} · meta Top {entry.objective?.position}
                  </span>
                  <span className={`font-black shrink-0 ${entry.met ? "text-green-400" : entry.tone === "warn" ? "text-yellow-400" : "text-red-400"}`}>
                    {entry.position}º {entry.met ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-300">
              Meta: {review.objective?.text}. Resultado: <span className="font-black text-white">{review.position}º na classe</span>.
            </p>
          )}
          <p className="font-bold text-white mt-2">{review.verdict}</p>
          <div className="mt-4">
            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
              <span>Confiança</span>
              <span>
                {game.career.confidence}% → {review.confidence}%
              </span>
            </div>
            <MeterBar value={review.confidence} color={confidenceColor(review.confidence)} />
          </div>
          {!review.fired && (
            <p className="text-xs text-gray-400 mt-3">
              Prêmio do campeonato: <span className="text-green-400 font-bold">{formatMoney(summary.prize)}</span> · Orçamento da diretoria{" "}
              {review.budgetFactor > 1
                ? `ampliado em ${Math.round((review.budgetFactor - 1) * 100)}%`
                : review.budgetFactor < 1
                  ? `reduzido em ${Math.round((1 - review.budgetFactor) * 100)}%`
                  : "mantido"}
              .
            </p>
          )}
        </div>
        <div className="rounded-xl p-6 border border-gray-800 bg-gray-900">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-3">
            <FileSignature size={16} className="text-blue-400" /> Contratos que terminam
          </h3>
          {expiring.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum contrato de piloto termina agora.</p>
          ) : (
            <div className="space-y-2">
              {expiring.map(({ driver, newWage, car }) => (
                <div className="flex items-center justify-between gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2" key={driver.id}>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">
                      {sister && car && <span className="text-[10px] font-black bg-gray-800 text-gray-300 px-1 rounded mr-1">#{car}</span>}
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
        {!review.fired && (program.canDrop || program.expand.length > 0) && (
          <div className="lg:col-span-2 rounded-xl p-6 border border-gray-800 bg-gray-900">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300 flex items-center gap-2 mb-3">
              <Car size={16} className="text-cyan-400" /> Programa da equipe
            </h3>
            {program.canDrop && sister ? (
              <button
                onClick={() => setDropSister(!dropSister)}
                className={`w-full text-left rounded-xl p-4 border-2 transition-colors ${dropSister ? "border-red-500 bg-red-900/20" : "border-gray-700 bg-gray-950 hover:border-red-500/60"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-black text-white">Retirar o carro #{sister.number}</div>
                    <p className="text-xs text-gray-400 mt-1">
                      O {sister.name} ({classLabel(sister.class)}) deixa o campeonato: sem custo de operação ({formatMoney(secondCarOperations(sister.class))}/corrida), mas a
                      diretoria também corta a verba do segundo carro. Os pilotos dele vão para o mercado.
                    </p>
                  </div>
                  <span className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${dropSister ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                    {dropSister ? "RETIRAR" : "MANTER"}
                  </span>
                </div>
              </button>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-3">Inscreva um segundo carro para a próxima temporada (opcional). A inscrição sai do caixa ao virar o ano.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {program.expand.map(option => {
                    const sameClass = option.cls === player.class;
                    const affordable = player.funds >= option.fee;
                    const selected = expand === option.program;
                    return (
                      <div
                        key={option.program}
                        className={`rounded-xl p-4 border-2 transition-colors ${selected ? "border-cyan-500 bg-cyan-900/20" : "border-gray-700 bg-gray-950"} ${affordable ? "" : "opacity-50"}`}
                      >
                        <button disabled={!affordable} onClick={() => setExpand(selected ? null : option.program)} className="w-full text-left disabled:cursor-not-allowed">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-black text-white">
                              {sameClass ? "Segundo carro na mesma classe" : `Segundo carro na outra classe (${classLabel(option.cls)})`}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${selected ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                              {selected ? "ESCOLHIDO" : affordable ? "ESCOLHER" : "SEM CAIXA"}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                            {[
                              ["Inscrição", `-${formatMoney(option.fee)}`, "text-red-300"],
                              ["Verba anual", `+${formatMoney(option.annual)}`, "text-green-300"],
                              ["Operação", `-${formatMoney(secondCarOperations(option.cls))}/corr.`, "text-red-300"]
                            ].map(([label, value, color]) => (
                              <div className="bg-gray-900 rounded p-1.5" key={label}>
                                <div className="text-[9px] uppercase font-bold text-gray-500">{label}</div>
                                <div className={`text-xs font-mono font-bold ${color}`}>{value}</div>
                              </div>
                            ))}
                          </div>
                          {sameClass && <p className="text-[10px] text-gray-500 mt-2">P&D compartilhado entre os dois carros (+50% no custo) e ordens de equipe.</p>}
                        </button>
                        {selected && (
                          <input
                            type="text"
                            value={nameFor(option)}
                            onChange={e => setSisterNames({ ...sisterNames, [option.program]: e.target.value })}
                            maxLength={32}
                            className="mt-3 w-full bg-gray-900 border border-gray-700 focus:border-cyan-500 outline-none rounded-lg px-3 py-2 text-sm font-bold text-white"
                            aria-label="Nome do segundo carro"
                            placeholder="Nome do segundo carro"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {promotion && !review.fired && (
          <button
            onClick={() => setAcceptPromotion(!acceptPromotion)}
            className={`lg:col-span-2 text-left rounded-xl p-6 border-2 transition-colors ${acceptPromotion ? "border-red-500 bg-red-900/20" : "border-gray-700 bg-gray-900 hover:border-red-500/60"}`}
          >
            <div className="flex items-start gap-4">
              <ArrowUpCircle size={36} className="text-red-400 shrink-0" />
              <div className="flex-1">
                <h3 className="font-black text-xl text-white">Convite para a Hypercar!</h3>
                <p className="text-sm text-gray-300 mt-1">
                  O ACO convidou a {player.name} para a classe principal. Você recebe o orçamento da Hypercar, mas começa com um carro novo, do zero, contra as
                  fábricas. Seus pilotos e instalações seguem com você.
                </p>
              </div>
              <span className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${acceptPromotion ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                {acceptPromotion ? "ACEITO" : "TOQUE PARA ACEITAR"}
              </span>
            </div>
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 pb-6">
        <div className="bg-gray-800/50 px-4 py-2 rounded text-xs text-gray-400 border border-gray-700 text-center max-w-xl">
          <span className="text-white font-bold">{regulation.text}</span> Ao avançar, os pilotos envelhecem 1 ano, contratos são renovados e a IA vai ao mercado.
        </div>
        {review.fired ? (
          <button
            onClick={() => onConfirm(decisions())}
            className="px-8 py-4 bg-red-700 hover:bg-red-600 text-white rounded-full font-black text-lg shadow-lg flex items-center gap-3"
          >
            <TriangleAlert size={22} /> Receber a carta da diretoria
          </button>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={exportSaveFile} className="px-5 py-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-full font-bold flex items-center gap-2 border border-gray-700">
              <Save size={18} /> Exportar save
            </button>
            <button
              onClick={() => onConfirm(decisions())}
              className="group relative px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-black text-lg md:text-xl shadow-lg shadow-red-900/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <RotateCcw size={24} className="group-hover:rotate-180 transition-transform duration-500" />
              INICIAR TEMPORADA {game.season + 1}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeasonEndScreen;
