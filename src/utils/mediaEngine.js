import { MEDIA_SCHEMA, MEDIA_OUTLETS, SOCIAL_HANDLES, HASHTAGS, MEDIA_BACKEND_URL } from "../data/constants.js";
import { generateId, pickRandom, generateEngagement, surname } from "./helpers.js";

// ---------------------------------------------------------------------------
// Mídia gerada por IA (Worker no Cloudflare)
// ---------------------------------------------------------------------------

export const fetchAiMediaFeed = async context => {
  const prompt = `
    Você é a engine de narrativa oficial do jogo WEC Manager.

    Gere uma lista de 3 a 6 itens de mídia com:
    - Notícias (tom jornalístico)
    - Posts sociais (fãs, pilotos, memes)
    - Rumores (raros)

    Use estritamente o JSON do schema enviado.

    CONTEXTO:
    Pista: ${context.track}
    Clima: ${context.weather}
    Drama: ${context.dramaLevel}
    Eventos: ${context.keyEvents.join(", ")}

    HYPERCAR:
    Vencedor: ${context.winnerHyp}
    Pódio: ${context.podiumHyp.join(" / ")}

    LMGT3:
    Vencedor: ${context.winnerGt3}
    Pódio: ${context.podiumGt3.join(" / ")}

    JOGADOR:
    Equipe: ${context.playerTeam}
    Classe: ${context.playerClass}
    Posição Final: P${context.playerPos}
    Status: ${context.playerStatus}
    Sentimento: ${context.playerSentiment}
    ${context.secondCar ? `Segundo carro da equipe: ${context.secondCar}` : ""}

    - Para social, varie entre fãs felizes, haters ou memes sobre a estratégia.
    - O idioma deve ser Português (PT-BR).
  `;
  try {
    const result = await (await fetch(MEDIA_BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        mediaSchema: MEDIA_SCHEMA
      })
    })).json();
    if (!result.ok || !result.data) {
      console.error("Erro no backend:", result.error);
      return null;
    } else {
      return JSON.parse(result.data).map(item => ({
        ...item,
        id: crypto.randomUUID(),
        read: false,
        date: "Pós-Corrida"
      }));
    }
  } catch (error) {
    console.error("Erro ao chamar o Worker:", error);
    return null;
  }
};

// Monta o contexto da corrida que vai no prompt da IA (a partir do relatório da corrida)
export const buildRaceContext = (report, playerTeam) => {
  const finishers = list => list.filter(result => result.finished);
  const hyper = finishers(report.classes.HYPERCAR);
  const gt3 = finishers(report.classes.LMGT3);
  const mine = report.player;
  const keyEvents = [];
  if (report.rain) {
    keyEvents.push("Chuva forte e pista molhada");
  }
  if (report.safetyCar) {
    keyEvents.push("Safety Car agitou a estratégia");
  }
  if (!mine.finished) {
    keyEvents.push(`Abandono da equipe do jogador (${playerTeam.name}: ${mine.dnfReason})`);
  }
  report.events
    .filter(event => event.text.includes("💥") || event.text.includes("DNF") || event.text.includes("SAFETY"))
    .slice(-3)
    .forEach(event => keyEvents.push(event.text));
  let sentiment = "Neutro";
  if (!mine.finished) {
    sentiment = "Devastado";
  } else if (mine.classPos === 1) {
    sentiment = "Eufórico (Vitória)";
  } else if (mine.classPos <= 3) {
    sentiment = "Satisfeito (Pódio)";
  } else if (mine.classPos > 10) {
    sentiment = "Decepcionado";
  }
  return {
    track: report.track.name,
    weather: report.rain ? "Chuvoso/Caótico" : "Seco/Estável",
    dramaLevel: report.safetyCar ? 85 : 40,
    keyEvents,
    winnerHyp: hyper[0]?.teamName || "Desconhecido",
    podiumHyp: hyper.slice(0, 3).map(result => result.teamName),
    winnerGt3: gt3[0]?.teamName || "Desconhecido",
    podiumGt3: gt3.slice(0, 3).map(result => result.teamName),
    playerTeam: playerTeam.name,
    playerClass: playerTeam.class,
    playerPos: mine.classPos,
    playerStatus: mine.finished ? "RUN" : "DNF",
    playerSentiment: sentiment,
    secondCar: (report.players || []).slice(1).map(result => `#${result.number} (${result.class}): ${result.finished ? `P${result.classPos}` : `DNF - ${result.dnfReason}`}`)[0] || null
  };
};

