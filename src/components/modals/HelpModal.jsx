import { useState } from "react";
import { BookOpen, Car, Factory, Flag, Fuel, Trophy, Users, X } from "lucide-react";

const SECTIONS = [
  {
    id: "basics",
    title: "O jogo",
    icon: BookOpen,
    items: [
      "Você é o chefe de uma equipe do Mundial de Endurance (WEC), na Hypercar ou na LMGT3. A temporada tem 8 etapas; o campeonato é disputado por classe.",
      "Pontuação: 25-18-15-12-10-8-6-4-2-1 para os 10 primeiros da classe. Le Mans vale pontos em dobro, Qatar e Bahrein valem 1,5x, e a pole de cada classe vale 1 ponto.",
      "A diretoria define uma meta para cada temporada. Cumprir a meta aumenta a confiança e o orçamento; falhar seguidamente pode custar o seu emprego (exceto no Fácil).",
      "A reputação sobe com bons resultados e libera patrocinadores e pilotos de elite. Um campeão da LMGT3 recebe convite para a Hypercar."
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
    id: "twocars",
    title: "Equipe com 2 carros",
    icon: Car,
    items: [
      "Programas: Um carro (clássico), Dois carros na mesma classe (como as equipes de fábrica) ou Programa duplo, com um Hypercar e um LMGT3 na mesma equipe.",
      "Na mesma classe os dois carros usam o mesmo projeto: cada upgrade de P&D vale para os dois, mas custa 50% a mais. No programa duplo, cada carro tem o seu P&D.",
      "Cada carro tem 3 pilotos, pontos e campeonato próprios. Caixa, reputação, fábrica, equipe técnica e patrocinadores são da equipe. Dá para trocar pilotos de carro na aba Pilotos.",
      "Custos do 2º carro: operação por corrida (logística e mecânicos) e salários de mais 3 pilotos. Em troca, a diretoria libera uma fatia extra do orçamento anual da classe dele e os patrocinadores pagam +15% pela exposição.",
      "No fim de semana, o setup e a volta de classificação são feitos para cada carro. O 2º carro pode copiar o acerto do carro principal (com alguma perda) e deixar o piloto fazer a volta sozinho.",
      "Na corrida, alterne entre os carros para comandar pits e modos. Com os dois na mesma classe, use as ordens de equipe: Manter posições (sem disputa interna) ou trocar as posições quando estiverem juntos.",
      "A diretoria define uma meta para cada carro. O carro principal conta inteiro na confiança e no orçamento; o segundo carro pesa 60%.",
      "No fim da temporada você pode inscrever um segundo carro (pagando a inscrição) ou retirar o que já tem."
    ]
  },
  {
    id: "seasons",
    title: "Temporadas",
    icon: Trophy,
    items: [
      "No fim do ano: prêmio pela posição no campeonato, orçamento da diretoria, evolução dos pilotos e mercado de transferências da IA.",
      "Regulamento: a cada 3 anos um corte de 15 pontos em todos os carros; a cada 5 anos regulamento novo e todos recomeçam do zero.",
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
