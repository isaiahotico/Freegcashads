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
  projectId: "freegcash-ads",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();

const tgUser = tg?.initDataUnsafe?.user;

const telegramId = tgUser?.id || "guest";
const username = tgUser
  ? `@${tgUser.username || tgUser.first_name}`
  : "Guest";

document.getElementById("userBar").innerText = "👤 User: " + username;

/* ================= USER INIT ================= */
const userRef = doc(db, "users", String(telegramId));

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

/* ================= BALANCE LISTENER ================= */
onSnapshot(userRef, (snap) => {
  if (snap.exists()) {
    document.getElementById("balance").innerText =
      "₱" + snap.data().balance.toLocaleString();
  }
});

/* ================= WITHDRAW REQUEST ================= */
document.getElementById("withdrawBtn").onclick = async () => {
  const amount = Number(document.getElementById("amount").value);
  const gcash = document.getElementById("gcash").value;

  if (!amount || !gcash) return alert("Fill all fields");

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

  snap.forEach(docu => {
    const w = docu.data();
    if (w.telegramId === telegramId) {
      ul.innerHTML += `<li>${w.amount} - ${w.status}</li>`;
    }
  });
});

/* ================= ADMIN ACCESS (ONE TIME ONLY) ================= */
const adminPanel = document.getElementById("adminPanel");
const adminBtn = document.getElementById("adminBtn");

function enableAdmin() {
  localStorage.setItem("isAdmin", "true");
  adminPanel.classList.remove("hidden");
}

if (localStorage.getItem("isAdmin") === "true") {
  adminPanel.classList.remove("hidden");
}

adminBtn.onclick = () => {
  if (localStorage.getItem("isAdmin") === "true") return;

  const pass = prompt("Admin Password:");
  if (pass === "Propetas6") {
    enableAdmin();
  } else {
    alert("Wrong password");
  }
};

/* ================= ADMIN WITHDRAWALS ================= */
onSnapshot(collection(db, "withdrawals"), (snap) => {
  if (localStorage.getItem("isAdmin") !== "true") return;

  const ul = document.getElementById("adminWithdrawals");
  ul.innerHTML = "";

  snap.forEach(docu => {
    const w = docu.data();
    if (w.status === "pending") {
      ul.innerHTML += `
        <li>
          ${w.username} - ₱${w.amount}
          <button onclick="approve('${docu.id}', ${w.amount}, '${w.telegramId}')">Approve</button>
          <button onclick="reject('${docu.id}')">Reject</button>
        </li>
      `;
    }
  });
});

/* ================= ADMIN ACTIONS ================= */
window.approve = async (id, amount, uid) => {
  const wRef = doc(db, "withdrawals", id);
  const uRef = doc(db, "users", uid);

  const uSnap = await getDoc(uRef);
  if (!uSnap.exists()) return;

  const newBal = uSnap.data().balance - amount;
  if (newBal < 0) return alert("Insufficient balance");

  await updateDoc(uRef, { balance: newBal });
  await updateDoc(wRef, { status: "approved" });
};

window.reject = async (id) => {
  await updateDoc(doc(db, "withdrawals", id), { status: "rejected" });
};
