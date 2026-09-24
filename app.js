const POPULATION_SIZE = 1000;
const SURVIVORS = 500;
const SPECIES_QUOTA = 40; // sopravvissuti garantiti a ogni specie (creature con lo stesso numero di nodi)
const STEP_SECONDS = 10;
const EVAL_DT = 0.05;
const GRAVITY = -9.81;
const MAX_MUSCLE_FORCE = 160;
const ENERGY_RAMP_SECONDS = 0.5; // i muscoli si caricano da 0 a 100% in questo tempo
const AIR_DAMPING = 0.98;
const MUSCLE_ENERGY = 100; // energia iniziale di ogni muscolo, uguale per tutti
const ENERGY_RECHARGE = 10; // energia recuperata da ogni muscolo al secondo (fino a 100)
const ENERGY_COST = 0.1; // energia consumata per unità di lavoro (forza × accorciamento/allungamento)
// Velocità del muscolo (m/s) a cui il costo è quello base: un muscolo due volte più rapido
// consuma il doppio per lo stesso lavoro, uno lento la metà. Così la corsa costa molto più del passo.
const ENERGY_SPEED_REF = 0.5;
const MAX_WORLD_X = 150;
const MAX_WORLD_Y = 8;
const OBSTACLE_START_X = 2.5; // il primo ostacolo comincia qui (le creature partono intorno a 0)

// Ostacoli sul terreno, modificabili dalla pagina (in metri). Altezza 0 = terreno piatto.
const TERRAIN = { height: 0.2, width: 0.2, gap: 1.5 };

// Se il punto x cade sopra un ostacolo, restituisce i bordi dell'ostacolo; altrimenti null.
function obstacleAt(x) {
  if (TERRAIN.height <= 0 || x < OBSTACLE_START_X) return null;
  const period = TERRAIN.width + TERRAIN.gap;
  const left = OBSTACLE_START_X + Math.floor((x - OBSTACLE_START_X) / period) * period;
  return x < left + TERRAIN.width ? { left, right: left + TERRAIN.width } : null;
}

// Parametri dell'evoluzione.
const EVOLUTION = {
  mutationStrength: 1, // moltiplica ampiezza e frequenza delle mutazioni (regolabile dalla pagina)
  bigJumpChance: 0.1, // probabilità che una mutazione sia un salto ampio
  bigJumpScale: 5,
  tournamentSize: 2, // sfidanti estratti per scegliere ogni genitore
  crossoverRate: 0.3, // quota di figli nati da due genitori
  luckMin: 0.5, // fortuna: la distanza di ognuno è moltiplicata per un numero a caso fra luckMin e 1
};

const statsEl = document.getElementById('stats');
const resetBtn = document.getElementById('resetBtn');
const stepBtn = document.getElementById('stepBtn');
const autoBtn = document.getElementById('autoBtn');
const autoSpeedInput = document.getElementById('autoSpeed');
const autoSpeedLabel = document.getElementById('autoSpeedLabel');
const mutationInput = document.getElementById('mutationStrength');
const mutationLabel = document.getElementById('mutationLabel');
const obstacleHeightInput = document.getElementById('obstacleHeight');
const obstacleWidthInput = document.getElementById('obstacleWidth');
const obstacleGapInput = document.getElementById('obstacleGap');

const chartCanvas = document.getElementById('chartCanvas');
const chartCtx = chartCanvas.getContext('2d');

const bestCanvas = document.getElementById('bestCanvas');
const bestCtx = bestCanvas.getContext('2d');
const avgCanvas = document.getElementById('avgCanvas');
const avgCtx = avgCanvas.getContext('2d');

