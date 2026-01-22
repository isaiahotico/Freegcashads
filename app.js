import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------------- FIREBASE ---------------- */

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------- TELEGRAM ---------------- */

Telegram.WebApp.ready();
Telegram.WebApp.expand();

const tgUser = Telegram.WebApp.initDataUnsafe?.user;
const uid = tgUser?.id?.toString();

/* ---------------- UI ---------------- */

const balanceEl = document.getElementById("balance");
const usernameEl = document.getElementById("tgUsername");

/* ---------------- SHOW USERNAME LIVE ---------------- */

if (tgUser) {
  const displayName =
    tgUser.username ||
    `${tgUser.first_name || ""} ${tgUser.last_name || ""}`.trim();

  usernameEl.innerText = displayName || "Telegram User";
} else {
  usernameEl.innerText = "Unknown";
}

/* ---------------- USER INIT ---------------- */

async function initUser() {
  if (!uid) return;

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      username: tgUser?.username || null,
      first_name: tgUser?.first_name || "",
      last_name: tgUser?.last_name || "",
      balance: 0,
      createdAt: Date.now()
    });
    balanceEl.innerText = "0";
  } else {
    balanceEl.innerText = snap.data().balance ?? 0;
  }
}

initUser();

/* ---------------- ADSGRAM ---------------- */

const AdsGram = window.AdsGram || window.SAD;

let lastRewardTime = 0;
const REWARD_COOLDOWN = 60000; // 1 minute

/* ---------------- REWARD ADS ---------------- */

window.watchReward = async (blockId) => {
  if (!uid) return;

  if (Date.now() - lastRewardTime < REWARD_COOLDOWN) {
    Telegram.WebApp.showAlert("⏳ Please wait before watching another reward ad");
    return;
  }

  const ad = new AdsGram({ blockId });

  try {
    await ad.show();
    lastRewardTime = Date.now();

    const ref = doc(db, "users", uid);
    await updateDoc(ref, {
      balance: increment(1),
      updatedAt: Date.now()
    });

    const snap = await getDoc(ref);
    balanceEl.innerText = snap.data().balance;

    Telegram.WebApp.showAlert("✅ +1 coin added!");
  } catch (e) {
    Telegram.WebApp.showAlert("❌ Ad not completed");
  }
};

/* ---------------- INTERSTITIAL ADS ---------------- */

window.watchInterstitial = (blockId) => {
  const ad = new AdsGram({ blockId });
  ad.show();
};
