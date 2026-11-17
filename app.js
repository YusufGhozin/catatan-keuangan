import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const INCOME_CATEGORIES = ['Gaji', 'Freelance', 'Bisnis', 'Beasiswa', 'Hadiah', 'Investasi', 'Penjualan', 'Lainnya'];
const EXPENSE_CATEGORIES = ['Makanan & Minuman', 'Transportasi', 'Tagihan', 'Belanja', 'Pendidikan', 'Kesehatan', 'Hiburan', 'Tempat Tinggal', 'Cicilan', 'Sosial', 'Lainnya'];
const PAYMENT_METHODS = ['Tunai', 'Transfer', 'Kartu Debit', 'Kartu Kredit', 'QRIS', 'E-wallet', 'Lainnya'];
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

let supabase = null;
let currentUser = null;
let transactions = [];
let selectedYear = new Date().getFullYear();
let selectedMonth = 'all';
let editingId = null;
let pendingDeleteId = null;
let noticeTimer = null;
let authMode = 'login';

function isConfigReady() {
  return typeof SUPABASE_URL === 'string'
    && typeof SUPABASE_ANON_KEY === 'string'
    && SUPABASE_URL.startsWith('https://')
    && !SUPABASE_URL.includes('ISI_')
    && SUPABASE_ANON_KEY.length > 30
    && !SUPABASE_ANON_KEY.includes('ISI_');
}

