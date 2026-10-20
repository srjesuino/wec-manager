# WEC Manager — Pro Edition 4.1

Jogo de gerenciamento de equipe do Mundial de Endurance (Hypercar e LMGT3), em React + Tailwind + Lucide.

## Novidades da 4.1

- **Equipe com dois carros**: na nova carreira escolha *Um carro*, *Dois carros na classe* (P&D compartilhado, +50% no custo) ou *Programa duplo* (um Hypercar e um LMGT3). No fim de cada temporada dá para inscrever ou retirar o segundo carro.
- **Fim de semana com dois carros**: setup e volta lançada para cada carro (ou copie os dados do carro irmão / deixe o piloto fazer a volta), pneu de largada por carro e corrida com seletor de carro, rádio por carro, **ordens de equipe** e inversão de posições.
- **Diretoria por carro**: cada carro tem a sua meta; o segundo pesa 60% na confiança e no orçamento. Patrocinadores pagam +15% com dois carros na pista.

```bash
npm install
npm run dev        # jogo em http://localhost:5173
npm run build      # versão de produção em dist/
npm run testar     # cenários do motor (promoção, demissão, saves antigos, pontos, dois carros)
npm run simular    # temporadas sem interface: node scripts/simular.mjs [temporadas] [HYPERCAR|LMGT3] [EASY|NORMAL|CLASSIC] [SINGLE|SAME_CLASS|DUAL_CLASS]
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
    results.js             pontos, prêmios, salários, patrocínios, reputação
    season.js              virada de temporada (regulamento, contratos, mercado, diretoria, promoção)
    team.js                carros do jogador (principal + segundo carro), P&D compartilhado
    economy.js / ai.js / drivers.js / career.js / newGame.js
  screens/                 menu, painel, briefing, setup, classificação, corrida, resultado, fim de temporada
  components/              abas do painel, mapa da pista, modais, notícias
scripts/                   simulação, cenários e diagnósticos do motor
_engenharia-reversa/       ferramentas da reconstrução a partir do bundle (fica só no seu PC, fora do git)
```

O save automático fica no `localStorage` (`wec_manager_autosave`). Saves das versões 3.x e 4.0 são migrados ao carregar.
