// Configurações das categorias do campeonato
// economy: escala financeira da categoria (patrocínios, salários, prêmios e instalações na LMGT3 valem 1/3)
export const SERIES_CONFIG = {
  HYPERCAR: {
    id: "HYPERCAR",
    name: "WEC - Hypercar",
    short: "HYP",
    budget: 45000000,
    partsCostBase: 350000,
    upgradeGrowth: 1.032,
    prestige: 100,
    fuelTank: 100,
    tyreWearFactor: 1,
    fuelFactor: 1,
    baseSpeed: 60,
    economy: 1,
    annualBudget: 36000000,
    prizeBase: 500000,
    seasonPrizeStep: 600000,
    startReputation: 30,
    aiLevels: [85, 72, 60]
  },
  LMGT3: {
    id: "LMGT3",
    name: "WEC - LMGT3",
    short: "GT3",
    budget: 15000000,
    partsCostBase: 120000,
    upgradeGrowth: 1.032,
    prestige: 50,
    fuelTank: 100,
    tyreWearFactor: 0.8,
    fuelFactor: 0.8,
    baseSpeed: 48,
    economy: 0.33,
    annualBudget: 12000000,
    prizeBase: 165000,
    seasonPrizeStep: 200000,
    startReputation: 20,
    aiLevels: [80, 68, 58]
  }
};

// Patrocinadores disponíveis para contrato
// Valores de referência da Hypercar; na LMGT3 são multiplicados por SERIES_CONFIG.economy.
// goal: posição exigida na classe ({ HYPERCAR, LMGT3 }); minReputation: reputação mínima para negociar.
export const SPONSORS = [{
  id: "future_crypto",
  name: "DogeCoinz",
  industry: "Crypto",
  description: "Paga aleatoriamente entre $0 e $800k por corrida.",
  type: "GAMBLE",
  signingBonus: 300000,
  perRacePayment: 0,
  maxRandom: 800000,
  goal: null,
  duration: 4,
  minReputation: 0
}, {
  id: "cafe_pilota",
  name: "Café Pilota",
  industry: "Alimentos",
  description: "Patrocínio modesto, mas topa qualquer equipe.",
  type: "FIXED",
  signingBonus: 150000,
  perRacePayment: 120000,
  goal: null,
  duration: 8,
  minReputation: 0
}, {
  id: "tech_global",
  name: "TechGlobal",
  industry: "Tecnologia",
  description: "Pagamento constante, baixo risco.",
  type: "FIXED",
  signingBonus: 500000,
  perRacePayment: 250000,
  goal: null,
  duration: 6,
  minReputation: 10
}, {
  id: "oil_corp",
  name: "PetroGiant",
  industry: "Energia",
  description: "Grande bônus de assinatura, renda baixa.",
  type: "UPFRONT",
  signingBonus: 2000000,
  perRacePayment: 50000,
  goal: null,
  duration: 8,
  minReputation: 15
}, {
  id: "gripmax",
  name: "GripMax Lubrificantes",
  industry: "Automotivo",
  description: "Paga pouco por corrida, mas dá um bônus por pódio na classe.",
  type: "PODIUM",
  signingBonus: 200000,
  perRacePayment: 120000,
  bonus: 700000,
  goal: null,
  duration: 6,
  minReputation: 20
}, {
  id: "bank_secure",
  name: "Secure Bank",
  industry: "Finanças",
  description: "Contrato longo e estável.",
  type: "FIXED",
  signingBonus: 1000000,
  perRacePayment: 150000,
  goal: null,
  duration: 10,
  minReputation: 25
}, {
  id: "apex_telecom",
  name: "Apex Telecom",
  industry: "Telecom",
  description: "Contrato estável de média duração.",
  type: "FIXED",
  signingBonus: 400000,
  perRacePayment: 320000,
  goal: null,
  duration: 6,
  minReputation: 30
}, {
  id: "lux_watch",
  name: "Kronos Watches",
  industry: "Luxo",
  description: "Exige Top 5 na classe (Top 8 na LMGT3). Paga muito bem se cumprir.",
  type: "PERFORMANCE",
  signingBonus: 250000,
  perRacePayment: 600000,
  goal: {
    HYPERCAR: 5,
    LMGT3: 8
  },
  duration: 4,
  minReputation: 30
}, {
  id: "solaris",
  name: "Solaris Energy",
  industry: "Energia Renovável",
  description: "Bônus enorme se a equipe subir ao pódio da classe em Le Mans.",
  type: "LEMANS",
  signingBonus: 300000,
  perRacePayment: 200000,
  bonus: 3000000,
  goal: {
    HYPERCAR: 3,
    LMGT3: 3
  },
  duration: 8,
  minReputation: 35
}, {
  id: "speed_drink",
  name: "Redbullish",
  industry: "Bebidas",
  description: "Exige Top 3 na classe (Top 5 na LMGT3). Pagamento agressivo.",
  type: "PERFORMANCE",
  signingBonus: 100000,
  perRacePayment: 1000000,
  goal: {
    HYPERCAR: 3,
    LMGT3: 5
  },
  duration: 5,
  minReputation: 40
}, {
  id: "atlas_logistics",
  name: "Atlas Logistics",
  industry: "Logística",
  description: "Luvas altíssimas para uma equipe de prestígio.",
  type: "UPFRONT",
  signingBonus: 4000000,
  perRacePayment: 100000,
  goal: null,
  duration: 8,
  minReputation: 45
}, {
  id: "orbital_aero",
  name: "Orbital Aerospace",
  industry: "Aeroespacial",
  description: "Exige pódio na classe. Paga $1.5M por corrida se cumprir.",
  type: "PERFORMANCE",
  signingBonus: 500000,
  perRacePayment: 1500000,
  goal: {
    HYPERCAR: 3,
    LMGT3: 3
  },
  duration: 6,
  minReputation: 60
}, {
  id: "nimbus_cloud",
  name: "Nimbus Cloud",
  industry: "Tecnologia",
  description: "Contrato longo e generoso, só para equipes de ponta.",
  type: "FIXED",
  signingBonus: 1500000,
  perRacePayment: 650000,
  goal: null,
  duration: 10,
  minReputation: 70
}, {
  id: "monarch_bank",
  name: "Monarch Private Bank",
  industry: "Finanças",
  description: "Só fecha com vencedores. Paga um bônus extra a cada vitória.",
  type: "WIN",
  signingBonus: 2500000,
  perRacePayment: 800000,
  bonus: 1000000,
  goal: null,
  duration: 8,
  minReputation: 85
}];

