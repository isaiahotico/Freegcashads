
// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- TELEGRAM INIT ---
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*1000);
document.getElementById("userBar").innerText = "👤 " + username;

// --- APP STATE ---
let myBalance = 0;
let lastSent = localStorage.getItem('lastSent') || 0;

// Initialize User
async function syncUser() {
    const userRef = db.collection('users').doc(username);
    const doc = await userRef.get();
    if (!doc.exists()) {
        await userRef.set({ balance: 0 });
    } else {
        myBalance = doc.data().balance;
    }
    updateUI();
}
syncUser();

// --- THEME ENGINE (Aide Text) ---
const colors = ["pink", "green", "blue", "red", "violet", "yellow", "yellowgreen", "orange", "white", "cyan", "brown", "bricks"];
document.getElementById('aide-text').onclick = () => {
    const body = document.getElementById('mainBody');
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    body.className = ""; // Reset
    body.style.backgroundColor = "";
    body.style.color = "white";

    if (randomColor === "bricks") {
        body.classList.add('bricks');
    } else {
        body.style.backgroundColor = randomColor;
        if (["white", "yellow", "cyan", "yellowgreen"].includes(randomColor)) {
            body.style.color = "black";
        }
    }
};

// --- CHAT SYSTEM ---
async function processMessage() {
    const text = document.getElementById('chatInput').value;
    const now = Date.now();

    if (!text) return alert("Enter a message");
    if (now - lastSent < 180000) return alert("Cooldown: 3 minutes");

    try {
        // Sequentially show 3 Interstitial Ads
        alert("Preparing Ads (1/3)...");
        await show_10337853();
        alert("Preparing Ads (2/3)...");
        await show_10337795();
        alert("Preparing Ads (3/3)...");
        await show_10276123();

        // Successful Ad Completion
        myBalance += 0.015;
        lastSent = now;
        localStorage.setItem('lastSent', now);

        await db.collection('users').doc(username).update({ balance: myBalance });
        await db.collection('messages').add({
            user: username,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('chatInput').value = "";
        updateUI();
    } catch (err) {
        alert("Ad failed. Watch all ads to send message.");
    }
}

// Global Sync Listener for Chat
db.collection('messages').orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
    const display = document.getElementById('chat-display');
    display.innerHTML = "";
    snap.forEach(doc => {
        const m = doc.data();
        display.innerHTML += `
            <div class="msg">
                <b>${m.user}</b>
                <span>${m.text}</span>
            </div>`;
    });
});

// --- WITHDRAWAL SYSTEM ---
async function submitWithdrawal() {
    const name = document.getElementById('gcName').value;
    const num = document.getElementById('gcNum').value;
    const amt = parseFloat(document.getElementById('wdAmount').value);

    if (amt > myBalance || amt <= 0) return alert("Insufficient balance");
    if (!name || !num) return alert("Fill all fields");

    await db.collection('withdrawals').add({
        username: username,
        gcashName: name,
        gcashNum: num,
        amount: amt,
        status: "pending",
        date: firebase.firestore.FieldValue.serverTimestamp()
    });

    myBalance -= amt;
    await db.collection('users').doc(username).update({ balance: myBalance });
    alert("Withdrawal Request Sent!");
    updateUI();
}

// User Withdrawal Table Sync
db.collection('withdrawals').where('username', '==', username).onSnapshot(snap => {
    const tbody = document.getElementById('user-wd-list');
    tbody.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        tbody.innerHTML += `<tr><td>${new Date(d.date?.seconds*1000).toLocaleDateString()}</td><td>₱${d.amount}</td><td class="status-${d.status}">${d.status}</td></tr>`;
    });
});

// --- OWNER DASHBOARD ---
function openAdmin() {
    const pass = prompt("Enter Admin Password:");
    if (pass === "Propetas6") {
        openPage('admin-page');
        syncAdminTable();
    } else {
        alert("Access Denied");
    }
}

function syncAdminTable() {
    db.collection('withdrawals').where('status', '==', 'pending').onSnapshot(snap => {
        const tbody = document.getElementById('admin-wd-list');
        tbody.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            tbody.innerHTML += `
                <tr>
                    <td>${d.username}</td>
                    <td>${d.gcashName}<br>${d.gcashNum}</td>
                    <td>₱${d.amount}</td>
                    <td><button onclick="approveWD('${doc.id}')" style="background:#00ff00; border:none; border-radius:4px;">Approve</button></td>
                </tr>`;
        });
    });
}

async function approveWD(id) {
    if(confirm("Mark as Paid?")) {
        await db.collection('withdrawals').doc(id).update({ status: 'approved' });
    }
}

// --- UTILS ---
function openPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active-page');
}

function updateUI() {
    document.getElementById('bal-val').innerText = myBalance.toFixed(3);
}

setInterval(() => {
    document.getElementById('live-clock').innerText = new Date().toLocaleString();
}, 1000);
