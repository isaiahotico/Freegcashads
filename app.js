
// app.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, limit,
  onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, updateDoc, runTransaction, getDocs, startAfter
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ================== Firebase init ==================
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================== User identity ==================
const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user;
const userName = tgUser ? `@${tgUser.username || tgUser.first_name}` : ("GUEST_" + Math.random().toString(36).slice(2,8));
document.getElementById('st-user').innerText = `👤 ${userName}`;
let myData = { username: userName, balance: 0, refBonus: 0, referredBy: null };

// Utility: localStorage cooldowns
const now = () => Date.now();
const cdGet = k => parseInt(localStorage.getItem(k) || 0);
const cdSet = k => localStorage.setItem(k, Date.now().toString());

// ================== Heartbeat & Online ==================
async function heartbeat() {
  try {
    const uRef = doc(db, 'users', userName);
    await setDoc(uRef, { username: userName, lastSeen: now(), status: 'online' }, { merge: true });
  } catch (e) { console.error('heartbeat err', e); }
}
heartbeat();
setInterval(heartbeat, 20000); // 20s

// Subscribe online users (client-side filtering for lastSeen within 60s)
let unsubOnline = null;
function subscribeOnline() {
  if (unsubOnline) unsubOnline();
  const q = query(collection(db, 'users'), orderBy('lastSeen', 'desc'), limit(500));
  unsubOnline = onSnapshot(q, snap => {
    const rows = [];
    snap.docs.forEach(d => {
      const u = d.data();
      if ((now() - (u.lastSeen || 0)) <= 60000) {
        rows.push(`<tr><td>${u.username}</td><td>Just now</td><td style="color:green">● Online</td></tr>`);
      }
    });
    document.getElementById('online-count').innerText = rows.length;
    document.getElementById('online-list').innerHTML = rows.join('') || '<tr><td colspan="3">No users online</td></tr>';
  });
}
subscribeOnline();

// ================== Navigation helpers ==================
function hideAll() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
}
window.nav = (pageId) => {
  hideAll();
  document.getElementById('p-' + pageId).classList.add('active');
  if (pageId === 'online') subscribeOnline();
  if (pageId === 'lead') initLeaderboard();
  if (pageId === 'help') initHelp();
  if (pageId === 'wd') initUserWdHistory();
};
window.navChat = (room) => {
  hideAll();
  document.getElementById('p-chat').classList.add('active');
  currentRoom = room;
  document.getElementById('chat-title').innerText = {
    elem: '📘 ELEMENTARY CHAT 📘',
    high: '📗 HIGHSCHOOL CHAT 📗',
    college: '📙 COLLEGE CHAT 📙'
  }[room] || room;
  initChat(room);
};

// ================== Chat (per-room, 4-min cooldown, live + pagination) ==================
let currentRoom = 'elem';
const CHAT_PAGE = 100; // recent per subscription
let chatUnsub = null;
let oldestDoc = null;
let loadingOlder = false;

function initChat(room) {
  if (chatUnsub) chatUnsub();
  const msgsRef = collection(db, 'messages');
  const q = query(msgsRef, where('room', '==', room), orderBy('timestamp', 'desc'), limit(CHAT_PAGE));
  chatUnsub = onSnapshot(q, snap => {
    const docs = snap.docs;
    oldestDoc = docs[docs.length - 1] || null;
    const html = docs.slice().reverse().map(d => {
      const m = d.data();
      const cls = (m.u === userName) ? 'msg me' : 'msg other';
      const text = escapeHtml(m.t || '');
      const time = m.timestamp ? new Date(m.timestamp.toMillis()).toLocaleString() : '';
      return `<div class="${cls}"><b>${m.u}</b><div>${text}</div><div class="small">${time}</div></div>`;
    }).join('');
    const list = document.getElementById('msg-list');
    const wasAtBottom = (list.scrollTop + list.clientHeight >= list.scrollHeight - 20);
    list.innerHTML = html;
    if (wasAtBottom) list.scrollTop = list.scrollHeight;
  });
}

