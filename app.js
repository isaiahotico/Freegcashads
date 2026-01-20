
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
const USDT_RATE = 0.017; // Simulated conversion rate

// --- TELEGRAM & FIREBASE INITIALIZATION ---
const tg = window.Telegram?.WebApp;
tg?.ready();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser
  ? `@${tgUser.username || tgUser.first_name}`
  : "Guest";
const userId = tgUser?.id || 'guest_user'; // Unique ID for Firebase

document.getElementById("userBar").innerText = "👤 User: " + username;
document.getElementById("userReferralName").innerText = username;

// Global Firestore instance (initialized in index.html module script)
const db = window.db; 

// --- STATE MANAGEMENT (Local Storage & Simulated Firebase) ---
let userBalance = parseFloat(localStorage.getItem('userBalance') || '0.00');
let chatCooldownEnd = parseInt(localStorage.getItem('chatCooldownEnd') || '0');

function updateBalanceDisplay() {
    userBalance = Math.max(0, userBalance); // Ensure balance is not negative
    const fixedBalance = userBalance.toFixed(3);
    document.getElementById('userBalance').innerText = fixedBalance;
    document.getElementById('withdrawalBalance').innerText = fixedBalance;
    localStorage.setItem('userBalance', fixedBalance);
}

// --- UI TOGGLE AND HELP FUNCTIONS ---

// 1. Background Color Toggle
document.getElementById('appBody').addEventListener('click', function() {
    this.classList.toggle('rainbow-bg');
});

// 2. Navigation Toggle
function toggleArea(areaId) {
    const areas = ['adsArea', 'signInArea', 'giftArea', 'withdrawalArea', 'referralArea', 'chatArea', 'leaderboardArea', 'topicsArea', 'ownerDashboard'];
    areas.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = (id === areaId) ? 'block' : 'none';
        }
    });

    // Specific actions when entering certain areas
    if (areaId === 'withdrawalArea') {
        updateWithdrawalForm();
        // In a real app: startSnapshotListener('withdrawals');
    }
    if (areaId === 'chatArea') {
        startChatCooldownTimer();
        // In a real app: startSnapshotListener('chat');
    }
    if (areaId === 'leaderboardArea') {
        // In a real app: startSnapshotListener('leaderboard');
    }
}

// 3. Help Modal
function showHelpModal() {
    document.getElementById('helpModal').style.display = 'block';
}

function closeHelpModal() {
    document.getElementById('helpModal').style.display = 'none';
}

// 4. Owner Dashboard Access
function showOwnerDashboardPrompt() {
    const password = prompt("Enter Owner Password:");
    if (password === OWNER_PASSWORD) {
        toggleArea('ownerDashboard');
        // In a real app: startSnapshotListener('admin_requests');
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

// --- AD AND REWARD LOGIC (Updated to handle chat ad) ---
function simulateAdShow(adId, adType) { /* ... */ }
async function watchAds(taskId, adIdOrArray, reward, cooldownMs, adType) { /* ... */ }
function claimReward(taskId, reward, cooldownMs) { /* ... */ }
function startCooldownTimer(taskId, lastClaimTime, cooldownMs) { /* ... */ }
function showRandomAutomaticInterstitial() { /* ... */ }

// --- WITHDRAWAL LOGIC (Simulated Firebase) ---

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
        // Auto convert PHP to USDT
        const usdtAmount = amount * USDT_RATE;
        alert(`Requesting ${amount.toFixed(2)} PHP, converted to approximately ${usdtAmount.toFixed(5)} USDT.`);
    }

    // --- SIMULATED FIREBASE WRITE ---
    console.log(`Submitting withdrawal request for ${amount} PHP to ${method} (${address}).`);
    
    // Deduct balance immediately
    userBalance -= amount;
    updateBalanceDisplay();
    
    alert(`Withdrawal request submitted for ${amount.toFixed(2)} PHP. Status: Pending Admin Approval.`);
    
    // In a real app, this would write to Firestore:
    // await addDoc(collection(db, "withdrawals"), { userId, username, amount, method, address, currency, date: new Date(), status: 'pending' });
    
    // Refresh history display (simulated)
    simulateWithdrawalHistoryUpdate();
}