// Calendário: pistas da temporada (path = traçado SVG usado no mapa da corrida)
const BASE_TRACKS = [{
  id: "qatar",
  name: "Qatar 1812km",
  laps: 38,
  type: "balanced",
  length: 5419,
  keyFeature: "o calor do deserto",
  corners: ["Curva 1", "Setor Sinuoso"],
  path: "M67.8,61.2 L65.0,79.9 L93.6,168.5 L146.9,208.6 L141.4,222.4 L91.4,253.7 L88.7,269.1 L97.5,283.4 L414.8,285.1 L435.7,274.6 L431.3,247.7 L371.9,158.0 L425.2,82.7 L396.1,28.8 L337.2,31.0 L294.9,117.9 L272.9,139.3 L242.7,150.9 L229.4,146.5 L239.9,88.2 L214.6,62.9 L191.5,16.1 L178.3,15.0 L164.0,26.0 L148.6,116.8 L139.8,110.7 L116.7,48.0 L93.6,46.9 Z"
}, {
  id: "imola",
  name: "6 Hours of Imola",
  laps: 24,
  type: "technical",
  length: 4909,
  keyFeature: "o tráfego intenso",
  corners: ["Tamburello", "Rivazza", "Acque Minerali"],
  path: "M92,285 L93,281 L95,278 L97,275 L99,272 L101,269 L104,266 L106,263 L108,260 L110,256 L112,253 L114,250 L116,247 L118,244 L120,240 L118,237 L116,233 L114,230 L113,226 L113,221 L113,217 L114,212 L114,207 L115,203 L115,198 L116,193 L116,189 L117,184 L117,179 L118,175 L119,170 L119,165 L119,160 L120,155 L120,151 L121,146 L122,142 L123,138 L125,135 L128,132 L130,130 L133,127 L136,125 L139,122 L141,120 L142,115 L142,110 L143,106 L146,103 L149,101 L152,99 L156,97 L159,96 L163,94 L166,92 L170,91 L173,89 L177,88 L180,86 L185,85 L188,83 L192,82 L196,80 L200,79 L204,78 L208,76 L212,75 L216,75 L221,74 L225,73 L230,73 L235,72 L240,72 L245,72 L250,72 L254,71 L260,71 L265,71 L270,71 L274,70 L279,69 L283,68 L287,67 L291,66 L295,65 L299,63 L303,62 L307,61 L311,60 L315,59 L319,57 L323,56 L327,55 L331,53 L334,52 L337,50 L341,48 L344,45 L347,43 L350,41 L353,39 L356,37 L359,34 L362,32 L365,30 L368,28 L371,26 L373,23 L377,21 L380,19 L382,17 L387,15 L391,15 L395,17 L397,20 L400,22 L402,25 L404,28 L407,31 L408,35 Z"
}, {
  id: "spa",
  name: "6 Hours of Spa",
  laps: 20,
  type: "speed",
  length: 7004,
  keyFeature: "a instabilidade climática",
  corners: ["Eau Rouge", "Raidillon", "La Source", "Blanchimont"],
  path: "M488.8,73.4 L445.6,11.8 L406.8,13.0 L392.4,0.0 L213.9,48.1 L117.1,98.2 L39.4,175.0 L11.2,236.1 L29.9,242.4 L127.8,186.6 L136.7,194.0 L186.8,190.3 L257.6,167.3 L303.4,188.9 L372.2,281.6 L409.4,300.0 L432.4,298.8 L460.0,267.5 L460.6,244.7 L415.7,212.5 L416.0,169.0 L339.1,135.0 L329.0,102.5 L340.0,91.8 L435.6,69.7 L455.4,98.2 L474.1,102.5 L487.4,93.9 Z"
}, {
  id: "lemans",
  name: "24 Hours of Le Mans",
  laps: 45,
  type: "endurance",
  length: 13626,
  keyFeature: "a longa noite em Sarthe",
  corners: ["Mulsanne", "Tetre Rouge", "Indianapolis", "Dunlop"],
  path: "M500.0,27.4 L498.6,25.7 L487.8,22.6 L479.0,22.3 L384.8,27.7 L377.7,29.4 L361.4,34.8 L357.7,34.8 L351.3,33.1 L348.9,33.5 L346.5,35.2 L344.9,39.2 L342.8,40.9 L190.0,90.0 L187.7,91.4 L182.2,97.5 L180.9,97.8 L178.2,95.8 L176.2,95.1 L172.8,95.5 L48.1,136.1 L40.0,140.2 L17.3,154.7 L13.2,158.1 L7.8,163.9 L1.7,173.4 L0.0,176.8 L0.3,180.1 L5.8,194.0 L11.9,202.5 L16.6,205.6 L22.7,205.9 L25.7,208.3 L26.4,210.0 L26.8,221.1 L29.1,227.2 L31.8,230.6 L37.3,234.3 L40.7,237.7 L48.4,250.3 L50.5,251.6 L55.9,250.9 L63.0,262.5 L65.7,265.5 L69.8,267.9 L81.6,272.0 L94.2,274.0 L120.6,274.7 L120.9,277.4 L129.1,277.7 L129.1,275.7 L129.7,275.0 L142.3,275.3 L143.3,274.3 L144.0,272.3 L153.1,270.3 L154.5,268.9 L155.1,266.9 L156.8,265.9 L196.1,255.4 L204.3,256.4 L211.0,256.4 L223.9,254.0 L228.3,254.3 L231.0,256.0 L238.1,263.1 L242.9,264.8 L248.6,264.8 L254.7,262.1 L262.2,254.3 L266.3,252.6 L272.7,252.0 L277.8,252.0 L282.2,253.0 L293.4,262.8 L298.4,264.8 L304.2,264.8 L308.3,263.5 L313.0,260.8 L325.9,251.6 L364.2,232.7 L380.4,228.3 L415.3,220.5 L417.7,218.8 L418.0,216.7 L408.9,193.7 L408.5,191.3 L410.6,189.6 L416.3,188.3 L423.4,185.6 L425.5,184.2 L428.2,181.2 L428.5,182.9 L430.6,182.9 L430.6,189.3 L432.2,189.3 L432.2,181.2 L428.2,181.2 L443.1,162.2 L458.0,141.5 L481.4,96.5 L483.7,90.0 L500.0,29.4 Z"
}, {
  id: "saopaulo",
  name: "6 Hours of São Paulo",
  laps: 32,
  type: "technical",
  length: 4309,
  keyFeature: "o 'S' do Senna",
  corners: ["S do Senna", "Laranjinha", "Junção"],
  path: "M38.9,145.4 L47.3,195.5 L72.7,242.0 L125.6,266.0 L197.5,282.9 L234.1,285.0 L313.1,268.1 L452.7,227.2 L461.1,214.5 L459.0,201.8 L441.4,182.8 L453.4,151.1 L452.0,120.0 L440.7,97.5 L427.3,84.8 L346.2,58.7 L171.4,15.0 L158.0,15.7 L148.1,29.8 L141.1,61.5 L144.6,95.4 L160.8,113.7 L268.7,194.8 L271.5,223.0 L262.3,238.5 L234.8,246.9 L203.8,248.3 L215.1,211.7 L197.5,193.4 L182.0,196.9 L144.6,227.2 L113.6,235.7 L112.9,230.0 L150.2,189.8 L153.8,160.9 L136.9,137.0 L75.5,98.2 L63.5,96.1 L57.2,101.7 Z"
}, {
  id: "cota",
  name: "Lone Star Le Mans (COTA)",
  laps: 22,
  type: "balanced",
  length: 5513,
  keyFeature: "a subida cega da curva 1",
  corners: ["Big Red", "Esses", "Reta Oposta"],
  path: "M25.0,196.1 L28.6,200.2 L176.4,212.8 L304.9,242.2 L311.6,238.8 L299.5,185.8 L317.3,192.2 L314.4,216.8 L322.9,226.5 L334.5,228.6 L337.4,223.6 L334.0,177.7 L346.8,161.6 L362.7,157.5 L372.9,160.7 L380.2,169.1 L386.4,192.9 L403.7,226.7 L467.7,224.5 L474.5,221.0 L475.0,213.2 L380.7,63.5 L373.3,57.8 L366.5,61.2 L363.9,119.7 L299.0,134.9 L287.6,149.8 L266.6,151.0 L250.9,172.1 L242.7,176.8 L222.0,175.4 L201.2,154.4 L174.6,163.1 L152.1,148.5 L105.5,142.8 L32.3,184.8 Z"
}, {
  id: "fuji",
  name: "6 Hours of Fuji",
  laps: 25,
  type: "technical",
  length: 4563,
  keyFeature: "a reta infinita e o Monte Fuji",
  corners: ["Hairpin", "Dunlop Chicane", "Reta Principal"],
  path: "M475.0,103.5 L33.7,82.2 L25.0,92.6 L29.3,106.2 L40.0,112.8 L91.5,116.1 L90.8,129.0 L83.2,137.3 L65.0,141.4 L41.1,138.6 L35.9,143.5 L34.5,158.1 L40.1,182.5 L58.3,199.2 L49.7,212.9 L53.3,219.4 L135.8,227.2 L192.7,201.8 L228.3,156.9 L245.9,148.3 L251.9,151.3 L253.0,206.8 L271.7,224.7 L290.7,231.0 L306.8,226.6 L318.0,215.3 L343.9,159.1 L453.6,129.4 Z"
}, {
  id: "bahrain",
  name: "8 Hours of Bahrain",
  laps: 29,
  type: "endurance",
  length: 5412,
  keyFeature: "a abrasividade do asfalto",
  corners: ["Curva 1", "Curva 10", "Reta dos Boxes"],
  path: "M79.3,22.7 L53.3,190.5 L53.3,224.2 L61.0,250.3 L42.7,273.4 L46.5,283.1 L430.3,285.0 L457.3,269.6 L457.3,258.0 L338.7,64.2 L314.6,36.2 L299.2,39.1 L285.7,54.5 L268.3,90.2 L266.4,116.2 L278.9,140.4 L336.8,173.1 L346.4,191.5 L341.6,207.9 L114.0,205.9 L123.7,192.4 L135.2,188.6 L224.9,198.2 L249.0,197.2 L255.8,189.5 L245.2,174.1 L191.2,131.7 L191.2,98.9 L184.4,86.4 L149.7,67.1 L101.5,17.9 L88.0,15.0 Z"
}];

