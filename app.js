
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue, push, query, limitToLast, orderByChild, startAt, endAt } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let userId = tg.initDataUnsafe?.user?.id || "DEBUG_USER_" + Math.random().toString(36).substring(7);
let userName = tg.initDataUnsafe?.user?.first_name || "New Hunter";
let userBalance = 0;
let isAdmin = false;

const MIN_WITHDRAWAL = 0.012; // Minimum withdrawal amount
const ADMIN_PASSWORD = "Propetas6";
const MESSAGES_PER_PAGE = 15; // Pagination for admin dashboard

// --- MONETAG AD ZONES ---
const MONETAG_AD_FUNCTIONS = [
    window.show_10337853, // Zone 1
    window.show_10337795, // Zone 2
    window.show_10276123  // Zone 3
];

// --- UI HELPERS ---
const showRewardNotification = (amount, message) => {
    Swal.fire({
        title: `<span style="color: #22c55e; font-size: 2em;">+₱${amount.toFixed(3)}</span>`,
        html: `
            <div style="font-size: 1.1em; color: #cbd5e1; margin-top: 10px;">${message}</div>
            <div style="margin-top: 20px;">
                <img src="https://media.giphy.com/media/xT0xezQvhxSg9L0VXE/giphy.gif" alt="Reward animation" style="width: 120px; height: 120px; object-fit: cover; border-radius: 50%; border: 2px solid #22c55e; box-shadow: 0 0 15px rgba(34, 197, 94, 0.7);">
            </div>
        `,
        icon: 'success',
        background: '#0f172a',
        color: '#e2e8f0',
        confirmButtonColor: '#22c55e',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false
    });
};

// --- TABS LOGIC ---
window.switchTab = (tabId, buttonElement) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
};

// --- CORE: REWARD SYSTEM ---
const updateBalance = async (amount, message = "Reward") => {
    const userRef = ref(db, 'users/' + userId);
    const snapshot = await get(userRef);
    let current = 0;
    if(snapshot.exists()) current = snapshot.val().balance || 0;
    const newBal = parseFloat((current + amount).toFixed(4));
    
    await update(userRef, { balance: newBal, name: userName, lastActivity: Date.now() });
    showRewardNotification(amount, message);
};

// Sync Balance to UI
onValue(ref(db, 'users/' + userId), (snapshot) => {
    if (snapshot.exists()) {
        userBalance = snapshot.val().balance || 0;
        document.getElementById('balance-tiny').innerText = userBalance.toFixed(3);
        document.getElementById('balance-large').innerText = "₱" + userBalance.toFixed(3);
    } else {
        set(ref(db, 'users/' + userId), {
            username: userName,
            balance: 0.000,
            createdAt: Date.now(),
            lastActivity: Date.now()
        });
    }
});

