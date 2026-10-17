import { Star } from "lucide-react";
import { TYRES } from "../../data/constants";
import { driverCategory, nationalityOf } from "../../utils/helpers";

export const ClassBadge = ({ cls, size = "sm" }) => (
  <span
    className={`${size === "xs" ? "text-[8px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"} font-black rounded ${
      cls === "HYPERCAR" ? "bg-red-900 text-red-200" : "bg-yellow-900 text-yellow-200"
    }`}
  >
    {cls === "HYPERCAR" ? "HYP" : "GT3"}
  </span>
);

export const TyreBadge = ({ compound, wear = null }) => {
  const tyre = TYRES[compound] || TYRES.MEDIUM;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-black text-white bg-gray-950"
        style={{ borderColor: tyre.color }}
        title={tyre.label}
      >
        {tyre.short}
      </span>
      {wear != null && <span className={`text-[10px] font-mono font-bold ${wear < 30 ? "text-red-400" : "text-gray-400"}`}>{Math.max(0, Math.round(wear))}%</span>}
    </span>
  );
};

// Sigla do país (emojis de bandeira não aparecem no Windows)
export const CountryCode = ({ code, title }) => (
  <span title={title} className="inline-block align-middle text-[9px] font-black tracking-wider px-1 py-px rounded bg-gray-700/80 text-gray-200 leading-tight mr-0.5">
    {code}
  </span>
);

export const Flag = ({ driver }) => <CountryCode code={nationalityOf(driver).code} title={nationalityOf(driver).name} />;

export const CategoryBadge = ({ rating }) => {
  const category = driverCategory(rating);
  return <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${category.badge}`}>{category.label}</span>;
};

export const Stars = ({ value, size = 12 }) => (
  <span className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <Star key={n} size={size} className={n <= value ? "text-yellow-400" : "text-gray-700"} fill={n <= value ? "currentColor" : "none"} />
    ))}
  </span>
);

export const TeamStripe = ({ color }) => <span className="inline-block w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: color || "#6b7280" }} />;

export const MeterBar = ({ value, max = 100, color = "bg-blue-500", height = "h-2" }) => (
  <div className={`${height} bg-gray-800 rounded-full overflow-hidden`}>
    <div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
  </div>
);

export const confidenceColor = value => (value >= 60 ? "bg-green-500" : value >= 30 ? "bg-yellow-500" : "bg-red-500");