// Equipes de cada categoria
export const TEAM_NAMES = {
  HYPERCAR: ["Toyota Gazoo", "Ferrari AF", "Porsche Penske", "Cadillac Racing", "Alpine Endurance", "BMW M Team", "Peugeot Total", "Lamborghini Iron", "Hertz Team JOTA", "Proton Comp"],
  LMGT3: ["Porsche", "Team WRT", "Ferrari", "Audi Sport", "BMW M", "Alpine", "Aston Martin", "McLaren", "Proton Mustang", "Corvette Racing", "Lexus Racing", "Lamborghini Squadra", "Mercedes-AMG", "Cadillac", "Nissan GT", "Jaguar Racing"]
};

// Banco de nomes para geração de pilotos
export const FIRST_NAMES = ["Antonio", "Brendon", "Sebastien", "Kamui", "Nyck", "Mike", "Jose", "Alessandro", "James", "Earl", "Will", "Callum", "Robert", "Jenson", "Mick", "Kevin", "Laurens", "Dries", "Sheldon", "Kelvin", "Giuliano", "Kazuki", "Sébastien", "Ryo", "Lucas", "Nick", "Daniel", "Lando", "Nico", "Louis", "Stoffel", "Raffaele", "Sergio", "Stoffel", "Max", "Lewis", "Kevin", "Luca"];
export const LAST_NAMES = ["Giovinazzi", "Hartley", "Buemi", "Kobayashi", "De Vries", "Conway", "Maria Lopez", "Pier Guidi", "Calado", "Bamber", "Stevens", "Ilott", "Kubica", "Button", "Schumacher", "Estre", "Vanthoor", "Van der Linde", "Rast", "Fuoco", "Nakajima", "Lopez", "Vandoorne", "Hulkenberg", "Sargeant", "Ricciardo", "Norris", "Verstappen", "Hamilton", "Magnussen", "Ghiotto", "Caldwell", "Sato", "Fukuzumi", "Matsuda", "Matsushita"];

