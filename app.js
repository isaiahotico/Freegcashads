
// app.js

// --- CONSTANTS ---
const AD_REWARD_MESSAGE = "🎉Congratulations🎉 you earned some money!!😍🍍🎉";
const ONE_MINUTE_MS = 60000;
const FIVE_MINUTES_MS = 300000;
const ONE_HOUR_MS = 3600000;
const THREE_HOURS_MS = 10800000;
const CHAT_COOLDOWN_MS = 4 * ONE_MINUTE_MS;
const OWNER_PASSWORD = "Propetas6";

const MONETAG_AD_IDS = ['10276123', '10337795', '10337853'];
const USDT_RATE = 0.017;

// --- TELEGRAM & FIREBASE INITIALIZATION ---
const tg = window.Telegram?.WebApp;
tg?.ready();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser
  ? `@${tgUser.username || tgUser.first_name}`
  : "Guest";
const userId = tgUser?.id || 'guest_user';

document.getElementById("userBar").innerText = "👤 User: " + username;
document.getElementById("userReferralName").innerText = username;

const db = window.db; 

// --- STATE MANAGEMENT (Local Storage & Simulated Firebase) ---
let userBalance = parseFloat(localStorage.getItem('userBalance') || '0.00');
let chatCooldownEnd = parseInt(localStorage.getItem('chatCooldownEnd') || '0');

// Array to simulate the Firestore 'withdrawals' collection
let withdrawalRequests = JSON.parse(localStorage.getItem('withdrawalRequests') || '[]');

function updateBalanceDisplay() {
    userBalance = Math.max(0, userBalance);
    const fixedBalance = userBalance.toFixed(3);
    document.getElementById('userBalance').innerText = fixedBalance;
    document.getElementById('withdrawalBalance').innerText = fixedBalance;
    localStorage.setItem('userBalance', fixedBalance);
}

// --- UI TOGGLE AND HELP FUNCTIONS ---

// 1. Background Color Toggle (Kept)
document.getElementById('appBody').addEventListener('click', function() {
    this.classList.toggle('rainbow-bg');
});

// 2. Navigation Toggle (Updated to call syncWithdrawalData)
function toggleArea(areaId) {
    const areas = ['adsArea', 'signInArea', 'giftArea', 'withdrawalArea', 'referralArea', 'chatArea', 'leaderboardArea', 'topicsArea', 'ownerDashboard'];
    areas.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = (id === areaId) ? 'block' : 'none';
        }
    });

    if (areaId === 'withdrawalArea' || areaId === 'ownerDashboard') {
        syncWithdrawalData();
    }
    if (areaId === 'chatArea') {
        startChatCooldownTimer();
    }
}

// 3. Help Modal (Kept)
function showHelpModal() { /* ... */ }
function closeHelpModal() { /* ... */ }

// 4. Owner Dashboard Access (Updated to call syncWithdrawalData)
function showOwnerDashboardPrompt() {
    const password = prompt("Enter Owner Password:");
    if (password === OWNER_PASSWORD) {
        toggleArea('ownerDashboard');
        syncWithdrawalData(); // Sync data immediately upon entering dashboard
        alert("Welcome, Owner!");
    } else if (password !== null) {
        alert("Incorrect Password.");
    }
}

// 5. Footer Time Update (Kept)
function updateFooter() { /* ... */ }
setInterval(updateFooter, 1000);
updateFooter();
updateBalanceDisplay();

// --- REWARD ANIMATION LOGIC (Kept) ---
const animations = [
    '🎉 Success! +', '💰 CASH DROP! +', '✨ WOW! +', '💎 Reward Claimed! +', '🚀 Boost! +'
];
function showRewardAnimation(reward) { /* ... */ }

// --- AD AND REWARD LOGIC (Kept) ---
function simulateAdShow(adId, adType) { /* ... */ }
async function watchAds(taskId, adIdOrArray, reward, cooldownMs, adType) { /* ... */ }
function claimReward(taskId, reward, cooldownMs) { /* ... */ }
function startCooldownTimer(taskId, lastClaimTime, cooldownMs) { /* ... */ }
function showRandomAutomaticInterstitial() { /* ... */ }

// --- WITHDRAWAL LOGIC FIX (Simulated Firebase Sync) ---

function updateWithdrawalForm() {
    const method = document.getElementById('withdrawalMethod').value;
    document.getElementById('gcashForm').style.display = (method === 'gcash' ? 'block' : 'none');
    document.getElementById('faucetpayForm').style.display = (method === 'faucetpay' ? 'block' : 'none');
}

function submitWithdrawalRequest() {
    const method = document.getElementById('withdrawalMethod').value;
    const amount = parseFloat(document.getElementById('withdrawalAmount').value);
    const balance = userBalance;
    let address = '';
    let currency = 'PHP';

    if (amount <= 0 || isNaN(amount)) {
        alert("Please enter a valid amount.");
        return;
    }
    if (amount > balance) {
        alert("Insufficient balance.");
        return;
    }

    if (method === 'gcash') {
        address = document.getElementById('gcashNumber').value;
        if (address.length !== 11) {
            alert("GCash number must be 11 digits.");
            return;
        }
    } else if (method === 'faucetpay') {
        address = document.getElementById('faucetpayEmail').value;
        currency = 'USDT';
    }

    // 1. Deduct balance immediately
    userBalance -= amount;
    updateBalanceDisplay();
    
    // 2. Create Request Object
    const newRequest = {
        id: Date.now(), // Simple unique ID
        userId: userId,
        username: username,
        amount: amount.toFixed(3),
        method: method.toUpperCase(),
        address: address,
        currency: currency,
        date: new Date().toLocaleString(),
        status: 'Pending'
    };
    
    // 3. Add to simulated database (Local Storage)
    withdrawalRequests.push(newRequest);
    localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));

    alert(`Withdrawal request submitted for ${amount.toFixed(2)} PHP. Status: Pending Admin Approval.`);
    
    // 4. Update UI for both user and admin dashboard
    syncWithdrawalData();
}

