import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, get, set, update,
  push, onValue, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ================= TELEGRAM ================= */
const tg = window.Telegram.WebApp;
tg.ready();

const user = tg.initDataUnsafe.user;
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

const userRef = ref(db, "users/" + uid);

/* ================= INIT USER ================= */
get(userRef).then(snap => {
  if (!snap.exists()) {
    set(userRef, {
      username,
      balance: 0,
      created: Date.now()
    });
  }
});

onValue(userRef, snap => {
  if (snap.exists()) {
    document.getElementById("balanceBar").innerText =
      "💰 Balance: ₱" + snap.val().balance.toFixed(2);
  }
});

/* ================= NAV ================= */
window.openPage = page => {
  document.querySelectorAll("[id^='page-']").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-" + page).classList.remove("hidden");
  renderPage(page);
};

/* ================= REWARD ================= */
async function reward(amount, key, cooldownMs) {
  const now = Date.now();
  const cdRef = ref(db, "cooldowns/" + uid + "/" + key);
  const cdSnap = await get(cdRef);

  if (cdSnap.exists() && now < cdSnap.val()) {
    alert("⏳ Cooldown active");
    return;
  }

  await runTransaction(userRef, u => {
    if (!u) return u;
    u.balance += amount;
    return u;
  });

  await set(cdRef, now + cooldownMs);
  alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
}

/* ================= TASK UI ================= */
function task(title, showFn, amount, cd, key) {
  return `
    <div class="card">
      <b>${title}</b>
      <button onclick="${showFn}.then(()=>reward(${amount},'${key}',${cd}))">
        Watch Ad
      </button>
    </div>
  `;
}

/* ================= RENDER ================= */
function renderPage(p) {

  if (p === "ads") {
    page_ads.innerHTML =
      "<h3>🍍 ADS AREA 🍍</h3>" +
      task("🤑 Task #1", "show_10276123()", 0.02, 300000, "a1") +
      task("🤑 Task #2", "show_10337795()", 0.02, 300000, "a2") +
      task("🤑 Task #3", "show_10337853()", 0.02, 300000, "a3");
  }

  if (p === "signin") {
    page_signin.innerHTML =
      "<h3>🍍 Sign In Tasks</h3>" +
      task("🍍 Task #1", "show_10276123()", 0.025, 10800000, "s1") +
      task("🍍 Task #2", "show_10337795()", 0.025, 10800000, "s2") +
      task("🍍 Task #3", "show_10337853()", 0.025, 10800000, "s3");
  }

  if (p === "gift") {
    page_gift.innerHTML =
      "<h3>🍍 Gifts</h3>" +
      task("🎁 Gift #1", "show_10276123('pop')", 0.02, 1200000, "g1") +
      task("🎁 Gift #2", "show_10337795('pop')", 0.02, 1200000, "g2") +
      task("🎁 Gift #3", "show_10337853('pop')", 0.02, 1200000, "g3");
  }

  if (p === "withdraw") {
    page_withdraw.innerHTML = `
      <h3>Withdraw your Money here</h3>
      <input id="gcash" placeholder="GCash Number">
      <button onclick="withdraw()">Withdraw</button>
      <h4>📜 Your Withdrawal History</h4>
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

/* ================= USER HISTORY (PAGINATION) ================= */
window.loadUserWithdrawals = page => {
  const pageSize = 10;

  onValue(ref(db, "withdrawals"), snap => {
    let list = [];
    snap.forEach(c => {
      if (c.val().uid === uid) list.push(c.val());
    });

    list.sort((a, b) => b.time - a.time);

    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    page = Math.min(Math.max(page, 1), totalPages);

    const start = (page - 1) * pageSize;
    const items = list.slice(start, start + pageSize);

    let html = "";
    items.forEach(d => {
      html += `<div class="card">₱${d.amount.toFixed(2)}<br>Status: <b>${d.status}</b></div>`;
    });

    userHistory.innerHTML = html || "<i>No withdrawals yet</i>";
    userPager.innerHTML = `
      <button ${page <= 1 ? "disabled" : ""} onclick="loadUserWithdrawals(${page - 1})">⬅ Prev</button>
      Page ${page} / ${totalPages}
      <button ${page >= totalPages ? "disabled" : ""} onclick="loadUserWithdrawals(${page + 1})">Next ➡</button>
    `;
  });
};
