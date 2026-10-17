# WEC Manager — Pro Edition 4.0

Jogo de gerenciamento de equipe do Mundial de Endurance (Hypercar e LMGT3), em React + Tailwind + Lucide.

```bash
npm install
npm run dev        # jogo em http://localhost:5173
npm run build      # versão de produção em dist/
npm run testar     # cenários do motor (promoção, demissão, save antigo, pontos)
npm run simular    # temporadas sem interface: node scripts/simular.mjs [temporadas] [HYPERCAR|LMGT3] [EASY|NORMAL|CLASSIC]
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
    economy.js / ai.js / drivers.js / career.js / newGame.js
  screens/                 menu, painel, briefing, setup, classificação, corrida, resultado, fim de temporada
  components/              abas do painel, mapa da pista, modais, notícias
scripts/                   simulação, cenários e diagnósticos do motor
_engenharia-reversa/       ferramentas da reconstrução a partir do bundle (fica só no seu PC, fora do git)
```

O save automático fica no `localStorage` (`wec_manager_autosave`). Saves da versão 3.x são migrados ao carregar.
