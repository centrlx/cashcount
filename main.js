// ── Встроенные категории ─────────────────────────────────────
const DEFAULT_CATS = {
  income: [
    { name: 'Boosty.to' },
    { name: 'PayPal' },
    { name: 'Криптовалюта' },
    { name: 'Подарок' },
    { name: 'Перевод на карту' },
    { name: 'Другое' },
  ],
  expense: [
    { name: 'Еда и кафе' },
    { name: 'Транспорт/Такси' },
    { name: 'Сашуля' },
    { name: 'Одежда' },
    { name: 'Подписки' },
    { name: 'Развлечения' },
    { name: 'Алкоголь' },
    { name: 'Другое' },
  ]
};

// ── Состояние ────────────────────────────────────────────────
let currentUser  = null;
let currentType  = 'income';
let transactions = [];
let customCats   = { income: [], expense: [] };
let chart        = null;
let catPanelOpen = false;
let unsubTx      = null;

function allCats(type) {
  return [...DEFAULT_CATS[type], ...(customCats[type] || [])];
}

// Категории и дата — сразу при загрузке скрипта
document.getElementById('date').value = todayISO();
updateCategoryList();

// ── Auth — главная точка входа ───────────────────────────────
auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'auth.html'; return; }

  currentUser = user;
  document.getElementById('userEmail').textContent = user.email;

  await loadCustomCats();
  updateCategoryList();
  await loadTransactions();
});

function logout() {
  auth.signOut().then(() => { window.location.href = 'auth.html'; });
}

// ── Firestore ────────────────────────────────────────────────
function userDoc() { return db.collection('users').doc(currentUser.uid); }
function txCol()   { return userDoc().collection('transactions'); }

async function loadTransactions() {
  try {
    const snap = await txCol().get();
    transactions = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.date.localeCompare(a.date));
    updateSummary();
    renderHistory();
    updateChart();
  } catch (e) {
    console.error('Firestore error:', e);
    showToast('Ошибка Firestore: ' + (e.code || e.message), 'error');
  }
}

// ── Транзакции ───────────────────────────────────────────────
async function addTransaction() {
  const amount   = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  const date     = document.getElementById('date').value;
  const note     = document.getElementById('note').value.trim();

  if (!amount || amount <= 0) { showToast('Введите корректную сумму', 'error'); return; }
  if (!date)                  { showToast('Выберите дату', 'error');            return; }

  try {
    await txCol().add({
      type: currentType,
      amount,
      category,
      date,
      note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('amount').value = '';
    document.getElementById('note').value   = '';
    showToast((currentType === 'income' ? '+' : '−') + fmt(amount) + ' — ' + category, 'success');
    await loadTransactions();
  } catch (e) {
    showToast('Ошибка: ' + (e.code || e.message), 'error');
    console.error(e);
  }
}

async function deleteTx(id) {
  try {
    await txCol().doc(id).delete();
    showToast('Транзакция удалена', 'error');
    await loadTransactions();
  } catch (e) {
    showToast('Ошибка: ' + (e.code || e.message), 'error');
    console.error(e);
  }
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
    allCats(currentType).map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

// ── Кастомные категории ──────────────────────────────────────
async function loadCustomCats() {
  try {
    const snap = await userDoc().get();
    if (snap.exists && snap.data().customCats) {
      customCats = snap.data().customCats;
    }
  } catch (e) { console.error(e); }
}

async function saveCats() {
  await userDoc().set({ customCats }, { merge: true });
}

function toggleCatPanel() {
  catPanelOpen = !catPanelOpen;
  document.getElementById('catPanel').classList.toggle('open', catPanelOpen);
  if (catPanelOpen) renderCatPanel();
}

function renderCatPanel() {
  const typeLabel = currentType === 'income' ? 'доходов' : 'расходов';
  document.getElementById('catPanelHead').textContent = `Мои категории (${typeLabel})`;

  const cats = customCats[currentType];
  document.getElementById('customCatList').innerHTML = cats.length === 0
    ? `<div class="no-custom">Своих категорий пока нет</div>`
    : cats.map((c, i) => `
        <div class="custom-cat-item">
          <span>${escHtml(c.name)}</span>
          <button class="cat-del-btn" onclick="deleteCustomCat(${i})" title="Удалить">✕</button>
        </div>`).join('');
}

async function addCustomCat() {
  const name = document.getElementById('newCatName').value.trim();
  if (!name) { showToast('Введите название категории', 'error'); return; }
  if (allCats(currentType).some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('Такая категория уже есть', 'error'); return;
  }
  customCats[currentType].push({ name });
  await saveCats();
  updateCategoryList();
  renderCatPanel();
  document.getElementById('category').value  = name;
  document.getElementById('newCatName').value = '';
  showToast(`Категория «${name}» добавлена`, 'success');
}

async function deleteCustomCat(index) {
  const cat = customCats[currentType][index];
  customCats[currentType].splice(index, 1);
  await saveCats();
  updateCategoryList();
  renderCatPanel();
  showToast(`Категория «${cat.name}» удалена`, 'error');
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
      <div class="tx-icon ${tx.type}">${escHtml(tx.category.charAt(0).toUpperCase())}</div>
      <div class="tx-info">
        <div class="tx-cat">${escHtml(tx.category)}</div>
        <div class="tx-meta">${fmtDate(tx.date)}${tx.note ? ' · ' + escHtml(tx.note) : ''}</div>
      </div>
      <div class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '−'}${fmt(tx.amount)}</div>
      <button class="tx-del" onclick="deleteTx('${tx.id}')" title="Удалить">✕</button>
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

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('expenseChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(grouped),
      datasets: [{
        data: Object.values(grouped),
        backgroundColor: CHART_COLORS.slice(0, Object.keys(grouped).length),
        borderColor: '#0e1117',
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
          callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}` }
        }
      }
    }
  });
}

// ── Утилиты ──────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

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

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = `toast ${type}`; }, 2800);
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = document.activeElement?.id;
  if (id === 'note' || id === 'newCatName') return;
  addTransaction();
});