function show(element, visible = true) {
  element.classList.toggle('hidden', !visible);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function formatMoney(value) {
  return rupiah.format(Number(value) || 0).replace(/,\s?/, ', ');
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1].slice(0, 3)} ${year}`;
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function defaultTransactionDate() {
  const today = todayISO();
  if (selectedMonth !== 'all') return `${selectedYear}-${selectedMonth}-01`;
  if (selectedYear === new Date().getFullYear()) return today;
  return `${selectedYear}-01-01`;
}

function notify(message, kind = 'info') {
  const notice = $('#notice');
  notice.textContent = message;
  notice.classList.remove('hidden');
  notice.style.borderColor = kind === 'error' ? '#f0c3c5' : '#f1d9a5';
  notice.style.background = kind === 'error' ? '#fff3f3' : '#fff9eb';
  notice.style.color = kind === 'error' ? '#a94951' : '#84621f';
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => show(notice, false), 5500);
}

function setAuthMessage(message, success = false) {
  const target = $('#auth-message');
  target.textContent = message;
  target.classList.toggle('success', success);
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  show($('#auth-form'), true);
  show($('#password-reset-form'), false);
  show($('#login-tab'), true);
  show($('#signup-tab'), true);
  $('#login-tab').classList.toggle('active', !signup);
  $('#signup-tab').classList.toggle('active', signup);
  $('#auth-title').textContent = signup ? 'Buat akun pribadi' : 'Masuk ke akun Anda';
  $('#auth-subtitle').textContent = signup
    ? 'Daftarkan email untuk mulai menyimpan catatan keuangan.'
    : 'Gunakan email dan kata sandi yang sudah terdaftar.';
  $('#auth-submit').textContent = signup ? 'Buat akun' : 'Masuk';
  $('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
  show($('#forgot-password'), !signup);
  setAuthMessage('');
}

function showPasswordRecovery() {
  currentUser = null;
  show($('#setup-screen'), false);
  show($('#app'), false);
  show($('#auth-screen'), true);
  show($('#auth-form'), false);
  show($('#password-reset-form'), true);
  show($('#login-tab'), false);
  show($('#signup-tab'), false);
  show($('#forgot-password'), false);
  $('#auth-title').textContent = 'Atur ulang kata sandi';
  $('#auth-subtitle').textContent = 'Buat kata sandi baru untuk akun Ruang Keuangan Anda.';
  setAuthMessage('');
}

function showAuth() {
  currentUser = null;
  show($('#setup-screen'), false);
  show($('#app'), false);
  show($('#auth-screen'), true);
  setAuthMode('login');
}

async function enterApp(user) {
  if (!user) return;
  currentUser = user;
  $('#user-email').textContent = user.email || 'Akun pribadi';
  $('#user-avatar').textContent = (user.email || 'U').trim().charAt(0).toUpperCase();
  show($('#setup-screen'), false);
  show($('#auth-screen'), false);
  show($('#app'), true);
  await loadTransactions();
}

async function loadTransactions() {
  if (!currentUser) return;
  $('#transactions-table-body').innerHTML = '<tr><td colspan="6" class="date-cell">Memuat transaksi...</td></tr>';
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, user_id, transaction_date, kind, amount, category, payment_method, account, description, created_at')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    transactions = data || [];
    populateYearFilter();
    renderDashboard();
  } catch (error) {
    console.error(error);
    transactions = [];
    renderDashboard();
    notify(`Gagal memuat data: ${friendlyError(error)}. Pastikan tabel dan kebijakan database sudah dibuat.`, 'error');
  }
}

function friendlyError(error) {
  const message = error?.message || 'Terjadi kesalahan';
  if (message.includes('Failed to fetch')) return 'koneksi ke Supabase gagal';
  if (message.toLowerCase().includes('relation') && message.toLowerCase().includes('does not exist')) return 'tabel transactions belum tersedia';
  if (message.toLowerCase().includes('row-level security')) return 'akses database ditolak oleh kebijakan keamanan';
  return message;
}

function populateYearFilter() {
  const yearsInData = transactions.map((item) => Number(item.transaction_date.slice(0, 4))).filter(Number.isFinite);
  const current = new Date().getFullYear();
  const minYear = Math.min(2000, ...(yearsInData.length ? yearsInData : [current]));
  const maxYear = Math.max(current + 1, ...(yearsInData.length ? yearsInData : [current]));
  const years = [];
  for (let year = maxYear; year >= minYear; year--) years.push(year);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  $('#year-filter').innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');
  $('#year-filter').value = String(selectedYear);
  $('#month-filter').value = selectedMonth;
}

function inSelectedPeriod(item) {
  if (!item.transaction_date.startsWith(`${selectedYear}-`)) return false;
  return selectedMonth === 'all' || item.transaction_date.slice(5, 7) === selectedMonth;
}

function selectedPeriodTransactions() {
  return transactions.filter(inSelectedPeriod);
}

function periodName() {
  return selectedMonth === 'all' ? `Tahun ${selectedYear}` : `${MONTHS[Number(selectedMonth) - 1]} ${selectedYear}`;
}

function renderDashboard() {
  const periodItems = selectedPeriodTransactions();
  const income = periodItems.filter((item) => item.kind === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = periodItems.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
  const net = income - expense;
  $('#total-income').textContent = formatMoney(income);
  $('#total-expense').textContent = formatMoney(expense);
  $('#net-balance').textContent = formatMoney(net);
  $('#net-balance').style.color = net < 0 ? '#c9666d' : '#263448';
  $('#transaction-count').textContent = new Intl.NumberFormat('id-ID').format(periodItems.length);
  $('#income-period-label').textContent = periodName();
  $('#expense-period-label').textContent = periodName();
  $('#chart-caption').textContent = `Perbandingan pemasukan dan pengeluaran selama ${selectedYear}`;
  $('#category-caption').textContent = periodName();
  $('#transaction-period-caption').textContent = `Daftar transaksi • ${periodName()}`;
  renderCashflowChart();
  renderCategoryBreakdown(periodItems);
  renderTransactions();
}

function renderCashflowChart() {
  const monthly = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, income: 0, expense: 0 }));
  transactions.filter((item) => item.transaction_date.startsWith(`${selectedYear}-`)).forEach((item) => {
    const monthIndex = Number(item.transaction_date.slice(5, 7)) - 1;
    if (monthIndex < 0 || monthIndex > 11) return;
    if (item.kind === 'income') monthly[monthIndex].income += Number(item.amount);
    if (item.kind === 'expense') monthly[monthIndex].expense += Number(item.amount);
  });
  const maxValue = Math.max(1, ...monthly.flatMap((item) => [item.income, item.expense]));
  $('#cashflow-chart').innerHTML = monthly.map((item) => {
    const incomeHeight = item.income ? Math.max(3, (item.income / maxValue) * 100) : 1.5;
    const expenseHeight = item.expense ? Math.max(3, (item.expense / maxValue) * 100) : 1.5;
    return `<div class="chart-month" title="${MONTHS[item.month - 1]}: pemasukan ${formatMoney(item.income)} • pengeluaran ${formatMoney(item.expense)}">
      <div class="bar-pair"><div class="chart-bar income-bar" style="height:${incomeHeight}%"></div><div class="chart-bar expense-bar" style="height:${expenseHeight}%"></div></div>
      <span class="chart-month-label">${MONTH_SHORT[item.month - 1]}</span>
    </div>`;
  }).join('');
}

function renderCategoryBreakdown(periodItems) {
  const grouped = new Map();
  periodItems.filter((item) => item.kind === 'expense').forEach((item) => {
    grouped.set(item.category, (grouped.get(item.category) || 0) + Number(item.amount));
  });
  const sorted = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    $('#category-breakdown').innerHTML = '<div class="category-empty">Belum ada pengeluaran pada periode ini.<br />Kategori akan muncul setelah transaksi dicatat.</div>';
    return;
  }
  const top = sorted.slice(0, 5);
  if (sorted.length > 5) top.push(['Kategori lainnya', sorted.slice(5).reduce((sum, item) => sum + item[1], 0)]);
  const max = Math.max(...top.map((item) => item[1]), 1);
  $('#category-breakdown').innerHTML = top.map(([name, amount]) => `
    <div class="category-row">
      <span class="category-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
      <span class="category-amount">${formatMoney(amount)}</span>
      <div class="category-track"><div class="category-fill" style="width:${Math.max(2, (amount / max) * 100)}%"></div></div>
    </div>`).join('');
}

function filteredTransactions() {
  const query = $('#search-input').value.trim().toLowerCase();
  const kind = $('#type-filter').value;
  return selectedPeriodTransactions().filter((item) => {
    const matchesKind = kind === 'all' || item.kind === kind;
    const haystack = `${item.category} ${item.description || ''} ${item.payment_method || ''} ${item.account || ''}`.toLowerCase();
    return matchesKind && (!query || haystack.includes(query));
  }).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function renderTransactions() {
  const items = filteredTransactions();
  const tbody = $('#transactions-table-body');
  $('#visible-count').textContent = `Menampilkan ${items.length} dari ${selectedPeriodTransactions().length} transaksi`;
  show($('#empty-transactions'), items.length === 0);
  show(tbody, items.length > 0);
  if (!items.length) {
    tbody.innerHTML = '';
    return;
  }
  tbody.innerHTML = items.map((item) => {
    const income = item.kind === 'income';
    const description = item.description ? escapeHTML(item.description) : escapeHTML(item.account || item.payment_method || 'Tanpa keterangan');
    return `<tr>
      <td class="date-cell">${formatDate(item.transaction_date)}</td>
      <td><div class="transaction-cell"><div class="transaction-symbol ${income ? 'income' : 'expense'}">${income ? '↙' : '↗'}</div><div class="transaction-info"><strong>${escapeHTML(item.category)}</strong><span>${description}</span></div></div></td>
      <td class="method-cell">${escapeHTML(item.payment_method || '-')}</td>
      <td><span class="type-pill ${income ? 'income' : 'expense'}">${income ? 'Pemasukan' : 'Pengeluaran'}</span></td>
      <td class="amount-cell ${income ? 'income' : 'expense'}">${income ? '+' : '−'} ${formatMoney(item.amount)}</td>
      <td><div class="row-actions"><button class="row-action" type="button" data-action="edit" data-id="${escapeHTML(item.id)}" title="Ubah" aria-label="Ubah transaksi">✎</button><button class="row-action delete" type="button" data-action="delete" data-id="${escapeHTML(item.id)}" title="Hapus" aria-label="Hapus transaksi">×</button></div></td>
    </tr>`;
  }).join('');
}

function updateCategorySuggestions(kind) {
  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  $('#category-options').innerHTML = categories.map((name) => `<option value="${escapeHTML(name)}"></option>`).join('');
  if (!editingId) $('#transaction-category').value = categories[0];
}

function openTransactionModal(item = null) {
  editingId = item?.id || null;
  $('#transaction-form').reset();
  const kind = item?.kind || 'income';
  $$('input[name="transaction-kind"]').forEach((radio) => { radio.checked = radio.value === kind; });
  updateCategorySuggestions(kind);
  $('#transaction-date').value = item?.transaction_date || defaultTransactionDate();
  $('#transaction-amount').value = item?.amount ?? '';
  $('#transaction-category').value = item?.category || (kind === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  $('#transaction-method').value = PAYMENT_METHODS.includes(item?.payment_method) ? item.payment_method : 'Tunai';
  $('#transaction-account').value = item?.account || '';
  $('#transaction-description').value = item?.description || '';
  $('#modal-title').textContent = editingId ? 'Ubah transaksi' : 'Tambah transaksi';
  $('#save-transaction').textContent = editingId ? 'Simpan perubahan' : 'Simpan transaksi';
  show($('#transaction-modal'), true);
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#transaction-amount').focus(), 40);
}

function closeTransactionModal() {
  show($('#transaction-modal'), false);
  document.body.style.overflow = '';
  editingId = null;
}

function validateTransaction(formData) {
  const amount = Number(formData.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Nominal harus lebih besar dari 0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.transaction_date)) throw new Error('Tanggal transaksi belum valid.');
  if (!formData.category.trim()) throw new Error('Kategori wajib diisi.');
  if (formData.category.length > 60) throw new Error('Nama kategori maksimal 60 karakter.');
  return { ...formData, amount };
}

async function saveTransaction(event) {
  event.preventDefault();
  if (!currentUser) return;
  const wasEditing = Boolean(editingId);
  const button = $('#save-transaction');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Menyimpan...';
  try {
    const formData = {
      transaction_date: $('#transaction-date').value,
      kind: $('input[name="transaction-kind"]:checked').value,
      amount: $('#transaction-amount').value,
      category: $('#transaction-category').value.trim(),
      payment_method: $('#transaction-method').value,
      account: $('#transaction-account').value.trim() || null,
      description: $('#transaction-description').value.trim() || null
    };
    const values = validateTransaction(formData);
    let result;
    if (editingId) {
      result = await supabase.from('transactions').update(values).eq('id', editingId).select().single();
    } else {
      result = await supabase.from('transactions').insert({ ...values, user_id: currentUser.id }).select().single();
    }
    if (result.error) throw result.error;
    closeTransactionModal();
    await loadTransactions();
    notify(wasEditing ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil disimpan.');
  } catch (error) {
    console.error(error);
    notify(error.message || friendlyError(error), 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  show($('#confirm-modal'), true);
}

async function deleteTransaction() {
  if (!pendingDeleteId) return;
  const button = $('#confirm-delete');
  button.disabled = true;
  button.textContent = 'Menghapus...';
  try {
    const { error } = await supabase.from('transactions').delete().eq('id', pendingDeleteId);
    if (error) throw error;
    show($('#confirm-modal'), false);
    pendingDeleteId = null;
    await loadTransactions();
    notify('Transaksi berhasil dihapus.');
  } catch (error) {
    console.error(error);
    notify(`Gagal menghapus transaksi: ${friendlyError(error)}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Ya, hapus';
  }
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportJSON() {
  const backup = {
    app: 'Ruang Keuangan',
    version: 1,
    exported_at: new Date().toISOString(),
    note: 'File cadangan berisi transaksi akun Anda. Simpan di tempat pribadi.',
    transactions
  };
  downloadFile(`cadangan-keuangan-${todayISO()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
  notify('File cadangan JSON berhasil dibuat. Simpan file ini di tempat yang aman.');
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCSV() {
  const items = filteredTransactions();
  const rows = [
    ['Tanggal', 'Jenis', 'Kategori', 'Nominal (IDR)', 'Metode pembayaran', 'Akun / sumber dana', 'Keterangan'],
    ...items.map((item) => [item.transaction_date, item.kind === 'income' ? 'Pemasukan' : 'Pengeluaran', item.category, item.amount, item.payment_method, item.account || '', item.description || ''])
  ];
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  downloadFile(`transaksi-${selectedYear}-${selectedMonth === 'all' ? 'semua-bulan' : selectedMonth}.csv`, csv, 'text/csv;charset=utf-8');
  notify(`${items.length} transaksi berhasil diekspor ke CSV.`);
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

async function importJSON(file) {
  if (!file || !currentUser) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.transactions)) throw new Error('Format file tidak dikenali. Gunakan file cadangan JSON dari aplikasi ini.');
    const valid = parsed.transactions.filter((item) =>
      item && ['income', 'expense'].includes(item.kind)
      && Number.isFinite(Number(item.amount)) && Number(item.amount) > 0
      && isValidDate(item.transaction_date)
      && typeof item.category === 'string' && item.category.trim().length > 0
    );
    if (!valid.length) throw new Error('Tidak ada transaksi valid yang dapat dipulihkan.');
    const confirmed = window.confirm(`Ditemukan ${valid.length} transaksi valid. Data akan ditambahkan ke akun ini dan tidak menggantikan data yang sudah ada. Lanjutkan?`);
    if (!confirmed) return;
    const payload = valid.map((item) => ({
      user_id: currentUser.id,
      transaction_date: item.transaction_date,
      kind: item.kind,
      amount: Number(item.amount),
      category: item.category.trim().slice(0, 60),
      payment_method: PAYMENT_METHODS.includes(item.payment_method) ? item.payment_method : 'Lainnya',
      account: typeof item.account === 'string' ? item.account.slice(0, 80) : null,
      description: typeof item.description === 'string' ? item.description.slice(0, 240) : null
    }));
    for (let index = 0; index < payload.length; index += 100) {
      const { error } = await supabase.from('transactions').insert(payload.slice(index, index + 100));
      if (error) throw error;
    }
    await loadTransactions();
    notify(`${payload.length} transaksi berhasil dipulihkan.`);
  } catch (error) {
    console.error(error);
    notify(`Gagal memulihkan data: ${error.message || friendlyError(error)}`, 'error');
  } finally {
    $('#import-json-file').value = '';
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const button = $('#auth-submit');
  button.disabled = true;
  button.textContent = authMode === 'signup' ? 'Membuat akun...' : 'Memeriksa...';
  setAuthMessage('');
  try {
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.href.split('#')[0] }
      });
      if (error) throw error;
      if (data.session) {
        await enterApp(data.user);
      } else {
        setAuthMessage('Akun berhasil dibuat. Periksa email untuk konfirmasi, lalu masuk kembali.', true);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await enterApp(data.user);
    }
  } catch (error) {
    console.error(error);
    setAuthMessage(friendlyAuthError(error));
  } finally {
    button.disabled = false;
    button.textContent = authMode === 'signup' ? 'Buat akun' : 'Masuk';
  }
}

function friendlyAuthError(error) {
  const message = error?.message || 'Tidak dapat memproses akun.';
  if (message.toLowerCase().includes('invalid login credentials')) return 'Email atau kata sandi tidak sesuai.';
  if (message.toLowerCase().includes('user already registered')) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (message.toLowerCase().includes('password should be')) return 'Kata sandi minimal 6 karakter.';
  if (message.toLowerCase().includes('email not confirmed')) return 'Email belum dikonfirmasi. Periksa kotak masuk email Anda.';
  return message;
}

async function updateRecoveredPassword(event) {
  event.preventDefault();
  const password = $('#new-password').value;
  const button = $('#password-reset-submit');
  button.disabled = true;
  button.textContent = 'Menyimpan...';
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
    showAuth();
    setAuthMessage('Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.', true);
  } catch (error) {
    setAuthMessage(friendlyAuthError(error));
  } finally {
    button.disabled = false;
    button.textContent = 'Simpan kata sandi baru';
  }
}

async function resetPassword() {
  const email = $('#auth-email').value.trim();
  if (!email) {
    setAuthMessage('Masukkan email terlebih dahulu, lalu pilih “Lupa kata sandi?”.');
    $('#auth-email').focus();
    return;
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
    if (error) throw error;
    setAuthMessage('Tautan pemulihan dikirim jika alamat email tersebut terdaftar. Periksa kotak masuk Anda.', true);
  } catch (error) {
    setAuthMessage(friendlyAuthError(error));
  }
}

function bindEvents() {
  $('#login-tab').addEventListener('click', () => setAuthMode('login'));
  $('#signup-tab').addEventListener('click', () => setAuthMode('signup'));
  $('#auth-form').addEventListener('submit', handleAuthSubmit);
  $('#password-reset-form').addEventListener('submit', updateRecoveredPassword);
  $('#forgot-password').addEventListener('click', resetPassword);
  $('#signout-button').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) notify(`Gagal keluar: ${friendlyError(error)}`, 'error');
  });

  ['#add-transaction-top', '#add-transaction-main', '#empty-add-button'].forEach((selector) => {
    $(selector).addEventListener('click', () => openTransactionModal());
  });
  $('#close-modal').addEventListener('click', closeTransactionModal);
  $('#cancel-modal').addEventListener('click', closeTransactionModal);
  $('#transaction-modal').addEventListener('click', (event) => { if (event.target === $('#transaction-modal')) closeTransactionModal(); });
  $('#transaction-form').addEventListener('submit', saveTransaction);
  $$('input[name="transaction-kind"]').forEach((radio) => radio.addEventListener('change', (event) => updateCategorySuggestions(event.target.value)));
  $('#confirm-delete').addEventListener('click', deleteTransaction);
  $('#cancel-delete').addEventListener('click', () => { show($('#confirm-modal'), false); pendingDeleteId = null; });
  $('#confirm-modal').addEventListener('click', (event) => { if (event.target === $('#confirm-modal')) { show($('#confirm-modal'), false); pendingDeleteId = null; } });

  $('#year-filter').addEventListener('change', (event) => { selectedYear = Number(event.target.value); renderDashboard(); });
  $('#month-filter').addEventListener('change', (event) => { selectedMonth = event.target.value; renderDashboard(); });
  $('#search-input').addEventListener('input', renderTransactions);
  $('#type-filter').addEventListener('change', renderTransactions);
  $('#transactions-table-body').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = transactions.find((transaction) => transaction.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === 'edit') openTransactionModal(item);
    if (button.dataset.action === 'delete') openDeleteModal(item.id);
  });
  $('#export-json').addEventListener('click', exportJSON);
  $('#export-csv').addEventListener('click', exportCSV);
  $('#import-json-trigger').addEventListener('click', () => $('#import-json-file').click());
  $('#import-json-file').addEventListener('change', (event) => importJSON(event.target.files?.[0]));
  $$('[data-scroll]').forEach((button) => button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.scroll);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $$('.side-link[data-scroll]').forEach((link) => link.classList.toggle('active', link === button));
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!$('#transaction-modal').classList.contains('hidden')) closeTransactionModal();
      if (!$('#confirm-modal').classList.contains('hidden')) { show($('#confirm-modal'), false); pendingDeleteId = null; }
    }
  });
}

async function init() {
  bindEvents();
  if (!isConfigReady()) {
    show($('#setup-screen'), true);
    show($('#auth-screen'), false);
    show($('#app'), false);
    return;
  }
  try {
    if (!window.supabase?.createClient) throw new Error('Library Supabase tidak berhasil dimuat. Periksa koneksi internet lalu muat ulang halaman.');
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        showPasswordRecovery();
      } else if (event === 'SIGNED_OUT' && currentUser) {
        transactions = [];
        showAuth();
      }
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user) await enterApp(data.session.user);
    else showAuth();
  } catch (error) {
    console.error(error);
    showAuth();
    setAuthMessage(`Tidak dapat menghubungkan aplikasi: ${friendlyError(error)}.`);
  }
}

init();
