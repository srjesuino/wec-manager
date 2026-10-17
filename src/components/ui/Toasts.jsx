import { CircleAlert, CircleCheckBig, Info, TriangleAlert, X } from "lucide-react";

const STYLES = {
  info: { icon: Info, box: "border-blue-500/40 bg-gray-900/95", iconClass: "text-blue-400" },
  success: { icon: CircleCheckBig, box: "border-green-500/40 bg-gray-900/95", iconClass: "text-green-400" },
  warn: { icon: TriangleAlert, box: "border-yellow-500/40 bg-gray-900/95", iconClass: "text-yellow-400" },
  error: { icon: CircleAlert, box: "border-red-500/50 bg-gray-900/95", iconClass: "text-red-400" }
};

// Avisos flutuantes (upgrades, contratos, erros, resultados)
const Toasts = ({ toasts, onDismiss }) => (
  <div className="fixed top-3 right-3 left-3 md:left-auto md:w-96 z-[100] flex flex-col gap-2 pointer-events-none">
    {toasts.map(toast => {
      const style = STYLES[toast.type] || STYLES.info;
      const Icon = style.icon;
      return (
        <div
          className={`pointer-events-auto flex items-start gap-3 border rounded-xl px-4 py-3 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-2 duration-300 ${style.box}`}
          key={toast.id}
        >
          <Icon size={18} className={`shrink-0 mt-0.5 ${style.iconClass}`} />
          <p className="text-sm text-gray-200 leading-snug flex-1">{toast.text}</p>
          <button onClick={() => onDismiss(toast.id)} className="text-gray-500 hover:text-white shrink-0" aria-label="Fechar aviso">
            <X size={14} />
          </button>
        </div>
      );
    })}
  </div>
);

export default Toasts;