function simulateWithdrawalHistoryUpdate() {
    // This function simulates the Snapshot Listener updating the UI
    const historyBody = document.getElementById('withdrawalHistoryBody');
    historyBody.innerHTML = ''; // Clear existing
    
    // Simulated data (real data would come from Firestore)
    const simulatedData = [
        { name: username, method: 'GCash', amount: '50.00', date: '2024-05-01', status: 'Approved' },
        { name: username, method: 'FaucetPay', amount: '10.00', date: '2024-05-15', status: 'Pending' },
        { name: 'UserX', method: 'GCash', amount: '5.00', date: '2024-05-20', status: 'Denied' },
    ];

    simulatedData.forEach(item => {
        const row = historyBody.insertRow();
        row.innerHTML = `<td>${item.name}</td><td>${item.method}</td><td>${item.amount}</td><td>${item.date}</td><td>${item.status}</td>`;
    });
    
    document.getElementById('totalApprovedWithdrawals').innerText = '150.00'; // Simulated total
}

// --- REFERRALS LOGIC (Simulated Firebase) ---

function claimReferralRewards() {
    const rewards = parseFloat(document.getElementById('claimableRewards').innerText);
    if (rewards > 0) {
        userBalance += rewards;
        updateBalanceDisplay();
        showRewardAnimation(rewards);
        // In a real app: Update user document, reset claimable_rewards to 0
        document.getElementById('claimableRewards').innerText = '0.000';
        alert(`Claimed ${rewards.toFixed(3)} PHP referral rewards!`);
    } else {
        alert("No claimable rewards available.");
    }
}

function addReferrer() {
    const referrerCode = document.getElementById('referralCodeInput').value.trim();
    if (referrerCode === username) {
        alert("You cannot refer yourself.");
        return;
    }
    if (referrerCode) {
        // In a real app: Check if referrerCode exists, then update user document
        alert(`Referrer ${referrerCode} added successfully! (Simulated)`);
        document.getElementById('totalReferrals').innerText = '1'; // Simulated increase
    }
}

// --- CHAT LOGIC (Simulated Firebase and Ad Reward) ---

function startChatCooldownTimer() {
    const timerElement = document.getElementById('chatCooldownTimer');
    const updateChatTimer = () => {
        const now = Date.now();
        const timeLeft = chatCooldownEnd - now;

        if (timeLeft <= 0) {
            timerElement.innerText = "Ready to chat.";
            clearInterval(chatTimerInterval);
            return;
        }

        const seconds = Math.floor(timeLeft / 1000);
        timerElement.innerText = `Cooldown: ${seconds}s`;
    };

    if (chatCooldownEnd > Date.now()) {
        updateChatTimer();
        var chatTimerInterval = setInterval(updateChatTimer, 1000);
    } else {
        timerElement.innerText = "Ready to chat.";
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const messageText = input.value.trim();

    if (!messageText) return;

    if (chatCooldownEnd > Date.now()) {
        alert("Chat is on cooldown. Please wait.");
        return;
    }

    // 1. Show Random Ad and Reward User (0.02 PHP)
    const randomAdId = MONETAG_AD_IDS[Math.floor(Math.random() * MONETAG_AD_IDS.length)];
    try {
        await simulateAdShow(randomAdId, 'chat_interstitial');
        
        // Reward user after ad
        userBalance += 0.02;
        updateBalanceDisplay();
        showRewardAnimation(0.02);
        
        // 2. Set Cooldown
        chatCooldownEnd = Date.now() + CHAT_COOLDOWN_MS;
        localStorage.setItem('chatCooldownEnd', chatCooldownEnd);
        startChatCooldownTimer();

        // 3. Send Message (Simulated Firebase Write)
        const chatMessages = document.getElementById('chatMessages');
        const newMessage = document.createElement('div');
        newMessage.className = 'chat-message';
        newMessage.innerHTML = `<strong>${username}:</strong> ${messageText} <small>(${new Date().toLocaleTimeString()})</small>`;
        chatMessages.appendChild(newMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom

        input.value = '';
        console.log(`Message sent: ${messageText}`);

    } catch (e) {
        alert("Ad failed. Cannot send message.");
    }
}

// --- TOPICS LOGIC (Simulated Firebase) ---

function createTopic() {
    const title = document.getElementById('newTopicTitle').value.trim();
    if (title) {
        alert(`Topic "${title}" created! (Simulated)`);
        document.getElementById('newTopicTitle').value = '';
        // In a real app: Write to Firestore 'topics' collection
    }
}

// --- INITIALIZATION ON LOAD ---
function initializeTasks() {
    // Initialize task cooldowns (Tasks 1-10)
    // (Existing logic for initializing cooldowns remains here)
    
    // Start automatic ad logic
    showRandomAutomaticInterstitial();
    setInterval(showRandomAutomaticInterstitial, ONE_MINUTE_MS);
    
    // Simulate initial data loads
    simulateWithdrawalHistoryUpdate();
    // In a real app, this would start the snapshot listeners:
    // startSnapshotListener('leaderboard');
    // startSnapshotListener('chat');
}

window.onload = initializeTasks;
