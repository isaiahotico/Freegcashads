
// app.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, limit, where,
  onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ============ Firebase config ============ */
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

/* ============ Environment & user identity ============ */
// If Telegram WebApp is present, prefer tg initData user; otherwise fallback
const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user;
const myUsername = tgUser ? (tgUser.username || tgUser.first_name) : ("Guest" + Math.floor(Math.random()*9999));

/* ============ App state ============ */
let myData = {};           // local snapshot of user's doc
let currentRoom = 'elementary';
let ownerPage = 1;
const OWNER_PAGE_SIZE = 25;

/* ============ Monetag ad functions mapping ============ */
// Monetag SDK creates global functions show_10337853, show_10337795, show_10276123
// We create wrappers that return promises to allow .then(...) chaining
function adPromise(fnName) {
  return new Promise((resolve, reject) => {
    try {
      const fn = window[fnName];
      if (typeof fn !== 'function') {
        // Monetag function missing — reject so callers can handle gracefully
        reject(new Error(`${fnName} not available`));
        return;
      }
      // Many Monetag SDKs return a promise or call directly; try-call and chain .then if it returns
      const res = fn();
      if (res && typeof res.then === 'function') {
        res.then(resolve).catch(reject);
      } else {
        // If function doesn't return a promise, assume it succeeded
        resolve();
      }
    } catch (err) {
      reject(err);
    }
  });
}

const AD = {
  BONUS: () => adPromise('show_10337853'),
  REWARDED_2: () => adPromise('show_10337795'),
  REWARDED_1: () => adPromise('show_10276123'),
};

/* ============ UI helpers ============ */
function $(id){ return document.getElementById(id); }
function navTo(id){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = $(id);
  if (el) el.classList.add('active');
  // trigger page-specific syncs
  if (id === 'page-owner') syncOwnerData();
  if (id === 'page-withdraw') syncUserWithdrawals();
  if (id === 'page-gift') updateGiftTimers();
  if (id === 'page-bonus') updateBonusTimer();
}

/* ============ Owner auth overlay ============ */
window.openOwnerAuth = () => { $('owner-auth').classList.remove('hidden'); $('owner-pass').value=''; };
window.closeOwnerAuth = () => { $('owner-auth').classList.add('hidden'); };
window.submitOwnerAuth = () => {
  const pass = $('owner-pass').value;
  if (pass === 'Propetas12') {
    closeOwnerAuth();
    navTo('page-owner');
    syncOwnerData();
  } else {
    alert('Wrong password');
  }
};

/* ============ Owner Dashboard ============ */
function syncOwnerData(){
  const q = query(collection(db, 'withdrawals'), orderBy('timestamp', 'desc'));
  onSnapshot(q, snap => {
    const docs = snap.docs || [];
    const start = (ownerPage - 1) * OWNER_PAGE_SIZE;
    const pageDocs = docs.slice(start, start + OWNER_PAGE_SIZE);
    const rows = pageDocs.map(d => {
      const w = d.data();
      const acc = w.accountInfo || '-';
      const time = w.timestamp ? new Date(w.timestamp.seconds * 1000).toLocaleString() : '-';
      return `<tr>
        <td>${escapeHtml(w.username)}</td>
        <td>${escapeHtml(acc)}</td>
        <td>₱${(w.amount||0).toFixed(2)}</td>
        <td class="status-${escapeHtml(w.status||'Pending')}">${escapeHtml(w.status||'Pending')}</td>
        <td>${(w.status === 'Pending') ? `<button class="btn" onclick="approveWithdrawal('${d.id}')">Approve</button>` : 'Done'}</td>
      </tr>`;
    }).join('');
    $('owner-list').innerHTML = rows || '<tr><td colspan="5" class="muted">No withdrawals</td></tr>';
    $('owner-page-num').innerText = ownerPage;
  });
}
window.changeOwnerPage = (delta) => { ownerPage = Math.max(1, ownerPage + delta); syncOwnerData(); };
window.approveWithdrawal = async (id) => {
  try {
    await updateDoc(doc(db, 'withdrawals', id), { status: 'Approved' });
    alert('Withdrawal approved');
  } catch (err) {
    console.error(err);
    alert('Failed to approve');
  }
};

