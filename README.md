# WEC Manager — Pro Edition 4.2

Jogo de gerenciamento de equipe do Mundial de Endurance (Hypercar e LMGT3), em React + Tailwind + Lucide.

## Regras de equipe (4.2)

- **Equipes e carros**: na Hypercar uma equipe inscreve 1 ou 2 carros; na LMGT3, sempre 2. A sua equipe pode correr numa classe ou nas duas (até 4 carros). As equipes da IA seguem a mesma regra.
- **Campeonato de equipes**: na Hypercar os pontos dos carros da equipe se somam (como no campeonato de fabricantes). Na LMGT3, até 2026 cada carro é uma inscrição separada na tabela de equipes; a partir de 2027 (regulamento aprovado pela FIA em outubro de 2026) os pontos dos dois carros se somam. Cada carro também pontua no campeonato de carros/pilotos.
- **Conselho**: o jogador é o dono da equipe e não é demitido. Se a confiança zerar, o conselho corta um carro (um Hypercar, ou um programa inteiro — a LMGT3 exige dois carros) ou, se não houver o que cortar, parte do orçamento. No Fácil, nunca.
- **Editor de grid**: crie, edite e exclua equipes da IA à vontade; o tamanho do grid é livre e a IA não sai quando você entra numa classe.
- **Motor de equilíbrio**: cada equipe da IA tem verba e engenharia que mudam ano a ano, regulamento novo em 2028 e a cada 5 anos (conceitos bons e ruins), homologação (fichas de evolução por temporada; correções de confiabilidade e a equipe de pit não usam ficha), BoP mais forte na LMGT3 (compensa 60% da diferença, até ±3%; na Hypercar 40%, até ±2%) e fábricas que contratam estrelas e reagem quando perdem.

```bash
npm install
npm run dev        # jogo em http://localhost:5173
npm run build      # versão de produção em dist/
npm run testar     # cenários do motor (regras de classe, pontuação de equipes, conselho, editor de grid, saves antigos)
npm run simular    # temporadas sem interface: node scripts/simular.mjs [temporadas] [H1|H2|G2|H1G2|H2G2] [EASY|NORMAL|CLASSIC]
node scripts/equilibrio.mjs 12 H1 NORMAL 4   # eras de campeões e curva de um jogador habilidoso
```

## Estrutura

```
src/
  data/constants.js        séries, pistas, equipes, patrocinadores, pneus, dificuldades, instalações, staff
  utils/helpers.js         geração de pilotos (atributos, potencial, nacionalidade), formatação
  utils/mediaEngine.js     notícias, redes sociais e rumores (IA com fallback local)
  engine/                  regras do jogo, sem React (testáveis no Node)
    race.js                simulação da corrida (stints, pneus, ultrapassagens, danos, FCY/SC, dia/noite, rádio)
    weekend.js             clima, BoP, classificação e grid
    results.js             pontos de carros e de equipes, prêmios, salários, patrocínios, reputação
    season.js              virada de temporada (regulamento, contratos, mercado, programa do jogador, conselho)
    team.js                modelo do grid: equipes, programas (equipe numa classe) e carros
    ai.js                  perfis das equipes da IA (verba, engenharia, reação), desenvolvimento e conceitos
    sandbox.js             editor de grid (criar, editar e excluir equipes da IA)
    economy.js / drivers.js / career.js / newGame.js
  screens/                 menu, painel, briefing, setup, classificação, corrida, resultado, fim de temporada
  components/              abas do painel, mapa da pista, modais, notícias
scripts/                   simulação, cenários e diagnósticos do motor
_engenharia-reversa/       ferramentas da reconstrução a partir do bundle (fica só no seu PC, fora do git)
```

O save automático fica no `localStorage` (`wec_manager_autosave`). Saves das versões 3.x, 4.0 e 4.1 são migrados ao carregar.