// Schema JSON enviado ao backend de IA para gerar a mídia pós-corrida
export const MEDIA_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["NEWS", "SOCIAL", "RUMOR"]
      },
      source: {
        type: "string"
      },
      title: {
        type: "string",
        nullable: true
      },
      body: {
        type: "string"
      },
      importance: {
        type: "string",
        enum: ["HIGH", "MEDIUM", "LOW"]
      },
      tags: {
        type: "array",
        items: {
          type: "string"
        }
      },
      likes: {
        type: "integer"
      },
      avatarColor: {
        type: "string"
      }
    },
    required: ["type", "source", "body", "importance", "likes"]
  }
};

// Veículos de imprensa (notícias e rumores)
export const MEDIA_OUTLETS = [{
  name: "Autosport Global",
  type: "NEWS",
  bias: "NEUTRAL",
  style: "formal"
}, {
  name: "The Race Analysis",
  type: "NEWS",
  bias: "TECHNICAL",
  style: "analytic"
}, {
  name: "Motorsport.com",
  type: "NEWS",
  bias: "NEUTRAL",
  style: "standard"
}, {
  name: "WEC Insider",
  type: "NEWS",
  bias: "ENTHUSIAST",
  style: "excited"
}, {
  name: "Paddock Rumors",
  type: "RUMOR",
  bias: "SENSATIONALIST",
  style: "tabloid"
}, {
  name: "Grid Gossip",
  type: "RUMOR",
  bias: "SPECULATIVE",
  style: "casual"
}];