// Load older messages when user scrolls to top
window.onChatScroll = async () => {
  const el = document.getElementById('msg-list');
  if (el.scrollTop > 50 || loadingOlder) return;
  if (!oldestDoc) return;
  loadingOlder = true;
  try {
    const msgsRef = collection(db, 'messages');
    const qMore = query(msgsRef, where('room', '==', currentRoom), orderBy('timestamp', 'desc'), startAfter(oldestDoc), limit(100));
    const snap = await getDocs(qMore);
    if (!snap.empty) {
      // prepend older items above current content
      const htmlOlder = snap.docs.slice().reverse().map(d => {
        const m = d.data();
        const cls = (m.u === userName) ? 'msg me' : 'msg other';
        const text = escapeHtml(m.t || '');
        const time = m.timestamp ? new Date(m.timestamp.toMillis()).toLocaleString() : '';
        return `<div class="${cls}"><b>${m.u}</b><div>${text}</div><div class="small">${time}</div></div>`;
      }).join('');
      const list = document.getElementById('msg-list');
      list.innerHTML = htmlOlder + list.innerHTML;
      oldestDoc = snap.docs[snap.docs.length - 1] || oldestDoc;
      // keep scroll position approximately where it was
    }
  } catch (e) { console.error('load older err', e); }
  loadingOlder = false;
};

// Send message with per-room 4-min cooldown and ad-watching
document.getElementById('sendBtn').addEventListener('click', async () => {
  const text = document.getElementById('m-in').value.trim();
  if (!text) return alert('Введите сообщение');
  const cdKey = `cd_chat_${currentRoom}`;
  if (now() - cdGet(cdKey) < 240000) return alert('Комната в 4-минутном откате!');
  try {
    // show highest cpm ads as greeting — keep try/catch so message not blocked
    await show_10337853().catch(()=>{}); await show_10337795().catch(()=>{}); await show_10276123().catch(()=>{});
    // reward only in elementary instantly
    if (currentRoom === 'elem') {
      // reward small on server transaction to avoid double-spend
      await runTransactionReward(userName, 0.015, 'chat_elem_reward_' + Date.now());
    } else {
      // show claim UI (client-side) — user still must press claim and we will verify in transaction
      document.getElementById('chat-cd-info').innerText = 'Нажмите CLAIM при появлении кнопки для получения награды';
    }

    // append message
    await addDoc(collection(db, 'messages'), {
      u: userName, t: text, room: currentRoom, timestamp: serverTimestamp()
    });
    cdSet(cdKey);
    document.getElementById('m-in').value = '';
  } catch (e) { console.error(e); alert('Ошибка отправки. Попробуйте снова.'); }
});

// ================== Prevent double reward: transaction helper ==================
async function runTransactionReward(username, amount, claimId) {
  // claimId — уникальный ид для транзакции, но для безопасности используем claims/{username}_{claimType}
  const claimDocId = `${username}_${claimId}`;
  const claimRef = doc(db, 'claims', claimDocId);
  const userRef = doc(db, 'users', username);
  try {
    await runTransaction(db, async (tx) => {
      const claimSnap = await tx.get(claimRef);
      if (claimSnap.exists() && claimSnap.data().claimed === true) {
        throw 'ALREADY_CLAIMED';
      }
      // mark claim in progress / claimed
      tx.set(claimRef, { claimed: true, amount, at: now(), by: username }, { merge: true });
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) {
        tx.set(userRef, { username, balance: amount }, { merge: true });
      } else {
        const cur = uSnap.data().balance || 0;
        tx.update(userRef, { balance: cur + amount });
      }
    });
    // success
    return true;
  } catch (err) {
    if (err === 'ALREADY_CLAIMED') {
      console.warn('Reward already claimed');
      return false;
    } else {
      console.error('trans err', err);
      throw err;
    }
  }
}

// ================== Gifts (popup rewarded, 3h CD) ==================
async function adCallByZone(zone, mode='pop') {
  const fn = window[`show_${zone}`];
  if (typeof fn === 'function') {
    try {
      return await fn(mode);
    } catch (e) { console.warn('ad fail', e); throw e; }
  } else {
    console.warn('Ad function missing', zone);
    throw new Error('Ad SDK missing');
  }
}

window.triggerGift = async (id) => {
  const cdKey = `cd_gift_${id}`;
  if (now() - cdGet(cdKey) < 10800000) return alert('Cooldown 3 hours');
  const zones = {1:10337853,2:10337795,3:10276123};
  try {
    await adCallByZone(zones[id], 'pop');
    // create claim marker (unclaimed)
    const claimDoc = doc(db, 'claims', `${userName}_gift_${id}`);
    await setDoc(claimDoc, { watched: true, claimed: false, zone: zones[id], watchedAt: now() }, { merge: true });
    document.getElementById(`clm-g${id}`).style.display = 'inline-block';
  } catch (e) {
    alert('Ошибка показа рекламы');
  }
};

