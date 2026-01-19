
// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, where,
  doc, updateDoc, getDocs, startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Анонимный вход в Firebase (если нужен простой доступ)
await signInAnonymously(auth).catch(e => console.warn('Anon sign-in failed', e));

let currentUser = { uid: 'guest', username: 'Guest' };
onAuthStateChanged(auth, (u) => {
  if (u) currentUser.uid = u.uid;
});

// Telegram init
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user || null;
if (tgUser) {
  currentUser = { uid: String(tgUser.id), username: tgUser.username ? `@${tgUser.username}` : tgUser.first_name };
}

// UI elements
document.getElementById('userBar').innerText = `👤 User: ${currentUser.username}`;
document.getElementById('usernameSmall').innerText = `ID: ${currentUser.uid}`;

// Data model helpers
async function ensureUserDoc() {
  const udoc = doc(db, 'users', currentUser.uid);
  // Creation done as users interact (simple approach)
  try {
    await setIfNotExists(udoc, {
      username: currentUser.username,
      balance: 0,
      totalEarned: 0,
      adsCount: 0,
      referrals: [],
      referredBy: null,
      createdAt: Date.now()
    });
  } catch (e) {}
}

async function setIfNotExists(docRef, data) {
  // get and set if not exists
  const snap = await getDocs(query(collection(db, '_dummy'), limit(1))).catch(()=>null);
  // Simpler: try update, if fails create
  try {
    await updateDoc(docRef, {}); // if exists, nothing
  } catch {
    await addDocToPath(docRef, data);
  }
}

async function addDocToPath(refDoc, data) {
  // Firestore doesn't support addDoc to specific id in modular SDK directly
  // Workaround: use set via import of setDoc is better; but to keep code compact:
  const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  await setDoc(refDoc, data, { merge: true });
}

// Initial ensure user doc
await ensureUserDoc();

// Реальное время: слушаем изменения баланса юзера
const userDocRef = doc(db, 'users', currentUser.uid);
onSnapshot(userDocRef, (snap) => {
  if (!snap.exists()) return;
  const d = snap.data();
  document.getElementById('balanceDisplay').innerText = `₱${(d.balance||0).toFixed(2)}`;
  document.getElementById('totalEarned').innerText = `₱${(d.totalEarned||0).toFixed(2)}`;
  document.getElementById('profileUsername').innerText = d.username || currentUser.username;
  document.getElementById('profileRefCount').innerText = (d.referrals || []).length || 0;
  document.getElementById('profileAdsCount').innerText = d.adsCount || 0;
  // Здесь можно рассчитать day/week stats (на проде — агрегация через Cloud Functions)
});

// ---------- Ads / Tasks core ----------
const tasksConfig = [
  { id: 'area1', title: '🤑🍍Task #1🍍🤑', zones: ['show_10276123'], reward: 0.02, cooldownSec: 300 },
  { id: 'area2', title: '🤑🍍Task #2🍍🤑', zones: ['show_10337795'], reward: 0.02, cooldownSec: 300 },
  { id: 'signin1', title: '🍍Task #1 (SignIn)', zones: ['show_10276123'], reward: 0.025, cooldownSec: 10800 },
  { id: 'gift1', title: '🍍Gift #1', zones: ['show_10276123'], reward: 0.02, cooldownSec: 10800, format:'pop' }
];

// render ads buttons
function renderAdsUI() {
  const adsList = document.getElementById('adsList');
  const signinList = document.getElementById('signinList');
  const giftList = document.getElementById('giftList');

  tasksConfig.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.innerText = t.title;
    btn.onclick = () => playTask(t);
    if (t.id.startsWith('area')) adsList.appendChild(btn);
    if (t.id.startsWith('signin')) signinList.appendChild(btn);
    if (t.id.startsWith('gift')) giftList.appendChild(btn);
  });
}
renderAdsUI();

// cooldowns stored in localStorage per user
function getCooldownKey(taskId){ return `cd_${currentUser.uid}_${taskId}`; }