let generation = 0;
let population = [];
let history = [];
let autoTimer = null;
let autoRunning = false;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, maxInclusive) {
  return Math.floor(rand(min, maxInclusive + 1));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const MAX_MUSCLES = 28;

function randomNode() {
  return { x: rand(-1.2, 1.2), y: rand(0.7, 1.7), mass: rand(0.7, 1.4), friction: rand(0, 1) };
}

function randomMuscle(from, to) {
  return {
    from,
    to,
    restLength: rand(0.25, 1.7),
    amplitude: rand(0.05, 0.55),
    frequency: rand(0.5, 3.0),
    phase: rand(0, Math.PI * 2),
    stiffness: rand(20, 95),
  };
}

const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Coppie di nodi non ancora collegate: ogni coppia può avere al massimo un muscolo.
function freePairs(creature) {
  const used = new Set(creature.muscles.map((m) => pairKey(m.from, m.to)));
  const pairs = [];
  for (let a = 0; a < creature.nodes.length; a += 1) {
    for (let b = a + 1; b < creature.nodes.length; b += 1) {
      if (!used.has(pairKey(a, b))) pairs.push([a, b]);
    }
  }
  return pairs;
}

function addRandomMuscle(creature) {
  const pairs = freePairs(creature);
  if (!pairs.length || creature.muscles.length >= MAX_MUSCLES) return false;
  const [a, b] = pairs[randInt(0, pairs.length - 1)];
  creature.muscles.push(randomMuscle(a, b));
  return true;
}

// Ogni creatura ha almeno tanti muscoli quanti nodi (se le coppie libere lo permettono).
function ensureMinMuscles(creature) {
  while (creature.muscles.length < creature.nodes.length && addRandomMuscle(creature));
}

function removeDuplicateMuscles(creature) {
  const seen = new Set();
  creature.muscles = creature.muscles.filter((m) => {
    const key = pairKey(m.from, m.to);
    if (m.from === m.to || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createRandomCreature() {
  const nodeCount = randInt(3, 8);
  const creature = {
    nodes: Array.from({ length: nodeCount }, () => randomNode()),
    muscles: [],
    distance: 0,
    evaluated: false,
    trace: null,
  };
  const musclesCount = randInt(nodeCount + 1, nodeCount * 2 + 4);
  for (let i = 0; i < musclesCount && addRandomMuscle(creature); i += 1);
  return creature;
}

// Il nodo nuovo nasce vicino al corpo e collegato ai due nodi più vicini,
// così forma un triangolo stabile invece di penzolare.
function addNode(creature) {
  const count = creature.nodes.length;
  const meanX = creature.nodes.reduce((sum, n) => sum + n.x, 0) / count;
  const meanY = creature.nodes.reduce((sum, n) => sum + n.y, 0) / count;
  const node = randomNode();
  node.x = clamp(meanX + rand(-0.8, 0.8), -1.8, 1.8);
  node.y = clamp(meanY + rand(-0.5, 0.5), 0.35, 2.4);
  creature.nodes.push(node);

  const nearest = creature.nodes
    .slice(0, count)
    .map((n, i) => ({ i, d: Math.hypot(n.x - node.x, n.y - node.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 2);
  nearest.forEach(({ i, d }) => {
    const muscle = randomMuscle(count, i);
    muscle.restLength = clamp(d, 0.15, 2.4);
    creature.muscles.push(muscle);
  });
  // Il limite di muscoli resta rispettato togliendone di vecchi a caso.
  while (creature.muscles.length > MAX_MUSCLES) creature.muscles.splice(randInt(0, creature.muscles.length - 3), 1);
}

// Toglie un nodo e riaggancia i muscoli rimasti ai nodi giusti.
function removeNode(creature) {
  const removed = randInt(0, creature.nodes.length - 1);
  creature.nodes.splice(removed, 1);
  creature.muscles = creature.muscles.filter((m) => m.from !== removed && m.to !== removed);
  creature.muscles.forEach((m) => {
    if (m.from > removed) m.from -= 1;
    if (m.to > removed) m.to -= 1;
  });
  ensureMinMuscles(creature);
}

// A volte la mutazione è un salto ampio: aiuta a uscire dalle soluzioni mediocri.
function mutateValue(value, step, min, max) {
  const jump = Math.random() < EVOLUTION.bigJumpChance ? EVOLUTION.bigJumpScale : 1;
  return clamp(value + rand(-step, step) * jump * EVOLUTION.mutationStrength, min, max);
}

function mutateCreature(child) {
  const k = EVOLUTION.mutationStrength;

  if (Math.random() < 0.15 * k && child.nodes.length < 10) addNode(child);
  if (Math.random() < 0.12 * k && child.nodes.length > 3) removeNode(child);
  if (Math.random() < 0.3 * k) addRandomMuscle(child);
  if (Math.random() < 0.2 * k && child.muscles.length > child.nodes.length) {
    child.muscles.splice(randInt(0, child.muscles.length - 1), 1);
  }

  child.nodes.forEach((n) => {
    n.x = mutateValue(n.x, 0.12, -1.8, 1.8);
    n.y = mutateValue(n.y, 0.12, 0.35, 2.4);
    n.mass = mutateValue(n.mass, 0.08, 0.5, 2.0);
    n.friction = mutateValue(n.friction, 0.05, 0, 1);
  });

  child.muscles.forEach((m) => {
    if (Math.random() < 0.2 * k) {
      // Ricollega il muscolo a una coppia di nodi ancora libera, se esiste.
      const pairs = freePairs(child);
      if (pairs.length) [m.from, m.to] = pairs[randInt(0, pairs.length - 1)];
    }
    m.restLength = mutateValue(m.restLength, 0.1, 0.15, 2.4);
    m.amplitude = mutateValue(m.amplitude, 0.06, 0.01, 0.8);
    m.frequency = mutateValue(m.frequency, 0.18, 0.2, 3.8);
    m.phase = (m.phase + rand(-0.35, 0.35) * k) % (Math.PI * 2);
    m.stiffness = mutateValue(m.stiffness, 8, 8, 140);
  });

  child.distance = 0;
  child.evaluated = false;
  return child;
}

function copyCreature(parent) {
  return structuredClone({ ...parent, trace: null });
}

// Incrocio: il figlio ha il corpo del primo genitore; ogni nodo e muscolo
// che esiste anche nel secondo genitore viene preso a caso dall'uno o dall'altro.
function crossover(parentA, parentB) {
  const child = copyCreature(parentA);
  child.nodes.forEach((n, i) => {
    const other = parentB.nodes[i];
    if (other && Math.random() < 0.5) Object.assign(n, other);
  });
  child.muscles.forEach((m, i) => {
    const other = parentB.muscles[i];
    if (!other || Math.random() >= 0.5) return;
    if (other.from < child.nodes.length && other.to < child.nodes.length) Object.assign(m, other);
  });
  removeDuplicateMuscles(child);
  ensureMinMuscles(child);
  return child;
}

// Torneo: si estraggono alcune sopravvissute a caso e vince la migliore.
// Le sopravvissute sono ordinate per punteggio (distanza × fortuna), quindi vince l'indice più basso.
function pickParent(survivors) {
  let best = randInt(0, survivors.length - 1);
  for (let i = 1; i < EVOLUTION.tournamentSize; i += 1) best = Math.min(best, randInt(0, survivors.length - 1));
  return survivors[best];
}

// Il secondo genitore di un incrocio è della stessa specie del primo:
// mescolare corpi con un numero diverso di nodi darebbe figli poco sensati.
function makeChild(survivors, species) {
  const parentA = pickParent(survivors);
  const child = Math.random() < EVOLUTION.crossoverRate
    ? crossover(parentA, pickParent(species.get(parentA.nodes.length)))
    : copyCreature(parentA);
  return mutateCreature(child);
}

function groupBySpecies(creatures) {
  const species = new Map();
  creatures.forEach((c) => {
    const key = c.nodes.length;
    if (!species.has(key)) species.set(key, []);
    species.get(key).push(c);
  });
  return species;
}

// Ogni specie conserva le sue migliori SPECIES_QUOTA creature (o tutte, se sono meno);
// i posti rimasti vanno alle migliori in assoluto. Le liste sono ordinate per punteggio.
function selectSurvivors(ranked) {
  const chosen = new Set();
  groupBySpecies(ranked).forEach((members) => {
    members.slice(0, SPECIES_QUOTA).forEach((c) => chosen.add(c));
  });
  for (const c of ranked) {
    if (chosen.size >= SURVIVORS) break;
    chosen.add(c);
  }
  return ranked.filter((c) => chosen.has(c));
}

function createSimState(creature) {
  const nodes = creature.nodes.map((n) => ({
    x: n.x,
    y: n.y,
    vx: 0,
    vy: 0,
    mass: n.mass,
    friction: n.friction,
    grounded: false,
  }));
  const muscles = creature.muscles.map((m) => ({
    energy: MUSCLE_ENERGY,
    length: Math.hypot(nodes[m.to].x - nodes[m.from].x, nodes[m.to].y - nodes[m.from].y),
  }));
  return { nodes, muscles };
}

function stepPhysics(creature, state, t, dt) {
  const forces = state.nodes.map(() => ({ fx: 0, fy: GRAVITY }));
  // Carica graduale: impedisce il balzo iniziale dovuto allo scatto dei muscoli.
  const maxForce = MAX_MUSCLE_FORCE * Math.min(1, t / ENERGY_RAMP_SECONDS);

  creature.muscles.forEach((m, i) => {
    const ms = state.muscles[i];
    const a = state.nodes[m.from];
    const b = state.nodes[m.to];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const target = m.restLength + m.amplitude * Math.sin(t * m.frequency * Math.PI * 2 + m.phase);
    // La spinta cala in proporzione all'energia rimasta; a energia 0 il muscolo non agisce più.
    const springMag = clamp(m.stiffness * (dist - target), -maxForce, maxForce) * (ms.energy / MUSCLE_ENERGY);
    const change = Math.abs(dist - ms.length);
    const spent = Math.abs(springMag) * change * ENERGY_COST * (change / dt / ENERGY_SPEED_REF);
    ms.energy = clamp(ms.energy - spent + ENERGY_RECHARGE * dt, 0, MUSCLE_ENERGY);
    ms.length = dist;
    const dirX = dx / dist;
    const dirY = dy / dist;

    forces[m.from].fx += springMag * dirX;
    forces[m.from].fy += springMag * dirY;
    forces[m.to].fx -= springMag * dirX;
    forces[m.to].fy -= springMag * dirY;
  });

  state.nodes.forEach((n, i) => {
    const ax = forces[i].fx / n.mass;
    const ay = forces[i].fy / n.mass;

    n.vx = (n.vx + ax * dt) * AIR_DAMPING;
    n.vy = (n.vy + ay * dt) * AIR_DAMPING;

    const prevX = n.x;
    const prevY = n.y;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.x = clamp(n.x, -MAX_WORLD_X, MAX_WORLD_X);
    n.y = clamp(n.y, -1, MAX_WORLD_Y);

    // Ostacolo: se il nodo ci arriva da sopra si appoggia sulla cima,
    // se ci arriva di lato urta la parete e viene respinto.
    let floor = 0;
    const block = obstacleAt(n.x);
    if (block && n.y < TERRAIN.height) {
      if (prevY >= TERRAIN.height) {
        floor = TERRAIN.height;
      } else {
        n.x = prevX < block.left ? block.left - 0.001 : block.right + 0.001;
        n.vx = 0;
      }
    } else if (block) {
      floor = TERRAIN.height;
    }

    n.grounded = false;
    if (n.y < floor) {
      n.y = floor;
      if (n.vy < 0) n.vy = -n.vy * 0.08;
      // Attrito del nodo: 0 = ghiaccio (scivola), 1 = presa totale.
      n.vx *= 1 - n.friction;
      n.grounded = true;
    }
  });
}

function centerX(state) {
  const sum = state.nodes.reduce((acc, n) => acc + n.x, 0);
  return sum / state.nodes.length;
}

function simulateCreature(creature, duration, dt, trackFrames = false) {
  const state = createSimState(creature);
  const startX = centerX(state);
  const frames = [];

  for (let t = 0; t < duration; t += dt) {
    stepPhysics(creature, state, t, dt);
    if (trackFrames && frames.length < 320) {
      frames.push({
        t,
        nodes: state.nodes.map((n) => ({ x: n.x, y: n.y, grounded: n.grounded })),
        energy: state.muscles.map((ms) => ms.energy),
      });
    }
  }

  const distance = Math.max(0, centerX(state) - startX);
  return { distance, frames };
}

function evaluatePopulation() {
  // La simulazione è deterministica: le sopravvissute hanno già la loro distanza.
  population.forEach((c) => {
    c.trace = null;
    if (c.evaluated) return;
    c.distance = simulateCreature(c, STEP_SECONDS, EVAL_DT, false).distance;
    c.evaluated = true;
  });

  population.sort((a, b) => b.distance - a.distance);

  const best = population[0].distance;
  const avg = population.reduce((sum, c) => sum + c.distance, 0) / population.length;
  history.push({ generation, best, avg });

  const bestTrace = simulateCreature(population[0], STEP_SECONDS, EVAL_DT, true);
  population[0].trace = bestTrace.frames;
  const median = population[Math.floor(population.length / 2)];
  const medianTrace = simulateCreature(median, STEP_SECONDS, EVAL_DT, true);
  median.trace = medianTrace.frames;
}

function evolveOnce() {
  generation += 1;
  // Selezione "buono abbastanza": sopravvivenza e scelta dei genitori dipendono
  // dalla distanza moltiplicata per un fattore di fortuna, nuovo a ogni ciclo.
  population.forEach((c) => {
    c.score = c.distance * rand(EVOLUTION.luckMin, 1);
  });
  const ranked = [...population].sort((a, b) => b.score - a.score);
  const survivors = selectSurvivors(ranked);
  const species = groupBySpecies(survivors);
  const children = Array.from({ length: POPULATION_SIZE - survivors.length }, () => makeChild(survivors, species));
  population = survivors.concat(children);
  evaluatePopulation();
  renderAll();
}

function resetSimulation() {
  generation = 0;
  history = [];
  population = Array.from({ length: POPULATION_SIZE }, () => createRandomCreature());
  evaluatePopulation();
  renderAll();
}

function drawChart() {
  const { width, height } = chartCanvas;
  chartCtx.clearRect(0, 0, width, height);
  chartCtx.fillStyle = '#0b1020';
  chartCtx.fillRect(0, 0, width, height);

  const pad = 34;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  chartCtx.strokeStyle = '#334155';
  chartCtx.strokeRect(pad, pad, plotW, plotH);
  if (history.length < 2) return;

  const maxY = Math.max(...history.map((h) => h.best), 0.1) * 1.1;
  const xScale = (i) => pad + (i / (history.length - 1)) * plotW;
  const yScale = (v) => pad + plotH - (v / maxY) * plotH;

  chartCtx.fillStyle = '#94a3b8';
  chartCtx.font = '12px sans-serif';
  chartCtx.fillText('Distanza (metri in 10s)', 8, 16);
  chartCtx.fillText('Ciclo', width - 48, height - 8);

  chartCtx.strokeStyle = '#22c55e';
  chartCtx.lineWidth = 2;
  chartCtx.beginPath();
  history.forEach((h, i) => (i === 0 ? chartCtx.moveTo(xScale(i), yScale(h.best)) : chartCtx.lineTo(xScale(i), yScale(h.best))));
  chartCtx.stroke();

  chartCtx.strokeStyle = '#38bdf8';
  chartCtx.beginPath();
  history.forEach((h, i) => (i === 0 ? chartCtx.moveTo(xScale(i), yScale(h.avg)) : chartCtx.lineTo(xScale(i), yScale(h.avg))));
  chartCtx.stroke();

  chartCtx.fillStyle = '#22c55e';
  chartCtx.fillText('■ max', pad + 8, pad + 14);
  chartCtx.fillStyle = '#38bdf8';
  chartCtx.fillText('■ media', pad + 64, pad + 14);
}

function drawGround(ctx, width, height, cameraX) {
  const groundY = height - 42;
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, groundY, width, height - groundY);

  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1;
  const minMeter = Math.floor(cameraX - 8);
  const maxMeter = Math.ceil(cameraX + 16);
  for (let m = minMeter; m <= maxMeter; m += 1) {
    const x = (m - cameraX) * 35 + 60;
    if (x < 0 || x > width) continue;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, groundY - (m % 5 === 0 ? 18 : 10));
    ctx.stroke();

    if (m % 5 === 0) {
      ctx.fillStyle = '#86efac';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${m}m`, x - 10, groundY + 14);
    }
  }

  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(width, groundY);
  ctx.stroke();

  if (TERRAIN.height > 0) {
    const period = TERRAIN.width + TERRAIN.gap;
    const first = Math.max(0, Math.floor((minMeter - OBSTACLE_START_X) / period));
    ctx.fillStyle = '#a16207';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    for (let left = OBSTACLE_START_X + first * period; left <= maxMeter; left += period) {
      const x = (left - cameraX) * 35 + 60;
      const w = TERRAIN.width * 35;
      const h = TERRAIN.height * 35;
      ctx.fillRect(x, groundY - h, w, h);
      ctx.strokeRect(x, groundY - h, w, h);
    }
  }
}

function drawCreatureFrame(ctx, canvas, creature, color, label) {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const trace = creature.trace || [];
  if (!trace.length) return;

  const simTime = (performance.now() / 1000) % STEP_SECONDS;
  const frameIndex = Math.min(trace.length - 1, Math.floor((simTime / STEP_SECONDS) * trace.length));
  const frame = trace[frameIndex];

  const avgX = frame.nodes.reduce((acc, n) => acc + n.x, 0) / frame.nodes.length;
  drawGround(ctx, width, height, avgX);

  const scale = 35;
  const toCanvasX = (x) => (x - avgX) * scale + 60;
  const toCanvasY = (y) => height - 42 - y * scale;

  // I muscoli sbiadiscono man mano che consumano la loro energia.
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  creature.muscles.forEach((m, i) => {
    const a = frame.nodes[m.from];
    const b = frame.nodes[m.to];
    if (!a || !b) return;
    ctx.globalAlpha = 0.15 + 0.85 * (frame.energy[i] / MUSCLE_ENERGY);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(a.x), toCanvasY(a.y));
    ctx.lineTo(toCanvasX(b.x), toCanvasY(b.y));
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Colore del nodo: bianco = attrito 0 (scivola), nero = attrito 1 (presa totale).
  // Anello giallo = nodo a contatto col suolo.
  frame.nodes.forEach((n, i) => {
    const grey = Math.round(255 * (1 - creature.nodes[i].friction));
    const x = toCanvasX(n.x);
    const y = toCanvasY(n.y);
    ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (n.grounded) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${label} | nodi: ${creature.nodes.length} | muscoli: ${creature.muscles.length}`, 8, 16);
  ctx.fillText(`Distanza in 10s: ${creature.distance.toFixed(2)} m`, 8, 32);
}

function speciesSummary() {
  return [...groupBySpecies(population)]
    .sort(([a], [b]) => a - b)
    .map(([nodes, members]) => `${nodes}: ${members.length}, ${Math.max(...members.map((c) => c.distance)).toFixed(1)} m`)
    .join(' · ');
}

function renderStats() {
  const best = population[0];
  const avgDistance = population.reduce((sum, c) => sum + c.distance, 0) / population.length;
  const median = population[Math.floor(population.length / 2)];

  statsEl.innerHTML = `
    <div><strong>Ciclo:</strong> ${generation}</div>
    <div><strong>Popolazione:</strong> ${population.length}</div>
    <div><strong>Tempo valutazione:</strong> ${STEP_SECONDS}s</div>
    <div><strong>Distanza max:</strong> ${best.distance.toFixed(2)} m</div>
    <div><strong>Distanza media:</strong> ${avgDistance.toFixed(2)} m</div>
    <div><strong>Distanza mediana:</strong> ${median.distance.toFixed(2)} m</div>
    <div class="species"><strong>Specie (nodi: creature, record):</strong> ${speciesSummary()}</div>
  `;
}

function renderAll() {
  drawChart();
  renderStats();
  const best = population[0];
  const median = population[Math.floor(population.length / 2)];
  drawCreatureFrame(bestCtx, bestCanvas, best, '#22c55e', 'Best');
  drawCreatureFrame(avgCtx, avgCanvas, median, '#38bdf8', 'Mediana');
}

function animateWorlds() {
  if (population.length) {
    const best = population[0];
    const median = population[Math.floor(population.length / 2)];
    drawCreatureFrame(bestCtx, bestCanvas, best, '#22c55e', 'Best');
    drawCreatureFrame(avgCtx, avgCanvas, median, '#38bdf8', 'Mediana');
  }
  requestAnimationFrame(animateWorlds);
}

function updateAutoLabel() {
  autoSpeedLabel.textContent = `${autoSpeedInput.value} ms`;
}

// Il ciclo successivo parte solo dopo che il precedente è terminato,
// così il browser non si intasa se il calcolo è più lento della pausa scelta.
function scheduleNextAuto() {
  autoTimer = setTimeout(() => {
    evolveOnce();
    if (autoRunning) scheduleNextAuto();
  }, Number(autoSpeedInput.value));
}

function stopAuto() {
  autoRunning = false;
  clearTimeout(autoTimer);
  autoTimer = null;
  autoBtn.textContent = 'Avvio automatico';
}

function startAuto() {
  stopAuto();
  autoRunning = true;
  scheduleNextAuto();
  autoBtn.textContent = 'Pausa automatica';
}

resetBtn.addEventListener('click', () => {
  stopAuto();
  resetSimulation();
});

stepBtn.addEventListener('click', evolveOnce);
autoBtn.addEventListener('click', () => (autoRunning ? stopAuto() : startAuto()));
autoSpeedInput.addEventListener('input', () => {
  updateAutoLabel();
  if (autoRunning) startAuto();
});

function updateMutation() {
  EVOLUTION.mutationStrength = Number(mutationInput.value);
  mutationLabel.textContent = `×${EVOLUTION.mutationStrength.toFixed(1)}`;
}

mutationInput.addEventListener('input', updateMutation);

// Cambiando gli ostacoli tutte le creature vanno rivalutate: vale dal ciclo successivo.
function updateTerrain() {
  const read = (input, min, max) => clamp(Number(input.value) || 0, min, max);
  TERRAIN.height = read(obstacleHeightInput, 0, 1);
  TERRAIN.width = read(obstacleWidthInput, 0.05, 3);
  TERRAIN.gap = read(obstacleGapInput, 0.1, 10);
  population.forEach((c) => {
    c.evaluated = false;
  });
}

[obstacleHeightInput, obstacleWidthInput, obstacleGapInput].forEach((input) => input.addEventListener('change', updateTerrain));

updateAutoLabel();
updateMutation();
updateTerrain();
resetSimulation();
animateWorlds();