window.claimGift = async (id) => {
  const claimDocId = `${userName}_gift_${id}`;
  const claimRef = doc(db, 'claims', claimDocId);
  const userRef = doc(db, 'users', userName);
  try {
    await runTransaction(db, async (tx) => {
      const cSnap = await tx.get(claimRef);
      if (!cSnap.exists() || cSnap.data().watched !== true) throw 'NOT_WATCHED';
      if (cSnap.data().claimed === true) throw 'ALREADY';
      tx.update(claimRef, { claimed: true, claimedAt: now() });
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) {
        tx.set(userRef, { username: userName, balance: 0.01 }, { merge: true });
      } else {
        const cur = uSnap.data().balance || 0;
        tx.update(userRef, { balance: cur + 0.01 });
      }
    });
    cdSet(`cd_gift_${id}`);
    document.getElementById(`clm-g${id}`).style.display = 'none';
    alert('Вы получили 0.01 Peso');
  } catch (e) {
    if (e === 'NOT_WATCHED') alert('Сначала посмотрите рекламу');
    else if (e === 'ALREADY') alert('Уже получено');
    else { console.error(e); alert('Ошибка начисления'); }
  }
};

// ================== Bonus (3 ads sequence, 20m CD) ==================
window.startBonus = async (id) => {
  const cdKey = `cd_bonus_${id}`;
  if (now() - cdGet(cdKey) < 1200000) return alert('Cooldown 20 минут');
  try {
    // show three ads (highest CPM priority)
    await adCallByZone(10276123).catch(()=>{}); // try
    await adCallByZone(10337795).catch(()=>{});
    await adCallByZone(10337853).catch(()=>{});
    // mark sequence completed in claims
    await setDoc(doc(db, 'claims', `${userName}_bonus_${id}`), { sequenceWatched: true, claimed:false, at: now() }, { merge:true });
    document.getElementById(`clm-b${id}`).style.display = 'inline-block';
  } catch (e) { alert('Ошибка при воспроизведении рекламы'); }
};

window.claimBonus = async (id) => {
  const claimRef = doc(db, 'claims', `${userName}_bonus_${id}`);
  try {
    await runTransaction(db, async (tx) => {
      const cSnap = await tx.get(claimRef);
      if (!cSnap.exists() || !cSnap.data().sequenceWatched) throw 'NOT_COMPLETE';
      if (cSnap.data().claimed) throw 'ALREADY';
      tx.update(claimRef, { claimed: true, claimedAt: now() });
      const uRef = doc(db, 'users', userName);
      const uSnap = await tx.get(uRef);
      if (!uSnap.exists()) {
        tx.set(uRef, { username: userName, balance: 0.015 }, { merge:true });
      } else {
        const cur = uSnap.data().balance || 0;
        tx.update(uRef, { balance: cur + 0.015 });
      }
    });
    cdSet(`cd_bonus_${id}`);
    document.getElementById(`clm-b${id}`).style.display = 'none';
    alert('Вы получили 0.015 Peso');
  } catch (e) {
    if (e === 'NOT_COMPLETE') alert('Сначала посмотрите последовательность из 3 реклам');
    else if (e === 'ALREADY') alert('Уже получено');
    else { console.error(e); alert('Ошибка начисления'); }
  }
};

// ================== Withdrawals: deduct and create receipt ==================
window.requestWd = async () => {
  const amt = parseFloat(document.getElementById('wd-amt').value);
  const gcash = document.getElementById('wd-gcash').value.trim();
  if (!gcash) return alert('Введите GCash номер');
  if (!amt || amt < 0.02) return alert('Минимум 0.02');
  try {
    // atomic: check user balance and create withdrawal and decrement balance using transaction
    const wId = `${userName}_${now()}`;
    const wRef = doc(db, 'withdrawals', wId);
    const userRef = doc(db, 'users', userName);
    await runTransaction(db, async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw 'NO_USER';
      const cur = uSnap.data().balance || 0;
      if (cur < amt) throw 'INSUF';
      // decrement balance
      tx.update(userRef, { balance: cur - amt });
      // create withdrawal with receipt
      tx.set(wRef, {
        uid: userName, u: userName, amount: amt, gcash: gcash,
        status: 'pending', date: serverTimestamp(),
        receipt: { id: wId, createdAt: serverTimestamp(), deductedFrom: cur, after: cur - amt }
      });
    });
    alert('Запрос на вывод создан и баланс уменьшен. Ожидайте подтверждения владельца.');
  } catch (e) {
    if (e === 'INSUF') alert('Недостаточно средств');
    else console.error(e), alert('Ошибка создания запроса');
  }
};

