// ── Встроенные категории ─────────────────────────────────────
const DEFAULT_CATS = {
  income: [
    { name: 'Зарплата',    emoji: '' },
    { name: 'Boosty.to',     emoji: '' },
    { name: 'PayPal',  emoji: '' },
    { name: 'Криптовалюта',  emoji: '' },
    { name: 'Подарок',     emoji: '' },
    { name: 'Перевод на карту',  emoji: '' },
    { name: 'Другое',      emoji: '' },
  ],
  expense: [
    { name: 'Еда и кафе',  emoji: '' },
    { name: 'Транспорт/Такси',   emoji: '' },
    { name: 'Сашуля', emoji: '' },
    { name: 'Одежда',      emoji: '' },
    { name: 'Подписки',    emoji: '' },
    { name: 'Развлечения', emoji: '' },
    { name: 'Алкоголь',       emoji: '' },
    { name: 'Другое',      emoji: '' },
  ]
};

// ── Состояние ────────────────────────────────────────────────
let currentType  = 'income';
let transactions = JSON.parse(localStorage.getItem('cc_tx')   || '[]');
let customCats   = JSON.parse(localStorage.getItem('cc_cats') || '{"income":[],"expense":[]}');
let chart        = null;
let catPanelOpen = false;

// ── Хелпер: все категории текущего типа ─────────────────────
function allCats(type) {
  return [...DEFAULT_CATS[type], ...customCats[type]];
}

// ── Инициализация ────────────────────────────────────────────
function init() {
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('date').value = todayISO();
  updateCategoryList();
  updateSummary();
  renderHistory();
  updateChart();
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Тип транзакции ───────────────────────────────────────────
function setType(type) {
  currentType = type;
  document.getElementById('incomeBtn').className  = 'type-btn' + (type === 'income'  ? ' active-income'  : '');
  document.getElementById('expenseBtn').className = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
  updateCategoryList();
  if (catPanelOpen) renderCatPanel();
}

function updateCategoryList() {
  document.getElementById('category').innerHTML =
    allCats(currentType).map(c => `<option value="${c.name}">${c.emoji} ${c.name}</option>`).join('');
}

// ── Панель своих категорий ───────────────────────────────────
function toggleCatPanel() {
  catPanelOpen = !catPanelOpen;
  const panel = document.getElementById('catPanel');
  if (catPanelOpen) {
    panel.classList.add('open');
    renderCatPanel();
  } else {
    panel.classList.remove('open');
  }
}

function renderCatPanel() {
  const typeLabel = currentType === 'income' ? 'доходов' : 'расходов';
  document.getElementById('catPanelHead').textContent = `Мои категории (${typeLabel})`;

  const list = document.getElementById('customCatList');
  const cats = customCats[currentType];

  if (cats.length === 0) {
    list.innerHTML = `<div class="no-custom">Своих категорий пока нет</div>`;
    return;
  }

  list.innerHTML = cats.map((c, i) => `
    <div class="custom-cat-item">
      <span>${c.emoji} ${escHtml(c.name)}</span>
      <button class="cat-del-btn" onclick="deleteCustomCat(${i})" title="Удалить">✕</button>
    </div>
  `).join('');
}

function addCustomCat() {
  const emojiRaw = document.getElementById('newCatEmoji').value.trim();
  const name     = document.getElementById('newCatName').value.trim();

  if (!name) { showToast('Введите название категории', 'error'); return; }

  const emoji = emojiRaw || '🏷️';

  if (allCats(currentType).some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('Такая категория уже есть', 'error');
    return;
  }

  customCats[currentType].push({ name, emoji });
  saveCats();
  updateCategoryList();
  renderCatPanel();

  document.getElementById('category').value   = name;
  document.getElementById('newCatEmoji').value = '';
  document.getElementById('newCatName').value  = '';

  showToast(`Категория «${name}» добавлена`, 'success');
}

function deleteCustomCat(index) {
  const cat = customCats[currentType][index];
  customCats[currentType].splice(index, 1);
  saveCats();
  updateCategoryList();
  renderCatPanel();
  showToast(`Категория «${cat.name}» удалена`, 'error');
}

function saveCats() {
  localStorage.setItem('cc_cats', JSON.stringify(customCats));
}

// ── Добавление транзакции ────────────────────────────────────
function addTransaction() {
  const amount   = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  const date     = document.getElementById('date').value;
  const note     = document.getElementById('note').value.trim();

  if (!amount || amount <= 0) { showToast('Введите корректную сумму', 'error'); return; }
  if (!date)                  { showToast('Выберите дату', 'error');            return; }

  const emoji = allCats(currentType).find(c => c.name === category)?.emoji ?? '💰';

  transactions.unshift({ id: Date.now(), type: currentType, amount, category, date, note, emoji });
  saveTx();
  updateSummary();
  renderHistory();
  updateChart();

  document.getElementById('amount').value = '';
  document.getElementById('note').value   = '';

  showToast((currentType === 'income' ? '+' : '−') + fmt(amount) + ' — ' + category, 'success');
}

function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTx();
  updateSummary();
  renderHistory();
  updateChart();
  showToast('Транзакция удалена', 'error');
}

