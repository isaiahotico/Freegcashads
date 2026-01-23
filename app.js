
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, query, orderByChild, limitToLast, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Telegram Init
const tg = window.Telegram?.WebApp;
tg?.ready();
const userId = tg?.initDataUnsafe?.user?.id || "guest_" + Math.floor(Math.random()*1000);
const username = tg?.initDataUnsafe?.user?.username || tg?.initDataUnsafe?.user?.first_name || "Guest";
document.getElementById('userBar').innerText = `👤 ${username}`;

let currentBalance = 0;

/* --- SYNC USER DATA --- */
onValue(ref(db, `users/${userId}`), (snapshot) => {
    const data = snapshot.val();
    currentBalance = data?.balance || 0;
    document.getElementById('mainBalance').innerText = currentBalance.toFixed(3);
    // Ensure user exists in DB for Leaderboard
    if(!data) set(ref(db, `users/${userId}`), { username, balance: 0, lastChat: 0 });
});

/* --- GLOBAL CHAT SYSTEM (3-Day Reset Logic) --- */
const chatRef = ref(db, 'messages');
onValue(query(chatRef, limitToLast(50)), (snapshot) => {
    const box = document.getElementById('chatBox');
    box.innerHTML = "";
    snapshot.forEach(child => {
        const m = child.val();
        const div = document.createElement('div');
        div.className = `msg ${m.uid == userId ? 'msg-own' : ''}`;
        div.innerHTML = `<b>${m.name}</b>: ${m.text}`;
        box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
});

window.sendChatMessage = async function() {
    const text = document.getElementById('chatInput').value;
    const now = Date.now();
    
    // 4 Min Cooldown Check
    const userSnap = await get(ref(db, `users/${userId}/lastChat`));
    if(userSnap.val() && now - userSnap.val() < 240000) {
        alert("Wait 4 minutes to chat again!");
        return;
    }

    if(!text) return;

    try {
        // Must watch 3 ads
        await show_10337853(); await show_10337795(); await show_10276123();
        
        push(chatRef, { uid: userId, name: username, text: text, timestamp: now });
        set(ref(db, `users/${userId}/lastChat`), now);
        set(ref(db, `users/${userId}/balance`), currentBalance + 0.02);
        
        document.getElementById('chatInput').value = "";
        alert("🎉 Message Sent! +₱0.02 Reward");
    } catch(e) { alert("Ad failed. Check connection."); }
};

/* --- LEADERBOARD (Paginated) --- */
onValue(ref(db, 'users'), (snapshot) => {
    const users = [];
    snapshot.forEach(c => { users.push(c.val()); });
    users.sort((a,b) => b.balance - a.balance);
    
    const table = document.querySelector('#leaderTable tbody');
    table.innerHTML = "";
    users.slice(0, 20).forEach((u, i) => {
        table.innerHTML += `<tr><td>${i+1}</td><td>${u.username}</td><td>₱${u.balance.toFixed(2)}</td></tr>`;
    });
});

/* --- WITHDRAWAL SYSTEM --- */
window.requestWithdrawal = function() {
    const name = document.getElementById('wdName').value;
    const num = document.getElementById('wdNumber').value;
    const amt = parseFloat(document.getElementById('wdAmount').value);

    if(amt < 5 || amt > currentBalance) {
        alert("Invalid Amount (Min ₱5)");
        return;
    }

    const wdData = {
        uid: userId,
        username: username,
        accountName: name,
        accountNumber: num,
        amount: amt,
        status: "Pending",
        timestamp: Date.now()
    };

    push(ref(db, 'withdrawals'), wdData);
    set(ref(db, `users/${userId}/balance`), currentBalance - amt);
    alert("Withdrawal Request Sent!");
};

// Show user's own withdrawals
onValue(ref(db, 'withdrawals'), (snapshot) => {
    const myTable = document.querySelector('#myWdTable tbody');
    myTable.innerHTML = "";
    snapshot.forEach(c => {
        const d = c.val();
        if(d.uid === userId) {
            myTable.innerHTML += `<tr><td>${new Date(d.timestamp).toLocaleDateString()}</td><td>₱${d.amount}</td><td>${d.status}</td></tr>`;
        }
    });
});

/* --- ADMIN DASHBOARD --- */
window.checkAdmin = function() {
    const pass = prompt("Enter Owner Password:");
    if(pass === "Propetas6") {
        openPage('adminPage');
        loadAdminWithdrawals();
    } else {
        alert("Unauthorized!");
    }
};

function loadAdminWithdrawals() {
    onValue(ref(db, 'withdrawals'), (snapshot) => {
        const table = document.querySelector('#adminWdTable tbody');
        table.innerHTML = "";
        snapshot.forEach(c => {
            const d = c.val();
            if(d.status === "Pending") {
                table.innerHTML += `
                    <tr>
                        <td>${d.username}</td>
                        <td>${d.accountName}<br>${d.accountNumber}</td>
                        <td>₱${d.amount}</td>
                        <td><button onclick="approveWd('${c.key}')">Approve</button></td>
                    </tr>`;
            }
        });
    });
}

window.approveWd = function(key) {
    set(ref(db, `withdrawals/${key}/status`), "Approved ✅");
    alert("Withdrawal Approved!");
};

// Footer Time
setInterval(() => {
    document.getElementById('footerTime').innerText = "PAPERHOUSE INC " + new Date().toLocaleString();
}, 1000);