// Live subscribe user withdrawal history
let unsubUserWd = null;
function initUserWdHistory() {
  if (unsubUserWd) unsubUserWd();
  const q = query(collection(db, 'withdrawals'), where('uid', '==', userName), orderBy('date', 'desc'), limit(25));
  unsubUserWd = onSnapshot(q, snap => {
    const rows = snap.docs.map(d => {
      const w = d.data();
      const date = w.date ? new Date(w.date.toMillis()).toLocaleString() : '';
      const cls = w.status === 'approved' ? 'status-approved' : (w.status === 'denied' ? 'status-denied' : 'status-pending');
      return `<tr><td>${date}</td><td>${escapeHtml(w.gcash)}</td><td>${w.amount}</td><td><span class="status ${cls}">${w.status}</span></td></tr>`;
    });
    document.getElementById('user-wd-body').innerHTML = rows.join('') || '<tr><td colspan="4">Нет записей</td></tr>';
  });
}

// ================== Owner Dashboard ==================
let ownerUnsub = null;
let adminPageCursor = null;
const ADMIN_PAGE_SIZE = 25;
let adminSnapshots = [];
function loginOwner() {
  const pw = document.getElementById('owner-pass').value;
  if (pw !== 'Propetas12') return alert('Access Denied');
  document.getElementById('owner-login').style.display = 'none';
  document.getElementById('owner-panel').style.display = 'block';
  loadAdminPage();
}

async function loadAdminPage(cursor=null) {
  // cursor: last visible doc for paging
  const wRef = collection(db, 'withdrawals');
  let q;
  if (!cursor) q = query(wRef, orderBy('date', 'desc'), limit(ADMIN_PAGE_SIZE));
  else q = query(wRef, orderBy('date', 'desc'), startAfter(cursor), limit(ADMIN_PAGE_SIZE));
  // snapshot for this page (live)
  if (ownerUnsub) ownerUnsub();
  ownerUnsub = onSnapshot(q, snap => {
    adminSnapshots = snap.docs;
    adminPageCursor = snap.docs[snap.docs.length - 1] || adminPageCursor;
    const rows = snap.docs.map(d => {
      const w = d.data();
      const receipt = w.receipt ? w.receipt.id || '—' : '—';
      let actionHTML = '';
      if (w.status === 'pending') {
        actionHTML = `<button onclick="adminSetStatus('${d.id}','approved')" style="background:green;color:#fff;padding:6px;border-radius:6px;border:0">Approve</button>
                      <button onclick="adminSetStatus('${d.id}','denied')" style="background:red;color:#fff;padding:6px;border-radius:6px;border:0;margin-left:6px">Deny</button>`;
      } else actionHTML = `<span>${w.status}</span>`;
      return `<tr><td>${w.u}</td><td>${escapeHtml(w.gcash)}</td><td>${w.amount}</td><td>${receipt}</td><td>${actionHTML}</td></tr>`;
    });
    document.getElementById('admin-wd-body').innerHTML = rows.join('') || '<tr><td colspan="5">Нет запросов</td></tr>';
    // compute total approved (simple: sum over page snapshot for demo; could compute across collection)
    const totalApproved = snap.docs.reduce((s,d)=> s + ((d.data().status==='approved')? (d.data().amount||0):0), 0);
    document.getElementById('admin-total-paid').innerText = totalApproved.toFixed(2);
  });
}
window.adminNext = () => {
  if (adminPageCursor) loadAdminPage(adminPageCursor);
};
window.adminPrev = () => {
  // Simple: reload first page (prev navigation more involved and needs cursors stack)
  loadAdminPage(null);
};

window.adminSetStatus = async (id, status) => {
  try {
    const wRef = doc(db, 'withdrawals', id);
    await updateDoc(wRef, { status });
    alert('Статус обновлён');
  } catch (e) { console.error(e); alert('Ошибка обновления'); }
};

