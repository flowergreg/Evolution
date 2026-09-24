# Evolution Playground (selezione naturale semplificata)

Piccola web app in JavaScript vanilla che simula, in modo didattico, una selezione naturale di creature 2D fatte di nodi e muscoli.

## Modello

- Popolazione iniziale: **1000 creature** casuali.
- Ogni creatura ha:
  - da 3 a 10 nodi, ciascuno con posizione iniziale e massa;
  - muscoli che collegano coppie di nodi e si comportano come molle oscillanti
    (lunghezza a riposo, ampiezza, frequenza, fase, rigidità);
  - ogni nodo può essere collegato a **più muscoli** (grafo generale, non solo catena).
  - ogni coppia di nodi può avere **al massimo un muscolo** (con 3 nodi, al massimo 3 muscoli).
- Fitness: **metri percorsi in 10 secondi** dal baricentro della creatura.
- A ogni ciclo:
  - sopravvivono le **500** creature che hanno percorso più strada;
  - nascono 500 figli; ogni genitore è scelto con un piccolo torneo (si estraggono due sopravvissute
    e vince la migliore), quindi le creature più veloci hanno in media più figli;
  - circa il 30% dei figli nasce dall'incrocio di due genitori;
  - ogni figlio riceve mutazioni: piccole variazioni, con occasionali salti ampi, e a volte
    aggiunta o rimozione di nodi e muscoli (un nodo nuovo nasce vicino al corpo, collegato ai due nodi più vicini);
  - la popolazione torna a 1000.

## Fisica semplificata

- Gravità e resistenza dell'aria uguale per tutte le creature.
- Pavimento verde impenetrabile con attrito: i nodi a terra fanno presa, quelli sollevati scivolano liberamente.
  Per avanzare una creatura deve quindi coordinare i muscoli in modo da spingere con i nodi appoggiati.
- All'avvio i muscoli si caricano gradualmente, da 0 a 100% della forza in 0,5 secondi:
  così le creature non possono avanzare con un unico balzo iniziale e devono camminare.
- Limiti a forza dei muscoli e velocità dei nodi, per evitare "esplosioni" numeriche.

## Visualizzazione

- Due viste 2D animate: creatura migliore e creatura mediana.
- Pavimento con segnalatori metrici per percepire la velocità.
- Grafico della distanza massima e media per ciclo.
- Avanzamento manuale o automatico, con pausa regolabile tra un ciclo e l'altro.
- Cursore "Intensità mutazioni" (da ×0 a ×3) per regolare la variabilità durante la simulazione.

## Avvio

Apri `index.html` in un browser moderno. Non sono richieste dipendenze esterne.
