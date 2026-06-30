// Если уже залогинен — сразу на главную
auth.onAuthStateChanged(user => {
  if (user) window.location.href = 'index.html';
});

// ── Переключение вкладок ─────────────────────────────────────
function showTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginForm').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('registerForm').style.display = isLogin ? 'none'  : 'block';
  document.getElementById('loginTab').classList.toggle('auth-tab--active', isLogin);
  document.getElementById('registerTab').classList.toggle('auth-tab--active', !isLogin);
  document.getElementById('loginError').textContent = '';
  document.getElementById('regError').textContent   = '';
}

// ── Вход ─────────────────────────────────────────────────────
async function login() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  if (!email || !password) { errEl.textContent = 'Заполните все поля'; return; }

  btn.disabled    = true;
  btn.textContent = 'Входим...';
  errEl.textContent = '';

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged перенаправит
  } catch (e) {
    errEl.textContent = friendlyError(e.code);
    btn.disabled    = false;
    btn.textContent = 'Войти';
  }
}

// ── Регистрация ──────────────────────────────────────────────
async function register() {
  const email     = document.getElementById('regEmail').value.trim();
  const password  = document.getElementById('regPassword').value;
  const password2 = document.getElementById('regPassword2').value;
  const errEl     = document.getElementById('regError');
  const btn       = document.getElementById('regBtn');

  if (!email || !password)    { errEl.textContent = 'Заполните все поля';   return; }
  if (password !== password2) { errEl.textContent = 'Пароли не совпадают';  return; }
  if (password.length < 6)    { errEl.textContent = 'Минимум 6 символов';   return; }

  btn.disabled    = true;
  btn.textContent = 'Создаём...';
  errEl.textContent = '';

  try {
    await auth.createUserWithEmailAndPassword(email, password);
    // onAuthStateChanged перенаправит
  } catch (e) {
    errEl.textContent = friendlyError(e.code);
    btn.disabled    = false;
    btn.textContent = 'Создать аккаунт';
  }
}

// ── Понятные ошибки Firebase ─────────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'Пользователь не найден',
    'auth/wrong-password':       'Неверный пароль',
    'auth/invalid-credential':   'Неверный email или пароль',
    'auth/email-already-in-use': 'Email уже используется',
    'auth/invalid-email':        'Неверный формат email',
    'auth/weak-password':        'Слишком простой пароль',
    'auth/too-many-requests':    'Слишком много попыток — подождите',
    'auth/network-request-failed': 'Ошибка сети, проверь подключение',
  };
  return map[code] ?? 'Ошибка: ' + code;
}

// Enter → отправить активную форму
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const loginVisible = document.getElementById('loginForm').style.display !== 'none';
  if (loginVisible) login(); else register();
});
