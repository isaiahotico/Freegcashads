
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get, update, onChildAdded, push, query as rtdbQuery, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp, doc, deleteDoc, where, getCountFromServer, onSnapshot, writeBatch, runTransaction, FieldValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); // Realtime Database for balance, referrals, chat
const fs = getFirestore(app); // Firestore for withdrawals, topics, leaderboards

// --- Telegram Config ---
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest";
const userId = tgUser?.id || `anon_${Date.now()}`; // Use anon ID if not in Telegram
document.getElementById("userBar").innerText = "👤 " + username;

// --- Global State & Constants ---
const OWNER_PASSWORD = "Propetas6";
const OWNER_UID = "YOUR_OWNER_UID"; // *** REPLACE WITH YOUR FIREBASE AUTH UID ***
const REWARD_AMOUNT = 0.02;
const REFERRAL_BONUS_PERCENT = 0.10;
const USDT_RATE = 58; // Example rate: 1 USDT = 58 PHP. Make this dynamic if needed.
const PAGES = {
    MAIN: 'mainPage',
    ADS: 'adsPage',
    WITHDRAW: 'withdrawPage',
    REFERRALS: 'referralsPage',
    CHAT: 'chatPage',
    PROFILE: 'profilePage',
    LEADERBOARD: 'leaderboardPage',
    TOPICS: 'topicsPage',
    HELP: 'helpPage',
    OWNER_PASS: 'ownerPasswordPage',
    OWNER_DASH: 'ownerDashboard'
};
const ITEMS_PER_PAGE = 10; // For withdrawals, topics, chat, leaderboards
const CHAT_COOLDOWN = 4 * 60 * 1000; // 4 minutes
const ADS_AUTO_COOLDOWN = 3 * 60 * 1000; // 3 minutes

// --- DOM Elements ---
const balanceDisplay = document.getElementById('balanceDisplay');
const userBar = document.getElementById('userBar');
const ownerPasswordInput = document.getElementById('ownerPasswordInput');
const ownerDashboard = document.getElementById('ownerDashboard');
const ownerPasswordPage = document.getElementById('ownerPasswordPage');
const totalApprovedWithdrawalsDisplay = document.getElementById('totalApprovedWithdrawals');

// --- Initialization ---
async function initApp() {
    userBar.innerText = "👤 " + username;
    
    // Initialize RTDB User Data (balance, referrals, etc.)
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
        await set(userRef, {
            username: username,
            balance: 0,
            referralCode: generateReferralCode(),
            totalReferrals: 0,
            claimableBonus: 0,
            totalAdsWatched: 0,
            rewardHistory: { day: 0, week: 0, overall: 0 },
            messagesSent: 0,
            createdAt: Date.now()
        });
    }

    // Load initial balance
    onValue(ref(db, `users/${userId}/balance`), (snap) => {
        balanceDisplay.innerText = "₱" + (snap.val() || 0).toFixed(2);
    });
    
    // Load initial withdrawal history
    loadWithdrawalHistory();
    
    // Load topics
    loadTopics();
    
    // Load chat messages
    loadChatMessages();

    // Load leaderboards
    loadLeaderboards();

    // Load profile info
    loadProfileInfo();

    // Auto Ad on App Open (if not already run)
    runAutoAds();
    
    // Start footer clock
    setInterval(() => { document.getElementById('footerTime').innerText = new Date().toLocaleString(); }, 1000);
}

