/* ================= FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();

const tgUser = tg?.initDataUnsafe?.user;
const telegramId = tgUser?.id?.toString() || "guest";

const username = tgUser
  ? `@${tgUser.username || tgUser.first_name}`
  : "Guest";

document.getElementById("userBar").innerText = "👤 " + username;

/* ================= USER INIT (SAFE) ================= */
const userRef = doc(db, "users", telegramId);

async function initUser() {
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      balance: 50000,
      createdAt: serverTimestamp()
    });
  }
}
initUser();

/* ================= BALANCE LISTENER (NaN PROOF) ================= */
onSnapshot(userRef, (snap) => {
  if (!snap.exists()) return;

  let bal = Number(snap.data().balance);
  if (isNaN(bal)) bal = 0;

  document.getElementById("balance").innerText =
    "₱" + bal.toLocaleString();
});

/* ================= WITHDRAW REQUEST ================= */
document.getElementById("withdrawBtn").onclick = async () => {
  const amount = Number(document.getElementById("amount").value);
  const gcash = document.getElementById("gcash").value.trim();

  if (!gcash || amount <= 0) {
    alert("Invalid input");
    return;
  }

  await addDoc(collection(db, "withdrawals"), {
    telegramId,
    username,
    amount,
    gcash,
    status: "pending",
    createdAt: serverTimestamp()
  });

  alert("Withdrawal Requested");
};

/* ================= USER WITHDRAWALS ================= */
onSnapshot(collection(db, "withdrawals"), (snap) => {
  const ul = document.getElementById("userWithdrawals");
  ul.innerHTML = "";

  snap.forEach(d => {
    const w = d.data();
    if (w.telegramId === telegramId) {
      ul.innerHTML += `<li>₱${w.amount} — ${w.status}</li>`;
    }
  });
});

/* ================= ADMIN ACCESS (ONE TIME) ================= */
const adminPanel = document.getElementById("adminPanel");
const adminBtn = document.getElementById("adminBtn");

if (localStorage.getItem("isAdmin") === "true") {
  adminPanel.classList.remove("hidden");
}

adminBtn.onclick = () => {
  if (localStorage.getItem("isAdmin") === "true") return;

  const pass = prompt("Admin Password:");
  if (pass === "Propetas6") {
    localStorage.setItem("isAdmin", "true");
    adminPanel.classList.remove("hidden");
  } else {
    alert("Wrong password");
  }
};

/* ================= ADMIN WITHDRAWALS ================= */
onSnapshot(collection(db, "withdrawals"), (snap) => {
  if (localStorage.getItem("isAdmin") !== "true") return;

  const ul = document.getElementById("adminWithdrawals");
  ul.innerHTML = "";

  snap.forEach(d => {
    const w = d.data();
    if (w.status === "pending") {
      ul.innerHTML += `
        <li>
          ${w.username} - ₱${w.amount}
          <button onclick="approve('${d.id}', ${w.amount}, '${w.telegramId}')">Approve</button>
          <button onclick="reject('${d.id}')">Reject</button>
        </li>
      `;
    }
  });
});

/* ================= ADMIN ACTIONS (SAFE MATH) ================= */
window.approve = async (id, amount, uid) => {
  const uRef = doc(db, "users", uid);
  const wRef = doc(db, "withdrawals", id);

  const snap = await getDoc(uRef);
  if (!snap.exists()) return;

  let bal = Number(snap.data().balance);
  if (isNaN(bal)) bal = 0;

  if (bal < amount) {
    alert("Insufficient balance");
    return;
  }

  await updateDoc(uRef, { balance: bal - amount });
  await updateDoc(wRef, { status: "approved" });
};

window.reject = async (id) => {
  await updateDoc(doc(db, "withdrawals", id), { status: "rejected" });
};