// ---------------------------------------------------------------------------
// Mídia gerada localmente (fallback sem IA)
// ---------------------------------------------------------------------------

// Lê a corrida (pela posição NA CLASSE do jogador) e marca o que aconteceu de relevante
const analyzeRaceStory = report => {
  const mine = report.player;
  const classResults = report.classes[mine.class];
  const winner = classResults.find(result => result.finished);
  const story = {
    tags: [],
    dramaLevel: 0,
    winnerName: winner?.teamName || "Ninguém",
    highlightRival: null
  };
  if (report.rain) {
    story.tags.push("RAIN_CHAOS");
    story.dramaLevel += 30;
  }
  if (report.safetyCar) {
    story.tags.push("SC_DRAMA");
    story.dramaLevel += 20;
  }
  if (report.track.id === "lemans") {
    story.tags.push("LE_MANS");
    story.dramaLevel += 15;
  }
  if (!mine.finished) {
    story.tags.push("PLAYER_DNF");
    story.dramaLevel += 40;
  } else if (mine.classPos === 1) {
    story.tags.push("PLAYER_WIN");
    story.dramaLevel += 20;
    const second = classResults[1];
    if (second && (!second.finished || second.gap.includes("volta") || parseFloat(second.gap.replace("+", "")) > 60)) {
      story.tags.push("DOMINANT_WIN");
    } else if (second && parseFloat(second.gap.replace("+", "")) < 3) {
      story.tags.push("PHOTO_FINISH");
      story.dramaLevel += 30;
    }
  } else if (mine.classPos <= 3) {
    story.tags.push("PLAYER_PODIUM");
  } else if (mine.classPos > Math.ceil(classResults.length * 0.7)) {
    story.tags.push("PLAYER_BAD_DAY");
  } else {
    story.tags.push("PLAYER_MIDFIELD");
  }
  if (mine.finished && mine.startClassPosition - mine.classPos >= 4) {
    story.tags.push("COMEBACK");
  }
  if (mine.pole) {
    story.tags.push("PLAYER_POLE");
  }
  if (mine.fastestLap) {
    story.tags.push("PLAYER_FASTEST");
  }
  if (winner && !winner.isPlayer) {
    story.highlightRival = winner.teamName;
    story.tags.push("RIVAL_WIN");
  }
  return story;
};

