import { useState } from "react";
import {
  BadgeCheck,
  CheckCheck,
  CircleAlert,
  Globe,
  Heart,
  LoaderCircle,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Share2,
  Tag,
  Zap
} from "lucide-react";

// Cartões do feed (fora do componente para não serem recriados a cada render)
const NewsCard = ({ item }) => (
  <div
    className={`relative bg-gray-900 border-l-4 rounded-r-xl overflow-hidden transition-all hover:bg-gray-800/80 group ${item.read ? "border-gray-700 opacity-80" : "border-blue-500 bg-gray-800 shadow-md"}`}
  >
    <div className="p-5">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-blue-900/30 text-blue-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider border border-blue-900/50 flex items-center gap-1">
            <Globe size={10} /> {item.source}
          </span>
          {item.importance === "HIGH" && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">
              BREAKING
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-500 font-mono">{item.date}</span>
      </div>
      <h4
        className={`font-serif font-bold text-xl text-white mb-3 leading-tight ${item.read ? "text-gray-400" : ""}`}
      >
        {item.title}
      </h4>
      <p className="text-gray-400 text-sm leading-relaxed font-sans">{item.body}</p>
      {item.tags && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800">
          {item.tags.map((tag, index) => (
            <span
              className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1"
              key={index}
            >
              <Tag size={10} /> {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
);
const SocialPost = ({ item }) => (
  <div
    className={`bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors ${item.read ? "opacity-75" : "shadow-lg shadow-blue-900/10"}`}
  >
    <div className="flex gap-3">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-lg ${item.avatarColor || "bg-gray-700"}`}
      >
        {item.handle ? item.handle.charAt(1).toUpperCase() : "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="font-bold text-white text-sm truncate">Fã de WEC</span>
            <BadgeCheck size={12} className="text-blue-400 shrink-0" />
            <span className="text-xs text-gray-500 truncate ml-1">{item.handle}</span>
            <span className="text-gray-600 text-xs mx-1">•</span>
            <span className="text-xs text-gray-500">{item.date}</span>
          </div>
        </div>
        <p className="text-gray-200 text-sm mt-1 mb-3 whitespace-pre-wrap leading-snug">
          {item.body.split(" ").map((word, index) =>
            word.startsWith("#") ? (
              <span className="text-blue-400 font-bold" key={index}>
                {word}{" "}
              </span>
            ) : (
              word + " "
            )
          )}
        </p>
        <div className="flex items-center justify-between max-w-xs text-gray-500">
          <button className="flex items-center gap-1 text-xs hover:text-blue-400 group transition-colors">
            <MessageSquare
              size={14}
              className="group-hover:bg-blue-900/20 rounded-full p-0.5 box-content transition-colors"
            />
            {Math.floor(item.likes / 10)}
          </button>
          <button className="flex items-center gap-1 text-xs hover:text-green-400 group transition-colors">
            <Zap
              size={14}
              className="group-hover:bg-green-900/20 rounded-full p-0.5 box-content transition-colors"
            />
            {item.shares}
          </button>
          <button className="flex items-center gap-1 text-xs hover:text-red-500 group transition-colors">
            <Heart
              size={14}
              className="group-hover:bg-red-900/20 rounded-full p-0.5 box-content transition-colors group-hover:fill-red-500"
            />
            {item.likes}
          </button>
          <button className="flex items-center gap-1 text-xs hover:text-blue-400 group transition-colors">
            <Share2
              size={14}
              className="group-hover:bg-blue-900/20 rounded-full p-0.5 box-content transition-colors"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
);
const RumorCard = ({ item }) => (
  <div
    className={`bg-gradient-to-r from-purple-900/20 to-gray-900 border border-purple-900/30 rounded-xl p-4 relative overflow-hidden group ${item.read ? "opacity-70" : "ring-1 ring-purple-500/50"}`}
  >
    <div className="absolute -right-4 -top-4 text-purple-800/10 rotate-12 group-hover:text-purple-800/20 transition-colors">
      <CircleAlert size={100} />
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase">
          RUMOR
        </span>
        <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
          {item.source}
        </span>
      </div>
      <h4 className="font-bold text-white text-lg italic mb-2">"{item.title}"</h4>
      <p className="text-gray-300 text-xs italic border-l-2 border-purple-600 pl-3">{item.body}</p>
      <div className="mt-3 flex justify-end">
        <span className="text-[9px] text-gray-500 uppercase font-bold">Confiabilidade: Baixa</span>
      </div>
    </div>
  </div>
);
const InterviewCard = ({ item }) => (
  <div className="bg-gray-800 border-l-4 border-yellow-500 rounded-r-xl p-6 shadow-lg my-2">
    <div className="flex flex-col items-center text-center">
      <h4 className="text-2xl md:text-3xl font-serif italic text-white mb-4 leading-tight">
        "{item.title}"
      </h4>
      <div className="w-10 h-1 bg-yellow-500 mb-3 rounded-full" />
      <p className="text-gray-400 text-sm">{item.body}</p>
      <span className="text-[10px] text-gray-500 uppercase font-bold mt-2 tracking-widest">
        {item.source} • {item.date}
      </span>
    </div>
  </div>
);

const NewsFeed = ({ newsFeed, markAllRead, isLoading }) => {
  const [filter, setFilter] = useState("ALL");
  const filteredFeed = newsFeed.filter(item => (filter === "ALL" ? true : item.type === filter));
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl h-full flex flex-col overflow-hidden shadow-2xl">
      <div className="p-4 md:p-6 border-b border-gray-800 bg-gray-900 flex justify-between items-center sticky top-0 z-10 shrink-0 shadow-md">
        <div>
          <h3 className="text-2xl font-black italic text-white flex items-center gap-2 tracking-tighter">
            <Globe className="text-blue-500" size={24} /> NEWS WIRE
          </h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Global Motorsport Feed</p>
        </div>
        <button
          onClick={markAllRead}
          className="text-[10px] md:text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg border border-gray-700 flex items-center gap-2 transition-colors font-bold uppercase tracking-wider active:scale-95"
        >
          <CheckCheck size={14} /> <span className="hidden md:inline">Marcar Lidas</span>
        </button>
      </div>
      <div className="flex border-b border-gray-800 bg-gray-900/50 px-4 gap-4 shrink-0 overflow-x-auto no-scrollbar">
        {["ALL", "NEWS", "SOCIAL", "RUMOR"].map(item => (
          <button
            onClick={() => setFilter(item)}
            className={`py-3 text-[10px] md:text-xs font-black uppercase transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${filter === item ? "text-blue-400 border-blue-500" : "text-gray-500 border-transparent hover:text-white"}`}
            key={item}
          >
            {item === "NEWS" && <Newspaper size={12} />}
            {item === "SOCIAL" && <MessageCircle size={12} />}
            {item === "RUMOR" && <CircleAlert size={12} />}
            {item === "ALL" ? "Todos" : item}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950 custom-scrollbar scroll-smooth">
        {isLoading && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500 mb-6">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex items-center justify-center gap-3">
              <LoaderCircle className="animate-spin text-blue-400" size={24} />
              <div>
                <p className="text-blue-200 font-bold text-sm">Aguarde...</p>
                <p className="text-blue-400 text-xs">Consultando jornais e redes sociais...</p>
              </div>
            </div>
          </div>
        )}
        {filteredFeed.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 space-y-4">
            <div className="bg-gray-800 p-4 rounded-full">
              <Newspaper size={48} className="text-gray-500" />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-gray-400">Sem novidades.</p>
              <p className="text-sm">O mundo do automobilismo está dormindo.</p>
            </div>
          </div>
        ) : (
          filteredFeed.map(item =>
            item.type === "SOCIAL" ? (
              <SocialPost item={item} key={item.id} />
            ) : item.type === "RUMOR" ? (
              <RumorCard item={item} key={item.id} />
            ) : item.type === "INTERVIEW" ? (
              <InterviewCard item={item} key={item.id} />
            ) : (
              <NewsCard item={item} key={item.id} />
            )
          )
        )}
        {filteredFeed.length > 0 && (
          <div className="text-center py-8">
            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">
              Fim do Feed Recente
            </p>
            <div className="w-16 h-1 bg-gray-800 mx-auto mt-2 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};
export default NewsFeed;
