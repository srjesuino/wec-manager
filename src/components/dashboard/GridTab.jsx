import { useState } from "react";
import { Check, Info, LayoutGrid, Pencil, Plus, Trash2, X } from "lucide-react";
import { AI_TIERS, CLASSES, CLASS_RULES } from "../../data/constants";
import { SANDBOX_TIERS, sandboxRows, suggestedCarLevel, unusedTeamNames } from "../../engine/sandbox";
import { teamScoringText } from "../../engine/team";
import { INVESTMENT_RANGE, ENGINEERING_RANGE } from "../../engine/ai";
import { ClassBadge, MeterBar, TeamStripe } from "../ui/common";

const tierLabel = tier => SANDBOX_TIERS.find(item => item.id === tier)?.label ?? "—";

// Posição de um valor dentro da faixa (0–100), para as barras
const rangePercent = (value, [min, max]) => ((value - min) / (max - min)) * 100;

const byStanding = (a, b) => b.program.points - a.program.points || b.carPerformance - a.carPerformance;

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-gray-950/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div
      className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] overflow-y-auto"
      onClick={event => event.stopPropagation()}
    >
      <div className="p-5 border-b border-gray-800 flex justify-between items-center">
        <h3 className="text-lg font-black text-white">{title}</h3>
        <button onClick={onClose} className="p-2 rounded-full bg-gray-800 text-gray-300" aria-label="Fechar">
          <X size={18} />
        </button>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">{label}</span>
    {children}
    {hint && <span className="text-[10px] text-gray-500 block mt-1">{hint}</span>}
  </label>
);

const inputClass = "w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-blue-500";

const Slider = ({ label, value, min, max, step, onChange, format, hint }) => (
  <Field label={`${label}: ${format(value)}`} hint={hint}>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-blue-500" />
  </Field>
);

const multiplier = value => `x${value.toFixed(2)}`;

// Quantidade de carros: Hypercar escolhe 1 ou 2; LMGT3 é sempre 2
const CarsField = ({ cls, value, onChange }) => {
  const rules = CLASS_RULES[cls];
  if (rules.minCars === rules.maxCars) {
    return (
      <Field label="Carros">
        <p className="text-sm text-gray-300 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
          {rules.minCars} carros — na {rules.label} toda equipe inscreve {rules.minCars}.
        </p>
      </Field>
    );
  }
  const options = Array.from({ length: rules.maxCars - rules.minCars + 1 }, (_, i) => rules.minCars + i);
  return (
    <Field label="Carros">
      <div className="flex gap-2">
        {options.map(count => (
          <button
            type="button"
            key={count}
            onClick={() => onChange(count)}
            className={`flex-1 py-2 rounded-lg border-2 font-black text-sm ${value === count ? "border-blue-500 bg-blue-900/30 text-white" : "border-gray-800 bg-gray-950 text-gray-400"}`}
          >
            {count} {count === 1 ? "carro" : "carros"}
          </button>
        ))}
      </div>
    </Field>
  );
};

const ProfileSliders = ({ investment, engineering, onInvestment, onEngineering }) => (
  <>
    <Slider
      label="Investimento"
      value={investment}
      min={INVESTMENT_RANGE[0]}
      max={INVESTMENT_RANGE[1]}
      step={0.05}
      onChange={onInvestment}
      format={multiplier}
      hint="Quanto dinheiro a equipe põe no desenvolvimento ao longo da temporada."
    />
    <Slider
      label="Engenharia"
      value={engineering}
      min={ENGINEERING_RANGE[0]}
      max={ENGINEERING_RANGE[1]}
      step={0.01}
      onChange={onEngineering}
      format={multiplier}
      hint="Quanto rende cada evolução, o acerto e a classificação."
    />
  </>
);