const generateNewsArticle = (story, playerTeam, trackName, report) => {
  const outlet = pickRandom(MEDIA_OUTLETS.filter(o => o.type === "NEWS"));
  const winnerName = story.winnerName;
  let title = "";
  let body = "";
  let tags = [];
  if (story.tags.includes("PLAYER_WIN")) {
    if (story.tags.includes("LE_MANS")) {
      title = `Glória em Sarthe! ${playerTeam.name} Vence as 24 Horas de Le Mans`;
      body = `Depois de um dia e uma noite inteiros de corrida, a ${playerTeam.name} cruzou a linha na frente da classe ${playerTeam.class}. Uma vitória que entra para a história da equipe — e vale pontos em dobro no campeonato.`;
      tags = ["LE MANS", "LENDÁRIO"];
    } else if (story.tags.includes("RAIN_CHAOS")) {
      title = `${playerTeam.name} Dança na Chuva e Conquista ${trackName}`;
      body = `Em um domingo caótico onde a estratégia foi rainha, a ${playerTeam.name} manteve a compostura. Enquanto rivais rodavam e erravam nos boxes, eles navegaram até a bandeira quadriculada.`;
      tags = ["MASTERCLASS", "CHUVA"];
    } else if (story.tags.includes("PHOTO_FINISH")) {
      title = `Inacreditável! ${playerTeam.name} Vence Por Milímetros em ${trackName}`;
      body = `A reta final de ${trackName} viu uma das chegadas mais apertadas da história do WEC. A defesa da ${playerTeam.name} nas últimas voltas entrará para os livros de história.`;
      tags = ["ÉPICO", "BATALHA"];
    } else {
      title = `Dominância Total: ${playerTeam.name} Destrói a Concorrência`;
      body = `Uma performance clínica. O ritmo de corrida apresentado hoje pela ${playerTeam.name} deixou o paddock coçando a cabeça em busca de respostas.`;
      tags = ["DOMÍNIO", "VITÓRIA"];
    }
  } else if (story.tags.includes("PLAYER_DNF")) {
    title = `Desilusão para ${playerTeam.name}: ${report.player.dnfReason || "Abandono"} Custa Caro`;
    body = "O carro parou, e com ele, as esperanças de um bom resultado. A confiabilidade continua sendo o \"Calcanhar de Aquiles\" da equipe nesta temporada.";
    tags = ["QUEBRA", "DRAMA"];
  } else if (story.tags.includes("COMEBACK")) {
    title = `Recuperação Espetacular: ${playerTeam.name} Sai de P${report.player.startClassPosition} e Termina em P${report.player.classPos}`;
    body = `Ninguém apostava na ${playerTeam.name} depois de uma classificação difícil, mas a estratégia e as ultrapassagens transformaram o domingo. ${winnerName} venceu, mas a história do dia foi outra.`;
    tags = ["RECUPERAÇÃO", "ESTRATÉGIA"];
  } else if (story.tags.includes("PLAYER_PODIUM")) {
    title = `Pódio em ${trackName}: ${playerTeam.name} Volta para Casa com Troféu`;
    body = `A ${playerTeam.name} terminou em P${report.player.classPos} na classe ${playerTeam.class}. ${winnerName} levou a vitória, mas a equipe mostrou que tem ritmo para brigar lá na frente.`;
    tags = ["PÓDIO", "RESULTADO"];
  } else if (story.tags.includes("RIVAL_WIN")) {
    title = `${winnerName} Mostra Força e Vence em ${trackName}`;
    body = `A ${playerTeam.name} não teve resposta para o ritmo da ${winnerName} hoje. O campeonato fica mais acirrado com este resultado sólido dos rivais.`;
    tags = ["RIVAL", "RESULTADO"];
  } else {
    title = `Resumo de ${trackName}: Uma Corrida de Estratégia`;
    body = `Com desgaste de pneus alto, quem cuidou da borracha levou a melhor. ${winnerName} vence, enquanto o meio do pelotão proporcionou as melhores disputas.`;
    tags = ["ANÁLISE"];
  }
  return {
    id: generateId(),
    type: "NEWS",
    source: outlet.name,
    title,
    body,
    date: "Domingo, 17:30",
    read: false,
    importance: story.tags.includes("PLAYER_WIN") || story.tags.includes("PLAYER_DNF") ? "HIGH" : "MEDIUM",
    tags,
    imageBg: story.tags.includes("RAIN_CHAOS") ? "rain" : "track"
  };
};

