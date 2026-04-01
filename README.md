# Evolution Playground (selezione naturale semplificata)

Web app in JavaScript vanilla che simula una selezione naturale ispirata a creature 2D fatte da nodi e muscoli.

## Regole implementate

- Popolazione iniziale: **1000 creature** casuali.
- A ogni ciclo:
  - sopravvivono le **500** con distanza maggiore,
  - ciascuna genera 1 figlio mutato,
  - la popolazione torna a 1000.
- Fitness: **metri percorsi in 10 secondi**.
- Fisica semplificata:
  - gravità,
  - pavimento verde impenetrabile,
  - attrito/contatto col suolo,
  - muscoli come molle oscillanti.
- Ogni nodo può essere collegato a **più di due muscoli** (grafo generale, non solo catena).

## Visualizzazione

- Grafico max/media distanza per ciclo.
- Due viste 2D animate (creatura migliore e mediana).
- Pavimento verde con segnalatori metrici per percepire la velocità.
- Avanzamento manuale o automatico.
Piccola web app in JavaScript vanilla che simula, in modo didattico, una selezione naturale ispirata a creature 2D fatte da nodi + muscoli.

## Modello implementato

- Popolazione iniziale di **1000 creature** casuali.
- Ogni creatura ha:
  - numero di nodi,
  - muscoli con ampiezza/frequenza/fase/rigidità,
  - bias globali di ritmo, equilibrio e passo.
- Valutazione fitness: distanza percorsa in una simulazione temporale semplificata.
- Selezione per ciclo:
  - si tengono le **500 migliori**,
  - ogni sopravvissuta genera un figlio con piccole mutazioni,
  - popolazione torna a 1000.
- Visualizzazione:
  - grafico cartesiano distanza max/media per ciclo,
  - mondo 2D animato per creatura migliore e creatura mediana,
  - avanzamento manuale o automatico.

## Avvio

Apri `index.html` in un browser moderno.

Non sono richieste dipendenze esterne.