const CreateModal = ({ game, cls, onCreate, onClose }) => {
  const rules = CLASS_RULES[cls];
  const [name, setName] = useState("");
  const [cars, setCars] = useState(rules.minCars);
  const [tier, setTier] = useState(2);
  const [color, setColor] = useState("#9ca3af");
  const [numbers, setNumbers] = useState(["", ""]);
  const [investment, setInvestment] = useState(AI_TIERS[2].investment);
  const [engineering, setEngineering] = useState(AI_TIERS[2].engineering);
  const [carLevel, setCarLevel] = useState(() => suggestedCarLevel(game, cls, 2));
  const names = unusedTeamNames(game, cls);

  // Trocar o nível da equipe traz os valores padrão daquele nível
  const changeTier = value => {
    setTier(value);
    setInvestment(AI_TIERS[value].investment);
    setEngineering(AI_TIERS[value].engineering);
    setCarLevel(suggestedCarLevel(game, cls, value));
  };

  const submit = () => {
    const ok = onCreate({
      name,
      cls,
      color,
      cars,
      tier,
      numbers: numbers.slice(0, cars).map(value => value.trim()).filter(Boolean),
      investment,
      engineering,
      carLevel
    });
    if (ok) {
      onClose();
    }
  };

  return (
    <Modal title={`Nova equipe · ${rules.label}`} onClose={onClose}>
      <Field label="Nome" hint={names.length ? "Sugestões: equipes reais que ainda não estão no grid." : null}>
        <input value={name} onChange={e => setName(e.target.value)} list="grid-team-names" className={inputClass} placeholder="Nome da equipe" maxLength={40} />
        <datalist id="grid-team-names">
          {names.map(item => (
            <option value={item} key={item} />
          ))}
        </datalist>
      </Field>
      <CarsField cls={cls} value={cars} onChange={setCars} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nível">
          <select value={tier} onChange={e => changeTier(Number(e.target.value))} className={inputClass}>
            {SANDBOX_TIERS.map(item => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cor">
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 bg-gray-950 border border-gray-700 rounded-lg p-1 cursor-pointer" />
        </Field>
      </div>
      <Field label="Números (opcional)" hint="Em branco, o jogo escolhe números livres.">
        <div className="flex gap-2">
          {Array.from({ length: cars }, (_, i) => (
            <input
              key={i}
              value={numbers[i]}
              onChange={e => setNumbers(numbers.map((value, j) => (j === i ? e.target.value.replace(/\D/g, "").slice(0, 3) : value)))}
              inputMode="numeric"
              className={inputClass}
              placeholder={`Carro ${i + 1}`}
            />
          ))}
        </div>
      </Field>
      <Slider
        label="Nível do carro"
        value={carLevel}
        min={20}
        max={99}
        step={1}
        onChange={setCarLevel}
        format={value => value}
        hint={`Motor, aero, chassi e eficiência. Sugestão para a classe: ${suggestedCarLevel(game, cls, tier)}.`}
      />
      <ProfileSliders investment={investment} engineering={engineering} onInvestment={setInvestment} onEngineering={setEngineering} />
      <button
        onClick={submit}
        disabled={!name.trim()}
        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider text-sm disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <Plus size={16} /> Inscrever equipe
      </button>
    </Modal>
  );
};

const EditModal = ({ row, onEdit, onClose }) => {
  const { team, program, entries, cls } = row;
  const rules = CLASS_RULES[cls];
  const profile = row.profile || { investment: 1, engineering: 1 };
  const currentLevel = Math.round(["engine", "aero", "chassis"].reduce((sum, part) => sum + (program.car[part] ?? 0), 0) / 3);
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color || "#9ca3af");
  const [cars, setCars] = useState(entries.length);
  const [numbers, setNumbers] = useState(() => Object.fromEntries(entries.map(entry => [entry.id, String(entry.number)])));
  const [investment, setInvestment] = useState(profile.investment);
  const [engineering, setEngineering] = useState(profile.engineering);
  const [resetCar, setResetCar] = useState(false);
  const [carLevel, setCarLevel] = useState(currentLevel);

  const submit = () => {
    const patch = { name, color, investment, engineering, numbers };
    if (cars !== entries.length) {
      patch.cars = cars;
    }
    if (resetCar) {
      patch.carLevel = carLevel;
    }
    if (onEdit(team.id, patch)) {
      onClose();
    }
  };

  return (
    <Modal title={`Editar ${team.name}`} onClose={onClose}>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Nome">
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} maxLength={40} />
        </Field>
        <Field label="Cor">
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-14 h-10 bg-gray-950 border border-gray-700 rounded-lg p-1 cursor-pointer" />
        </Field>
      </div>
      <CarsField cls={cls} value={cars} onChange={setCars} />
      <Field label="Números">
        <div className="flex gap-2">
          {entries.map((entry, i) => (
            <input
              key={entry.id}
              value={numbers[entry.id]}
              onChange={e => setNumbers({ ...numbers, [entry.id]: e.target.value.replace(/\D/g, "").slice(0, 3) })}
              inputMode="numeric"
              className={`${inputClass} ${i >= cars ? "opacity-40" : ""}`}
              disabled={i >= cars}
            />
          ))}
        </div>
        {cars > entries.length && <span className="text-[10px] text-gray-500 block mt-1">O carro novo recebe um número livre e pilotos do nível da equipe.</span>}
        {cars < entries.length && <span className="text-[10px] text-orange-300 block mt-1">O último carro sai do grid e os pilotos dele vão para o mercado.</span>}
      </Field>
      <ProfileSliders investment={investment} engineering={engineering} onInvestment={setInvestment} onEngineering={setEngineering} />
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-300">
          <input type="checkbox" checked={resetCar} onChange={e => setResetCar(e.target.checked)} className="accent-blue-500" />
          Redefinir o carro (hoje: {currentLevel})
        </label>
        {resetCar && <Slider label="Nível do carro" value={carLevel} min={20} max={99} step={1} onChange={setCarLevel} format={value => value} hint="Motor, aero, chassi e eficiência passam a ter este nível." />}
      </div>
      <p className="text-[10px] text-gray-500">{rules.label}: os pontos já conquistados na temporada não mudam.</p>
      <button onClick={submit} disabled={!name.trim()} className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider text-sm disabled:opacity-40 flex items-center justify-center gap-2">
        <Check size={16} /> Salvar
      </button>
    </Modal>
  );
};