// Perfis de fãs nas redes sociais
export const SOCIAL_HANDLES = ["@SimRacer99", "@TifosiForever", "@LeMansLegend", "@CarbonFiber_X", "@RaceDirectorPls", "@ApexHunter", "@PitLaneSpy", "@V8_Enjoyer", "@HybridEraHater", "@WEC_Stan", "@OrangeArmy_WEC", "@StrategyGod"];

export const HASHTAGS = {
  GENERAL: ["#WEC", "#EnduranceRacing", "#Motorsport"]
};

// Endpoint do Worker que gera a mídia com IA
export const MEDIA_BACKEND_URL = "https://wec-backend.jesuinodeoliveira97.workers.dev";

// ---------------------------------------------------------------------------
// v4.0 — dados ampliados
// ---------------------------------------------------------------------------

export const GAME_VERSION = "4.1";
export const SAVE_KEY = "wec_manager_autosave";
export const SETTINGS_KEY = "wec_manager_settings";

// Detalhes de cada etapa, mesclados ao traçado original.
// pointsMultiplier: Le Mans vale pontos em dobro e as provas longas (1812 km e 8h) valem 1,5x.
// startHour/durationHours: relógio real da prova (para o ciclo dia/noite).
// timeScale: a prova é comprimida; os tempos exibidos (voltas, diferenças) são escalados para a casa dos reais.
// weather: probabilidade de cada cenário climático no fim de semana.
const TRACK_DETAILS = {
  qatar: {
    country: "Catar",
    code: "QAT",
    date: "28 FEV",
    timeScale: 1.24,
    pointsMultiplier: 1.5,
    startHour: 14,
    durationHours: 10,
    tyreWear: 1.15,
    fuelUse: 1,
    overtaking: 1,
    pitLane: 23,
    weather: { SUNNY: 0.85, OVERCAST: 0.15, MIXED: 0, RAINY: 0 }
  },
  imola: {
    country: "Itália",
    code: "ITA",
    date: "20 ABR",
    timeScale: 1.26,
    pointsMultiplier: 1,
    startHour: 13,
    durationHours: 6,
    tyreWear: 1,
    fuelUse: 1,
    overtaking: 0.7,
    pitLane: 22,
    weather: { SUNNY: 0.5, OVERCAST: 0.2, MIXED: 0.2, RAINY: 0.1 }
  },
  spa: {
    country: "Bélgica",
    code: "BEL",
    date: "10 MAI",
    timeScale: 1.18,
    pointsMultiplier: 1,
    startHour: 13,
    durationHours: 6,
    tyreWear: 0.95,
    fuelUse: 1.05,
    overtaking: 1.2,
    pitLane: 24,
    weather: { SUNNY: 0.3, OVERCAST: 0.25, MIXED: 0.25, RAINY: 0.2 }
  },
  lemans: {
    country: "França",
    code: "FRA",
    date: "14 JUN",
    timeScale: 1.01,
    pointsMultiplier: 2,
    startHour: 16,
    durationHours: 24,
    tyreWear: 0.9,
    fuelUse: 1.1,
    overtaking: 1.3,
    pitLane: 28,
    weather: { SUNNY: 0.5, OVERCAST: 0.2, MIXED: 0.2, RAINY: 0.1 }
  },
  saopaulo: {
    country: "Brasil",
    code: "BRA",
    date: "13 JUL",
    timeScale: 1.3,
    pointsMultiplier: 1,
    startHour: 12,
    durationHours: 6,
    tyreWear: 1.1,
    fuelUse: 1,
    overtaking: 1,
    pitLane: 21,
    weather: { SUNNY: 0.35, OVERCAST: 0.2, MIXED: 0.25, RAINY: 0.2 }
  },
  cota: {
    country: "EUA",
    code: "USA",
    date: "07 SET",
    timeScale: 1.32,
    pointsMultiplier: 1,
    startHour: 12,
    durationHours: 6,
    tyreWear: 1.1,
    fuelUse: 1,
    overtaking: 1,
    pitLane: 22,
    weather: { SUNNY: 0.7, OVERCAST: 0.15, MIXED: 0.1, RAINY: 0.05 }
  },
  fuji: {
    country: "Japão",
    code: "JPN",
    date: "28 SET",
    timeScale: 1.3,
    pointsMultiplier: 1,
    startHour: 11,
    durationHours: 6,
    tyreWear: 1,
    fuelUse: 1.05,
    overtaking: 1.1,
    pitLane: 22,
    weather: { SUNNY: 0.4, OVERCAST: 0.25, MIXED: 0.2, RAINY: 0.15 }
  },
  bahrain: {
    country: "Bahrein",
    code: "BHR",
    date: "08 NOV",
    timeScale: 1.34,
    pointsMultiplier: 1.5,
    startHour: 14,
    durationHours: 8,
    tyreWear: 1.35,
    fuelUse: 1,
    overtaking: 1.1,
    pitLane: 22,
    weather: { SUNNY: 0.85, OVERCAST: 0.15, MIXED: 0, RAINY: 0 }
  }
};
export const TRACKS = BASE_TRACKS.map(track => ({
  ...track,
  ...TRACK_DETAILS[track.id]
}));