// ================== Leaderboard (top 500) ==================
let unsubLead = null;
function initLeaderboard() {
  if (unsubLead) unsubLead();
  const q = query(collection(db, 'users'), orderBy('balance', 'desc'), limit(500));
  unsubLead = onSnapshot(q, snap => {
    const rows = snap.docs.map((d,i) => {
      const u = d.data();
      return `<tr><td>${i+1}</td><td>${u.username}</td><td>${(u.balance||0).toFixed(2)}</td></tr>`;
    });
    document.getElementById('lead-body').innerHTML = rows.join('') || '<tr><td colspan="3">Нет данных</td></tr>';
  });
}

// ================== Help section (links clickable) ==================
let unsubHelp = null;
function initHelp() {
  if (unsubHelp) unsubHelp();
  const q = query(collection(db, 'help'), orderBy('order', 'asc'));
  unsubHelp = onSnapshot(q, snap => {
    const html = snap.docs.map(d => {
      const h = d.data();
      const linkHtml = h.link ? `<div><a href="#" onclick="openHelpLink('${encodeURIComponent(h.link)}')">${h.linkLabel || h.link}</a></div>` : '';
      return `<div class="card"><div style="font-weight:700">${escapeHtml(h.title)}</div><div>${escapeHtml(h.content)}</div>${linkHtml}</div>`;
    }).join('');
    document.getElementById('help-content').innerHTML = html || '<div class="card">Нет справки</div>';
  });
}
window.openHelpLink = (enc) => {
  const url = decodeURIComponent(enc);
  window.open(url, '_blank');
};

// ================== Referral ==================
window.setReferrer = async () => {
  const code = document.getElementById('ref-input').value.trim();
  if (!code) return alert('Введите код');
  if (code === userName) return alert('Нельзя ввести свой код');
  try {
    const uRef = doc(db, 'users', userName);
    const snap = await getDoc(uRef);
    const data = snap.exists() ? snap.data() : {};
    if (data.referredBy) return alert('Уже привязан реферал');
    await updateDoc(uRef, { referredBy: code });
    // optionally give small instant bonus
    await runTransactionReward(userName, 0.005, `ref_link_${now()}`);
    alert('Реферальный код привязан');
  } catch (e) { console.error(e); alert('Ошибка'); }
};

window.claimRefBonus = async () => {
  try {
    const uRef = doc(db, 'users', userName);
    await runTransaction(db, async (tx) => {
      const uSnap = await tx.get(uRef);
      const bonus = (uSnap.exists() ? (uSnap.data().refBonus || 0) : 0);
      if (!bonus || bonus <= 0) throw 'NO_BONUS';
      const cur = (uSnap.data().balance || 0);
      tx.update(uRef, { balance: cur + bonus, refBonus: 0 });
    });
    alert('Бонус добавлен на баланс');
  } catch (e) {
    if (e === 'NO_BONUS') alert('Нет бонуса');
    else { console.error(e); alert('Ошибка'); }
  }
};

// ================== Sync user doc to UI ==================
let unsubUser = null;
function syncUserDoc() {
  if (unsubUser) unsubUser();
  const uRef = doc(db, 'users', userName);
  unsubUser = onSnapshot(uRef, snap => {
    if (!snap.exists()) {
      setDoc(uRef, { username: userName, balance: 0, refBonus: 0, lastSeen: now() }, { merge:true });
      return;
    }
    myData = snap.data();
    document.getElementById('st-bal').innerText = `💰 ${(myData.balance||0).toFixed(3)} Peso`;
    document.getElementById('ref-my-code').innerText = myData.username || userName;
    document.getElementById('ref-bonus-val').innerText = (myData.refBonus || 0).toFixed(3);
  });
}
syncUserDoc();

// ================== User withdrawal history already implemented above via initUserWdHistory()

// ================== Utilities ==================
function escapeHtml(s) {
  return s.toString().replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// ================== Init default view ==================
navChat('elem');
initLeaderboard();
initHelp();
initUserWdHistory();

// Optional: expose functions globally for buttons
window.triggerGift = window.triggerGift;
window.claimGift = window.claimGift;
window.startBonus = window.startBonus;
window.claimBonus = window.claimBonus;
window.requestWd = window.requestWd;
window.setReferrer = window.setReferrer;
window.claimRefBonus = window.claimRefBonus;
window.loginOwner = loginOwner;
window.adminSetStatus = window.adminSetStatus;
