
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue, push, query, limitToLast, orderByChild } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const tg = window.Telegram.WebApp;

let userId = tg.initDataUnsafe?.user?.id || "DEBUG_USER";
let userName = tg.initDataUnsafe?.user?.first_name || "Guest Hunter";
let userBalance = 0;
let isAdmin = false;

// --- TABS LOGIC ---
window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
};

// --- CORE: REWARD SYSTEM (FIXED) ---
const updateBalance = (amount) => {
    const userRef = ref(db, 'users/' + userId);
    get(userRef).then((snapshot) => {
        let current = 0;
        if(snapshot.exists()) current = snapshot.val().balance || 0;
        const newBal = parseFloat((current + amount).toFixed(4));
        update(userRef, { balance: newBal, name: userName });
    });
};

// Sync Balance to UI
onValue(ref(db, 'users/' + userId), (snapshot) => {
    if (snapshot.exists()) {
        userBalance = snapshot.val().balance;
        document.getElementById('balance').innerText = userBalance.toFixed(3);
        document.getElementById('balance-large').innerText = "₱" + userBalance.toFixed(3);
    }
});

// --- AD SEQUENCE: 3 COMBINED ---
window.watchAdsSequence = async (type) => {
    try {
        Swal.fire({ title: 'Loading Ad Suite...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        await show_10276123(); // Ad 1
        await show_10337795(); // Ad 2
        await show_10337853(); // Ad 3
        
        const reward = type === 'chat' ? 0.015 : 0.005;
        updateBalance(reward);
        Swal.close();
        return true;
    } catch (e) {
        Swal.fire('Ad Error', 'Failed to load ad suite. Try again.', 'error');
        return false;
    }
};

// --- CHAT SYSTEM ---
const sendBtn = document.getElementById('send-btn');
const chatInput = document.getElementById('chat-input');
let lastMsgTime = 0;

sendBtn.onclick = async () => {
    const now = Date.now();
    if (now - lastMsgTime < 180000) { // 3 min cooldown
        return Swal.fire('Cooldown', 'Wait 3 minutes between messages!', 'warning');
    }

    if (!chatInput.value.trim()) return;

    const adSuccess = await watchAdsSequence('chat');
    if (adSuccess) {
        push(ref(db, 'messages'), {
            uid: userId,
            name: userName,
            text: chatInput.value,
            timestamp: now
        });
        chatInput.value = "";
        lastMsgTime = now;
    }
};

// Real-time Chat Listener
onValue(query(ref(db, 'messages'), limitToLast(20)), (snapshot) => {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = "";
    snapshot.forEach(child => {
        const msg = child.val();
        chatBox.innerHTML += `
            <div class="chat-msg glass p-3 rounded-2xl max-w-[80%] ${msg.uid == userId ? 'ml-auto border-green-500/30' : ''}">
                <p class="text-[9px] text-green-500 font-bold uppercase mb-1">${msg.name}</p>
                <p class="text-sm">${msg.text}</p>
            </div>
        `;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

// --- WITHDRAWAL SYSTEM ---
window.processWithdrawal = () => {
    const num = document.getElementById('gcash-num').value;
    if (num.length < 11) return Swal.fire('Error', 'Invalid GCash Number', 'error');
    if (userBalance < 0.012) return Swal.fire('Error', 'Minimum ₱0.012 required', 'warning');

    const requestId = push(ref(db, 'withdrawals')).key;
    set(ref(db, 'withdrawals/' + requestId), {
        uid: userId,
        name: userName,
        gcash: num,
        amount: userBalance,
        status: 'pending',
        timestamp: Date.now()
    }).then(() => {
        update(ref(db, 'users/' + userId), { balance: 0 });
        Swal.fire('Submitted', 'Withdrawal pending approval.', 'success');
    });
};

// Live Global Table
onValue(query(ref(db, 'withdrawals'), limitToLast(10)), (snapshot) => {
    const table = document.getElementById('live-payouts-table');
    table.innerHTML = "";
    snapshot.forEach(child => {
        const w = child.val();
        table.innerHTML += `
            <tr class="border-b border-white/5">
                <td class="p-3">${w.name}</td>
                <td class="p-3 text-gray-400">${w.gcash.substring(0,4)}...</td>
                <td class="p-3 text-right font-bold">₱${w.amount.toFixed(3)}</td>
                <td class="p-3 text-right"><span class="px-2 py-1 rounded-full ${w.status == 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}">${w.status.toUpperCase()}</span></td>
            </tr>
        `;
    });
});

// --- ADMIN DASHBOARD ---
window.adminLogin = () => {
    Swal.fire({
        title: 'Admin Access',
        input: 'password',
        inputAttributes: { autocapitalize: 'off' },
        showCancelButton: true,
        confirmButtonText: 'Access',
        confirmButtonColor: '#16a34a'
    }).then((result) => {
        if (result.value === "Propetas6") {
            isAdmin = true;
            switchTab('admin');
            loadAdminPanel();
        } else if(result.value) {
            Swal.fire('Denied', 'Incorrect Password', 'error');
        }
    });
};

const loadAdminPanel = () => {
    onValue(ref(db, 'withdrawals'), (snapshot) => {
        const table = document.getElementById('admin-payouts-table');
        table.innerHTML = "";
        snapshot.forEach(child => {
            const w = child.val();
            const key = child.key;
            if(w.status === 'pending') {
                table.innerHTML += `
                <tr class="border-b border-white/5">
                    <td class="p-2">${w.name}</td>
                    <td class="p-2">${w.gcash}</td>
                    <td class="p-2">₱${w.amount.toFixed(3)}</td>
                    <td class="p-2 text-right flex gap-1">
                        <button onclick="manageWithdrawal('${key}', 'approved')" class="bg-green-600 px-2 py-1 rounded">✔</button>
                        <button onclick="manageWithdrawal('${key}', 'rejected')" class="bg-red-600 px-2 py-1 rounded">✖</button>
                    </td>
                </tr>`;
            }
        });
    });
};

window.manageWithdrawal = (key, status) => {
    if(status === 'rejected') {
        Swal.fire({
            title: 'Reject Reason?',
            input: 'text',
            showCancelButton: true
        }).then(res => {
            if(res.isConfirmed) {
                update(ref(db, 'withdrawals/' + key), { status: 'rejected', reason: res.value });
            }
        });
    } else {
        update(ref(db, 'withdrawals/' + key), { status: 'approved' });
    }
};

// Initial setup
tg.ready();
tg.expand();
