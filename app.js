const POPULATION_SIZE = 1000;
const SURVIVORS = 500;
const STEP_SECONDS = 12;
const DT = 0.035;

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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomMuscle() {
  return {
    amplitude: rand(0.2, 2.4),
    frequency: rand(0.3, 2.4),
    phase: rand(0, Math.PI * 2),
    stiffness: rand(0.3, 1.6),
  };
}

function createRandomCreature() {
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
}

function evolveOnce() {
  generation += 1;

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
  history.forEach((h, i) => {
    const x = xScale(i);
    const y = yScale(h.best);
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  chartCtx.stroke();

  chartCtx.strokeStyle = '#38bdf8';
  chartCtx.beginPath();
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
  ctx.fillText(`${label} | nodi: ${creature.nodeCount} | dist: ${creature.distance.toFixed(3)}`, 8, 16);
}

function renderStats() {
  const best = population[0];
  const avgDistance = population.reduce((sum, c) => sum + c.distance, 0) / population.length;
  const median = population[Math.floor(population.length / 2)];

  statsEl.innerHTML = `
    <div><strong>Ciclo:</strong> ${generation}</div>
    <div><strong>Popolazione:</strong> ${population.length}</div>
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
  const avgIndex = Math.floor(population.length / 2);
  const averageCreature = population[avgIndex];

  drawWorld(bestCtx, bestCanvas, best, '#22c55e', 'Best');
  drawWorld(avgCtx, avgCanvas, averageCreature, '#38bdf8', 'Media');
}

function animateWorlds() {
  if (population.length) {
    const best = population[0];
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
