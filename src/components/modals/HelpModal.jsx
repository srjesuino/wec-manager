import { useState } from "react";
import { BookOpen, Car, Factory, Flag, Fuel, Landmark, LayoutGrid, Trophy, Users, X } from "lucide-react";

const SECTIONS = [
  {
    id: "basics",
    title: "O jogo",
    icon: BookOpen,
    items: [
      "Você é o dono e chefe de uma equipe do Mundial de Endurance (WEC), na Hypercar, na LMGT3 ou nas duas. A temporada tem 8 etapas; em cada classe há um campeonato de equipes e um de carros (pilotos).",
      "Pontuação: 25-18-15-12-10-8-6-4-2-1 para os 10 primeiros. Le Mans vale pontos em dobro, Qatar e Bahrein valem 1,5x, e a pole de cada classe vale 1 ponto.",
      "O conselho da empresa define uma meta para cada classe em que a equipe corre. Cumprir a meta aumenta a confiança e o orçamento; se a confiança zerar, o conselho corta parte da operação (veja Conselho).",
      "A reputação sobe com bons resultados e libera patrocinadores e pilotos de elite. Quem corre só na LMGT3 recebe o convite do ACO para a Hypercar com o título da classe, ou com Top 3 e reputação 55+."
    ]
  },
  {
    id: "weekend",
    title: "Fim de semana",
    icon: Flag,
    items: [
      "Briefing: confira o tipo de pista, a previsão do tempo, o BoP e a dica do engenheiro para o setup.",
      "Treinos (setup): ajuste asa, suspensão e câmbio e consulte o piloto. Quanto mais perto do ideal, mais ritmo no fim de semana: um setup perfeito vale muito.",
      "Classificação: trave a barra na zona roxa nos 3 setores (toque ou Espaço). Depois escolha o pneu de largada.",
      "Corrida: rode em 1x a 10x ou simule até o fim (o box automático assume o seu carro)."
    ]
  },
  {
    id: "strategy",
    title: "Estratégia",
    icon: Fuel,
    items: [
      "Cada tanque dura cerca de 10 voltas; um jogo de pneus médios aguenta quase dois tanques. Parar só para abastecer economiza ~12s.",
      "Pneus: Macio (mais rápido, gasta 40% mais), Médio, Duro (mais lento, dura muito) e Chuva (obrigatório com pista molhada, derrete no seco).",
      "Modos: Poupar reduz consumo e desgaste; Ataque ganha ritmo e ajuda a ultrapassar, mas gasta mais e aumenta o risco de erro e de quebra.",
      "Pilotos se cansam: acima de 55% de fadiga o ritmo cai e os erros aumentam. Troque o piloto nos pit stops (o rádio avisa).",
      "Full Course Yellow e Safety Car são ótimas janelas: parar durante a neutralização custa bem menos tempo.",
      "Danos reduzem o ritmo. No pit você decide se repara (demora mais) ou segue assim."
    ]
  },
  {
    id: "management",
    title: "Gestão",
    icon: Factory,
    items: [
      "P&D: cada upgrade dá +2 na peça (ou +3 com um bom Diretor Técnico). O custo cresce com o nível e dispara acima de 80. A IA paga exatamente o mesmo.",
      "Homologação: cada carro pode trazer 10 evoluções por temporada (16 no ano de regulamento novo), mais até 8 extras se estiver muito atrás do melhor da classe. A equipe de pit não conta. Dinheiro sobrando vai para fábrica, staff e pilotos.",
      "Setup: um acerto perfeito vale ritmo de verdade, mas não compensa um carro muito pior — as equipes de fábrica também acertam bem os carros.",
      "BoP: carros acima da média da classe recebem lastro; os mais lentos ganham desempenho (40% da diferença, até ±2%).",
      "Fábrica: túnel de vento e centro de motores barateiam o P&D; o simulador dá mais tentativas de setup; o marketing aumenta os patrocínios.",
      "Equipe técnica: Diretor Técnico (upgrades), Engenheiro de Corrida (setup, previsão e rádio) e Chefe de Mecânicos (pit stops).",
      "Custos fixos por corrida: salários dos pilotos e da equipe técnica e manutenção das instalações. O extrato fica na aba Finanças."
    ]
  },
  {
    id: "drivers",
    title: "Pilotos",
    icon: Users,
    items: [
      "Cada carro tem 3 pilotos. O titular larga; os outros entram nas trocas durante os pit stops.",
      "Atributos: Ritmo (velocidade), Consistência (menos erros e oscilação), Chuva (desempenho com pista molhada) e Resistência (fadiga mais lenta).",
      "Jovens evoluem até o potencial (com simulador nível 3+ você vê o potencial exato); veteranos perdem rendimento e se aposentam.",
      "Contratos terminam no fim da temporada: você decide quem renovar. Para contratar no meio do ano, alguém precisa sair (com multa rescisória)."
    ]
  },
  {
    id: "cars",
    title: "Equipes e carros",
    icon: Car,
    items: [
      "Como no WEC real: na Hypercar uma equipe inscreve 1 ou 2 carros; na LMGT3 a equipe corre sempre com 2 carros. A IA segue a mesma regra, e a sua equipe pode ter programa nas duas classes ao mesmo tempo.",
      "Campeonato de equipes na Hypercar: os pontos dos carros da equipe se somam (como no de fabricantes). Uma equipe de um carro pontua só com ele.",
      "Campeonato de equipes na LMGT3: até 2026 cada carro é uma inscrição separada na tabela; a partir de 2027 os pontos dos dois carros se somam.",
      "Cada carro também tem os próprios pontos, que valem para o campeonato de carros e pilotos. A aba Classificação mostra a regra da temporada em cada classe.",
      "Dois carros na mesma classe usam o mesmo projeto: cada upgrade de P&D vale para os dois, mas custa 50% a mais. Cada classe tem o seu próprio carro e P&D.",
      "Todo carro além do primeiro custa operação por corrida (logística e mecânicos) e os salários de mais 3 pilotos. Em troca, o conselho libera uma fatia extra do orçamento anual e os patrocinadores pagam +10% por carro extra (até +30%).",
      "Caixa, reputação, fábrica, equipe técnica e patrocinadores são da equipe e atendem todos os carros. Dá para trocar pilotos de carro na aba Pilotos.",
      "No fim de semana, setup e classificação são feitos para cada carro. Um carro pode copiar o acerto de outro da mesma classe (com alguma perda) e deixar o piloto fazer a volta sozinho.",
      "Na corrida, alterne entre os carros para comandar pits e modos. Ordens de equipe valem por classe, entre os seus carros da mesma classe: Disputa livre ou Manter posições.",
      "Com programa nas duas classes, a segunda classe (LMGT3) pesa 60% na confiança e no orçamento do conselho.",
      "No fim da temporada você escolhe quantos carros inscrever em cada classe (Hypercar 0, 1 ou 2; LMGT3 0 ou 2). Carros novos pagam inscrição."
    ]
  },
  {
    id: "board",
    title: "Conselho",
    icon: Landmark,
    items: [
      "Você é o dono da equipe: ninguém tira o seu cargo. Quem cobra resultados é o conselho da empresa, que controla o orçamento.",
      "Cada meta cumprida aumenta a confiança e a verba anual; metas perdidas reduzem as duas.",
      "Se a confiança chegar a zero no fim da temporada, o conselho corta a operação: tira um Hypercar (de 2 para 1) ou fecha o programa inteiro de uma classe (a LMGT3 exige 2 carros, então não dá para cortar só um).",
      "Se não houver carro para cortar (a equipe tem um só programa e um carro), o conselho corta 30% do orçamento anual.",
      "Depois do corte, a confiança volta a 40%. No Fácil o conselho nunca corta."
    ]
  },
  {
    id: "grid",
    title: "Editor de grid",
    icon: LayoutGrid,
    items: [
      "O grid não tem limite de equipes: entrar numa classe não tira ninguém do campeonato.",
      "No editor de grid (modo sandbox) você cria equipes novas da IA, edita as que já existem e exclui as que não quer mais.",
      "As regras de carros valem também aqui: Hypercar com 1 ou 2 carros, LMGT3 sempre com 2.",
      "As mudanças valem na hora."
    ]
  },
  {
    id: "seasons",
    title: "Temporadas",
    icon: Trophy,
    items: [
      "No fim do ano: prêmio pela posição no campeonato de equipes, orçamento do conselho, evolução dos pilotos e mercado de transferências da IA.",
      "Regulamento: o primeiro regulamento novo chega em 2028 e depois a cada 5 temporadas. Todos ganham carro novo; quem acerta o conceito domina o começo do ciclo, e no fim os custos altos aproximam o grid. O seu conceito depende do Diretor Técnico, do Túnel de Vento e do Centro de Motores.",
      "Rivais vivos: cada equipe da IA tem verba da matriz e engenharia que mudam todo ano. Quem vai mal recebe mais dinheiro (ou sofre cortes), quem domina perde gente para os rivais, e as fábricas reagem quando uma equipe independente as vence. As mais ricas contratam as estrelas do mercado.",
      "Saves: o jogo salva sozinho no navegador. Use Exportar save para guardar um arquivo .json."
    ]
  }
];

