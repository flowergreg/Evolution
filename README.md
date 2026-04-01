# Evolution Playground (selezione naturale semplificata)

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