function generateReferralCode() {
    return `PH${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// --- Page Navigation ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.getElementById(id).classList.add('active-page');
    if(id === PAGES.ADS) {
        // Auto Interstitial when entering Ads page
        showMonetagInterstitial({
            frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false
        });
    }
    if(id === PAGES.WITHDRAW) updateWithdrawBalance();
    if(id === PAGES.TOPICS) loadTopics();
    if(id === PAGES.CHAT) { /* Chat will auto-load */ }
    if(id === PAGES.LEADERBOARD) loadLeaderboards();
    if(id === PAGES.PROFILE) loadProfileInfo();
    if(id === PAGES.OWNER_PASS) {
        ownerPasswordInput.value = ""; // Clear password on entry
        ownerDashboard.classList.add('hidden');
    }
};

// --- Monetag Ad Logic ---
async function showMonetagInterstitial(settings) {
    const ads = [window.show_10276123, window.show_10337795, window.show_10337853];
    const randomAd = ads[Math.floor(Math.random() * ads.length)];
    try {
        await randomAd({ type: 'inApp', inAppSettings: settings });
    } catch (e) { console.error("Interstitial ad failed:", e); }
}

function runAutoAds() {
    const lastAdTime = parseInt(localStorage.getItem('lastAdTime') || '0');
    const now = Date.now();
    if (now - lastAdTime > ADS_AUTO_COOLDOWN) {
        showMonetagInterstitial({ frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false });
        localStorage.setItem('lastAdTime', now);
    }
}

window.triggerAd = async (taskId) => {
    const taskBtn = document.getElementById(`btn-task${taskId}`);
    const claimBtn = document.getElementById(`claim-task${taskId}`);
    const cooldownDiv = document.getElementById(`cooldown-task${taskId}`);
    
    if (taskBtn.disabled) return; // Already in cooldown

    taskBtn.disabled = true;
    cooldownDiv.innerText = "Watching ad...";

    let adFunc;
    if (taskId === 1) adFunc = window.show_10276123;
    else if (taskId === 2) adFunc = window.show_10337795;
    else if (taskId === 3) adFunc = window.show_10337853;
    else { // Task 4: Random
        const ads = [window.show_10276123, window.show_10337795, window.show_10337853];
        adFunc = ads[Math.floor(Math.random() * ads.length)];
    }

    try {
        await adFunc(); // Show the ad
        claimBtn.style.display = 'block'; // Show claim button
        cooldownDiv.innerText = ""; // Clear cooldown text
    } catch (e) {
        console.error(`Ad task ${taskId} failed:`, e);
        alert("Ad failed to load. Please try again.");
        taskBtn.disabled = false; // Re-enable button if ad failed
        cooldownDiv.innerText = "Ad failed.";
    }
};

window.claimReward = async (taskId) => {
    const cooldownKey = `cooldown_task_${taskId}`;
    const lastClaim = parseInt(localStorage.getItem(cooldownKey) || '0');
    const now = Date.now();

    if (now - lastClaim < 5 * 60 * 1000) { // 5 min cooldown
        alert("Please wait for the cooldown period before claiming again.");
        return;
    }

    const reward = REWARD_AMOUNT;
    try {
        // Use Firebase RTDB for balance updates for speed
        await update(ref(db, `users/${userId}`), {
            balance: FieldValue.increment(reward),
            totalAdsWatched: FieldValue.increment(1),
            [`rewardHistory/overall`]: FieldValue.increment(reward),
            // Update daily/weekly rewards - requires more complex date logic or a Cloud Function
            // For simplicity, we'll just update overall here.
        });
        localStorage.setItem(cooldownKey, now);
        
        // UI Updates
        document.getElementById(`claim-task${taskId}`).style.display = 'none';
        document.getElementById(`btn-task${taskId}`).style.display = 'block'; // Re-show the task button
        document.getElementById(`btn-task${taskId}`).disabled = true; // Disable until cooldown passes
        startCooldownTimer(taskId, 5 * 60); // Start 5 min cooldown timer
        showRandomAnimation(); // Show reward animation

    } catch (e) {
        console.error("Failed to claim reward:", e);
        alert("An error occurred while claiming your reward.");
    }
};

function startCooldownTimer(taskId, seconds) {
    const el = document.getElementById(`cooldown-task${taskId}`);
    const btn = document.getElementById(`btn-task${taskId}`);
    let timer = seconds;
    
    const interval = setInterval(() => {
        const minutes = Math.floor(timer / 60);
        const remainingSeconds = timer % 60;
        el.innerText = `Cooldown: ${minutes}m ${remainingSeconds}s`;
        timer--;
        if (timer < 0) {
            clearInterval(interval);
            el.innerText = "";
            btn.disabled = false;
            // Optionally re-fetch balance here to ensure it's up-to-date
        }
    }, 1000);
}

// --- Reward Animations ---
function showRandomAnimation() {
    const pop = document.getElementById('rewardPopup');
    const animClasses = ['animate__bounceIn', 'animate__tada', 'animate__pulse', 'animate__swing', 'animate__heartBeat'];
    const bgClasses = ['anim-1', 'anim-2', 'anim-3', 'anim-4', 'anim-5'];
    
    const animClass = animClasses[Math.floor(Math.random() * animClasses.length)];
    const bgClass = bgClasses[Math.floor(Math.random() * bgClasses.length)];

    pop.className = `reward-popup animate__animated ${animClass} ${bgClass}`;
    pop.style.display = 'block';

    setTimeout(() => {
        pop.classList.replace(animClass, 'animate__fadeOut');
        setTimeout(() => { pop.style.display = 'none'; }, 1000);
    }, 3000);
}

// --- Withdrawal Logic ---
function updateWithdrawBalance() {
    const balanceSpan = document.getElementById('withdrawBalance');
    balanceSpan.innerText = balanceDisplay.innerText; // Use the globally displayed balance
}

window.requestWithdrawal = async () => {
    const method = document.getElementById('withdrawMethod').value;
    const amountInput = document.getElementById('withdrawAmount');
    const amount = parseFloat(amountInput.value);
    const balance = parseFloat(balanceDisplay.innerText.replace('₱', ''));

    if (amount < 5) { alert("Minimum withdrawal is ₱5.00"); return; }
    if (amount > balance) { alert("Insufficient balance."); return; }

    let details = {};
    if (method === ' GCash') {
        const gcashNum = document.getElementById('gcashNumber').value.trim();
        if (!gcashNum) { alert("Please enter your GCash number."); return; }
        details = { gcashNumber: gcashNum, faucetPayEmail: null };
    } else { // FaucetPay
        const fpEmail = document.getElementById('faucetPayEmail').value.trim();
        if (!fpEmail) { alert("Please enter your FaucetPay email."); return; }
        details = { gcashNumber: null, faucetPayEmail: fpEmail };
    }

    const withdrawalId = push(ref(db, 'temp_withdrawals')).key; // Generate temp ID for RTDB listener
    const withdrawalData = {
        userId: userId,
        username: username,
        method: method.trim(),
        amount: amount,
        currency: 'PHP',
        usdtAmount: method === 'FaucetPay' ? (amount / USDT_RATE).toFixed(6) : null,
        details: details,
        requestedAt: Date.now(),
        status: 'pending',
        // ownerNotes: '', // For admin to add notes
        // processedAt: null,
    };

    try {
        // Use Firestore for withdrawal history and admin approval
        await addDoc(collection(fs, "withdrawals"), {
            ...withdrawalData,
            // Firestore handles serverTimestamp automatically if needed
        });

        // Deduct from RTDB balance immediately (can be reverted if admin denies)
        await update(ref(db, `users/${userId}`), {
            balance: FieldValue.increment(-amount) // Firestore negative increment
        });

        amountInput.value = ''; // Clear input
        document.getElementById('gcashNumber').value = '';
        document.getElementById('faucetPayEmail').value = '';
        alert("Withdrawal request submitted successfully!");
        loadWithdrawalHistory(); // Refresh history immediately
    } catch (e) {
        console.error("Withdrawal request failed:", e);
        alert("Failed to submit withdrawal request. Please try again later.");
        // Potentially revert balance deduction if Firestore failed
    }
};

// --- Withdrawal History (User View) ---
let currentWithdrawalPage = 0;
const withdrawalHistoryBody = document.getElementById('withdrawalHistoryBody');
const historyPagination = document.getElementById('historyPagination');

async function loadWithdrawalHistory(page = 0) {
    withdrawalHistoryBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading history...</td></tr>`;
    currentWithdrawalPage = page;
    const limitPerPage = ITEMS_PER_PAGE;
    const offset = page * limitPerPage;

    try {
        const q = query(collection(fs, "withdrawals"),
                      where("userId", "==", userId),
                      orderBy("requestedAt", "desc"),
                      limit(offset + limitPerPage)); // Get more to handle pagination client-side easily
        
        const snapshot = await getDocs(q);
        const withdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const paginatedWithdrawals = withdrawals.slice(offset, offset + limitPerPage);

        withdrawalHistoryBody.innerHTML = ''; // Clear loading message
        if (paginatedWithdrawals.length === 0) {
            withdrawalHistoryBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No withdrawal history yet.</td></tr>`;
        } else {
            paginatedWithdrawals.forEach(wd => {
                const row = withdrawalHistoryBody.insertRow();
                row.insertCell().innerText = wd.username || 'N/A';
                row.insertCell().innerText = wd.method || 'N/A';
                row.insertCell().innerText = `₱${wd.amount.toFixed(2)}${wd.usdtAmount ? ` / ${wd.usdtAmount} USDT` : ''}`;
                row.insertCell().innerText = new Date(wd.requestedAt).toLocaleString();
                
                let statusText = wd.status;
                let statusClass = 'status-pending';
                if (wd.status === 'approved') { statusClass = 'status-approved'; statusText = 'Approved'; }
                else if (wd.status === 'denied') { statusClass = 'status-denied'; statusText = 'Denied'; }
                else if (wd.status === 'paid') { statusClass = 'status-paid'; statusText = 'Paid'; }
                
                const statusCell = row.insertCell();
                statusCell.innerText = statusText;
                statusCell.className = statusClass;
            });
        }
        updateHistoryPaginationButtons(withdrawals.length);
    } catch (e) {
        console.error("Failed to load withdrawal history:", e);
        withdrawalHistoryBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Error loading history.</td></tr>`;
    }
}

function updateHistoryPaginationButtons(totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    document.getElementById('historyPageInfo').innerText = `Page ${currentWithdrawalPage + 1}`;
    document.getElementById('historyPagination').querySelector('.btn:first-child').disabled = currentWithdrawalPage === 0;
    document.getElementById('historyPagination').querySelector('.btn:last-child').disabled = currentWithdrawalPage >= totalPages - 1;
}

window.changeWithdrawalPage = (direction) => {
    loadWithdrawalHistory(currentWithdrawalPage + direction);
};

// --- Referrals ---
let currentReferralCode = '';
async function loadReferrals() {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    const data = snapshot.val();
    
    if (data) {
        currentReferralCode = data.referralCode;
        document.getElementById('referralCode').innerText = currentReferralCode;
        document.getElementById('totalReferrals').innerText = data.totalReferrals || 0;
        document.getElementById('claimableBonus').innerText = `₱${(data.claimableBonus || 0).toFixed(3)}`;
        
        const claimBtn = document.getElementById('claimReferralBonusBtn');
        claimBtn.disabled = (data.claimableBonus || 0) === 0;
    }
}

window.copyReferralCode = () => {
    copyToClipboard(currentReferralCode);
};

window.claimReferralBonus = async () => {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    const data = snapshot.val();

    if (!data || data.claimableBonus <= 0) {
        alert("No bonus available to claim.");
        return;
    }

    try {
        await update(userRef, {
            balance: FieldValue.increment(data.claimableBonus),
            claimableBonus: 0
        });
        alert(`₱${data.claimableBonus.toFixed(3)} bonus claimed!`);
        loadReferrals(); // Refresh display
    } catch (e) {
        console.error("Failed to claim referral bonus:", e);
        alert("Error claiming bonus. Please try again.");
    }
};


// --- Chat Logic ---
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const chatCooldownDiv = document.getElementById('chatCooldown');
let lastMessageTime = 0;

function loadChatMessages() {
    const messagesRef = ref(db, 'chatMessages');
    // Load latest 50 messages, listen for new ones
    const q = rtdbQuery(messagesRef, orderByChild('timestamp'), limitToLast(50));
    
    onChildAdded(q, (snapshot) => {
        const msg = snapshot.val();
        if (!msg) return;
        displayMessage(msg);
    });
    
    // Scroll to bottom on load
    setTimeout(() => chatBox.scrollTop = chatBox.scrollHeight, 500);
}

function displayMessage(msg) {
    const isOwnMessage = msg.userId === userId;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'sent' : 'received'}`;

    let content = msg.text;
    if (msg.adReward) { // Indicate if this message included a reward
        content += ` (+₱${msg.adReward.toFixed(2)})`;
    }
    
    messageDiv.innerHTML = `
        <div style="font-weight:bold; color:${isOwnMessage ? '#007bff' : '#27ae60'};">${msg.username}</div>
        <div>${content}</div>
        <div class="message-meta">${new Date(msg.timestamp).toLocaleTimeString()}</div>
    `;
    
    // Remove placeholder if it's the first message
    if (chatBox.querySelector('div') && chatBox.querySelector('div').innerText.includes('Loading messages')) {
        chatBox.innerHTML = '';
    }
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
}

window.sendMessage = async () => {
    const now = Date.now();
    if (now - lastMessageTime < CHAT_COOLDOWN) {
        chatCooldownDiv.innerText = `Please wait ${Math.ceil((CHAT_COOLDOWN - (now - lastMessageTime)) / 1000)} seconds to send another message.`;
        return;
    }
    chatCooldownDiv.innerText = ''; // Clear previous cooldown message

    const text = messageInput.value.trim();
    if (!text) return;

    // Add random ad to message
    const adRewardAmount = REWARD_AMOUNT; // 0.02
    const messageData = {
        userId: userId,
        username: username,
        text: text,
        timestamp: now,
        adReward: adRewardAmount, // Store that an ad was shown with this message
    };
    
    try {
        await push(ref(db, 'chatMessages'), messageData);
        messageInput.value = '';
        lastMessageTime = now;
        
        // Credit reward
        await update(ref(db, `users/${userId}`), {
             balance: FieldValue.increment(adRewardAmount),
             messagesSent: FieldValue.increment(1),
             // Update reward history metrics
        });
        
        // Show animation (optional, can be annoying in chat)
        // showRandomAnimation(); 

    } catch (e) {
        console.error("Failed to send message:", e);
        alert("Failed to send message. Please try again.");
    }
};

// --- Profile Logic ---
async function loadProfileInfo() {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    const data = snapshot.val();

    if (data) {
        document.getElementById('profileUsername').innerText = data.username;
        document.getElementById('profileTotalReferrals').innerText = data.totalReferrals || 0;
        document.getElementById('profileTotalAds').innerText = data.totalAdsWatched || 0;
        document.getElementById('profileRewardDay').innerText = `₱${(data.rewardHistory?.day || 0).toFixed(2)}`;
        document.getElementById('profileRewardWeek').innerText = `₱${(data.rewardHistory?.week || 0).toFixed(2)}`;
        document.getElementById('profileRewardOverall').innerText = `₱${(data.rewardHistory?.overall || 0).toFixed(2)}`;
        document.getElementById('profileMessagesSent').innerText = data.messagesSent || 0;
        
        // Add logic to show other users' profiles if clicking username
        // For now, just the message button
        if (userId.startsWith('anon_')) { // Don't allow messaging anonymous users or self
            document.getElementById('messageUserBtn').style.display = 'none';
        }
    }
}

window.messageUser = () => {
    // In a real app, you'd search for the user or have a way to select them.
    // For now, this is a placeholder.
    alert("Messaging functionality requires selecting a user. This is a placeholder.");
};

// --- Leaderboard Logic ---
let currentEarnerPage = 0;
let currentAdsPage = 0;
const earnerLeaderboardBody = document.getElementById('earnerLeaderboardBody');
const adsLeaderboardBody = document.getElementById('adsLeaderboardBody');

async function loadLeaderboards() {
    // Fetch Earners (requires Firestore snapshot listener for real-time updates)
    const earnersQuery = query(collection(fs, "users"), orderBy("balance", "desc"), limit(ITEMS_PER_PAGE));
    const earnersSnapshot = await getDocs(earnersQuery);
    renderLeaderboard(earnersSnapshot, earnerLeaderboardBody, 'balance', '₱');
    
    // Fetch Ads Watched
    const adsQuery = query(collection(fs, "users"), orderBy("totalAdsWatched", "desc"), limit(ITEMS_PER_PAGE));
    const adsSnapshot = await getDocs(adsQuery);
    renderLeaderboard(adsSnapshot, adsLeaderboardBody, 'totalAdsWatched', '');
}

function renderLeaderboard(snapshot, bodyElement, orderByField, currencyPrefix) {
    bodyElement.innerHTML = '';
    let rank = 1;
    snapshot.forEach(doc => {
        const data = doc.data();
        const row = bodyElement.insertRow();
        row.insertCell().innerText = rank++;
        row.insertCell().innerText = data.username || 'Anonymous';
        row.insertCell().innerText = `${currencyPrefix}${data[orderByField]?.toFixed(2) || data[orderByField] || 0}`;
    });
    if (snapshot.empty) {
        bodyElement.innerHTML = `<tr><td colspan="3">No data yet.</td></tr>`;
    }
}

// --- Topics Logic ---
let currentTopicPage = 0;
const topicsList = document.getElementById('topicsList');
const topicPagination = document.getElementById('topicPagination');

window.postTopic = async () => {
    const input = document.getElementById('topicInput');
    const title = input.value.trim();
    if (!title) { alert("Please enter a topic title."); return; }

    try {
        await addDoc(collection(fs, "topics"), {
            title: title,
            authorId: userId,
            authorUsername: username,
            createdAt: serverTimestamp(),
            replyCount: 0
        });
        input.value = "";
        loadTopics();
    } catch (e) {
        console.error("Failed to post topic:", e);
        alert("Error posting topic. Please try again.");
    }
};

async function loadTopics(page = 0) {
    topicsList.innerHTML = `<div style="text-align:center; padding:20px;">Loading topics...</div>`;
    currentTopicPage = page;
    const limitPerPage = ITEMS_PER_PAGE;
    const offset = page * limitPerPage;

    try {
        const q = query(collection(fs, "topics"), orderBy("createdAt", "desc"), limit(offset + limitPerPage));
        const snapshot = await getDocs(q);
        const topics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const paginatedTopics = topics.slice(offset, offset + limitPerPage);

        topicsList.innerHTML = '';
        if (paginatedTopics.length === 0) {
            topicsList.innerHTML = `<div style="text-align:center; padding:20px;">No topics yet. Be the first to post!</div>`;
        } else {
            paginatedTopics.forEach(topic => {
                topicsList.innerHTML += `
                    <div class="topic-item card" onclick="viewTopic('${topic.id}', '${topic.title}', '${topic.authorUsername}')">
                        <strong>${topic.title}</strong>
                        <div class="topic-meta">Posted by ${topic.authorUsername} on ${topic.createdAt.toDate().toLocaleString()} | Replies: ${topic.replyCount || 0}</div>
                    </div>
                `;
            });
        }
        updateTopicPaginationButtons(topics.length);
    } catch (e) {
        console.error("Failed to load topics:", e);
        topicsList.innerHTML = `<div style="text-align:center; padding:20px; color:red;">Error loading topics.</div>`;
    }
}

function updateTopicPaginationButtons(totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    document.getElementById('topicPageInfo').innerText = `Page ${currentTopicPage + 1}`;
    document.getElementById('topicPagination').querySelector('.btn:first-child').disabled = currentTopicPage === 0;
    document.getElementById('topicPagination').querySelector('.btn:last-child').disabled = currentTopicPage >= totalPages - 1;
}

window.changeTopicPage = (direction) => {
    loadTopics(currentTopicPage + direction);
};

// Placeholder for viewing a single topic (would need a new page/modal)
window.viewTopic = (topicId, title, author) => {
    alert(`Viewing topic: "${title}" by ${author} (ID: ${topicId}) - Full view not implemented in this version.`);
    // In a full app, you'd navigate to a new view/page showing topic details and replies.
};

// --- Owner Dashboard Logic ---
function showOwnerDashboard() {
    ownerPasswordPage.classList.add('active-page');
    ownerDashboard.classList.add('hidden');
}
function hideOwnerDashboard() {
    ownerDashboard.classList.add('hidden');
    ownerPasswordPage.classList.remove('active-page');
    showPage(PAGES.MAIN); // Go back to main menu
}

window.checkOwnerPassword = () => {
    if (ownerPasswordInput.value === OWNER_PASSWORD) {
        ownerPasswordPage.classList.remove('active-page');
        ownerDashboard.classList.remove('hidden');
        loadOwnerWithdrawals(); // Load data for the dashboard
        // loadOwnerTopics();
        // loadOwnerMessages();
    } else {
        alert("Incorrect Password!");
    }
};

let currentOwnerWithdrawalPage = 0;
const ownerWithdrawalBody = document.getElementById('ownerWithdrawalBody');

async function loadOwnerWithdrawals(page = 0) {
    ownerWithdrawalBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading requests...</td></tr>`;
    currentOwnerWithdrawalPage = page;
    const limitPerPage = ITEMS_PER_PAGE;
    const offset = page * limitPerPage;

    try {
        // Query for withdrawals, prioritizing pending ones first
        const pendingQuery = query(collection(fs, "withdrawals"), 
                                    where("status", "==", "pending"), 
                                    orderBy("requestedAt", "desc"),
                                    limit(offset + limitPerPage));
        const pendingSnapshot = await getDocs(pendingQuery);
        const pendingWithdrawals = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Query for other statuses if more data is needed
        // This example only loads pending for simplicity in ordering.
        
        const paginatedWithdrawals = pendingWithdrawals.slice(offset, offset + limitPerPage);

        ownerWithdrawalBody.innerHTML = '';
        if (paginatedWithdrawals.length === 0) {
            ownerWithdrawalBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No pending withdrawal requests.</td></tr>`;
        } else {
             paginatedWithdrawals.forEach(wd => {
                const row = ownerWithdrawalBody.insertRow();
                row.insertCell().innerText = `${wd.username || 'N/A'} (${wd.userId.substring(0,5)}...)`;
                row.insertCell().innerText = wd.method || 'N/A';
                row.insertCell().innerText = `₱${wd.amount.toFixed(2)}`;
                row.insertCell().innerText = new Date(wd.requestedAt).toLocaleString();
                
                let statusText = wd.status;
                let statusClass = 'pending';
                if (wd.status === 'approved') { statusClass = 'approved'; statusText = 'Approved'; }
                else if (wd.status === 'denied') { statusClass = 'denied'; statusText = 'Denied'; }
                else if (wd.status === 'paid') { statusClass = 'paid'; statusText = 'Paid'; }

                const statusCell = row.insertCell();
                statusCell.innerHTML = `<span class="dash-status ${statusClass}">${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</span>`;

                const actionsCell = row.insertCell();
                actionsCell.innerHTML = `
                    <button class="btn green small" onclick="processWithdrawal('${wd.id}', '${wd.userId}', '${wd.amount}', 'paid', '${wd.method}', '${wd.usdtAmount || 'N/A'}')">✅ Paid</button>
                    <button class="btn red small" onclick="processWithdrawal('${wd.id}', '${wd.userId}', '${wd.amount}', 'denied')">❌ Deny</button>
                `;
            });
        }
        // updateOwnerWithdrawalPaginationButtons(pendingWithdrawals.length); // Need to adjust for total count
    } catch (e) {
        console.error("Failed to load owner withdrawals:", e);
        ownerWithdrawalBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error loading requests.</td></tr>`;
    }
}

window.processWithdrawal = async (wdId, userId, amount, newStatus, method = null, usdtAmount = null) => {
    const withdrawalRef = doc(fs, "withdrawals", wdId);
    const userRef = ref(db, `users/${userId}`); // RTDB for balance

    try {
        // Use a batch write or transaction for atomicity
        const batch = writeBatch(fs);
        batch.update(withdrawalRef, { status: newStatus, processedAt: Date.now() });

        // If approved/paid, do NOT deduct from balance again (it was deducted on request)
        // If denied, we need to add the balance back.
        if (newStatus === 'denied') {
            const currentBalanceSnapshot = await get(userRef);
            const currentBalance = currentBalanceSnapshot.val()?.balance || 0;
            await update(userRef, { balance: FieldValue.increment(parseFloat(amount)) }); // Add balance back
        } else if (newStatus === 'paid' && method === 'FaucetPay') {
            // For FaucetPay (USDT), potentially update a ledger or just mark as paid.
            // Balance was already deducted.
        } else if (newStatus === 'paid' && method === ' GCash') {
             // Balance was already deducted.
        }

        await batch.commit();
        alert(`Withdrawal ${newStatus} successfully.`);
        loadOwnerWithdrawals(); // Refresh list
        // Real-time update to user's history via snapshot listeners
        
        // Update total approved count (can use a counter in RTDB or Firestore for this)
        updateTotalApprovedWithdrawals();

    } catch (e) {
        console.error("Failed to process withdrawal:", e);
        alert("Failed to process. Check console.");
    }
};

async function updateTotalApprovedWithdrawals() {
     const countQuery = query(collection(fs, "withdrawals"), where("status", "in", ["approved", "paid"]));
     const snapshot = await getCountFromServer(countQuery);
     const totalAmountQuery = query(collection(fs, "withdrawals"), where("status", "in", ["approved", "paid"]));
     const amountSnapshot = await getDocs(totalAmountQuery);
     let totalAmount = 0;
     amountSnapshot.forEach(doc => { totalAmount += doc.data().amount || 0; });
     
     totalApprovedWithdrawalsDisplay.innerText = `₱${totalAmount.toFixed(2)}`;
}

// Need to implement pagination for ownerWithdrawalPagination, ownerTopicsPagination, etc.

// --- Initialization Call ---
initApp();
