import { Briefcase, RotateCcw, Star, Trophy } from "lucide-react";

// Fim de carreira: a diretoria demitiu o chefe de equipe
const FiredScreen = ({ summary, onNewCareer }) => {
  const game = summary.game;
  const player = game.playerTeam;
  const seasons = (game.career.seasonsCompleted || 0) + 1;
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 font-sans text-center">
      <div className="max-w-xl w-full animate-in fade-in zoom-in-95 duration-700">
        <Briefcase size={64} className="mx-auto text-red-500 mb-6" />
        <p className="text-xs font-bold text-red-400 uppercase tracking-[0.3em]">Comunicado da diretoria</p>
        <h1 className="text-4xl md:text-6xl font-black italic mt-2 mb-4">VOCÊ FOI DEMITIDO</h1>
        <p className="text-gray-300 mb-2">{summary.review.verdict}</p>
        <p className="text-gray-500 text-sm mb-8">
          Meta da temporada {game.season}: {summary.review.objective?.text}.{" "}
          {summary.review.entries?.length > 1
            ? `Os carros terminaram em ${summary.review.entries.map(entry => `${entry.position}º (#${entry.number})`).join(" e ")}.`
            : `A ${player.name} terminou em ${summary.review.position}º.`}
        </p>
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            [Star, "Vitórias", player.careerWins || 0, "text-blue-400"],
            [Trophy, "Títulos", player.championships || 0, "text-yellow-400"],
            [Briefcase, "Temporadas", seasons, "text-gray-300"]
          ].map(([Icon, label, value, color]) => (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4" key={label}>
              <Icon className={`mx-auto mb-2 ${color}`} size={24} />
              <div className="text-3xl font-black">{value}</div>
              <div className="text-[10px] uppercase font-bold text-gray-500">{label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onNewCareer}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-black text-lg uppercase tracking-wider shadow-lg shadow-blue-900/30 inline-flex items-center gap-3 active:scale-95"
        >
          <RotateCcw size={22} /> Nova carreira
        </button>
      </div>
    </div>
  );
};

export default FiredScreen;
