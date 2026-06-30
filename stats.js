let currentUser  = null;
let transactions = [];
let activePeriod = 'all';
let catChart     = null;
let monthChart   = null;

const CHART_COLORS = [
  '#f85149','#ffa657','#e3b341','#3fb950',
  '#58a6ff','#bc8cff','#ff7c7c','#79c0ff','#d2a679','#56d364',
  '#f0883e','#a5d6ff','#ffa8c9','#85e89d','#b392f0'
];

// ── Auth ─────────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'auth.html'; return; }

  currentUser = user;
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  await loadTransactions();
  render();
});

function logout() {
  auth.signOut().then(() => { window.location.href = 'auth.html'; });
}

// ── Загрузка данных из Firestore ─────────────────────────────
async function loadTransactions() {
  try {
    const snap = await db.collection('users').doc(currentUser.uid)
      .collection('transactions')
      .orderBy('createdAt', 'desc')
      .get();
    transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Firestore:', e);
  }
}

// ── Фильтр периода ───────────────────────────────────────────
function setPeriod(period, btn) {
  activePeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function getFiltered() {
  if (activePeriod === 'all') return transactions;
  const now  = new Date();
  const from = activePeriod === 'month'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return transactions.filter(t => new Date(t.date + 'T00:00:00') >= from);
}

// ── Рендер ───────────────────────────────────────────────────
function render() {
  const tx = getFiltered();
  updateSummary(tx);
  updateCatChart(tx);
  updateMonthChart();
  updateCatTable(tx);
}

// ── Сводка ───────────────────────────────────────────────────
function updateSummary(tx) {
  const income  = tx.filter(t => t.type === 'income' ).reduce((s,t) => s + t.amount, 0);
  const expense = tx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance = income - expense;
  const inCnt   = tx.filter(t => t.type === 'income').length;
  const exCnt   = tx.filter(t => t.type === 'expense').length;

  document.getElementById('statsBalance').textContent     = fmt(balance);
  document.getElementById('statsBalance').style.color     = balance >= 0 ? 'var(--primary)' : 'var(--expense)';
  document.getElementById('statsIncome').textContent      = fmt(income);
  document.getElementById('statsExpense').textContent     = fmt(expense);
  document.getElementById('statsTxCount').textContent     = noun(tx.length, 'транзакция','транзакции','транзакций');
  document.getElementById('statsIncomeCount').textContent  = noun(inCnt, 'операция','операции','операций');
  document.getElementById('statsExpenseCount').textContent = noun(exCnt, 'операция','операции','операций');
}

// ── Donut-диаграмма ──────────────────────────────────────────
function updateCatChart(tx) {
  const expenses = tx.filter(t => t.type === 'expense');
  const noData   = document.getElementById('noCatData');
  const wrap     = document.getElementById('catChartWrap');

  if (expenses.length === 0) {
    noData.style.display = 'block'; wrap.style.display = 'none';
    if (catChart) { catChart.destroy(); catChart = null; }
    return;
  }
  noData.style.display = 'none'; wrap.style.display = 'flex';

  const grouped = {};
  expenses.forEach(t => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });
  const entries = Object.entries(grouped).sort((a,b) => b[1] - a[1]);

  if (catChart) catChart.destroy();
  catChart = new Chart(document.getElementById('catChart'), {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: CHART_COLORS.slice(0, entries.length),
        borderColor: '#0e1117',
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 11 }, padding: 10, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}` } }
      }
    }
  });
}

// ── Столбчатый график по месяцам ─────────────────────────────
function updateMonthChart() {
  const months    = getLast6Months();
  const monthData = {};
  months.forEach(m => { monthData[m] = { income: 0, expense: 0 }; });
  transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    if (monthData[m]) monthData[m][t.type] += t.amount;
  });

  const incomeData  = months.map(m => monthData[m].income);
  const expenseData = months.map(m => monthData[m].expense);
  const hasData     = incomeData.some(v => v > 0) || expenseData.some(v => v > 0);

  const noData = document.getElementById('noMonthData');
  const wrap   = document.getElementById('monthChartWrap');

  if (!hasData) {
    noData.style.display = 'block'; wrap.style.display = 'none';
    if (monthChart) { monthChart.destroy(); monthChart = null; }
    return;
  }
  noData.style.display = 'none'; wrap.style.display = 'flex';

  if (monthChart) monthChart.destroy();
  monthChart = new Chart(document.getElementById('monthChart'), {
    type: 'bar',
    data: {
      labels: months.map(fmtMonth),
      datasets: [
        { label: 'Доходы',  data: incomeData,  backgroundColor: 'rgba(63,185,80,.75)',  borderRadius: 5, borderSkipped: false },
        { label: 'Расходы', data: expenseData, backgroundColor: 'rgba(248,81,73,.75)', borderRadius: 5, borderSkipped: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12, padding: 14 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { color: 'rgba(33,38,45,.8)' } },
        y: {
          ticks: { color: '#8b949e', font: { size: 11 }, callback: v => '₸' + v.toLocaleString('ru-RU') },
          grid: { color: 'rgba(33,38,45,.8)' }
        }
      }
    }
  });
}

// ── Таблица категорий ─────────────────────────────────────────
function updateCatTable(tx) {
  const expenses  = tx.filter(t => t.type === 'expense');
  const container = document.getElementById('catTable');

  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div>Нет расходов за выбранный период</div>
      </div>`;
    return;
  }

  const grouped = {};
  expenses.forEach(t => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });
  const entries = Object.entries(grouped).sort((a,b) => b[1] - a[1]);
  const total   = entries.reduce((s,e) => s + e[1], 0);

  container.innerHTML = `
    <table class="stats-table">
      <thead>
        <tr>
          <th>Категория</th>
          <th style="text-align:right">Сумма</th>
          <th style="text-align:right">%</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(([cat, amount], i) => {
          const pct   = ((amount / total) * 100).toFixed(1);
          const color = CHART_COLORS[i % CHART_COLORS.length];
          return `
            <tr>
              <td><span class="cat-dot" style="background:${color}"></span>${escHtml(cat)}</td>
              <td class="amount-cell">${fmt(amount)}</td>
              <td class="pct-cell">${pct}%</td>
              <td class="bar-cell">
                <div class="bar-track">
                  <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
                </div>
              </td>
            </tr>`;
        }).join('')}
        <tr class="total-row">
          <td>Итого</td>
          <td class="amount-cell">${fmt(total)}</td>
          <td class="pct-cell">100%</td>
          <td></td>
        </tr>
      </tbody>
    </table>`;
}

// ── Утилиты ──────────────────────────────────────────────────
function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return months;
}

function fmtMonth(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
}

function fmt(n) {
  return '₸' + Math.abs(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function noun(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const mod = abs % 10;
  if (abs >= 11 && abs <= 19) return `${n} ${many}`;
  if (mod === 1)              return `${n} ${one}`;
  if (mod >= 2 && mod <= 4)  return `${n} ${few}`;
  return `${n} ${many}`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