/* ============ Chat rooms (all accessible) ============ */
window.openChat = (room) => {
  currentRoom = room;
  $('chat-title').innerText = `${room.toUpperCase()} CHAT`;
  navTo('page-chat');
  const q = query(collection(db,'messages'), where('room','==',room), orderBy('timestamp','desc'), limit(100));
  onSnapshot(q, snap => {
    const html = snap.docs.slice().reverse().map(d => {
      const m = d.data();
      const ts = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString() : '';
      return `<div><b>${escapeHtml(m.user)}:</b> ${escapeHtml(m.text)} <span class="small muted"> ${ts}</span></div>`;
    }).join('');
    $('chat-box').innerHTML = html;
    $('chat-box').scrollTop = $('chat-box').scrollHeight;
  });
};

window.sendChat = () => {
  const txt = $('chat-input').value?.trim();
  if (!txt) return;
  // show ad (bonus ad function used here) then reward on success
  AD.BONUS().then(async () => {
    // add message and credit user
    await addDoc(collection(db,'messages'), { user: '@' + myUsername, text: txt, room: currentRoom, timestamp: serverTimestamp() });
    await updateDoc(doc(db,'users',myUsername), { balance: increment(0.015) }).catch(async err=>{
      // If update fails because user doc missing, create
      await setDoc(doc(db,'users',myUsername), { username: myUsername, balance: 0 }, { merge: true });
      await updateDoc(doc(db,'users',myUsername), { balance: increment(0.015) });
    });
    // referral split (10% of 0.015)
    const refBy = myData.referredBy || myData.refBy;
    if (refBy) {
      await updateDoc(doc(db,'users', refBy), { refBonus: increment(0.015 * 0.1) }).catch(()=>{});
    }
    $('chat-input').value = '';
  }).catch(err => {
    console.warn('Ad failed or cancelled', err);
    alert('Please watch the ad to send and earn.');
  });
};

/* ============ Gift ads (individual) ============ */
const GIFT_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
async function watchGiftHandler(adFn, amount, giftKey) {
  const now = Date.now();
  const cooldown = myData[giftKey] || 0;
  if (now < cooldown) {
    const rem = Math.ceil((cooldown - now)/1000);
    alert('Cooldown active: ' + formatTime(rem));
    return;
  }
  adFn().then(async () => {
    // reward user after ad
    await updateDoc(doc(db,'users', myUsername), {
      balance: increment(amount),
      [giftKey]: now + GIFT_COOLDOWN_MS
    }).catch(async (err) => {
      // create user doc if missing
      await setDoc(doc(db,'users', myUsername), { username: myUsername, balance: 0 }, { merge: true });
      await updateDoc(doc(db,'users', myUsername), { balance: increment(amount), [giftKey]: now + GIFT_COOLDOWN_MS });
    });
    alert(`₱${amount.toFixed(2)} credited`);
  }).catch(err=>{
    console.warn('Gift ad failed', err);
    alert('Ad interrupted or not available.');
  });
}

window.watchGift = (id) => {
  if (id === 1) return watchGiftHandler(AD.REWARDED_1, 0.01, 'gift1cd');
  if (id === 2) return watchGiftHandler(AD.REWARDED_2, 0.01, 'gift2cd');
};