// --- AD HANDLERS ---
async function showPrioritizedAd(rewardAmount, rewardMessage) {
    Swal.fire({ title: 'Loading Ad...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let adShown = false;
    for (const adFunction of MONETAG_AD_FUNCTIONS) {
        try {
            // Ensure the function exists before calling
            if (typeof adFunction === 'function') {
                await adFunction();
                adShown = true;
                break; 
            } else {
                 console.warn("Monetag function not found or not a function:", adFunction);
            }
        } catch (e) {
            console.warn(`Monetag Ad failed:`, e);
        }
    }
    Swal.close();
    if (adShown) {
        await updateBalance(rewardAmount, rewardMessage);
        return true;
    } else {
        Swal.fire('Ad Error', 'Failed to load any ad. Please try again later.', 'error');
        return false;
    }
}

// Handler for the "Claim Daily Bonus" button
window.showPrioritizedAd = showPrioritizedAd; 

// --- CHAT SYSTEM ---
const sendBtn = document.getElementById('send-btn');
const chatInput = document.getElementById('chat-input');
const cooldownTimerDisplay = document.getElementById('cooldown-timer');
let lastMsgTime = 0; 
const CHAT_COOLDOWN_MS = 180000; // 3 minutes

const updateCooldownDisplay = () => {
    const now = Date.now();
    const remainingTime = CHAT_COOLDOWN_MS - (now - lastMsgTime);
    if (remainingTime > 0 && lastMsgTime > 0) { // Only show if cooldown is active and not initial load
        cooldownTimerDisplay.classList.remove('hidden');
        const seconds = Math.ceil(remainingTime / 1000);
        cooldownTimerDisplay.innerText = `COOLDOWN: ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        sendBtn.disabled = true;
        setTimeout(updateCooldownDisplay, 1000);
    } else {
        cooldownTimerDisplay.classList.add('hidden');
        sendBtn.disabled = false;
    }
};

sendBtn.onclick = async () => {
    const now = Date.now();
    if (now - lastMsgTime < CHAT_COOLDOWN_MS && lastMsgTime > 0) { // Check if cooldown is active
        return Swal.fire('Cooldown', 'You need to wait 3 minutes between messages to prevent spam!', 'warning');
    }

    if (!chatInput.value.trim()) {
        return Swal.fire('Empty Message', 'Please type something before sending.', 'warning');
    }

    Swal.fire({ title: 'Loading Ad Suite...', text: 'Prepare for 3 ads to send your message and earn!', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    let allAdsShown = true;
    try {
        // Ensure all ad functions are valid before attempting to show
        for (const adFunc of MONETAG_AD_FUNCTIONS) {
            if (typeof adFunc === 'function') {
                await adFunc();
            } else {
                throw new Error("Invalid Monetag function");
            }
        }
    } catch (e) {
        allAdsShown = false;
        console.error("Error loading Monetag ads:", e);
        Swal.close();
        Swal.fire('Ad Error', 'Failed to load all ads for chat. Please try again.', 'error');
    }

    if (allAdsShown) {
        const messageText = chatInput.value.trim();
        chatInput.value = ""; 
        
        await push(ref(db, 'messages'), {
            uid: userId,
            name: userName,
            text: messageText,
            timestamp: now
        });
        
        await updateBalance(0.015, "Chat Activity Reward");
        lastMsgTime = now;
        updateCooldownDisplay(); // Restart cooldown timer display
        Swal.close();
    }
};

// Real-time Chat Listener - Loads ALL messages
// IMPORTANT: For extremely large numbers of messages, this might become slow.
// Consider implementing infinite scroll or limited loading if performance is an issue.
onValue(query(ref(db, 'messages'), orderByChild('timestamp')), (snapshot) => {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = ""; // Clear existing messages
    let messages = [];
    snapshot.forEach(child => {
        messages.push(child.val());
    });

    // Sort messages by timestamp to ensure correct order
    messages.sort((a, b) => a.timestamp - b.timestamp);

    messages.forEach(msg => {
        const msgElement = document.createElement('div');
        msgElement.className = `chat-msg glass p-3 rounded-2xl max-w-[80%] ${msg.uid == userId ? 'ml-auto bg-green-900/40' : 'bg-gray-800/40'}`;
        msgElement.innerHTML = `
            <p class="text-[9px] text-green-300 font-bold uppercase mb-1">${msg.name || 'Unknown'}</p>
            <p class="text-sm">${msg.text}</p>
            <p class="text-[8px] text-gray-500 text-right mt-1">${new Date(msg.timestamp).toLocaleTimeString()}</p>
        `;
        chatBox.appendChild(msgElement);
    });
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
});


// --- WITHDRAWAL SYSTEM ---
window.processWithdrawal = async () => {
    const num = document.getElementById('gcash-num').value;
    
    if (!/^(09|\+639)\d{9}$/.test(num)) { 
        return Swal.fire('Invalid Number', 'Please enter a valid Philippine mobile number (e.g., 0917XXXXXXX).', 'warning');
    }
    
    if (userBalance < MIN_WITHDRAWAL) {
        return Swal.fire('Low Balance', `Minimum payout is ₱${MIN_WITHDRAWAL.toFixed(3)}. Keep hunting!`, 'info');
    }

    const confirmResult = await Swal.fire({
        title: 'Confirm Withdrawal',
        html: `Request ₱${userBalance.toFixed(3)} to GCash: <b>${num}</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#22c55e',
        cancelButtonColor: '#ef4444'
    });

    if (confirmResult.isConfirmed) {
        const requestId = push(ref(db, 'withdrawals')).key;
        await set(ref(db, 'withdrawals/' + requestId), {
            uid: userId,
            name: userName,
            gcash: num,
            amount: userBalance,
            status: 'pending',
            timestamp: Date.now()
        });

        await update(ref(db, 'users/' + userId), { balance: 0 }); // Deduct balance immediately
        Swal.fire('Submitted', 'Your payout request has been sent! Please allow 24-48 hours for processing.', 'success');
    }
};

// Live Global Payouts Table (Home Tab)
onValue(query(ref(db, 'withdrawals'), orderByChild('timestamp'), limitToLast(10)), (snapshot) => {
    const table = document.getElementById('live-payouts-table');
    table.innerHTML = "";
    let payouts = [];
    snapshot.forEach(child => {
        payouts.push(child.val());
    });
    payouts.reverse(); // Show newest first

    payouts.forEach(w => {
        const statusClass = w.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                             w.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-yellow-500/20 text-yellow-400';
        table.innerHTML += `
            <tr class="border-b border-white/5">
                <td class="p-3">${w.name || 'N/A'}</td>
                <td class="p-3 text-gray-400">${w.gcash ? w.gcash.substring(0,4) + '...' + w.gcash.substring(w.gcash.length - 4) : 'N/A'}</td>
                <td class="p-3 text-right font-bold">₱${w.amount ? w.amount.toFixed(3) : '0.000'}</td>
                <td class="p-3 text-right"><span class="px-2 py-1 rounded-full ${statusClass}">${w.status ? w.status.toUpperCase() : 'PENDING'}</span></td>
            </tr>
        `;
    });
});


// --- ADMIN DASHBOARD ---
let allWithdrawals = [];
let currentPage = 0;

window.adminLogin = () => {
    Swal.fire({
        title: 'Admin Access',
        input: 'password',
        inputAttributes: { autocapitalize: 'off' },
        showCancelButton: true,
        confirmButtonText: 'Access',
        confirmButtonColor: '#16a34a'
    }).then((result) => {
        if (result.value === ADMIN_PASSWORD) {
            isAdmin = true;
            switchTab('admin', document.getElementById('nav-admin'));
            loadAdminPanel();
        } else if(result.value) { 
            Swal.fire('Denied', 'Incorrect Password', 'error');
        }
    });
};

const loadAdminPanel = () => {
    if (!isAdmin) return;
    // Listen for any changes in withdrawals, filter for pending in render
    onValue(query(ref(db, 'withdrawals'), orderByChild('timestamp')), (snapshot) => {
        allWithdrawals = [];
        snapshot.forEach(child => {
            const withdrawal = child.val();
            // Only add pending withdrawals to the list for display and management
            if (withdrawal.status === 'pending') {
                allWithdrawals.push({ key: child.key, ...withdrawal });
            }
        });
        allWithdrawals.reverse(); 
        currentPage = 0; 
        renderAdminTable();
        renderPagination();
    });
};

const renderAdminTable = () => {
    const table = document.getElementById('admin-payouts-table');
    table.innerHTML = "";
    const start = currentPage * MESSAGES_PER_PAGE;
    const end = start + MESSAGES_PER_PAGE;
    const paginatedWithdrawals = allWithdrawals.slice(start, end);

    if (paginatedWithdrawals.length === 0) {
        table.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No pending withdrawals.</td></tr>`;
        return;
    }

    paginatedWithdrawals.forEach(w => {
        table.innerHTML += `
            <tr class="border-b border-white/5">
                <td class="p-2">${w.name || 'N/A'}</td>
                <td class="p-2">${w.gcash || 'N/A'}</td>
                <td class="p-2">₱${w.amount ? w.amount.toFixed(3) : '0.000'}</td>
                <td class="p-2 text-right flex gap-1 justify-end">
                    <button onclick="manageWithdrawal('${w.key}', 'approved')" class="bg-green-600 hover:bg-green-500 px-2 py-1 rounded">✔ Approve</button>
                    <button onclick="manageWithdrawal('${w.key}', 'rejected')" class="bg-red-600 hover:bg-red-500 px-2 py-1 rounded">✖ Reject</button>
                </td>
            </tr>`;
    });
};

const renderPagination = () => {
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.innerHTML = "";
    const totalPages = Math.ceil(allWithdrawals.length / MESSAGES_PER_PAGE);

    if (totalPages <= 1) return;

    for (let i = 0; i < totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i + 1;
        btn.className = `px-3 py-1 rounded ${i === currentPage ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`;
        btn.onclick = () => {
            currentPage = i;
            renderAdminTable();
            renderPagination();
        };
        paginationDiv.appendChild(btn);
    }
};

window.manageWithdrawal = async (key, status) => {
    if (!isAdmin) {
        Swal.fire('Access Denied', 'You are not authorized to perform this action.', 'error');
        return;
    }

    if (status === 'rejected') {
        const { value: reason } = await Swal.fire({
            title: 'Reject Reason?',
            input: 'text',
            inputPlaceholder: 'Enter reason for rejection',
            showCancelButton: true,
            confirmButtonText: 'Reject',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#ef4444'
        });

        if (reason) {
            await update(ref(db, 'withdrawals/' + key), { status: 'rejected', reason: reason, processedAt: Date.now() });
            Swal.fire('Rejected!', 'Withdrawal request rejected.', 'info');
        }
    } else if (status === 'approved') {
        const confirmResult = await Swal.fire({
            title: 'Approve Withdrawal?',
            text: 'This will mark the request as approved.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Approve',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#22c55e'
        });

        if (confirmResult.isConfirmed) {
            await update(ref(db, 'withdrawals/' + key), { status: 'approved', processedAt: Date.now() });
            Swal.fire('Approved!', 'Withdrawal request approved.', 'success');
        }
    }
};


// --- INITIALIZATION ---
tg.ready();
tg.expand();
updateCooldownDisplay(); // Initialize cooldown display on load
switchTab('home', document.getElementById('nav-home')); // Set default active tab
