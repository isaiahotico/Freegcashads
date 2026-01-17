import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, get, set, update,
  push, onValue, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ================= TELEGRAM ================= */
const tg = window.Telegram.WebApp;
tg.ready();

const user = tg.initDataUnsafe?.user || { id: "guest", first_name: "Guest" };
const uid = String(user.id);
const username = "@" + (user.username || user.first_name);

document.getElementById("userBar").innerText = "👤 " + username;

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.appspot.com",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ================= ELEMENTS ================= */
const page_ads = document.getElementById("page-ads");
const page_signin = document.getElementById("page-signin");
const page_gift = document.getElementById("page-gift");
const page_withdraw = document.getElementById("page-withdraw");

/* ================= USER ================= */
const userRef = ref(db, "users/" + uid);

get(userRef).then(s => {
  if (!s.exists()) {
    set(userRef, { username, balance: 0, created: Date.now() });
  }
});

onValue(userRef, s => {
  if (s.exists()) {
    document.getElementById("balanceBar").innerText =
      "💰 Balance: ₱" + s.val().balance.toFixed(2);
  }
});

/* ================= NAV ================= */
window.openPage = page => {
  document.querySelectorAll("[id^='page-']").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-" + page).classList.remove("hidden");
  renderPage(page);
};

/* ================= REWARD ================= */
async function reward(amount, key, cooldown) {
  const cdRef = ref(db, "cooldowns/" + uid + "/" + key);
  const now = Date.now();
  const cd = await get(cdRef);

  if (cd.exists() && now < cd.val()) {
    alert("⏳ Cooldown active");
    return;
  }

  await runTransaction(userRef, u => {
    if (!u) return u;
    u.balance += amount;
    return u;
  });

  await set(cdRef, now + cooldown);
  alert("🎉 Congratulations! You earned ₱" + amount.toFixed(2));
}

/* ================= ADS HANDLER ================= */
window.playAd = (zone, amount, key, cooldown) => {
  try {
    window["show_" + zone](); // show ad
    setTimeout(() => reward(amount, key, cooldown), 5000); // reward after 5s
  } catch (e) {
    alert("Ad not ready");
  }
};

/* ================= RENDER ================= */
function renderPage(p) {

  if (p === "ads") {
    page_ads.innerHTML = `
      <h3>🍍 ADS AREA</h3>
      <button onclick="playAd('10276123',0.02,'a1',300000)">Task 1</button>
      <button onclick="playAd('10337795',0.02,'a2',300000)">Task 2</button>
      <button onclick="playAd('10337853',0.02,'a3',300000)">Task 3</button>
    `;
  }

  if (p === "signin") {
    page_signin.innerHTML = `
      <h3>🍍 SIGN IN</h3>
      <button onclick="playAd('10276123',0.025,'s1',10800000)">Sign Task 1</button>
      <button onclick="playAd('10337795',0.025,'s2',10800000)">Sign Task 2</button>
      <button onclick="playAd('10337853',0.025,'s3',10800000)">Sign Task 3</button>
    `;
  }

  if (p === "gift") {
    page_gift.innerHTML = `
      <h3>🎁 GIFTS</h3>
      <button onclick="playAd('10276123',0.02,'g1',1200000)">Gift 1</button>
      <button onclick="playAd('10337795',0.02,'g2',1200000)">Gift 2</button>
      <button onclick="playAd('10337853',0.02,'g3',1200000)">Gift 3</button>
    `;
  }

  if (p === "withdraw") {
    page_withdraw.innerHTML = `
      <h3>Withdraw</h3>
      <input id="gcash" placeholder="GCash Number">
      <button onclick="withdraw()">Withdraw</button>
      <div id="userHistory"></div>
      <div id="userPager"></div>
    `;
    loadUserWithdrawals(1);
  }
}

/* ================= WITHDRAW ================= */
window.withdraw = async () => {
  const snap = await get(userRef);
  const bal = snap.val().balance;
  if (bal <= 0) return alert("No balance");

  const id = push(ref(db, "withdrawals")).key;
  set(ref(db, "withdrawals/" + id), {
    uid,
    username,
    amount: bal,
    status: "pending",
    time: Date.now()
  });

  update(userRef, { balance: 0 });
};

/* ================= USER HISTORY ================= */
window.loadUserWithdrawals = page => {
  const pageSize = 10;
  onValue(ref(db, "withdrawals"), snap => {
    let list = [];
    snap.forEach(c => c.val().uid === uid && list.push(c.val()));
    list.sort((a,b)=>b.time-a.time);

    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    const slice = list.slice((page-1)*pageSize, page*pageSize);

    userHistory.innerHTML = slice.map(w =>
      `<div>₱${w.amount.toFixed(2)} - ${w.status}</div>`
    ).join("") || "<i>No withdrawals</i>";

    userPager.innerHTML = `
      <button ${page<=1?"disabled":""} onclick="loadUserWithdrawals(${page-1})">Prev</button>
      ${page}/${pages}
      <button ${page>=pages?"disabled":""} onclick="loadUserWithdrawals(${page+1})">Next</button>
    `;
  });
};