// Banco de posts por situação; cada feed sorteia sem repetir
const socialTemplates = (story, playerTeam, trackName, report) => {
  const team = playerTeam.name;
  const handleTeam = team.replace(/\s/g, "");
  const winner = story.winnerName;
  const tag = pickRandom(HASHTAGS.GENERAL);
  const pos = report.player.classPos;
  const drove = report.player.drivers.filter(d => d.driveTime > 0);
  const driver = drove.length ? surname(pickRandom(drove).name) : null;
  const pools = [];
  if (story.tags.includes("PLAYER_WIN")) {
    pools.push([
      `SIM!! VAMOOO ${team}! 🏆 Finalmente tudo encaixou. Que corrida! A estratégia foi perfeita hoje. ${tag}`,
      `Sorte. Pura sorte. Se não fosse aquele Safety Car, a ${team} não pegava nem pódio. Campeonato manipulado? 🤔`,
      `Tenho que admitir, a ${team} voou hoje em ${trackName}. O ritmo no último stint foi absurdo. ${tag}`,
      `Chorei. Acompanho a ${team} desde o primeiro ano e hoje veio a vitória. 😭🏆`,
      `Os engenheiros da ${team} merecem um aumento. Que pit stops! ⚡ ${tag}`
    ]);
  }
  if (story.tags.includes("PLAYER_DNF")) {
    pools.push([
      `Dói ver o carro parado na pista... 💔 Estamos com vocês @${handleTeam}, vamos voltar mais fortes!`,
      "De novo?? A confiabilidade desse carro é uma piada. Parece feito de vidro. 🤡 Engenheiros precisam acordar.",
      `Mais um zero pra conta da ${team}. Alguém avisa que endurance é sobre TERMINAR a corrida? 😤`,
      `Abandono em ${trackName}... a diretoria da ${team} não deve estar nada feliz. 👀`
    ]);
  }
  if (story.tags.includes("PLAYER_PODIUM")) {
    pools.push([
      `Pódio pra ${team}! 🍾 Esse projeto está crescendo de verdade. ${tag}`,
      `P${pos} em ${trackName}! Quem diria que a ${team} ia andar assim esse ano. 🔥`,
      `${driver || "O piloto"} foi gigante no stint final. Pódio merecido! 👏`
    ]);
  }
  if (story.tags.includes("COMEBACK")) {
    pools.push([
      `Que recuperação da ${team}! Saiu lá de trás e foi engolindo todo mundo. Isso é corrida de endurance! 🔥 ${tag}`,
      `Largou mal, terminou bem. Paciência é tudo nas provas longas, e a ${team} entendeu isso hoje.`
    ]);
  }
  if (story.tags.includes("PLAYER_BAD_DAY")) {
    pools.push([
      `Alguém viu a ${team} hoje? Eu só vi no replay da largada. 😴 Precisa de muito P&D aí.`,
      `P${pos}... a ${team} precisa de um carro novo ou de um milagre. Talvez os dois. 🙃`,
      `O BoP nem consegue salvar esse carro da ${team}. 😬`
    ]);
  }
  if (story.tags.includes("SC_DRAMA")) {
    pools.push([
      "Esse Diretor de Prova precisa de óculos! O SC demorou 3 voltas pra sair! Arruinou a corrida de metade do grid. 😡",
      `O Safety Car embaralhou tudo em ${trackName}. Quem parou na hora certa saiu sorrindo. 🧠`
    ]);
  }
  if (story.tags.includes("RAIN_CHAOS")) {
    pools.push([`Chuva em ${trackName} = caos total. Quem acertou o pneu de chuva fez a festa. 🌧️ ${tag}`, "Pneu slick na pista molhada é coragem ou burrice? Hoje vi as duas coisas. ☔"]);
  }
  if (story.tags.includes("PLAYER_FASTEST")) {
    pools.push([`Volta mais rápida pra ${team}! O carro tem ritmo, falta só juntar tudo num domingo só. ⏱️ ${tag}`]);
  }
  if (story.tags.includes("PLAYER_POLE")) {
    pools.push([`Pole position da ${team}! A classificação foi um show. 🚀`]);
  }
  if (story.tags.includes("LE_MANS")) {
    pools.push([`24 horas sem dormir assistindo Le Mans e faria tudo de novo. Não existe corrida igual. 🇫🇷 ${tag}`, "A noite em Sarthe é a coisa mais bonita do automobilismo. Os faróis na Mulsanne... 🌙"]);
  }
  pools.push([
    `Corrida morna em ${trackName}, mas bom ver ${winner} no topo. Os carros da LMGT3 estavam salvando o show hoje nas disputas.`,
    `${winner} venceu em ${trackName} e eu continuo achando que o BoP ajudou. 🤔`,
    `Endurance é isso: 99% gerenciamento, 1% loucura. ${winner} acertou tudo hoje. ${tag}`,
    `Assisti ${trackName} inteira e não pisquei. Multiclasse é caos bonito. ${tag}`,
    `Quero ver a ${team} brigando lá na frente em Le Mans. Tem potencial! 🔥`,
    `Que estratégia de pneus foi aquela da ${team}? Alguém explica? 😅`,
    ...(driver ? [`${driver} pilotou demais hoje em ${trackName}. Merece um carro melhor! 👏 ${tag}`] : [])
  ]);
  return pools;
};

const generateSocialPost = (story, playerTeam, trackName, report, used) => {
  const mood = Math.random();
  const handle = pickRandom(SOCIAL_HANDLES);
  const pools = socialTemplates(story, playerTeam, trackName, report);
  // Prefere os posts da situação (primeiras listas); evita repetir no mesmo feed
  const candidates = pools.flat().filter(text => !used.has(text));
  const specific = pools.slice(0, -1).flat().filter(text => !used.has(text));
  const body = (specific.length && Math.random() < 0.7 ? pickRandom(specific) : pickRandom(candidates.length ? candidates : pools.flat()));
  used.add(body);
  const engagement = generateEngagement(story.dramaLevel + 20);
  return {
    id: generateId(),
    type: "SOCIAL",
    source: "X (Twitter)",
    handle,
    body,
    likes: engagement.likes,
    shares: engagement.shares,
    date: "Há 15min",
    read: false,
    avatarColor: mood > 0.5 ? "bg-blue-600" : "bg-red-600"
  };
};

