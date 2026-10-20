import { useEffect, useRef, useState } from "react";

// Contorno estático da pista (pré-visualização no painel e no briefing)
export const TrackOutline = ({ track, className = "w-full h-full", color = "#3b82f6" }) => (
  <svg viewBox="0 0 500 300" className={className} preserveAspectRatio="xMidYMid meet">
    <path d={track.path} fill="none" stroke="#1f2937" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    <path d={track.path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
  </svg>
);

const TrackMap = ({ track, cars, viewClass = "ALL", night = 0, neutral = null, playerColor = "#3b82f6", selectedId = null }) => {
  const pathRef = useRef(null);
  const [dots, setDots] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  useEffect(() => {
    if (pathRef.current) {
      try {
        const totalLength = pathRef.current.getTotalLength();
        const multi = cars.filter(car => car.isPlayer).length > 1;
        setStartPoint(pathRef.current.getPointAtLength(0));
        const positions = cars
          .map(car => {
            if (car.status === "DNF" || (viewClass !== "ALL" && car.class !== viewClass)) {
              return null;
            }
            let progress = car.lapProgressPct || 0;
            progress = Math.max(0, Math.min(1, progress));
            const point = pathRef.current.getPointAtLength(progress * totalLength);
            let x = point.x;
            let y = point.y;
            if (car.status === "PIT") {
              y += 15;
            }
            let color = "#9ca3af";
            if (car.isPlayer) {
              color = playerColor;
            } else if (car.class === "HYPERCAR") {
              color = "#ef4444";
            } else if (car.class === "LMGT3") {
              color = "#eab308";
            }
            return {
              id: car.teamId,
              x,
              y,
              color,
              stroke: car.isPlayer ? "white" : "none",
              isPlayer: car.isPlayer,
              label: car.isPlayer ? (multi ? `#${car.number}` : "VOCÊ") : "LÍDER",
              selected: car.isPlayer && (!multi || !selectedId || car.teamId === selectedId),
              isLeader: car.classPosition === 1,
              teamName: car.teamName,
              class: car.class
            };
          })
          .filter(Boolean)
          .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
        setDots(positions);
      } catch (error) {
        console.error("Erro ao calcular posições no mapa", error);
      }
    }
  }, [cars, track, viewClass, playerColor, selectedId]);
  const trackColor = neutral === "SC" ? "#ca8a04" : neutral === "FCY" ? "#a16207" : "#374151";
  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <div className="absolute top-2 left-2 md:left-4 z-10 pointer-events-none">
        <h3 className="text-white font-black italic uppercase text-sm md:text-lg shadow-black drop-shadow-md">{track.name}</h3>
        <p className="text-gray-400 text-[10px] md:text-xs">{viewClass === "ALL" ? "Multiclasse Traffic" : `Classe: ${viewClass}`}</p>
      </div>
      <svg viewBox="0 0 500 300" className="w-full h-full max-h-[80vh] md:max-h-[400px]" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {night > 0 && <rect x="-50" y="-50" width="600" height="400" fill="#020617" opacity={night * 0.55} />}
        <path d={track.path} fill="none" stroke="#1f2937" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path ref={pathRef} d={track.path} fill="none" stroke={trackColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {startPoint && (
          <g transform={`translate(${startPoint.x}, ${startPoint.y})`}>
            <rect x="-2" y="-9" width="4" height="18" fill="white" opacity="0.85" />
          </g>
        )}
        {dots.map(dot => (
          <g
            transform={`translate(${dot.x}, ${dot.y})`}
            style={{
              transition: "transform 0.1s linear"
            }}
            key={dot.id}
          >
            {dot.isPlayer && dot.selected && <circle r="12" fill="none" stroke={dot.color} strokeWidth="1" className="animate-ping" opacity="0.6" />}
            {night > 0.4 && <circle r={dot.isPlayer ? 8 : 5} fill="#fef9c3" opacity={0.25 * night} />}
            <circle
              r={dot.isPlayer ? 5 : dot.class === "HYPERCAR" ? 3.5 : 2.5}
              fill={dot.color}
              stroke={dot.stroke}
              strokeWidth={dot.isPlayer ? 1 : 0}
              filter={night > 0.4 ? "url(#glow)" : undefined}
            />
            {(dot.isPlayer || (viewClass !== "ALL" && dot.isLeader)) && (
              <g transform="translate(0, -10)">
                <rect x="-20" y="-12" width="40" height="12" rx="2" fill="rgba(0,0,0,0.8)" />
                <text x="0" y="-3" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">
                  {dot.label}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

export default TrackMap;