function saveTx() {
  localStorage.setItem('cc_tx', JSON.stringify(transactions));
}

// ── Сводка ───────────────────────────────────────────────────
function updateSummary() {
  const income  = transactions.filter(t => t.type === 'income' ).reduce((s,t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance = income - expense;

  document.getElementById('totalBalance').textContent = fmt(balance);
  document.getElementById('totalBalance').style.color = balance >= 0 ? 'var(--primary)' : 'var(--expense)';
  document.getElementById('totalIncome').textContent  = fmt(income);
  document.getElementById('totalExpense').textContent = fmt(expense);

  const inCnt = transactions.filter(t => t.type === 'income').length;
  const exCnt = transactions.filter(t => t.type === 'expense').length;
  document.getElementById('txCount').textContent      = noun(transactions.length, 'транзакция','транзакции','транзакций');
  document.getElementById('incomeCount').textContent  = noun(inCnt, 'операция','операции','операций');
  document.getElementById('expenseCount').textContent = noun(exCnt, 'операция','операции','операций');
}

// ── История ──────────────────────────────────────────────────
function renderHistory() {
  const filter   = document.getElementById('filterSel').value;
  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);
  const list     = document.getElementById('txList');

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div>${filter === 'all' ? 'Добавьте первую транзакцию!' : 'Нет операций в этой категории'}</div>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(tx => `
    <div class="tx-item">
      <div class="tx-icon ${tx.type}">${tx.emoji}</div>
      <div class="tx-info">
        <div class="tx-cat">${escHtml(tx.category)}</div>
        <div class="tx-meta">${fmtDate(tx.date)}${tx.note ? ' · ' + escHtml(tx.note) : ''}</div>
      </div>
      <div class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '−'}${fmt(tx.amount)}</div>
      <button class="tx-del" onclick="deleteTx(${tx.id})" title="Удалить">✕</button>
    </div>
  `).join('');
}

// ── Диаграмма ────────────────────────────────────────────────
const CHART_COLORS = [
  '#f85149','#ffa657','#e3b341','#3fb950',
  '#58a6ff','#bc8cff','#ff7c7c','#79c0ff','#d2a679','#56d364',
  '#f0883e','#a5d6ff','#ffa8c9','#85e89d','#b392f0'
];

function updateChart() {
  const expenses = transactions.filter(t => t.type === 'expense');
  const card     = document.getElementById('chartCard');

  if (expenses.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const grouped = {};
  expenses.forEach(t => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });

  const labels = Object.keys(grouped);
  const data   = Object.values(grouped);

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById('expenseChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderColor: '#161b22',
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b949e', font: { size: 11 }, padding: 10, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`
          }
        }
      }
    }
  });
}

// ── Утилиты ──────────────────────────────────────────────────
function fmt(n) {
  return '₸' + Math.abs(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(str) {
  return new Date(str + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function noun(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const mod = abs % 10;
  if (abs >= 11 && abs <= 19)    return `${n} ${many}`;
  if (mod === 1)                 return `${n} ${one}`;
  if (mod >= 2 && mod <= 4)      return `${n} ${few}`;
  return `${n} ${many}`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = `toast ${type}`; }, 2800);
}

// Enter → добавить (кроме текстовых полей в панели категорий)
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = document.activeElement?.id;
  if (id === 'note' || id === 'newCatName' || id === 'newCatEmoji') return;
  addTransaction();
});

init();