const generateRumor = (playerTeam, allTeams) => {
  const rumorType = pickRandom(["TRANSFER", "TECH", "FINANCE", "REGULATION"]);
  const outlet = pickRandom(MEDIA_OUTLETS.filter(o => o.type === "RUMOR"));
  const rivals = allTeams.filter(team => team.id !== playerTeam.id);
  let title = "";
  let body = "";
  if (rumorType === "TRANSFER") {
    const team = pickRandom(rivals);
    const driver = pickRandom(team.drivers);
    title = `Bomba: ${surname(driver.name)} de saída?`;
    body = `Fontes no paddock indicam que ${driver.name} foi visto jantando com chefes da ${playerTeam.name}. O contrato termina em breve...`;
  } else if (rumorType === "TECH") {
    const suspect = Math.random() > 0.5 ? playerTeam.name : pickRandom(rivals).name;
    title = `FIA investigando o assoalho da ${suspect}?`;
    body = `Rivais enviaram fotos detalhadas do difusor traseiro da ${suspect} para a FIA. Há suspeitas de flexão aerodinâmica ilegal acima de 300km/h.`;
  } else if (rumorType === "REGULATION") {
    title = "Mudança no BoP vem aí?";
    body = "Engenheiros de várias equipes reclamam que o Balance of Performance está favorecendo os carros mais lentos. A FIA estaria estudando uma revisão.";
  } else {
    title = `Orçamento Estourado na ${pickRandom(rivals).name}`;
    body = "Rumores de que a equipe já gastou 80% do budget da temporada e parou o desenvolvimento. O carro atual é o que terão até o fim do ano.";
  }
  return {
    id: generateId(),
    type: "RUMOR",
    source: outlet.name,
    title,
    body,
    date: "Bastidores",
    read: false,
    importance: "LOW",
    tags: ["FOFOCA", rumorType]
  };
};

// Feed completo pós-corrida: notícia principal, notícia da outra classe, 3–5 posts, entrevista (se pódio) e rumor (30%)
export const generateRaceMedia = (report, playerTeam, allTeams) => {
  const feed = [];
  const story = analyzeRaceStory(report);
  const trackName = report.track.name;
  feed.push(generateNewsArticle(story, playerTeam, trackName, report));
  const otherClass = playerTeam.class === "HYPERCAR" ? "LMGT3" : "HYPERCAR";
  const otherWinner = report.classes[otherClass].find(result => result.finished);
  if (otherWinner) {
    feed.push({
      id: generateId(),
      type: "NEWS",
      source: pickRandom(MEDIA_OUTLETS.filter(o => o.type === "NEWS")).name,
      title: `${otherClass === "HYPERCAR" ? "Hypercar" : "LMGT3"}: ${otherWinner.teamName} vence em ${trackName}`,
      body: `Na outra classe, a ${otherWinner.teamName} levou a melhor${report.fastestLaps[otherClass] ? ` e a volta mais rápida ficou com a ${report.fastestLaps[otherClass].teamName}` : ""}.`,
      date: "Domingo, 18:00",
      read: false,
      importance: "LOW",
      tags: [otherClass]
    });
  }
  const sister = (report.players || [])[1];
  if (sister) {
    const sisterClass = report.classes[sister.class];
    const winnerOfClass = sisterClass.find(result => result.finished);
    const sameClass = sister.class === report.player.class;
    const oneTwo = sameClass && [report.player, sister].every(result => result.finished && result.classPos <= 2);
    let title;
    let body;
    if (oneTwo) {
      title = `Dobradinha da ${playerTeam.name} em ${trackName}!`;
      body = `Os carros #${report.player.number} e #${sister.number} cruzaram a linha em 1º e 2º na ${className(sister.class)}. Uma demonstração de força da equipe inteira.`;
    } else if (!sister.finished) {
      title = `Carro #${sister.number} abandona em ${trackName}`;
      body = `O segundo carro da ${playerTeam.name} parou com ${(sister.dnfReason || "problemas").toLowerCase()}. A equipe vai analisar os dados antes da próxima etapa.`;
    } else if (sister.classPos === 1) {
      title = `Vitória do #${sister.number} na ${className(sister.class)}!`;
      body = `O segundo carro da ${playerTeam.name} venceu em ${trackName}${sameClass ? "" : ", fechando um fim de semana de duas frentes para a equipe"}.`;
    } else {
      title = `#${sister.number} termina em P${sister.classPos} na ${className(sister.class)}`;
      body = `${winnerOfClass ? `${winnerOfClass.teamName} venceu, ` : ""}enquanto o segundo carro da ${playerTeam.name} somou ${sister.points} pontos em ${trackName}.`;
    }
    feed.push({
      id: generateId(),
      type: "NEWS",
      source: pickRandom(MEDIA_OUTLETS.filter(o => o.type === "NEWS")).name,
      title,
      body,
      date: "Domingo, 17:45",
      read: false,
      importance: oneTwo || sister.classPos === 1 ? "HIGH" : "MEDIUM",
      tags: [sister.class, "EQUIPE"]
    });
  }
  const usedPosts = new Set();
  const postCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < postCount; i++) {
    feed.push(generateSocialPost(story, playerTeam, trackName, report, usedPosts));
  }
  if (story.tags.includes("PLAYER_WIN") || story.tags.includes("PLAYER_PODIUM")) {
    const quote = story.tags.includes("PLAYER_WIN") ? "O carro estava sobre trilhos. A equipe fez um trabalho fantástico nos boxes." : "Foi difícil segurar os pneus no final, mas o pódio é um grande resultado para nós.";
    feed.push({
      id: generateId(),
      type: "INTERVIEW",
      source: "TV Broadcast",
      title: `"${quote}"`,
      body: "Palavras do seu piloto na zona mista após a bandeira quadriculada.",
      date: "Ao Vivo",
      read: false,
      importance: "MEDIUM"
    });
  }
  if (Math.random() < 0.3) {
    feed.push(generateRumor(playerTeam, allTeams));
  }
  return feed;
};