export const TRACK_TYPE_LABELS = {
  balanced: "Equilibrada",
  technical: "Técnica",
  speed: "Velocidade",
  endurance: "Resistência"
};

export const WEATHER_SCENARIOS = {
  SUNNY: { label: "Ensolarado", rain: 0.02 },
  OVERCAST: { label: "Nublado", rain: 0.15 },
  MIXED: { label: "Instável", rain: 0.55 },
  RAINY: { label: "Chuvoso", rain: 0.9 }
};

// Pontuação do WEC (multiplicada pelo pointsMultiplier da etapa) + 1 ponto pela pole da classe
export const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const POLE_POINTS = 1;

// Compostos de pneu: grip relativo ao médio e taxa de desgaste
export const TYRES = {
  SOFT: { id: "SOFT", label: "Macio", short: "S", grip: 1.01, wear: 1.4, dry: true, color: "#ef4444" },
  MEDIUM: { id: "MEDIUM", label: "Médio", short: "M", grip: 1, wear: 1, dry: true, color: "#eab308" },
  HARD: { id: "HARD", label: "Duro", short: "H", grip: 0.99, wear: 0.7, dry: true, color: "#e5e7eb" },
  WET: { id: "WET", label: "Chuva", short: "W", grip: 1, wear: 1, dry: false, color: "#3b82f6" }
};
export const TYRE_ORDER = ["SOFT", "MEDIUM", "HARD", "WET"];

// Modos de pilotagem: ritmo, consumo, desgaste, risco de quebra e de erro
export const STRATEGIES = {
  CONSERVE: { id: "CONSERVE", label: "Poupar", pace: 0.98, fuel: 0.82, tyre: 0.8, risk: 0.5, error: 0.7 },
  BALANCED: { id: "BALANCED", label: "Normal", pace: 1, fuel: 1, tyre: 1, risk: 1, error: 1 },
  ATTACK: { id: "ATTACK", label: "Ataque", pace: 1.02, fuel: 1.25, tyre: 1.4, risk: 1.5, error: 1.6 }
};

export const DIFFICULTIES = {
  EASY: {
    id: "EASY",
    label: "Fácil",
    description: "Carro competitivo, mais dinheiro e uma diretoria paciente que nunca demite.",
    startCar: 62,
    startReliability: 78,
    budgetMult: 1.3,
    canBeFired: false,
    confidenceMult: 0.6
  },
  NORMAL: {
    id: "NORMAL",
    label: "Normal",
    description: "Equipe estreante de meio de grid. A diretoria cobra resultados.",
    startCar: 48,
    startReliability: 70,
    budgetMult: 1,
    canBeFired: true,
    confidenceMult: 1
  },
  CLASSIC: {
    id: "CLASSIC",
    label: "Clássico",
    description: "As regras originais: carro nível 25, confiabilidade 60 e diretoria exigente.",
    startCar: 25,
    startReliability: 60,
    budgetMult: 1,
    canBeFired: true,
    confidenceMult: 1.3
  }
};

// Equipes da IA: o índice na lista define o nível (3 de ponta, 3 de fábrica, o resto privadas)
export const AI_TIERS = [{
  id: 0,
  label: "Equipe de fábrica de ponta",
  fundsMult: 1.4,
  support: 2000000,
  annual: 30000000
}, {
  id: 1,
  label: "Equipe de fábrica",
  fundsMult: 1.4,
  support: 1500000,
  annual: 24000000
}, {
  id: 2,
  label: "Equipe privada",
  fundsMult: 1.2,
  support: 1100000,
  annual: 19000000
}];

