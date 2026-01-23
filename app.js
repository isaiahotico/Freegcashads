import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, 
    serverTimestamp, where, doc, setDoc, getDoc, updateDoc, increment, startAfter, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= TELEGRAM IDENTITY ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const userNameStr = tgUser ? `@${tgUser.username || tgUser.first_name}` : "@Guest";
const userId = tgUser?.id ? String(tgUser.id) : "guest_user";

// Display Username Immediately
document.getElementById("userBar").innerText = "👤 " + userNameStr;

/* ================= LIVE BALANCE LOGIC ================= */
const balanceEl = document.getElementById("balanceBar");

async function initUser() {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        await setDoc(userRef, { username: userNameStr, balance: 0 });
    }

    // Live Listen to Balance changes
    onSnapshot(userRef, (doc) => {
        const data = doc.data();
        balanceEl.innerText = `💰 ${data?.balance || 0}`;
    });
}
initUser();

/* ================= CHAT SYSTEM (3 DAYS) ================= */
const chatWindow = document.getElementById("chat-window");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const loadMoreBtn = document.getElementById("loadMore");

let lastVisible = null;
const THREE_DAYS_AGO = new Date(Date.now() - 3 × 24 × 60 × 60 × 1000);

// Send Message
sendBtn.onclick = async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";

    await addDoc(collection(db, "messages"), {
        uid: userId,
        username: userNameStr,
        text: text,
        timestamp: serverTimestamp()
    });
};

// Render Message
function displayMsg(docData, prepend = false) {
    const data = docData.data();    if (!data.timestamp) return;

    const div = document.createElement("div");
    div.className = `msg ${data.uid === userId ? 'me' : ''}`;
    div.innerHTML = `
        <span class="msg-info">${data.username}</span>
        ${data.text}
    `;
    
    if (prepend) chatWindow.prepend(div);
    else {
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

// Live Chat Listener (Newest 20 within 3 days)
const q = query(
    collection(db, "messages"),
    where("timestamp", ">=", THREE_DAYS_AGO),
    orderBy("timestamp", "desc"),
    limit(20)
);

onSnapshot(q, (snapshot) => {
    chatWindow.innerHTML = "";
    const docs = snapshot.docs.reverse();
    docs.forEach(d => displayMsg(d));
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
});

// Pagination
loadMoreBtn.onclick = async () => {
    if (!lastVisible) return;
    const nextQ = query(
        collection(db, "messages"),
        where("timestamp", ">=", THREE_DAYS_AGO),
        orderBy("timestamp", "desc"),
        startAfter(lastVisible),
        limit(10)
    );
    const snap = await getDocs(nextQ);
    snap.docs.forEach(d => displayMsg(d, true));
    lastVisible = snap.docs[snap.docs.length - 1];
};

/* ================= AD REWARD LOGIC ================= */
document.getElementById("watchAd").onclick = async () => {
    tg.showConfirm("Watch ad to get 50 coins?", async (ok) => {
        if (ok) {
            // Simulate Ad delay
            tg.MainButton.setText("SHOWING AD...").show();
            setTimeout(async () => {
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, { balance: increment(50) });
                tg.MainButton.hide();
                tg.showAlert("Success! +50 Coins added.");
            }, 2000);
        }
    });
};
