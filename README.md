# Evolution Playground (selezione naturale semplificata)

Piccola web app in JavaScript vanilla che simula, in modo didattico, una selezione naturale di creature 2D fatte di nodi e muscoli.

## Modello

- Popolazione iniziale: **1000 creature** casuali.
- Ogni creatura ha:
  - da 3 a 10 nodi, ciascuno con posizione iniziale e massa;
  - muscoli che collegano coppie di nodi e si comportano come molle oscillanti
    (lunghezza a riposo, ampiezza, frequenza, fase, rigidità);
  - ogni nodo può essere collegato a **più muscoli** (grafo generale, non solo catena).
- Fitness: **metri percorsi in 10 secondi** dal baricentro della creatura.
- A ogni ciclo:
  - sopravvivono le **500** creature che hanno percorso più strada;
  - ciascuna genera 1 figlio con piccole mutazioni (anche aggiunta o rimozione di nodi e muscoli);
  - la popolazione torna a 1000.

## Fisica semplificata

- Gravità e resistenza dell'aria uguale per tutte le creature.
- Pavimento verde impenetrabile con attrito: i nodi a terra fanno presa, quelli sollevati scivolano liberamente.
  Per avanzare una creatura deve quindi coordinare i muscoli in modo da spingere con i nodi appoggiati.
- Limiti a forza dei muscoli e velocità dei nodi, per evitare "esplosioni" numeriche.

## Visualizzazione

- Due viste 2D animate: creatura migliore e creatura mediana.
- Pavimento con segnalatori metrici per percepire la velocità.
- Grafico della distanza massima e media per ciclo.
- Avanzamento manuale o automatico, con pausa regolabile tra un ciclo e l'altro.

## Avvio

Apri `index.html` in un browser moderno. Non sono richieste dipendenze esterne.
