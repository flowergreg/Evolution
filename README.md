# Evolution Playground (selezione naturale semplificata)

Piccola web app in JavaScript vanilla che simula, in modo didattico, una selezione naturale di creature 2D fatte di nodi e muscoli.

## Modello

- Popolazione iniziale: **1000 creature** casuali.
- Ogni creatura ha:
  - da 3 a 10 nodi, ciascuno con posizione iniziale, massa e **attrito** (da 0 = ghiaccio a 1 = presa totale);
  - muscoli che collegano coppie di nodi e si comportano come molle oscillanti
    (lunghezza a riposo fino a 1,5 m, ampiezza, frequenza, fase, rigidità, **forza** da 0,05 a 1);
  - **peso** = somma delle forze dei muscoli: più una creatura pesa, più ogni movimento consuma energia;
  - ogni nodo può essere collegato a **più muscoli** (grafo generale, non solo catena).
  - ogni coppia di nodi può avere **al massimo un muscolo** (con 3 nodi, al massimo 3 muscoli).
- Fitness: **metri percorsi in 10 secondi** dal baricentro della creatura.
- A ogni ciclo:
  - ogni distanza viene moltiplicata per un fattore di **fortuna** casuale fra 0,5 e 1
    (selezione del "buono abbastanza", non solo del migliore);
  - le creature sono divise in **specie** secondo il numero di nodi; ogni specie conserva
    almeno le sue **40** migliori (o tutte, se sono meno), così i corpi complessi hanno tempo di maturare;
  - i posti rimasti, fino a **500** sopravvissute, vanno alle creature con il punteggio (distanza × fortuna) più alto;
  - nascono 500 figli; ogni genitore è scelto con un piccolo torneo (si estraggono due sopravvissute
    e vince quella con il punteggio più alto), quindi le creature più veloci hanno in media più figli;
  - circa il 30% dei figli nasce dall'incrocio di due genitori della stessa specie;
  - ogni figlio riceve mutazioni: piccole variazioni, con occasionali salti ampi, e a volte
    aggiunta o rimozione di nodi e muscoli (un nodo nuovo nasce vicino al corpo, collegato ai due nodi più vicini);
  - la popolazione torna a 1000.

## Fisica semplificata

- Gravità e resistenza dell'aria uguale per tutte le creature.
- Pavimento verde impenetrabile: i nodi a terra fanno presa secondo il loro attrito **e secondo quanto premono sul suolo**
  (un nodo che lo sfiora appena scivola), quelli sollevati si muovono liberamente.
  Per avanzare una creatura deve quindi coordinare i muscoli in modo da spingere con i nodi appoggiati.
- **Energia dei muscoli:** ogni muscolo parte con 100 di energia, uguale per tutti e non soggetta a mutazioni.
  Il lavoro compiuto la consuma e la spinta cala in proporzione; a energia 0 il muscolo non agisce più.
  Il consumo cresce con la velocità del muscolo: a parità di lavoro, un muscolo due volte più rapido
  consuma il doppio. Correre costa quindi molto più che camminare.
  L'energia si ricarica di 10 al secondo (fino a 100): conviene un'andatura economica e regolare, non uno scatto iniziale.
- All'avvio i muscoli si caricano gradualmente, da 0 a 100% della forza in 0,5 secondi:
  così le creature non possono avanzare con un unico balzo iniziale e devono camminare.
- **Ostacoli:** quadratini sul terreno a partire da 2,5 m, con altezza, larghezza e distanza
  regolabili dalla pagina durante la simulazione (valori iniziali 0,2 / 0,2 / 1,5 m; altezza 0 = terreno piatto).
  Un nodo che arriva da sopra si appoggia sulla cima, uno che arriva di lato urta la parete; il controllo segue
  tutto il percorso del nodo, così nemmeno un nodo veloce può scavalcarli. Anche i muscoli sono solidi: non possono
  passare attraverso gli spigoli degli ostacoli.
- Limite alla forza di ogni muscolo e alla sua lunghezza: oltre **1,5 m** un muscolo non si allunga più,
  come una corda tesa (impedisce di "lanciare un'ancora" lontano e tirarsi dietro il corpo).

## Visualizzazione

- Due viste 2D animate: creatura migliore e creatura mediana.
  - colore dei nodi da bianco (attrito 0) a nero (attrito 1); anello giallo = nodo a terra;
  - spessore dei muscoli = forza;
  - i muscoli sbiadiscono man mano che consumano energia.
- Pavimento con segnalatori metrici per percepire la velocità.
- Grafico della distanza massima e media per ciclo.
- Riepilogo delle specie: numero di creature e record di distanza per ogni numero di nodi.
- Grafico delle specie: per ogni ciclo, la percentuale di ciascuna specie (da 3 a 10 nodi) sulla popolazione,
  con un colore per specie; passando il mouse si leggono i valori del ciclo.
- Pannello **Ambiente**: caselle per ostacoli, gravità, resistenza dell'aria, forza, lunghezza massima e carica
  iniziale dei muscoli, energia iniziale, ricarica, costo dell'energia e velocità di riferimento del costo.
  Le modifiche valgono dal ciclo successivo; "Valori iniziali" ripristina i valori di partenza.
- Avanzamento manuale o automatico, con pausa regolabile tra un ciclo e l'altro.
- Cursore "Intensità mutazioni" (da ×0 a ×3) per regolare la variabilità durante la simulazione.

## Avvio

Apri `index.html` in un browser moderno. Non sono richieste dipendenze esterne.
