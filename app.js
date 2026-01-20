<!-- ================= app.js ================= -->
<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection, query, orderBy, limit, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? '@' + (tgUser.username || tgUser.first_name) : 'Guest';
document.getElementById('userBar').innerText = 'User: ' + username;

/* ================= USER INIT ================= */
const userRef = doc(db, 'users', username);
const snap = await getDoc(userRef);
if (!snap.exists()) {
  await setDoc(userRef, { balance: 0, earnings: 0, referrals: 0, createdAt: Date.now() });
}

onSnapshot(userRef, s => {
  document.getElementById('balance').innerText = s.data().balance.toFixed(3);
});

/* ================= NAV ================= */
window.openPage = id => {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById(id).style.display = 'block';
};
openPage('ads');

/* ================= ADS AREA ================= */
const ads = document.getElementById('ads');
ads.innerHTML = `
<h3>ADS AREA</h3>
<button onclick="runAd('a1',0.02,300000)">Task #1</button>
<button id="a1" disabled onclick="claim('a1',0.02)">Claim 0.02</button>`;

/* ================= GIFT AREA ================= */
gift.innerHTML = `
<h3>GIFT AREA</h3>
<button onclick="runAd('g1',0.02,10800000)">Gift #1</button>
<button id="g1" disabled onclick="claim('g1',0.02)">Claim 0.02</button>`;

/* ================= SIGN IN ================= */
signin.innerHTML = `
<h3>SIGN IN</h3>
<button onclick="runAd('s1',0.025,3600000)">Sign Task</button>
<button id="s1" disabled onclick="claim('s1',0.025)">Claim 0.025</button>`;

/* ================= WITHDRAW ================= */
withdraw.innerHTML = `<h3>Withdraw</h3>`;

onSnapshot(query(collection(db, 'withdrawals'), where('user', '==', username), orderBy('createdAt', 'desc'), limit(10)), snap => {
  withdraw.innerHTML = '<h3>Withdraw</h3>';
  snap.forEach(d => {
    const w = d.data();
    withdraw.innerHTML += `<div>${w.method} | ${w.amount} | ${w.status}</div>`;
  });
});

/* ================= REFERRAL ================= */
referral.innerHTML = `<h3>Referral</h3><input id="refUser" placeholder="@username"><button onclick="saveReferral()">Save</button>`;
window.saveReferral = async () => {
  const r = document.getElementById('refUser').value;
  await updateDoc(userRef, { referredBy: r });
};

/* ================= LEADERBOARD ================= */
onSnapshot(query(collection(db, 'users'), orderBy('earnings', 'desc'), limit(20)), snap => {
  leaderboard.innerHTML = '<h3>Leaderboard</h3>';
  snap.forEach((d, i) => leaderboard.innerHTML += `<div>#${i + 1} ${d.id} - ${d.data().earnings}</div>`);
});

/* ================= CHAT ================= */
chat.innerHTML = `<h3>CHAT</h3><input id="msg"><button onclick="sendMsg()">Send</button><div id="msgs"></div>`;
window.sendMsg = async () => {
  const last = localStorage.getItem('chat_cd');
  if (last && Date.now() - last < 240000) return alert('Cooldown');
  localStorage.setItem('chat_cd', Date.now());
  await addDoc(collection(db, 'chat'), { user: username, text: msg.value, createdAt: Date.now() });
  show_10276123();
  await updateDoc(userRef, { balance: snap.data().balance + 0.02, earnings: snap.data().earnings + 0.02 });
};

onSnapshot(query(collection(db, 'chat'), orderBy('createdAt', 'desc'), limit(50)), snap => {
  msgs.innerHTML = '';
  snap.forEach(d => msgs.innerHTML += `<div>${d.data().user}: ${d.data().text}</div>`);
});

/* ================= OWNER ================= */
owner.innerHTML = '<h3>Owner Dashboard</h3>';
const pass = prompt('Owner password');
if (pass === 'Propetas6') {
  onSnapshot(query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'), limit(20)), snap => {
    owner.innerHTML = '<h3>Owner Dashboard</h3>';
    snap.forEach(d => {
      const w = d.data();
      owner.innerHTML += `<div>${w.user} | ${w.amount} | ${w.status}
      <button onclick="approve('${d.id}')">Approve</button>
      <button onclick="deny('${d.id}')">Deny</button></div>`;
    });
  });
}
window.approve = id => updateDoc(doc(db, 'withdrawals', id), { status: 'approved' });
window.deny = id => updateDoc(doc(db, 'withdrawals', id), { status: 'denied' });

/* ================= HELPERS ================= */
window.runAd = (id, amt, cd) => {
  show_10337853();
  document.getElementById(id).disabled = false;
  localStorage.setItem(id + '_cd', Date.now() + cd);
};
window.claim = async (id, amt) => {
  const until = localStorage.getItem(id + '_cd');
  if (until && Date.now() < until) return alert('Cooldown');
  await updateDoc(userRef, { balance: snap.data().balance + amt, earnings: snap.data().earnings + amt });
  alert('🎉 Reward received');
};
</script>