// Notícias de abertura da temporada
export const generateSeasonStartNews = (year, playerTeam, objective, sisterTeam = null) => [{
  id: generateId(),
  type: "NEWS",
  source: "WEC Official",
  title: `Temporada ${year}: A Nova Era Começa`,
  body: sisterTeam
    ? `Todas as equipes apresentaram seus carros. A ${playerTeam.name} chega com dois carros — o #${playerTeam.number} na ${className(playerTeam.class)} e o #${sisterTeam.number} na ${className(sisterTeam.class)} — e promete surpreender.`
    : `Todas as equipes apresentaram seus carros. A ${playerTeam.name} promete surpreender, mas os testes de inverno mostram um grid extremamente compacto.`,
  date: "Pré-Temporada",
  read: false,
  importance: "HIGH",
  tags: ["SEASON_START"]
}, ...(objective ? [{
  id: generateId(),
  type: "NEWS",
  source: "Comunicado da Diretoria",
  title: `Meta para ${year}: ${objective.text}`,
  body: "A diretoria definiu o objetivo da temporada. Resultados acima da meta aumentam o orçamento; resultados abaixo podem custar caro.",
  date: "Pré-Temporada",
  read: false,
  importance: "MEDIUM",
  tags: ["DIRETORIA"]
}] : []), {
  id: generateId(),
  type: "SOCIAL",
  source: "X (Twitter)",
  handle: "@WEC_Fan_01",
  body: `O livery da ${playerTeam.name} é o mais bonito do grid este ano! 🔥 Mal posso esperar por Qatar.`,
  likes: 450,
  shares: 20,
  date: "Há 2h",
  read: false
}];

const className = cls => (cls === "HYPERCAR" ? "Hypercar" : "LMGT3");

// Segundo carro inscrito ou retirado na intertemporada
export const generateProgramNews = (playerTeam, change, year) => [{
  id: generateId(),
  type: "NEWS",
  source: "WEC Official",
  title:
    change.type === "EXPAND"
      ? `${playerTeam.name} inscreve o carro #${change.number} na ${className(change.cls)} em ${year}`
      : `${playerTeam.name} reduz a operação para um carro em ${year}`,
  body:
    change.type === "EXPAND"
      ? "A lista de inscritos foi confirmada pelo ACO. A equipe cresce, contrata mecânicos e promete brigar em duas frentes."
      : `O carro #${change.number} deixa o grid da ${className(change.cls)}. A diretoria quer concentrar o orçamento em um único programa.`,
  date: "Pré-Temporada",
  read: false,
  importance: "HIGH",
  tags: ["EQUIPE"]
}];