// Número e cor de cada equipe da IA
export const TEAM_DETAILS = {
  "Toyota Gazoo": { number: "8", color: "#ef4444" },
  "Ferrari AF": { number: "51", color: "#dc2626" },
  "Porsche Penske": { number: "6", color: "#f5f5f5" },
  "Cadillac Racing": { number: "2", color: "#facc15" },
  "Alpine Endurance": { number: "36", color: "#3b82f6" },
  "BMW M Team": { number: "20", color: "#60a5fa" },
  "Peugeot Total": { number: "93", color: "#a3e635" },
  "Lamborghini Iron": { number: "63", color: "#84cc16" },
  "Hertz Team JOTA": { number: "12", color: "#fde047" },
  "Proton Comp": { number: "99", color: "#9ca3af" },
  "Porsche": { number: "92", color: "#e5e7eb" },
  "Team WRT": { number: "46", color: "#0ea5e9" },
  "Ferrari": { number: "21", color: "#f87171" },
  "Audi Sport": { number: "88", color: "#d1d5db" },
  "BMW M": { number: "31", color: "#2563eb" },
  "Alpine": { number: "34", color: "#60a5fa" },
  "Aston Martin": { number: "27", color: "#10b981" },
  "McLaren": { number: "95", color: "#f97316" },
  "Proton Mustang": { number: "77", color: "#94a3b8" },
  "Corvette Racing": { number: "81", color: "#facc15" },
  "Lexus Racing": { number: "87", color: "#e11d48" },
  "Lamborghini Squadra": { number: "60", color: "#a3e635" },
  "Mercedes-AMG": { number: "75", color: "#d4d4d8" },
  "Cadillac": { number: "33", color: "#fbbf24" },
  "Nissan GT": { number: "23", color: "#f43f5e" },
  "Jaguar Racing": { number: "59", color: "#22c55e" }
};

// Cores disponíveis para a equipe do jogador
export const PLAYER_COLORS = ["#3b82f6", "#06b6d4", "#22c55e", "#a855f7", "#f97316", "#ec4899", "#eab308", "#ef4444", "#f8fafc"];

export const NATIONALITIES = {
  AR: { name: "Argentina", code: "ARG" },
  AU: { name: "Austrália", code: "AUS" },
  AT: { name: "Áustria", code: "AUT" },
  BE: { name: "Bélgica", code: "BEL" },
  BR: { name: "Brasil", code: "BRA" },
  CH: { name: "Suíça", code: "SUI" },
  DE: { name: "Alemanha", code: "GER" },
  DK: { name: "Dinamarca", code: "DEN" },
  ES: { name: "Espanha", code: "ESP" },
  FR: { name: "França", code: "FRA" },
  GB: { name: "Reino Unido", code: "GBR" },
  IT: { name: "Itália", code: "ITA" },
  JP: { name: "Japão", code: "JPN" },
  NL: { name: "Holanda", code: "NED" },
  NZ: { name: "Nova Zelândia", code: "NZL" },
  PL: { name: "Polônia", code: "POL" },
  US: { name: "EUA", code: "USA" },
  ZA: { name: "África do Sul", code: "RSA" }
};

// Nacionalidade de cada sobrenome do banco de nomes
export const LASTNAME_NATIONALITY = {
  Giovinazzi: "IT",
  Hartley: "NZ",
  Buemi: "CH",
  Kobayashi: "JP",
  "De Vries": "NL",
  Conway: "GB",
  "Maria Lopez": "AR",
  "Pier Guidi": "IT",
  Calado: "GB",
  Bamber: "NZ",
  Stevens: "GB",
  Ilott: "GB",
  Kubica: "PL",
  Button: "GB",
  Schumacher: "DE",
  Estre: "FR",
  Vanthoor: "BE",
  "Van der Linde": "ZA",
  Rast: "DE",
  Fuoco: "IT",
  Nakajima: "JP",
  Lopez: "AR",
  Vandoorne: "BE",
  Hulkenberg: "DE",
  Sargeant: "US",
  Ricciardo: "AU",
  Norris: "GB",
  Verstappen: "NL",
  Hamilton: "GB",
  Magnussen: "DK",
  Ghiotto: "IT",
  Caldwell: "GB",
  Sato: "JP",
  Fukuzumi: "JP",
  Matsuda: "JP",
  Matsushita: "JP"
};

// Classificação FIA de pilotos (apenas informativa)
export const DRIVER_CATEGORIES = [
  { id: "PLATINUM", label: "Platina", min: 85, badge: "bg-slate-200 text-slate-900" },
  { id: "GOLD", label: "Ouro", min: 75, badge: "bg-yellow-500 text-black" },
  { id: "SILVER", label: "Prata", min: 65, badge: "bg-gray-400 text-black" },
  { id: "BRONZE", label: "Bronze", min: 0, badge: "bg-orange-700 text-orange-100" }
];

export const DRIVERS_PER_CAR = 3;