/**
 * Simulates a Firestore Snapshot Listener update, refreshing both user history
 * and the owner dashboard request list.
 */
function syncWithdrawalData() {
    // 1. Load data from local storage
    withdrawalRequests = JSON.parse(localStorage.getItem('withdrawalRequests') || '[]');
    
    let totalApproved = 0;
    const userHistoryBody = document.getElementById('withdrawalHistoryBody');
    const adminRequestsBody = document.getElementById('pendingRequestsBody');
    
    userHistoryBody.innerHTML = '';
    adminRequestsBody.innerHTML = '';
    
    const userRequests = withdrawalRequests.filter(req => req.userId === userId);
    const pendingAdminRequests = [];

    // Process all requests
    withdrawalRequests.forEach(req => {
        if (req.status === 'Approved' || req.status === 'Paid') {
            totalApproved += parseFloat(req.amount);
        }
        
        // Populate User History (only user's requests)
        if (req.userId === userId) {
            const row = userHistoryBody.insertRow();
            row.innerHTML = `
                <td>${req.method}</td>
                <td>${req.amount} ${req.currency}</td>
                <td>${req.date}</td>
                <td class="status-${req.status}">${req.status}</td>
            `;
        }
        
        // Collect Pending Requests for Admin Dashboard
        if (req.status === 'Pending') {
            pendingAdminRequests.push(req);
        }
    });

    // Sort pending requests by date (priority)
    pendingAdminRequests.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Populate Admin Dashboard (Pending requests)
    pendingAdminRequests.forEach(req => {
        const row = adminRequestsBody.insertRow();
        row.innerHTML = `
            <td>${req.username}</td>
            <td>${req.method} (${req.address})</td>
            <td>${req.amount} ${req.currency}</td>
            <td>${req.date}</td>
            <td>
                <button onclick="updateRequestStatus(${req.id}, 'Approved', ${req.amount})">Approve</button>
                <button onclick="updateRequestStatus(${req.id}, 'Denied')">Deny</button>
            </td>
        `;
    });
    
    // Update totals
    document.getElementById('totalApprovedWithdrawals').innerText = totalApproved.toFixed(2);
    document.getElementById('adminTotalApproved').innerText = totalApproved.toFixed(2);
}

/**
 * Owner action to update the status of a withdrawal request.
 */
function updateRequestStatus(id, newStatus, amount) {
    const index = withdrawalRequests.findIndex(req => req.id === id);
    if (index !== -1) {
        // If denying, refund the balance (Simulated)
        if (newStatus === 'Denied') {
            const deniedAmount = parseFloat(withdrawalRequests[index].amount);
            userBalance += deniedAmount; // Note: In a real system, you refund the specific user
            updateBalanceDisplay();
            alert(`Request ${id} Denied. ${deniedAmount} PHP refunded (Simulated).`);
        }
        
        withdrawalRequests[index].status = newStatus;
        localStorage.setItem('withdrawalRequests', JSON.stringify(withdrawalRequests));
        syncWithdrawalData(); // Resync UI
    }
}

// --- REFERRALS, CHAT, TOPICS, LEADERBOARD LOGIC (Kept as simulation) ---
function claimReferralRewards() { /* ... */ }
function addReferrer() { /* ... */ }
function startChatCooldownTimer() { /* ... */ }
async function sendMessage() { /* ... */ }
function createTopic() { /* ... */ }


// --- INITIALIZATION ON LOAD ---
function initializeTasks() {
    // Task parameters: { ID, Reward, Cooldown MS }
    const allTasks = [
        { id: 1, reward: 0.02, cooldown: FIVE_MINUTES_MS },
        { id: 2, reward: 0.02, cooldown: FIVE_MINUTES_MS },
        { id: 3, reward: 0.02, cooldown: FIVE_MINUTES_MS },
        { id: 4, reward: 0.02, cooldown: FIVE_MINUTES_MS },
        { id: 5, reward: 0.025, cooldown: ONE_HOUR_MS },
        { id: 6, reward: 0.025, cooldown: ONE_HOUR_MS },
        { id: 7, reward: 0.02, cooldown: ONE_HOUR_MS },
        { id: 8, reward: 0.02, cooldown: THREE_HOURS_MS },
        { id: 9, reward: 0.02, cooldown: THREE_HOURS_MS },
        { id: 10, reward: 0.02, cooldown: THREE_HOURS_MS },
        // New Bonus Tasks
        { id: 11, reward: 0.015, cooldown: FIVE_MINUTES_MS },
        { id: 12, reward: 0.015, cooldown: FIVE_MINUTES_MS }
    ];

    allTasks.forEach(task => {
        const lastClaimTime = parseInt(localStorage.getItem(`lastClaim${task.id}`) || '0');
        if (Date.now() < lastClaimTime + task.cooldown) {
            startCooldownTimer(task.id, lastClaimTime, task.cooldown);
        } else {
            // Check if element exists before trying to set innerText
            const cooldownEl = document.getElementById(`cooldown${task.id}`);
            if (cooldownEl) cooldownEl.innerText = "Ready to watch.";
        }
    });
    
    // Start automatic ad logic
    showRandomAutomaticInterstitial();
    setInterval(showRandomAutomaticInterstitial, ONE_MINUTE_MS);
    
    // Initial sync of withdrawal data
    syncWithdrawalData(); 
}

window.onload = initializeTasks;