const HelpModal = ({ onClose }) => {
  const [active, setActive] = useState(SECTIONS[0].id);
  const section = SECTIONS.find(item => item.id === active);
  return (
    <div className="fixed inset-0 bg-gray-950/95 z-50 overflow-y-auto flex items-start md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-4xl bg-gray-900 md:border border-gray-700 md:rounded-xl shadow-2xl flex flex-col min-h-screen md:min-h-0 md:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={event => event.stopPropagation()}
      >
        <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800 md:rounded-t-xl">
          <div>
            <h2 className="text-xl md:text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">COMO JOGAR</h2>
            <p className="text-gray-400 text-xs md:text-sm">Guia rápido do WEC Manager</p>
          </div>
          <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full text-white" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className="flex md:flex-col gap-1 p-2 md:p-4 border-b md:border-b-0 md:border-r border-gray-800 overflow-x-auto md:w-56 shrink-0">
            {SECTIONS.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${active === item.id ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  <Icon size={16} className={active === item.id ? "text-blue-400" : ""} /> {item.title}
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto p-5 md:p-8 custom-scrollbar">
            <h3 className="text-2xl font-black italic mb-4">{section.title}</h3>
            <ul className="space-y-3">
              {section.items.map((text, i) => (
                <li className="flex gap-3 text-sm text-gray-300 leading-relaxed" key={i}>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