/* ============ Bonus ads (combined) ============ */
const BONUS_COOLDOWN_MS = 5 * 60 * 1000;
window.watchBonus = () => {
  const now = Date.now();
  const last = myData.lastBonusAd || 0;
  if (now - last < BONUS_COOLDOWN_MS) {
    const rem = Math.ceil((BONUS_COOLDOWN_MS - (now - last))/1000);
    alert('Cooldown active: ' + formatTime(rem));
    return;
  }

  // run three ad promises in sequence, reward after all succeed
  AD.BONUS().then(() => {
    return AD.REWARDED_2();
  }).then(() => {
    return AD.REWARDED_1();
  }).then(async () => {
    await updateDoc(doc(db,'users', myUsername), { balance: increment(0.015), lastBonusAd: now }).catch(async()=>{
      await setDoc(doc(db,'users', myUsername), { username: myUsername, balance: 0 }, { merge: true });
      await updateDoc(doc(db,'users', myUsername), { balance: increment(0.015), lastBonusAd: now });
    });
    // referral split 10%
    const refBy = myData.referredBy || myData.refBy;
    if (refBy) {
      await updateDoc(doc(db,'users', refBy), { refBonus: increment(0.015 * 0.1) }).catch(()=>{});
    }
    alert('₱0.015 credited');
  }).catch(err => {
    console.warn('Combined ads failed or cancelled', err);
    alert('Ad sequence interrupted. Try again.');
  });
};

/* ============ Withdrawals ============ */
window.submitWithdraw = async () => {
  const acc = $('wd-acc').value?.trim();
  if (!acc) { alert('Enter GCash / FaucetPay details'); return; }
  const bal = myData.balance || 0;
  if (bal < 0.02) { alert('Minimum withdrawal is ₱0.02'); return; }

  try {
    await addDoc(collection(db,'withdrawals'), {
      username: myUsername,
      amount: bal,
      accountInfo: acc,
      status: 'Pending',
      timestamp: serverTimestamp()
    });
    // reset balance
    await updateDoc(doc(db,'users', myUsername), { balance: 0 });
    alert('Withdrawal submitted');
  } catch (err) {
    console.error(err);
    alert('Failed to submit withdrawal');
  }
};

function syncUserWithdrawals(){
  const q = query(collection(db,'withdrawals'), where('username','==', myUsername), orderBy('timestamp','desc'));
  onSnapshot(q, snap => {
    const rows = snap.docs.map(d => {
      const w = d.data();
      const time = w.timestamp ? new Date(w.timestamp.seconds * 1000).toLocaleString() : '-';
      return `<tr><td>₱${(w.amount||0).toFixed(2)}</td><td class="status-${escapeHtml(w.status||'Pending')}">${escapeHtml(w.status||'Pending')}</td><td>${time}</td></tr>`;
    }).join('');
    $('user-wd-list').innerHTML = rows || '<tr><td colspan="3" class="muted">No history</td></tr>';
  });
}

/* ============ Referrals ============ */
window.bindRef = async () => {
  const code = $('bind-code').value?.trim();
  if (!code) { alert('Enter referral code'); return; }
  if (code === myUsername) { alert('Cannot use your own code'); return; }

  const refSnap = await getDoc(doc(db, 'users', code));
  if (!refSnap.exists()) { alert('Referral user not found'); return; }

  await updateDoc(doc(db,'users', myUsername), { referredBy: code }).catch(async () => {
    await setDoc(doc(db,'users', myUsername), { username: myUsername, balance: 0, referredBy: code }, { merge: true });
  });
  alert('Referral linked');
};

window.claimRef = async () => {
  const bonus = myData.refBonus || 0;
  if (!bonus || bonus <= 0) { alert('No referral bonus to claim'); return; }
  await updateDoc(doc(db,'users', myUsername), { balance: increment(bonus), refBonus: 0 }).catch(()=>{});
  alert('Referral bonus claimed');
};