// Instalações da equipe do jogador (nível 1 a 5)
export const FACILITIES = {
  windTunnel: {
    id: "windTunnel",
    name: "Túnel de Vento",
    description: "Barateia o P&D de Aerodinâmica e Chassi (-6% por nível)."
  },
  engineShop: {
    id: "engineShop",
    name: "Centro de Motores",
    description: "Barateia o P&D de Motor, Eficiência e Confiabilidade (-6% por nível)."
  },
  simulator: {
    id: "simulator",
    name: "Simulador",
    description: "Mais tentativas no setup (níveis 3 e 5), barra da classificação mais lenta e pilotos jovens evoluem mais."
  },
  hospitality: {
    id: "hospitality",
    name: "Marketing & Hospitality",
    description: "Patrocínios pagam +6% por nível, mais reputação por resultado e 4ª vaga de patrocínio no nível 4."
  }
};
export const FACILITY_ORDER = ["windTunnel", "engineShop", "simulator", "hospitality"];
export const FACILITY_MAX_LEVEL = 5;

// Equipe técnica do jogador (1 a 5 estrelas)
export const STAFF_ROLES = {
  technicalDirector: {
    id: "technicalDirector",
    name: "Diretor Técnico",
    description: "Cada estrela acima de 1 dá 12% de chance de um upgrade render +3 em vez de +2."
  },
  raceEngineer: {
    id: "raceEngineer",
    name: "Engenheiro de Corrida",
    description: "Feedback de setup mais preciso, previsão do tempo mais confiável e avisos de rádio melhores."
  },
  crewChief: {
    id: "crewChief",
    name: "Chefe de Mecânicos",
    description: "Pit stops mais rápidos e menos erros nos boxes."
  }
};
export const STAFF_ORDER = ["technicalDirector", "raceEngineer", "crewChief"];
export const STAFF_FIRST_NAMES = ["Marco", "Pierre", "Hans", "Kenji", "Lucia", "Sophie", "James", "Carlos", "Anna", "Yuki", "Diego", "Laura", "Olivier", "Ingrid", "Rafael", "Elena", "Tom", "Giulia"];
export const STAFF_LAST_NAMES = ["Bianchi", "Dupont", "Keller", "Tanaka", "Moreau", "Fischer", "Silva", "Hughes", "Rossi", "Lindqvist", "Okafor", "Novak", "Costa", "Weber", "Ishida", "Garnier", "Holm", "Ferreira"];

// Peças do carro (rótulos e efeitos exibidos na tela de P&D)
export const PART_INFO = {
  engine: { label: "Motor", desc: "Velocidade Final", color: "bg-red-500" },
  aero: { label: "Aerodinâmica", desc: "Curvas Rápidas", color: "bg-cyan-500" },
  chassis: { label: "Chassi", desc: "Desgaste Pneus", color: "bg-green-500" },
  reliability: { label: "Confiabilidade", desc: "Chance de Quebra", color: "bg-purple-500" },
  efficiency: { label: "Eficiência", desc: "Consumo Combustível", color: "bg-yellow-500" },
  crew: { label: "Pit Crew", desc: "Tempo de Box", color: "bg-orange-500" }
};
export const PART_LABELS = Object.fromEntries(Object.entries(PART_INFO).map(([key, info]) => [key, info.label]));

// ---------------------------------------------------------------------------
// v4.1 — equipe com dois carros
// ---------------------------------------------------------------------------

// Programas de corrida da equipe do jogador
export const PROGRAMS = {
  SINGLE: {
    id: "SINGLE",
    label: "Um carro",
    description: "O desafio clássico: um carro, três pilotos e todo o orçamento concentrado nele."
  },
  SAME_CLASS: {
    id: "SAME_CLASS",
    label: "Dois carros na classe",
    description: "Dois carros na mesma classe, como as equipes de fábrica. O P&D vale para os dois (custa 50% a mais) e você pode dar ordens de equipe."
  },
  DUAL_CLASS: {
    id: "DUAL_CLASS",
    label: "Programa duplo",
    description: "Um Hypercar e um LMGT3 na mesma equipe. Dois campeonatos, dois carros para desenvolver e o dobro de pressão."
  }
};
export const PROGRAM_ORDER = ["SINGLE", "SAME_CLASS", "DUAL_CLASS"];

// Custos e receitas do segundo carro (valores da classe do segundo carro)
// operations: logística e mecânicos extras por corrida; annualShare: fatia do orçamento anual da classe que a diretoria libera;
// startShare: fatia do orçamento inicial da classe; entryFee: inscrição ao expandir no meio da carreira
export const SECOND_CAR = {
  HYPERCAR: { operations: 350000, annualShare: 0.55, startShare: 0.55, entryFee: 6000000 },
  LMGT3: { operations: 120000, annualShare: 0.6, startShare: 0.6, entryFee: 2000000 }
};
// P&D compartilhado entre dois carros da mesma classe (peças para os dois)
export const SHARED_DEV_MULT = 1.5;
// Patrocinadores pagam mais por dois carros na pista (exposição)
export const TWO_CAR_SPONSOR_BONUS = 0.15;

// Ordens de equipe durante a corrida (só valem entre os seus carros da mesma classe)
export const TEAM_ORDERS = {
  FREE: { id: "FREE", label: "Disputa livre", description: "Os seus carros podem brigar entre si." },
  HOLD: { id: "HOLD", label: "Manter posições", description: "Nada de disputa interna: quem está atrás segura a posição." }
};
