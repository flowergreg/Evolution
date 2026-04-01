const POPULATION_SIZE = 1000;
const SURVIVORS = 500;
const STEP_SECONDS = 10;
const EVAL_DT = 0.05;
const GRAVITY = -9.81;

const statsEl = document.getElementById('stats');
const resetBtn = document.getElementById('resetBtn');
const stepBtn = document.getElementById('stepBtn');
const autoBtn = document.getElementById('autoBtn');
const autoSpeedInput = document.getElementById('autoSpeed');
const autoSpeedLabel = document.getElementById('autoSpeedLabel');

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

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, maxInclusive) {
  return Math.floor(rand(min, maxInclusive + 1));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomNode() {
  return { x: rand(-0.4, 0.4), y: rand(0.7, 1.7), mass: rand(0.7, 1.4) };
}

function randomMuscle(nodeCount) {
  const from = randInt(0, nodeCount - 1);
  let to = randInt(0, nodeCount - 1);
  while (to === from) to = randInt(0, nodeCount - 1);

  return {
    from,
    to,
    restLength: rand(0.25, 1.7),
    amplitude: rand(0.05, 0.55),
    frequency: rand(0.5, 3.0),
    phase: rand(0, Math.PI * 2),
    stiffness: rand(20, 95),
function randomMuscle() {
  return {
    amplitude: rand(0.2, 2.4),
    frequency: rand(0.3, 2.4),
    phase: rand(0, Math.PI * 2),
    stiffness: rand(0.3, 1.6),
  };
}

function createRandomCreature() {
  const nodeCount = randInt(3, 8);
  const musclesCount = randInt(nodeCount + 1, nodeCount * 2 + 4);

  return {
    nodes: Array.from({ length: nodeCount }, () => randomNode()),
    muscles: Array.from({ length: musclesCount }, () => randomMuscle(nodeCount)),
    traction: rand(0.6, 1.6),
    damping: rand(0.90, 0.98),
    distance: 0,
    trace: null,
  };
}

function rewireMuscles(creature) {
  creature.muscles.forEach((m) => {
    m.from = clamp(m.from, 0, creature.nodes.length - 1);
    m.to = clamp(m.to, 0, creature.nodes.length - 1);
    if (m.to === m.from) m.to = (m.from + 1) % creature.nodes.length;
  });
}

function mutateCreature(parent) {
  const child = structuredClone(parent);

  if (Math.random() < 0.15 && child.nodes.length < 10) child.nodes.push(randomNode());
  if (Math.random() < 0.12 && child.nodes.length > 3) child.nodes.splice(randInt(0, child.nodes.length - 1), 1);

  if (Math.random() < 0.3 && child.muscles.length < 28) child.muscles.push(randomMuscle(child.nodes.length));
  if (Math.random() < 0.2 && child.muscles.length > child.nodes.length) child.muscles.splice(randInt(0, child.muscles.length - 1), 1);

  child.nodes.forEach((n) => {
    n.x = clamp(n.x + rand(-0.12, 0.12), -1.8, 1.8);
    n.y = clamp(n.y + rand(-0.12, 0.12), 0.35, 2.4);
    n.mass = clamp(n.mass + rand(-0.08, 0.08), 0.5, 2.0);
  });

  child.muscles.forEach((m) => {
    if (Math.random() < 0.2) {
      m.from = randInt(0, child.nodes.length - 1);
      m.to = randInt(0, child.nodes.length - 1);
      if (m.to === m.from) m.to = (m.from + 1) % child.nodes.length;
    }
    m.restLength = clamp(m.restLength + rand(-0.10, 0.10), 0.15, 2.4);
    m.amplitude = clamp(m.amplitude + rand(-0.06, 0.06), 0.01, 0.8);
    m.frequency = clamp(m.frequency + rand(-0.18, 0.18), 0.2, 3.8);
    m.phase = (m.phase + rand(-0.35, 0.35)) % (Math.PI * 2);
    m.stiffness = clamp(m.stiffness + rand(-8, 8), 8, 140);
  });

  child.traction = clamp(child.traction + rand(-0.06, 0.06), 0.3, 2.1);
  child.damping = clamp(child.damping + rand(-0.01, 0.01), 0.84, 0.995);
  child.distance = 0;
  child.trace = null;

  rewireMuscles(child);
  return child;
}

function createSimState(creature) {
  const baseX = 0;
  const nodes = creature.nodes.map((n, i) => ({
    x: baseX + i * 0.45 + n.x,
    y: n.y,
    vx: 0,
    vy: 0,
    mass: n.mass,
    grounded: false,
  }));
  return { nodes };
}

function stepPhysics(creature, state, t, dt) {
  const forces = state.nodes.map(() => ({ fx: 0, fy: GRAVITY }));

  creature.muscles.forEach((m) => {
    const a = state.nodes[m.from];
    const b = state.nodes[m.to];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const target = m.restLength + m.amplitude * Math.sin(t * m.frequency * Math.PI * 2 + m.phase);
    const springMag = m.stiffness * (dist - target);
    const dirX = dx / dist;
    const dirY = dy / dist;

    forces[m.from].fx += springMag * dirX;
    forces[m.from].fy += springMag * dirY;
    forces[m.to].fx -= springMag * dirX;
    forces[m.to].fy -= springMag * dirY;

    const wave = Math.sin(t * m.frequency * Math.PI * 2 + m.phase);
    const groundBoost = wave * 0.9 * creature.traction;
    if (a.grounded) forces[m.from].fx += groundBoost;
    if (b.grounded) forces[m.to].fx += groundBoost;
  });

  state.nodes.forEach((n, i) => {
    const ax = forces[i].fx / n.mass;
    const ay = forces[i].fy / n.mass;

    n.vx = (n.vx + ax * dt) * creature.damping;
    n.vy = (n.vy + ay * dt) * creature.damping;

    n.x += n.vx * dt;
    n.y += n.vy * dt;

    n.grounded = false;
    if (n.y < 0) {
      n.y = 0;
      if (n.vy < 0) n.vy = -n.vy * 0.08;
      n.vx *= 0.86;
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
      });
    }
  }

  const distance = Math.max(0, centerX(state) - startX);
  return { distance, frames };
}

function evaluatePopulation() {
  population.forEach((c) => {
    c.distance = simulateCreature(c, STEP_SECONDS, EVAL_DT, false).distance;
  });

  const nodeCount = Math.floor(rand(2, 9));
  const muscles = Array.from({ length: nodeCount - 1 }, () => randomMuscle());
  return {
    nodeCount,
    muscles,
    rhythmBias: rand(0.4, 1.6),
    balanceBias: rand(0.2, 1.8),
    strideBias: rand(0.3, 1.9),
    distance: 0,
  };
}

function mutateCreature(parent) {
  const child = structuredClone(parent);

  if (Math.random() < 0.18) {
    child.nodeCount = clamp(
      child.nodeCount + (Math.random() < 0.5 ? -1 : 1),
      2,
      10,
    );
    while (child.muscles.length < child.nodeCount - 1) child.muscles.push(randomMuscle());
    while (child.muscles.length > child.nodeCount - 1) child.muscles.pop();
  }

  child.muscles.forEach((m) => {
    m.amplitude = clamp(m.amplitude + rand(-0.18, 0.18), 0.05, 3);
    m.frequency = clamp(m.frequency + rand(-0.12, 0.12), 0.12, 3);
    m.phase = (m.phase + rand(-0.35, 0.35)) % (Math.PI * 2);
    m.stiffness = clamp(m.stiffness + rand(-0.13, 0.13), 0.05, 2.5);
  });

  child.rhythmBias = clamp(child.rhythmBias + rand(-0.08, 0.08), 0.2, 2.1);
  child.balanceBias = clamp(child.balanceBias + rand(-0.08, 0.08), 0.1, 2.2);
  child.strideBias = clamp(child.strideBias + rand(-0.08, 0.08), 0.1, 2.2);
  child.distance = 0;

  return child;
}

function evaluateCreature(creature) {
  let x = 0;

  for (let t = 0; t < STEP_SECONDS; t += DT) {
    let drive = 0;
    let rhythmPenalty = 0;

    for (let i = 0; i < creature.muscles.length; i += 1) {
      const m = creature.muscles[i];
      const wave = Math.sin(t * m.frequency * creature.rhythmBias + m.phase);
      drive += Math.max(0, wave) * m.amplitude * (0.65 + m.stiffness);
      rhythmPenalty += Math.abs(Math.cos(t * m.frequency + m.phase)) * 0.0028;
    }

    const sizeFactor = 1 / (1 + Math.abs(creature.nodeCount - 5) * 0.14);
    const balance = 1 - Math.abs(creature.balanceBias - 1) * 0.18;
    const stride = creature.strideBias;
    const noise = rand(-0.0055, 0.0055);

    const velocity = drive * 0.011 * sizeFactor * balance * stride - rhythmPenalty + noise;
    x += Math.max(0, velocity);
  }

  creature.distance = x;
  return x;
}

function evaluatePopulation() {
  population.forEach(evaluateCreature);
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
  const survivors = population.slice(0, SURVIVORS);
  const children = survivors.map((p) => mutateCreature(p));

  const survivors = population.slice(0, SURVIVORS);
  const children = survivors.map((p) => mutateCreature(p));

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
  chartCtx.lineWidth = 1;
  chartCtx.strokeRect(pad, pad, plotW, plotH);

  if (history.length < 2) return;

  const maxY = Math.max(...history.map((h) => h.best)) * 1.08;

  function xScale(i) {
    return pad + (i / (history.length - 1)) * plotW;
  }
  function yScale(v) {
    return pad + plotH - (v / maxY) * plotH;
  }

  chartCtx.fillStyle = '#94a3b8';
  chartCtx.font = '12px sans-serif';
  chartCtx.fillText('Distanza', 6, 18);
  chartCtx.fillText('Ciclo', width - 48, height - 8);
  chartCtx.fillText('0', pad - 12, height - pad + 4);
  chartCtx.fillText(String(history.length - 1), width - pad - 12, height - pad + 16);

  chartCtx.strokeStyle = '#22c55e';
  chartCtx.lineWidth = 2;
  chartCtx.beginPath();
  history.forEach((h, i) => (i === 0 ? chartCtx.moveTo(xScale(i), yScale(h.best)) : chartCtx.lineTo(xScale(i), yScale(h.best))));
  history.forEach((h, i) => {
    const x = xScale(i);
    const y = yScale(h.best);
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  chartCtx.stroke();

  chartCtx.strokeStyle = '#38bdf8';
  chartCtx.beginPath();
  history.forEach((h, i) => (i === 0 ? chartCtx.moveTo(xScale(i), yScale(h.avg)) : chartCtx.lineTo(xScale(i), yScale(h.avg))));
  history.forEach((h, i) => {
    const x = xScale(i);
    const y = yScale(h.avg);
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
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
}

function drawCreatureFrame(ctx, canvas, creature, color, label) {
  const { width, height } = canvas;
function poseAt(creature, t) {
  const points = [];
  const spacing = 26;
  let y = 0;
  for (let i = 0; i < creature.nodeCount; i += 1) {
    if (i > 0) {
      const m = creature.muscles[i - 1] ?? randomMuscle();
      y += Math.sin(t * m.frequency * creature.rhythmBias + m.phase) * m.amplitude * 7;
    }
    points.push({ x: i * spacing, y });
  }
  return points;
}

function drawWorld(ctx, canvas, creature, color, label) {
  const { width, height } = canvas;
  const time = performance.now() / 1000;

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

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  creature.muscles.forEach((m) => {
    const a = frame.nodes[m.from];
    const b = frame.nodes[m.to];
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(a.x), toCanvasY(a.y));
    ctx.lineTo(toCanvasX(b.x), toCanvasY(b.y));
    ctx.stroke();
  });

  frame.nodes.forEach((n) => {
    ctx.fillStyle = n.grounded ? '#facc15' : '#e2e8f0';
    ctx.beginPath();
    ctx.arc(toCanvasX(n.x), toCanvasY(n.y), 4, 0, Math.PI * 2);
  const groundY = height - 40;
  ctx.strokeStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(width, groundY);
  ctx.stroke();

  const progressPx = (creature.distance / (history.at(-1)?.best || 1)) * (width * 0.7);
  const offsetX = 20 + progressPx;

  const points = poseAt(creature, time);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = offsetX + p.x;
    const y = groundY - 20 + p.y;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  points.forEach((p) => {
    const x = offsetX + p.x;
    const y = groundY - 20 + p.y;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${label} | nodi: ${creature.nodes.length} | muscoli: ${creature.muscles.length}`, 8, 16);
  ctx.fillText(`Distanza in 10s: ${creature.distance.toFixed(2)} m`, 8, 32);
  ctx.fillText(`${label} | nodi: ${creature.nodeCount} | dist: ${creature.distance.toFixed(3)}`, 8, 16);
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
    <div><strong>Distanza max:</strong> ${best.distance.toFixed(3)}</div>
    <div><strong>Distanza media:</strong> ${avgDistance.toFixed(3)}</div>
    <div><strong>Distanza mediana:</strong> ${median.distance.toFixed(3)}</div>
    <div><strong>Nodi miglior creatura:</strong> ${best.nodeCount}</div>
  `;
}

function renderAll() {
  drawChart();
  renderStats();
  const best = population[0];
  const median = population[Math.floor(population.length / 2)];
  drawCreatureFrame(bestCtx, bestCanvas, best, '#22c55e', 'Best');
  drawCreatureFrame(avgCtx, avgCanvas, median, '#38bdf8', 'Media');

  const best = population[0];
  const avgIndex = Math.floor(population.length / 2);
  const averageCreature = population[avgIndex];

  drawWorld(bestCtx, bestCanvas, best, '#22c55e', 'Best');
  drawWorld(avgCtx, avgCanvas, averageCreature, '#38bdf8', 'Media');
}

function animateWorlds() {
  if (population.length) {
    const best = population[0];
    const median = population[Math.floor(population.length / 2)];
    drawCreatureFrame(bestCtx, bestCanvas, best, '#22c55e', 'Best');
    drawCreatureFrame(avgCtx, avgCanvas, median, '#38bdf8', 'Media');
    const averageCreature = population[Math.floor(population.length / 2)];
    drawWorld(bestCtx, bestCanvas, best, '#22c55e', 'Best');
    drawWorld(avgCtx, avgCanvas, averageCreature, '#38bdf8', 'Media');
  }
  requestAnimationFrame(animateWorlds);
}

function updateAutoLabel() {
  autoSpeedLabel.textContent = `${autoSpeedInput.value} ms`;
}

resetBtn.addEventListener('click', () => {
  stopAuto();
  resetSimulation();
});

stepBtn.addEventListener('click', () => {
  evolveOnce();
});

function stopAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    autoBtn.textContent = 'Avvio automatico';
  }
}

function startAuto() {
  stopAuto();
  autoTimer = setInterval(evolveOnce, Number(autoSpeedInput.value));
  autoBtn.textContent = 'Pausa automatica';
}

resetBtn.addEventListener('click', () => {
  stopAuto();
  resetSimulation();
});

stepBtn.addEventListener('click', evolveOnce);
autoBtn.addEventListener('click', () => (autoTimer ? stopAuto() : startAuto()));
autoBtn.addEventListener('click', () => {
  if (autoTimer) stopAuto();
  else startAuto();
});

autoSpeedInput.addEventListener('input', () => {
  updateAutoLabel();
  if (autoTimer) startAuto();
});

updateAutoLabel();
resetSimulation();
animateWorlds();
