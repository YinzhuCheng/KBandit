/* K-Armed Bandit Teaching Demo (Chinese UI)
   Static site: index.html, styles.css, app.js
*/
(function () {
  const dom = {
    inputK: document.getElementById('inputK'),
    inputDist: document.getElementById('inputDist'),
    btnGenerate: document.getElementById('btnGenerate'),
    btnRandomize: document.getElementById('btnRandomize'),
    btnApply: document.getElementById('btnApply'),
    btnReset: document.getElementById('btnReset'),
    paramTable: document.getElementById('paramTable'),
    paramTableContainer: document.getElementById('paramTableContainer'),
    strategySelect: document.getElementById('strategySelect'),
    btnStep1: document.getElementById('btnStep1'),
    btnStep10: document.getElementById('btnStep10'),
    btnStep100: document.getElementById('btnStep100'),
    statSteps: document.getElementById('statSteps'),
    statCumReward: document.getElementById('statCumReward'),
    statAvgReward: document.getElementById('statAvgReward'),
    statBestArm: document.getElementById('statBestArm'),
    statMuStar: document.getElementById('statMuStar'),
    statRegret: document.getElementById('statRegret'),
    rewardChartEl: document.getElementById('rewardChart'),
    regretChartEl: document.getElementById('regretChart'),
  };

  const state = {
    K: 5,
    dist: 'bernoulli', // 'bernoulli' | 'gaussian'
    // arms: for bernoulli -> { p }, for gaussian -> { mean, std }
    arms: [],
    // true means for regret calculation
    trueMeans: [],
    bestArmIndex: -1,
    muStar: 0,
    // stats
    t: 0,
    cumulativeReward: 0,
    cumulativeRegret: 0,
    // estimates per arm
    counts: [],
    sums: [],
    means: [],
    // charts data
    historySteps: [],
    historyReward: [],
    historyRegret: [],
  };

  // Utilities
  function clamp(x, min, max) { return Math.max(min, Math.min(max, x)); }
  function randUniform(min, max) { return min + Math.random() * (max - min); }
  function sampleNormal(mean, std) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * std;
  }

  function initArms(K, dist) {
    state.K = K;
    state.dist = dist;
    state.arms = [];
    for (let i = 0; i < K; i++) {
      if (dist === 'bernoulli') {
        state.arms.push({ p: 0.5 });
      } else {
        state.arms.push({ mean: 0.5, std: 0.2 });
      }
    }
    computeTrueMeans();
    resetStats();
    renderParamTable();
    updateStatsPanel();
    updateCharts();
  }

  function computeTrueMeans() {
    state.trueMeans = state.arms.map((arm) => {
      if (state.dist === 'bernoulli') return clamp(arm.p, 0, 1);
      return arm.mean; // Gaussian expected value is mean
    });
    let bestIdx = 0;
    for (let i = 1; i < state.trueMeans.length; i++) {
      if (state.trueMeans[i] > state.trueMeans[bestIdx]) bestIdx = i;
    }
    state.bestArmIndex = bestIdx;
    state.muStar = state.trueMeans.length ? state.trueMeans[bestIdx] : 0;
  }

  function resetStats() {
    state.t = 0;
    state.cumulativeReward = 0;
    state.cumulativeRegret = 0;
    state.counts = Array(state.K).fill(0);
    state.sums = Array(state.K).fill(0);
    state.means = Array(state.K).fill(0);
    state.historySteps = [];
    state.historyReward = [];
    state.historyRegret = [];
    if (rewardChart) { rewardChart.data.labels = []; rewardChart.data.datasets[0].data = []; rewardChart.update(); }
    if (regretChart) { regretChart.data.labels = []; regretChart.data.datasets[0].data = []; regretChart.update(); }
  }

  function randomizeParameters() {
    for (let i = 0; i < state.K; i++) {
      if (state.dist === 'bernoulli') {
        state.arms[i].p = +randUniform(0.05, 0.95).toFixed(2);
      } else {
        state.arms[i].mean = +randUniform(0.0, 1.0).toFixed(2);
        state.arms[i].std = +randUniform(0.05, 0.4).toFixed(2);
      }
    }
    computeTrueMeans();
    resetStats();
    renderParamTable();
    updateStatsPanel();
  }

  function applyParametersFromTable() {
    const rows = dom.paramTable.querySelectorAll('tbody tr');
    rows.forEach((row, idx) => {
      if (state.dist === 'bernoulli') {
        const p = parseFloat(row.querySelector('input[name="p"]').value);
        state.arms[idx].p = isFinite(p) ? clamp(p, 0, 1) : 0.5;
      } else {
        const mean = parseFloat(row.querySelector('input[name="mean"]').value);
        const std = parseFloat(row.querySelector('input[name="std"]').value);
        state.arms[idx].mean = isFinite(mean) ? mean : 0.5;
        state.arms[idx].std = isFinite(std) ? clamp(std, 0.0001, 10) : 0.2;
      }
    });
    computeTrueMeans();
    resetStats();
    renderParamTable();
    updateStatsPanel();
  }

  function renderParamTable() {
    const thead = [];
    thead.push('<tr>');
    thead.push('<th>#</th>');
    if (state.dist === 'bernoulli') {
      thead.push('<th>p</th>');
    } else {
      thead.push('<th>均值</th><th>标准差</th>');
    }
    thead.push('<th>统计（拉动次数/样本均值）</th>');
    thead.push('<th>操作</th>');
    thead.push('</tr>');

    const tbody = [];
    for (let i = 0; i < state.K; i++) {
      const isBest = i === state.bestArmIndex;
      tbody.push(`<tr data-idx="${i}">`);
      tbody.push(`<td>${i} ${isBest ? '<span class="badge best">最优</span>' : ''}</td>`);
      if (state.dist === 'bernoulli') {
        tbody.push(`<td><input class="small-input" type="number" step="0.01" min="0" max="1" name="p" value="${state.arms[i].p}" /></td>`);
      } else {
        tbody.push(`<td><input class="small-input" type="number" step="0.01" name="mean" value="${state.arms[i].mean}" /></td>`);
        tbody.push(`<td><input class="small-input" type="number" step="0.01" min="0.0001" name="std" value="${state.arms[i].std}" /></td>`);
      }
      const pulls = state.counts[i] || 0;
      const mean = pulls ? (state.sums[i] / pulls) : 0;
      tbody.push(`<td>${pulls} / ${mean.toFixed(3)}</td>`);
      tbody.push(`<td><button class="btn manual-btn" data-action="pull">拉一次</button></td>`);
      tbody.push('</tr>');
    }

    dom.paramTable.innerHTML = `<thead>${thead.join('')}</thead><tbody>${tbody.join('')}</tbody>`;

    // bind manual pull
    dom.paramTable.querySelectorAll('button[data-action="pull"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        const idx = parseInt(tr.getAttribute('data-idx'));
        stepOnce('manual', idx);
      });
    });
  }

  function sampleReward(armIndex) {
    if (state.dist === 'bernoulli') {
      const p = clamp(state.arms[armIndex].p, 0, 1);
      return Math.random() < p ? 1 : 0;
    }
    const m = state.arms[armIndex].mean;
    const s = state.arms[armIndex].std;
    return sampleNormal(m, s);
  }

  function chooseArm(strategy) {
    if (strategy === 'random') {
      return Math.floor(Math.random() * state.K);
    }
    if (strategy === 'ucb') {
      // UCB1 with exploration coeff c = 1
      // if arm never pulled, select it first
      for (let i = 0; i < state.K; i++) if (state.counts[i] === 0) return i;
      const t = Math.max(1, state.t);
      let bestIdx = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < state.K; i++) {
        const avg = state.means[i] || 0;
        const bonus = Math.sqrt((2 * Math.log(t)) / state.counts[i]);
        const score = avg + bonus; // c = 1
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      return bestIdx;
    }
    // manual should pass explicit arm index
    return 0;
  }

  function updateAfterPull(armIndex, reward) {
    state.t += 1;
    state.cumulativeReward += reward;
    state.counts[armIndex] += 1;
    state.sums[armIndex] += reward;
    state.means[armIndex] = state.sums[armIndex] / state.counts[armIndex];

    state.cumulativeRegret = state.t * state.muStar - state.cumulativeReward;

    state.historySteps.push(state.t);
    state.historyReward.push(state.cumulativeReward);
    state.historyRegret.push(state.cumulativeRegret);

    if (rewardChart) {
      rewardChart.data.labels.push(state.t);
      rewardChart.data.datasets[0].data.push(state.cumulativeReward);
      rewardChart.update('none');
    }
    if (regretChart) {
      regretChart.data.labels.push(state.t);
      regretChart.data.datasets[0].data.push(state.cumulativeRegret);
      regretChart.update('none');
    }

    updateStatsPanel();
    renderParamTable();
    // highlight row briefly
    const row = dom.paramTable.querySelector(`tr[data-idx="${armIndex}"]`);
    if (row) {
      row.classList.add('highlight');
      setTimeout(() => row.classList.remove('highlight'), 350);
    }
  }

  function stepOnce(strategy, manualArmIndex) {
    let armIdx;
    if (strategy === 'manual') {
      armIdx = manualArmIndex;
    } else {
      armIdx = chooseArm(strategy);
    }
    const r = sampleReward(armIdx);
    updateAfterPull(armIdx, r);
  }

  function stepN(strategy, n) {
    for (let i = 0; i < n; i++) stepOnce(strategy);
  }

  function updateStatsPanel() {
    dom.statSteps.textContent = String(state.t);
    dom.statCumReward.textContent = state.cumulativeReward.toFixed(3);
    dom.statAvgReward.textContent = (state.t ? state.cumulativeReward / state.t : 0).toFixed(3);
    dom.statBestArm.textContent = state.bestArmIndex >= 0 ? String(state.bestArmIndex) : '-';
    dom.statMuStar.textContent = state.muStar.toFixed(3);
    dom.statRegret.textContent = state.cumulativeRegret.toFixed(3);
  }

  // Charts
  let rewardChart = null;
  let regretChart = null;
  function initCharts() {
    const lineOptions = {
      type: 'line',
      options: {
        animation: false,
        responsive: true,
        scales: {
          x: { title: { display: true, text: '步数 t', color: '#8a9aa9' }, ticks: { color: '#8a9aa9' }, grid: { color: '#243041' } },
          y: { title: { display: true, text: '', color: '#8a9aa9' }, ticks: { color: '#8a9aa9' }, grid: { color: '#243041' } },
        },
        plugins: { legend: { display: false } },
      },
      data: {
        labels: [],
        datasets: [{
          label: 'value',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.2)',
          tension: 0.1,
          pointRadius: 0,
        }],
      },
    };

    rewardChart = new Chart(dom.rewardChartEl.getContext('2d'), JSON.parse(JSON.stringify(lineOptions)));
    rewardChart.options.scales.y.title.text = '累积奖励';

    regretChart = new Chart(dom.regretChartEl.getContext('2d'), JSON.parse(JSON.stringify(lineOptions)));
    regretChart.options.scales.y.title.text = '后悔值';
  }

  function updateCharts() {
    if (!rewardChart || !regretChart) return;
    rewardChart.update('none');
    regretChart.update('none');
  }

  // Event wiring
  function bindEvents() {
    dom.btnGenerate.addEventListener('click', () => {
      const K = clamp(parseInt(dom.inputK.value || '1'), 1, 50);
      const dist = dom.inputDist.value;
      initArms(K, dist);
    });
    dom.btnRandomize.addEventListener('click', () => {
      randomizeParameters();
    });
    dom.btnApply.addEventListener('click', () => {
      applyParametersFromTable();
    });
    dom.btnReset.addEventListener('click', () => {
      resetStats();
      renderParamTable();
      updateStatsPanel();
    });

    dom.inputDist.addEventListener('change', () => {
      // keep K, change dist type and re-init arms with defaults
      initArms(state.K, dom.inputDist.value);
    });

    function updateStepButtonsDisabled() {
      const manual = dom.strategySelect.value === 'manual';
      dom.btnStep1.disabled = manual;
      dom.btnStep10.disabled = manual;
      dom.btnStep100.disabled = manual;
    }

    dom.btnStep1.addEventListener('click', () => {
      const s = dom.strategySelect.value;
      stepOnce(s);
    });
    dom.btnStep10.addEventListener('click', () => {
      const s = dom.strategySelect.value;
      stepN(s, 10);
    });
    dom.btnStep100.addEventListener('click', () => {
      const s = dom.strategySelect.value;
      stepN(s, 100);
    });

    dom.strategySelect.addEventListener('change', updateStepButtonsDisabled);
    // initialize disabled state
    updateStepButtonsDisabled();
  }

  // Init
  function main() {
    initCharts();
    initArms(state.K, state.dist);
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