// Mercado de pilotos da IA no inverno
export const generateTransferNews = moves =>
  moves.slice(0, 4).map(({ driver, team }) => ({
    id: generateId(),
    type: "NEWS",
    source: pickRandom(MEDIA_OUTLETS.filter(o => o.type === "NEWS")).name,
    title: `${driver.name} assina com a ${team.name}`,
    body: `O piloto de rating ${driver.rating} reforça a ${team.name} (${team.class}) para a próxima temporada.`,
    date: "Mercado",
    read: false,
    importance: "LOW",
    tags: ["MERCADO"]
  }));

export const generateRegulationNews = (regulation, year) =>
  regulation.type === "STABLE"
    ? []
    : [{
        id: generateId(),
        type: "NEWS",
        source: "FIA",
        title: regulation.type === "RESET" ? `Novo regulamento técnico para ${year}!` : `FIA corta desempenho para ${year}`,
        body: regulation.type === "RESET"
          ? "Todos os carros foram homologados do zero. Quem acertar o conceito e desenvolver mais rápido sai na frente."
          : "Um ajuste nas regras reduziu o desempenho de todos os carros em 15 pontos.",
        date: "Pré-Temporada",
        read: false,
        importance: "HIGH",
        tags: ["REGULAMENTO"]
      }];

// Mudanças nos programas das equipes da IA (verba da matriz) e o veredito dos testes do regulamento novo
export const generateAiProgramNews = (headlines, concepts, year) => {
  const TEXTS = {
    UP: {
      title: team => `${team.name} abre o cofre para ${year}`,
      body: team => `A matriz não gostou da temporada e aprovou um orçamento maior. A ${team.name} (${className(team.class)}) promete um carro muito mais forte.`
    },
    BOOST: {
      title: team => `Reviravolta na ${team.name}: novo parceiro técnico`,
      body: team => `Depois de anos no fundo do grid da ${className(team.class)}, a ${team.name} anunciou um novo parceiro técnico e um reforço pesado no orçamento.`
    },
    CUT: {
      title: team => `Crise na ${team.name}?`,
      body: team => `Fontes indicam corte de verba na ${team.name} (${className(team.class)}). A matriz estaria olhando para outros programas e o desenvolvimento deve andar mais devagar.`
    }
  };
  const news = headlines.slice(0, 3).map(({ team, type }) => ({
    id: generateId(),
    type: type === "CUT" ? "RUMOR" : "NEWS",
    source: pickRandom(MEDIA_OUTLETS.filter(o => o.type === (type === "CUT" ? "RUMOR" : "NEWS"))).name,
    title: TEXTS[type].title(team),
    body: TEXTS[type].body(team),
    date: "Intertemporada",
    read: false,
    importance: type === "CUT" ? "LOW" : "MEDIUM",
    tags: ["MERCADO", team.class]
  }));
  ["HYPERCAR", "LMGT3"].forEach(cls => {
    const list = concepts.filter(item => item.team.class === cls).sort((a, b) => b.offset - a.offset);
    if (list.length < 2) {
      return;
    }
    const best = list[0];
    const worst = list[list.length - 1];
    news.push({
      id: generateId(),
      type: "NEWS",
      source: "The Race Analysis",
      title: `${className(cls)}: ${best.team.name} acerta em cheio o novo regulamento`,
      body: `Os testes de inverno colocam a ${best.team.name} à frente com folga. Do outro lado, a ${worst.team.name} parece ter errado o conceito e já fala em "temporada de aprendizado".`,
      date: "Pré-Temporada",
      read: false,
      importance: "HIGH",
      tags: ["REGULAMENTO", cls]
    });
  });
  return news;
};

export const generatePromotionNews = (playerTeam, year) => [{
  id: generateId(),
  type: "NEWS",
  source: "WEC Official",
  title: `${playerTeam.name} sobe para a Hypercar em ${year}!`,
  body: "Depois de brilhar na LMGT3, a equipe aceitou o desafio de enfrentar as fábricas na classe principal do Mundial de Endurance.",
  date: "Pré-Temporada",
  read: false,
  importance: "HIGH",
  tags: ["PROMOÇÃO"]
}];