async function playTask(task) {
  const last = parseInt(localStorage.getItem(getCooldownKey(task.id)) || '0',10);
  const now = Math.floor(Date.now()/1000);
  if (last && now - last < task.cooldownSec) {
    alert(`Cooldown active. Подождите ${Math.ceil((task.cooldownSec - (now-last))/60)} минут.`);
    return;
  }
  // show two combined inline ads if available (simulated: call each zone twice)
  try {
    for (let z of task.zones) {
      const fn = window[z];
      if (typeof fn === 'function') {
        // format handling
        if (task.format === 'pop') {
          await fn('pop');
        } else {
          await fn(); // returns promise per SDK assumption
        }
      }
    }
    // after ads shown — unlock claim (here immediate reward flow)
    await grantReward(task.reward, `task:${task.id}`);
    localStorage.setItem(getCooldownKey(task.id), String(now));
    triggerRewardPopup();
    // update user stats: adsCount etc (handled inside grantReward)
  } catch (e) {
    console.warn('Ad error or ad SDK not present', e);
    alert('Ad not available. Попробуйте позже.');
  }
}

async function grantReward(amountPeso, reason='ads') {
  // Увеличиваем баланс и записываем транзакцию
  const uRef = doc(db, 'users', currentUser.uid);
  // Получаем баланс и делаем update (лучше через транзакцию на проде)
  const { getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  const snap = await getDoc(uRef);
  const data = snap.exists() ? snap.data() : {};
  const oldBal = data.balance || 0;
  const newBal = oldBal + amountPeso;
  await updateDoc(uRef, {
    balance: newBal,
    totalEarned: (data.totalEarned || 0) + amountPeso,
    adsCount: (data.adsCount || 0) + 1
  });
  // запись лога выплаты (ledger)
  await addDoc(collection(db, 'transactions'), {
    userId: currentUser.uid,
    username: currentUser.username,
    amount: amountPeso,
    currency: 'PHP',
    reason,
    ts: Date.now()
  });
  // реферальная комиссия: если есть referredBy, начислить 10% бонус их рефералу (0.1*amount)
  if (data.referredBy) {
    const bonus = +(amountPeso * 0.10).toFixed(4);
    const refUserRef = doc(db, 'users', data.referredBy);
    const { getDoc: g2, updateDoc: u2 } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const rSnap = await g2(refUserRef);
    if (rSnap.exists()) {
      const rData = rSnap.data();
      await u2(refUserRef, { balance: (rData.balance || 0) + bonus });
      // log referral bonus
      await addDoc(collection(db, 'transactions'), {
        userId: data.referredBy,
        username: rData.username,
        amount: bonus,
        currency: 'PHP',
        reason: 'referral_bonus',
        ts: Date.now(),
        fromUser: currentUser.uid
      });
    }
  }
}

// Reward popup (5 random animations)
const rewardAnims = ['animate__bounceIn','animate__jackInTheBox','animate__zoomInDown','animate__rollIn','animate__backInDown'];
function triggerRewardPopup(){
  const modal = document.createElement('div');
  modal.className = `modal`;
  const box = document.createElement('div');
  box.className = 'box animate__animated ' + rewardAnims[Math.floor(Math.random()*rewardAnims.length)];
  box.innerHTML = `<h2>🎉 Congratulations! 🎉</h2><p>Вы получили награду!</p><div style="text-align:right;"><button class="btn" onclick="this.closest('.modal').remove()">OK</button></div>`;
  modal.appendChild(box);
  document.body.appendChild(modal);
}

// ---------- Withdrawal logic ----------
let withdrawPageCursor = null;
let withdrawPageSize = 10;

async function requestWithdraw(method) {
  const amountInput = method === 'gcash' ? document.getElementById('gcashAmount') : document.getElementById('faucetAmount');
  const dest = method === 'gcash' ? document.getElementById('gcashNumber').value.trim() : document.getElementById('faucetEmail').value.trim();
  const amount = parseFloat(amountInput.value);
  if (!dest || isNaN(amount) || amount <= 0) { alert('Заполните корректно'); return; }

  // Проверка баланса
  const { getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  const uRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(uRef);
  const data = snap.exists() ? snap.data() : {};
  if ((data.balance || 0) < amount) { alert('Недостаточно средств'); return; }

  // Если FaucetPay — конвертация peso -> USDT (пример курс)
  let amountUSDT = null;
  if (method === 'faucet') {
    const rate = 56.0; // пример: 1 USD = 56 PHP -> 1 USDT ~ 1 USD
    amountUSDT = +(amount / rate).toFixed(6);
  }

  // Создаём запрос на вывод (status: pending)
  await addDoc(collection(db, 'withdrawals'), {
    userId: currentUser.uid,
    username: currentUser.username,
    method,
    dest,
    amountPeso: amount,
    amountUSDT: amountUSDT,
    status: 'pending',
    createdAt: Date.now()
  });

  // тут же вычитаем сумму из баланса (резерв)
  await updateDoc(uRef, { balance: (data.balance || 0) - amount });

  alert('Заявка создана и отправлена на проверку');
  amountInput.value = '';
  if (method === 'gcash') document.getElementById('gcashNumber').value = '';
  else document.getElementById('faucetEmail').value = '';
}

// Withdraw history with pagination & snapshot
let withdrawQuerySnap = null;
let withdrawLastDoc = null;
let withdrawFirstDoc = null;
let currentWithdrawPage = 0;

function subscribeWithdrawHistory() {
  // Показываем последние 10 записей пользователя
  const q = query(collection(db, 'withdrawals'), where('userId','==', currentUser.uid), orderBy('createdAt','desc'), limit(withdrawPageSize));
  onSnapshot(q, (snap) => {
    renderWithdrawList(snap.docs);
    withdrawFirstDoc = snap.docs[0] || null;
    withdrawLastDoc = snap.docs[snap.docs.length-1] || null;
  });
}
function renderWithdrawList(docs) {
  const container = document.getElementById('withdrawHistory');
  container.innerHTML = '';
  const tbl = document.createElement('table');
  tbl.innerHTML = '<tr><th>Дата</th><th>Метод</th><th>Сумма</th><th>Статус</th></tr>';
  docs.forEach(d=> {
    const data = d.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${new Date(data.createdAt).toLocaleString()}</td><td>${data.method} ${data.dest || ''}</td><td>₱${(data.amountPeso||0).toFixed(2)} ${data.amountUSDT ? `(≈${data.amountUSDT} USDT)` : ''}</td><td>${data.status}</td>`;
    tbl.appendChild(tr);
  });
  container.appendChild(tbl);
}
subscribeWithdrawHistory();

async function paginateWithdraw(dir) {
  // Для простоты реализуем только "следующие" (эта реализация — базовая)
  // Продвинутую пагинацию можно сделать startAfter / startAt с cursor
  if (dir === 1) {
    // next: get older than lastDoc
    if (!withdrawLastDoc) return;
    const q = query(collection(db, 'withdrawals'), where('userId','==', currentUser.uid), orderBy('createdAt','desc'), startAfter(withdrawLastDoc), limit(withdrawPageSize));
    const snap = await getDocs(q);
    renderWithdrawList(snap.docs);
    withdrawLastDoc = snap.docs[snap.docs.length-1] || withdrawLastDoc;
  } else {
    // prev: просто повторно подписаться на первые (упрощённо)
    subscribeWithdrawHistory();
  }
}

// ---------- Owner dashboard ----------
const OWNER_PASS = 'Propetas6';

function openOwner(){
  const pass = prompt('Введите пароль владельца:');
  if (pass !== OWNER_PASS) { alert('Неверный пароль'); return; }
  openOwnerDashboard();
}

function closeOwner(){
  document.getElementById('ownerModal').classList.add('hidden');
}

async function openOwnerDashboard() {
  document.getElementById('ownerModal').classList.remove('hidden');
  const content = document.getElementById('ownerContent');
  content.innerHTML = '<div>Loading requests...</div>';
  // Слушаем все withdrawals, приоритет pending сверху
  const q = query(collection(db, 'withdrawals'), orderBy('status'), orderBy('createdAt','desc'), limit(100));
  onSnapshot(q, (snap) => {
    const docs = snap.docs.slice().sort((a,b) => {
      const sa = a.data().status, sb = b.data().status;
      if (sa === sb) return b.data().createdAt - a.data().createdAt;
      // pending first
      if (sa === 'pending') return -1;
      if (sb === 'pending') return 1;
      return a.data().createdAt - b.data().createdAt;
    });
    renderOwnerTable(docs, content);
  });
}

function renderOwnerTable(docs, container) {
  container.innerHTML = '';
  const tbl = document.createElement('table');
  tbl.innerHTML = '<tr><th>Пользователь</th><th>Метод</th><th>Сумма</th><th>Дата</th><th>Статус</th><th>Action</th></tr>';
  docs.forEach(d => {
    const data = d.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${data.username}<br><small>${data.userId}</small></td>
      <td>${data.method}<br><small>${data.dest || ''}</small></td>
      <td>₱${(data.amountPeso||0).toFixed(2)} ${data.amountUSDT ? `(≈${data.amountUSDT} USDT)` : ''}</td>
      <td>${new Date(data.createdAt).toLocaleString()}</td>
      <td>${data.status}</td>
      <td></td>`;
    const actionsTd = tr.querySelector('td:last-child');

    if (data.status === 'pending') {
      const approveBtn = document.createElement('button');
      approveBtn.className = 'btn';
      approveBtn.innerText = 'Approve';
      approveBtn.onclick = () => approveWithdrawal(d.id);
      const denyBtn = document.createElement('button');
      denyBtn.className = 'btn';
      denyBtn.style.background = '#ff8a8a';
      denyBtn.innerText = 'Deny';
      denyBtn.onclick = () => denyWithdrawal(d.id);
      actionsTd.appendChild(approveBtn);
      actionsTd.appendChild(denyBtn);
    } else {
      // already processed
      actionsTd.innerText = '-';
    }
    tbl.appendChild(tr);
  });
  container.appendChild(tbl);
}

async function approveWithdrawal(withdrawId) {
  const wRef = doc(db, 'withdrawals', withdrawId);
  await updateDoc(wRef, { status: 'approved', processedAt: Date.now() });
  // Optionally — записать в payouts таблицу и уведомления пользователю
  alert('Заявка утверждена');
}
async function denyWithdrawal(withdrawId) {
  const wRef = doc(db, 'withdrawals', withdrawId);
  const wSnap = await (await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")).getDoc(wRef);
  if (!wSnap.exists()) return alert('Не найдено');
  const w = wSnap.data();
  // вернуть деньги пользователю (отмена резерва)
  const uRef = doc(db, 'users', w.userId);
  const { updateDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  const uSnap = await getDoc(uRef);
  const ub = uSnap.exists() ? uSnap.data().balance || 0 : 0;
  await updateDoc(uRef, { balance: ub + (w.amountPeso || 0) });
  await updateDoc(wRef, { status: 'denied', processedAt: Date.now() });
  alert('Заявка отклонена и сумма возвращена пользователю');
}

// ---------- Referrals ----------
async function setReferral(){
  const refInput = document.getElementById('referralInput').value.trim().replace('@','');
  if (!refInput) return alert('Введите username');
  // Поиск пользователя по username (предполагаем, что username уникален и хранится в users)
  const q = query(collection(db, 'users'), where('username','==', '@' + refInput), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return alert('Реферал не найден');
  const refUser = snap.docs[0];
  // Установить в своём профиле referredBy
  const uRef = doc(db, 'users', currentUser.uid);
  await updateDoc(uRef, { referredBy: refUser.id });
  alert('Реферал установлен');
}

// claim referral bonus: для примера берём все транзакции referral_bonus и суммируем невостребованные — в проде нужна отдельная схема
async function claimReferralBonus() {
  alert('Claim referral: в демо автоматически зачисляется при arise (реферальные бонусы начисляются сразу).');
}

// ---------- Chat ----------
let chatLimit = 50;
let lastChatDoc = null;
let chatCooldownKey = `chat_cd_${currentUser.uid}`;
async function loadChat() {
  const chatDiv = document.getElementById('chatMessages');
  chatDiv.innerHTML = '<div class="small">Loading...</div>';
  const q = query(collection(db, 'chats'), orderBy('ts','desc'), limit(chatLimit));
  onSnapshot(q, (snap) => {
    chatDiv.innerHTML = '';
    snap.docs.slice().reverse().forEach(d => {
      const data = d.data();
      const el = document.createElement('div');
      el.innerHTML = `<strong>${data.username}</strong>: ${escapeHtml(data.text)} <div class="small">${new Date(data.ts).toLocaleString()}</div>`;
      chatDiv.appendChild(el);
    });
  });
}
function escapeHtml(text){ return String(text).replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

async function sendChatMessage(){
  const input = document.getElementById('chatInput');
  if (!input.value.trim()) return;
  // cooldown 4 minutes
  const last = parseInt(localStorage.getItem(chatCooldownKey) || '0',10);
  const now = Date.now();
  if (last && now - last < 4*60*1000) {
    return alert('Cooldown: подождите 4 минуты между сообщениями');
  }
  // show random ad and reward 0.02 after success
  try {
    await showRandomAd();
    await addDoc(collection(db, 'chats'), {
      userId: currentUser.uid,
      username: currentUser.username,
      text: input.value.trim(),
      ts: Date.now()
    });
    // reward
    await grantReward(0.02, 'chat_message');
    localStorage.setItem(chatCooldownKey, String(now));
    input.value = '';
    alert('Сообщение отправлено и вы получили ₱0.02');
  } catch (e) {
    alert('Ad failed or network error. Попробуйте позже.');
  }
}

async function showRandomAd(){
  const ads = ['show_10276123','show_10337795','show_10337853'];
  const fnName = ads[Math.floor(Math.random()*ads.length)];
  const fn = window[fnName];
  if (typeof fn === 'function') return fn();
  // if SDK absent, simulate short wait
  return new Promise(res => setTimeout(res, 1200));
}
loadChat();

// ---------- Leaderboards ----------
function subscribeLeaderboards(){
  // Top earners (realtime sorted by totalEarned desc)
  const q = query(collection(db, 'users'), orderBy('totalEarned','desc'), limit(50));
  onSnapshot(q, (snap) => {
    const container = document.getElementById('leadersTable');
    container.innerHTML = '';
    const tbl = document.createElement('table');
    tbl.innerHTML = '<tr><th>#</th><th>User</th><th>Total Earned</th></tr>';
    let idx = 1;
    snap.docs.forEach(d => {
      const data = d.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx++}</td><td>${data.username||d.id}</td><td>₱${(data.totalEarned||0).toFixed(2)}</td>`;
      tbl.appendChild(tr);
    });
    container.appendChild(tbl);
  });

  // Ads leaderboard (by adsCount)
  const q2 = query(collection(db, 'users'), orderBy('adsCount','desc'), limit(50));
  onSnapshot(q2, (snap) => {
    const container = document.getElementById('adsLeadersTable');
    container.innerHTML = '';
    const tbl = document.createElement('table');
    tbl.innerHTML = '<tr><th>#</th><th>User</th><th>Ads Watched</th></tr>';
    let idx = 1;
    snap.docs.forEach(d => {
      const data = d.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx++}</td><td>${data.username||d.id}</td><td>${data.adsCount||0}</td>`;
      tbl.appendChild(tr);
    });
    container.appendChild(tbl);
  });
}
subscribeLeaderboards();

// Run weekly payout for top 5 Ads leaderboard (manual owner action)
async function runWeeklyPayout(){
  const pass = prompt('Owner password to run weekly payout:');
  if (pass !== 'Propetas6') { alert('Неверный пароль'); return; }
  // получаем топ-5 по adsCount (за текущую неделю — упрощённо: adsCount за всё, в проде хранить weeklyCount)
  const q = query(collection(db, 'users'), orderBy('adsCount','desc'), limit(5));
  const snap = await getDocs(q);
  const batchPromises = [];
  for (const d of snap.docs) {
    const userRef = doc(db, 'users', d.id);
    const data = d.data();
    const bonus = 10;
    batchPromises.push(updateDoc(userRef, { balance: (data.balance||0) + bonus, totalEarned: (data.totalEarned||0) + bonus }));
    // log payout
    batchPromises.push(addDoc(collection(db,'transactions'), {
      userId: d.id, username: data.username, amount: bonus, currency: 'PHP', reason: 'weekly_top5_bonus', ts: Date.now()
    }));
  }
  await Promise.all(batchPromises);
  alert('Weekly payout executed for top 5 (manual). Для авто используйте Cloud Functions с cron.');
}

// ---------- Utilities & Navigation ----------
function openSection(id){
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function openOwner(){
  // placeholder defined later (owner popup)
  window.openOwner();
}

// init UI small defaults
document.getElementById('gcashBalance').innerText = '0.00';
document.getElementById('faucetBalance').innerText = '0.00';


// ---------- Misc: auto-show in-app interstitial on open (каждые 3 минуты) ----------
(function openAdOnStart(){
  const lastOpen = parseInt(localStorage.getItem('lastOpenAd')||'0',10);
  const now = Date.now();
  if (!lastOpen || now - lastOpen > 3*60*1000) {
    showRandomAd();
    localStorage.setItem('lastOpenAd', String(now));
  }
  // cycle: каждые 6 минут показываем 2 ads с интервалом 30s
  setTimeout(() => {
    showRandomAd();
    setTimeout(showRandomAd, 30000);
  }, 5000);
  setInterval(() => {
    showRandomAd();
    setTimeout(showRandomAd, 30000);
  }, 6*60*1000);
})();