/* ============ Leaderboard & online users ============ */
function syncLeaderboard(){
  const q = query(collection(db,'users'), orderBy('balance','desc'), limit(20));
  onSnapshot(q, snap => {
    const html = snap.docs.map((d,i) => {
      const u = d.data();
      return `<tr><td>#${i+1}</td><td>${escapeHtml(d.id)}</td><td>₱${(u.balance||0).toFixed(3)}</td></tr>`;
    }).join('');
    $('leader-list').innerHTML = html || '<tr><td colspan="3" class="muted">No data</td></tr>';
  });
}

function syncOnline(){
  // write presence
  setInterval(()=> {
    setDoc(doc(db,'online', myUsername), { username: myUsername, lastSeen: serverTimestamp() }, { merge: true }).catch(()=>{});
  }, 20000);
  onSnapshot(collection(db,'online'), snap => {
    $('online-count').innerText = snap.size;
    const html = snap.docs.map(d => {
      const o = d.data();
      return `<div>${escapeHtml(o.username || d.id)}</div>`;
    }).join('');
    $('online-list').innerHTML = html;
  });
}

/* ============ Timers & UI updates ============ */
function updateGiftTimers(){
  const now = Date.now();
  for (let i=1;i<=2;i++){
    const key = (i===1 ? 'gift1cd' : 'gift2cd');
    const cd = myData[key] || 0;
    const el = $(`cd-${i}`);
    const btn = $(`btn-g${i}`);
    if (!el || !btn) continue;
    if (now < cd) {
      const rem = Math.ceil((cd - now)/1000);
      el.innerText = formatTime(rem);
      btn.disabled = true;
      btn.classList.remove('neon');
      btn.style.opacity = '0.6';
    } else {
      el.innerText = 'READY';
      btn.disabled = false;
      btn.classList.add('neon');
      btn.style.opacity = '';
    }
  }
}

function updateBonusTimer(){
  const now = Date.now();
  const last = myData.lastBonusAd || 0;
  const rem = BONUS_COOLDOWN_MS - (now - last);
  const el = $('bonus-timer');
  const btn = $('btn-bonus');
  if (rem > 0) {
    el.innerText = 'CD: ' + formatTime(Math.ceil(rem/1000));
    btn.disabled = true;
    btn.style.opacity = '0.6';
  } else {
    el.innerText = 'READY';
    btn.disabled = false;
    btn.style.opacity = '';
  }
}

/* ============ Utilities ============ */
function formatTime(seconds){
  seconds = Number(seconds);
  if (seconds <= 0) return '0s';
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;
  let parts = [];
  if (h>0) parts.push(h+'h');
  if (m>0) parts.push(m+'m');
  parts.push(s+'s');
  return parts.join(' ');
}

function escapeHtml(s){
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============ Initialization ============ */
async function init(){
  // show basic user info
  $('live-user').innerText = '@' + myUsername;
  $('my-code').innerText = myUsername;

  // Ensure user doc exists
  const uDoc = doc(db,'users', myUsername);
  const snap = await getDoc(uDoc);
  if (!snap.exists()) {
    await setDoc(uDoc, {
      username: myUsername,
      balance: 0,
      refBonus: 0,
      lastBonusAd: 0,
      gift1cd: 0,
      gift2cd: 0
    });
  }

  // realtime user sync
  onSnapshot(uDoc, docSnap => {
    if (!docSnap.exists()) return;
    myData = docSnap.data() || {};
    $('live-bal').innerText = '₱' + ((myData.balance || 0).toFixed(3));
    $('ref-bal').innerText = (myData.refBonus || 0).toFixed(3);
    // update cooldown UIs
    updateGiftTimers();
    updateBonusTimer();
  });

  // withdrawals history for user
  syncUserWithdrawals();

  // leaderboard & online
  syncLeaderboard();
  syncOnline();

  // Owner dashboard uses syncOwnerData when navigated/authorized
}
init();

/* Update timers periodically (only update if pages are active) */
setInterval(()=>{
  if ($('page-gift').classList.contains('active')) updateGiftTimers();
  if ($('page-bonus').classList.contains('active')) updateBonusTimer();
}, 1000);