const TeamRow = ({ row, position, onEdit, onDelete }) => {
  const [confirming, setConfirming] = useState(false);
  const { team, program, entries, isPlayer, profile } = row;
  return (
    <div className={`rounded-xl border p-3 md:p-4 ${isPlayer ? "bg-blue-900/20 border-blue-700/60" : "bg-gray-900 border-gray-800"}`}>
      <div className="flex items-start gap-3">
        <span className="font-mono text-gray-500 text-sm w-5 pt-0.5">{position}</span>
        <TeamStripe color={team.color} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`font-black truncate ${isPlayer ? "text-blue-300" : "text-white"}`}>{team.name}</span>
            <span className="text-xs font-mono text-gray-400">{entries.map(entry => `#${entry.number}`).join(" ")}</span>
            {isPlayer ? (
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-600 text-white">Sua equipe</span>
            ) : (
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{tierLabel(team.tier)}</span>
            )}
            {team.custom && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-900 text-purple-200">Criada no editor</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            {[
              ["Carro", row.carPerformance],
              ["Pilotos", row.driversRating],
              ["Pontos", program.points || 0]
            ].map(([label, value]) => (
              <div className="bg-gray-950 rounded-lg py-1 border border-gray-800" key={label}>
                <div className={`text-sm font-black ${label === "Pontos" ? "text-yellow-400" : "text-white"}`}>{value}</div>
                <div className="text-[9px] text-gray-500 uppercase font-bold">{label}</div>
              </div>
            ))}
          </div>
          {profile && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <div className="flex justify-between text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                  <span>Investimento</span>
                  <span>{multiplier(profile.investment)}</span>
                </div>
                <MeterBar value={rangePercent(profile.investment, INVESTMENT_RANGE)} color="bg-green-500" height="h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                  <span>Engenharia</span>
                  <span>{multiplier(profile.engineering)}</span>
                </div>
                <MeterBar value={rangePercent(profile.engineering, ENGINEERING_RANGE)} color="bg-cyan-500" height="h-1.5" />
              </div>
            </div>
          )}
        </div>
        {!isPlayer && !confirming && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button onClick={() => onEdit(row)} className="p-2 rounded-lg bg-gray-800 hover:bg-blue-600 text-gray-300 hover:text-white" aria-label={`Editar ${team.name}`}>
              <Pencil size={14} />
            </button>
            <button onClick={() => setConfirming(true)} className="p-2 rounded-lg bg-gray-800 hover:bg-red-600 text-gray-300 hover:text-white" aria-label={`Excluir ${team.name}`}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-2 bg-red-900/20 border border-red-900/40 rounded-lg p-2">
          <span className="text-xs font-bold text-red-200 flex-1 min-w-[160px]">Excluir {team.name}? Os pilotos vão para o mercado.</span>
          <button onClick={() => onDelete(team.id)} className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase">
            Excluir
          </button>
          <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 text-xs font-black uppercase">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

const GridTab = ({ game, onCreate, onEdit, onDelete }) => {
  const [cls, setCls] = useState(CLASSES.find(item => game.playerTeam.programs?.[item]) || CLASSES[0]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const rows = sandboxRows(game, cls).sort(byStanding);
  const rules = CLASS_RULES[cls];
  const cars = rows.reduce((sum, row) => sum + row.entries.length, 0);
  // Linha atualizada da equipe em edição (o jogo pode ter mudado)
  const editingRow = editing && rows.find(row => row.team.id === editing);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 md:pb-0">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-400 space-y-1">
          <p>
            <span className="text-white font-bold">Editor de grid:</span> crie, edite e exclua as equipes da IA. As mudanças valem na hora, inclusive no meio da temporada.
          </p>
          <p>Equipes novas no meio da temporada começam com zero ponto. Não há limite de equipes no grid.</p>
          <p>
            Na Hypercar cada equipe tem 1 ou 2 carros: {teamScoringText("HYPERCAR", game.season)} Na LMGT3 são sempre 2 carros: {teamScoringText("LMGT3", game.season)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          {CLASSES.map(item => (
            <button
              key={item}
              onClick={() => setCls(item)}
              className={`px-4 py-2 rounded-md text-sm font-black flex items-center gap-2 ${cls === item ? (item === "HYPERCAR" ? "bg-red-600 text-white" : "bg-yellow-600 text-black") : "text-gray-400"}`}
            >
              {CLASS_RULES[item].label}
            </button>
          ))}
        </div>
        <button onClick={() => setCreating(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-black uppercase flex items-center gap-2">
          <Plus size={16} /> Nova equipe
        </button>
      </div>

      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
        <LayoutGrid size={16} className="text-blue-400" /> <ClassBadge cls={cls} size="xs" /> {rows.length} equipes · {cars} carros
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {rows.map((row, index) => (
          <TeamRow row={row} position={index + 1} onEdit={item => setEditing(item.team.id)} onDelete={onDelete} key={row.key} />
        ))}
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-500 text-center p-6">Nenhuma equipe na {rules.label}. Crie a primeira.</p>}

      {creating && <CreateModal game={game} cls={cls} onCreate={onCreate} onClose={() => setCreating(false)} />}
      {editingRow && <EditModal row={editingRow} onEdit={onEdit} onClose={() => setEditing(null)} />}
    </div>
  );
};

export default GridTab;
