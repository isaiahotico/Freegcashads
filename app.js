
/* ================= FIREBASE CONFIG ================= */
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ================= TELEGRAM INTEGRATION ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name || `User${tgUser.id}`}` : "Guest_" + Math.floor(Math.random() * 9999);
document.getElementById("userBar").innerText = "👤 User: " + username;

/* ================= APP STATE & CONSTANTS ================= */
let currentBalance = 0;
let currentChatMode = ''; // 'elementary', 'highschool', 'college'
let lastSentTime = {}; // Stores cooldowns per chat mode
let userSettings = {}; // Stores user-specific settings like referral code, hasWithdrawnBefore, etc.

// Monetag Ad Functions (ensure these are globally accessible or properly namespaced)
// These should map to the SDK script tags in HTML
const monetagAds = {
    show_10337853: window.show_10337853,
    show_10276123: window.show_10276123,
    show_10337795: window.show_10337795,
    show_GENERIC: window.show_GENERIC || (() => Promise.reject("Backup ad not loaded")) // Backup Ad Function
};

// Ad Zone IDs (for potential manual calling if needed)
const AD_ZONES = {
    INTERSTITIAL_HIGH_CPM_1: '10337853',
    INTERSTITIAL_HIGH_CPM_2: '10276123',
    INTERSTITIAL_HIGH_CPM_3: '10337795',
    REWARDED_BONUS_1: '10276123', // Example mapping, adjust as needed
    REWARDED_BONUS_2: '10337795',
    REWARDED_BONUS_3: '10337853',
    BACKUP_INTERSTITIAL: 'YOUR_BACKUP_INTERSTITIAL_ZONE_ID' // Replace with actual backup zone ID
};

const BACKGROUND_COLORS = ['pink', 'green', 'blue', 'red', 'violet', 'yellow', 'yellowgreen', 'orange', 'white', 'cyan', 'brown'];

// Pagination Constants
const PAGE_SIZES = {
    chat: 50,
    onlineUsers: 25,
    withdrawal: 25,
    ownerDashboard: 25,
    leaderboard: 500,
    referrals: 25
};

// Pagination State
let paginationState = {
    chat: { currentPage: 1, lastVisible: null, firstVisible: null },
    onlineUsers: { currentPage: 1, lastVisible: null, firstVisible: null },
    withdrawal: { currentPage: 1, lastVisible: null, firstVisible: null },
    ownerDashboard: { currentPage: 1, lastVisible: null, firstVisible: null },
    leaderboard: { currentPage: 1, lastVisible: null, firstVisible: null },
    referrals: { currentPage: 1, lastVisible: null, firstVisible: null }
};

// Cooldowns
const CHAT_COOLDOWNS = { // in milliseconds
    elementary: 3 * 60 * 1000, // 3 minutes
    highschool: 3 * 60 * 1000, // 3 minutes
    college: 3 * 60 * 1000     // 3 minutes
};
const REWARD_AMOUNT_CHAT = 0.015; // Reward for chat messages (Highschool/College)
const REWARD_AMOUNT_BONUS = 0.015; // Reward for bonus ads
const AUTO_INTERSTITIAL_COOLDOWN = 3 * 60 * 1000; // 3 minutes for automatic interstitial ads
const ONLINE_UPDATE_INTERVAL = 5000; // 5 seconds
const LEADERBOARD_REFRESH_INTERVAL = 60000; // 1 minute
const REFERRAL_BONUS_PERCENTAGE = 0.08; // 8%
const BONUS_AD_CLAIM_COOLDOWN = 20 * 60 * 1000; // 20 minutes

// Owner Dashboard
const OWNER_PASSWORD = "Propetas12";
let ownerAuthenticated = false;
let totalApprovedWithdrawals = 0;

// Leaderboard
let lastLeaderboardReset = null;

// Timers
let onlineUsersInterval;
let leaderboardRefreshInterval;
let autoInterstitialInterval;
let youtubeTimerInterval;
let bonusRewardTimerInterval;

// Bonus Ads State
let watchedAdsForBonus = { bonus1: false, bonus2: false, bonus3: false };
let lastBonusRewardClaimTime = parseFloat(localStorage.getItem('lastBonusRewardClaimTime') || 0);

/* ================= INITIALIZATION ================= */
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setInterval(updateUI, 1000); // Update time and balance every second
    setInterval(cleanupOldMessages, 6 * 60 * 60 * 1000); // Clean up every 6 hours
    startAutoInterstitialAdInterval(); // Start interval for automatic interstitial ads
    updateBonusRewardCooldownDisplay(); // Show initial cooldown status
});

async function initApp() {
    await loadUserSettings(); // Load balance, settings, referral code, etc.
    openView('mainMenu'); // Start at the main menu
    triggerAutoInterstitialAd(); // Show an ad on app open
}

async function loadUserSettings() {
    const userDocRef = db.collection("users").doc(username);
    try {
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
            const data = userDoc.data();
            currentBalance = data.balance || 0;
            lastSentTime = data.lastSentTime || { elementary: 0, highschool: 0, college: 0 };
            userSettings = {
                hasWithdrawnBefore: data.hasWithdrawnBefore || false,
                referralCode: data.referralCode || generateReferralCode(),
                referredBy: data.referredBy || null,
                totalReferralBonus: data.totalReferralBonus || 0,
                referralsCount: data.referralsCount || 0,
                leaderboardEntry: data.leaderboardEntry || null // Store user's leaderboard data if available
            };
            if (!data.referralCode) { // If no code generated, set it now
                 await userDocRef.set({ referralCode: userSettings.referralCode }, { merge: true });
            }
            if (!data.hasWithdrawnBefore) { // Ensure hasWithdrawnBefore is set correctly
                localStorage.setItem('hasWithdrawnBefore', 'false');
            } else {
                 localStorage.setItem('hasWithdrawnBefore', 'true');
            }
        } else {
            // Create new user document
            const newReferralCode = generateReferralCode();
            await userDocRef.set({
                balance: 0,
                lastSentTime: { elementary: 0, highschool: 0, college: 0 },
                hasWithdrawnBefore: false,
                referralCode: newReferralCode,
                referredBy: null,
                totalReferralBonus: 0,
                referralsCount: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            userSettings = {
                hasWithdrawnBefore: false,
                referralCode: newReferralCode,
                referredBy: null,
                totalReferralBonus: 0,
                referralsCount: 0,
                leaderboardEntry: null
            };
            localStorage.setItem('hasWithdrawnBefore', 'false');
        }
        document.getElementById("userReferralCode").innerText = userSettings.referralCode;
        document.getElementById("referralCount").innerText = userSettings.referralsCount;
        document.getElementById("totalReferralBonus").innerText = userSettings.totalReferralBonus.toFixed(3);
        
    } catch (error) {
        console.error("Error loading user settings:", error);
        alert("Error loading your data. Please try again later.");
    }
    updateUI();
}

async function updateUserData(data) {
    const userDocRef = db.collection("users").doc(username);
    try {
        await userDocRef.set(data, { merge: true });
        // Update local userSettings if they are affected
        for (const key in data) {
            if (userSettings.hasOwnProperty(key)) {
                userSettings[key] = data[key];
            }
        }
        if (data.balance !== undefined) currentBalance = data.balance;
        if (data.totalReferralBonus !== undefined) document.getElementById("totalReferralBonus").innerText = data.totalReferralBonus.toFixed(3);
        if (data.referralsCount !== undefined) document.getElementById("referralCount").innerText = data.referralsCount;
        if (data.referralCode !== undefined) { document.getElementById("userReferralCode").innerText = data.referralCode; }
        if (data.hasWithdrawnBefore !== undefined) localStorage.setItem('hasWithdrawnBefore', data.hasWithdrawnBefore ? 'true' : 'false');

        updateUI();
    } catch (error) {
        console.error("Error updating user data:", error);
    }
}

/* ================= UI HELPER FUNCTIONS ================= */
function updateUI() {
    document.getElementById("userBalance").innerText = currentBalance.toFixed(3);
    document.getElementById("withdrawalBalanceDisplay").innerText = currentBalance.toFixed(3);
    document.getElementById("footer-date").innerText = new Date().toLocaleString();
}

function openView(viewId, mode = '') {
    document.querySelectorAll('.page-view').forEach(view => view.style.display = 'none');
    document.getElementById('mainMenu').style.display = 'none';

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
    } else {
        openView('mainMenu'); // Fallback
        return;
    }

    // View-specific logic
    if (viewId === 'chatView') {
        currentChatMode = mode;
        document.getElementById("chatTitle").innerText = `${mode.toUpperCase()} CHAT`;
        document.getElementById("claimRewardBtn").style.display = 'none'; // Hide chat reward button by default
        document.getElementById("sendBtn").style.display = 'inline-block';
        resetPagination('chat');
        loadMessages();
        startOnlineUserUpdates(); // Ensure online users are updated when in chat
        stopAutoInterstitialAdInterval(); // Pause auto ads when actively using the app
    } else if (viewId === 'onlineUsersView') {
        resetPagination('onlineUsers');
        loadOnlineUsers();
        startOnlineUserUpdates();
        stopAutoInterstitialAdInterval();
    } else if (viewId === 'withdrawalView') {
        resetPagination('withdrawal');
        loadWithdrawalHistory();
        checkFirstTimeWithdrawal();
        stopOnlineUserUpdates();
        stopAutoInterstitialAdInterval();
    } else if (viewId === 'ownerDashboardView') {
        stopOnlineUserUpdates();
        stopAutoInterstitialAdInterval();
        if (ownerAuthenticated) {
            loadOwnerDashboard();
            resetPagination('ownerDashboard');
        } else {
            document.getElementById('ownerDashboardContent').style.display = 'block';
            document.getElementById('ownerDashboardMain').style.display = 'none';
            document.getElementById('ownerPassword').value = ''; // Clear password field
        }
    } else if (viewId === 'leaderboardView') {
        resetPagination('leaderboard');
        loadLeaderboard();
        startLeaderboardRefresh();
        stopOnlineUserUpdates();
        stopAutoInterstitialAdInterval();
    } else if (viewId === 'helpView') {
        stopOnlineUserUpdates();
        stopLeaderboardRefresh();
        stopAutoInterstitialAdInterval();
    } else if (viewId === 'referralsView') {
        loadReferralData();
        stopOnlineUserUpdates();
        stopLeaderboardRefresh();
        stopAutoInterstitialAdInterval();
    } else if (viewId === 'bonusAdsView') {
        stopOnlineUserUpdates();
        stopLeaderboardRefresh();
        stopAutoInterstitialAdInterval(); // Pause auto ads when on bonus page
        resetBonusAdState(); // Reset button states
        updateBonusRewardCooldownDisplay(); // Update cooldown display on view load
    } else { // Main Menu
        stopOnlineUserUpdates();
        stopLeaderboardRefresh();
        startAutoInterstitialAdInterval(); // Resume auto ads when back at main menu
    }
}

function handleBgChange(e) {
    const body = document.getElementById("appBody");
    if (e.target.tagName === 'BUTTON') {
        e.target.style.backgroundColor = BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)];
    }
    const rand = Math.floor(Math.random() * (BACKGROUND_COLORS.length + 1));
    if (rand === BACKGROUND_COLORS.length) {
        body.className = "brick-bg";
        body.style.backgroundColor = "";
    } else {
        body.className = "";
        body.style.backgroundColor = BACKGROUND_COLORS[rand];
    }
}

/* ================= ADVERTISING LOGIC ================= */

/**
 * Shows a combination of rewarded ads and handles reward logic.
 * @param {string} bonusId - Identifier for the bonus ad set (e.g., 'bonus1').
 * @returns {Promise<boolean>} True if ads were successfully shown and reward logic initiated, false otherwise.
 */
async function showBonusAds(bonusId) {
    const rewardButton = document.getElementById('claimBonusRewardBtn');
    const cooldownInfo = document.getElementById('claimCooldownInfo');
    const rewardTimerSpan = document.getElementById('rewardTimer');

    // Check cooldown before showing ads
    const now = Date.now();
    if (now - lastBonusRewardClaimTime < BONUS_AD_CLAIM_COOLDOWN) {
        alert("Please wait for the cooldown period before claiming another reward.");
        updateBonusRewardCooldownDisplay(); // Ensure display is correct
        return false;
    }

    // Reset states for this specific bonus ID
    watchedAdsForBonus[bonusId] = false;
    rewardButton.disabled = true;
    rewardButton.style.display = 'none';
    cooldownInfo.style.display = 'block'; // Show cooldown timer

    // Define ads for this bonus
    let adsToShow = [];
    if (bonusId === 'bonus1') {
        adsToShow = [monetagAds.show_10276123, monetagAds.show_10337795, monetagAds.show_10337853];
    } else if (bonusId === 'bonus2') {
        adsToShow = [monetagAds.show_10337795, monetagAds.show_10276123, monetagAds.show_10337853]; // Example rotation
    } else { // bonus3
        adsToShow = [monetagAds.show_10337853, monetagAds.show_10276123, monetagAds.show_10337795]; // Example rotation
    }

    let success = true;
    for (const adFunc of adsToShow) {
        try {
            await adFunc(); // Execute the ad function
            await new Promise(resolve => setTimeout(resolve, 2000)); // Short delay between ads if needed
        } catch (e) {
            console.warn(`Ad failed to show for ${bonusId}:`, e);
            success = false;
            // Optionally, try to show a backup ad here
        }
    }

    if (success) {
        watchedAdsForBonus[bonusId] = true;
        rewardButton.style.display = 'inline-block'; // Show the claim button
        rewardButton.disabled = false;
        cooldownInfo.style.display = 'none'; // Hide cooldown timer
        showRewardAnimation(); // Show a visual confirmation
        return true;
    } else {
        alert("Failed to show all ads. Please try again. Ensure ad blockers are off.");
        return false;
    }
}

/**
 * Claims the bonus reward after ads have been watched.
 */
async function claimBonusReward() {
    const now = Date.now();
    if (now - lastBonusRewardClaimTime < BONUS_AD_CLAIM_COOLDOWN) {
        alert("Please wait for the cooldown period before claiming another reward.");
        updateBonusRewardCooldownDisplay();
        return;
    }
    
    // Check if any ads were actually watched for the current session
    if (!Object.values(watchedAdsForBonus).some(watched => watched)) {
         alert("Please watch ads first to unlock the reward.");
         return;
    }

    await updateBalance(REWARD_AMOUNT_BONUS);
    lastBonusRewardClaimTime = now;
    localStorage.setItem('lastBonusRewardClaimTime', now);
    alert(`You have claimed your ₱${REWARD_AMOUNT_BONUS.toFixed(3)} bonus reward!`);
    showRewardAnimation();
    
    // Reset bonus ad state and button
    resetBonusAdState();
    updateBonusRewardCooldownDisplay();
}

function resetBonusAdState() {
    watchedAdsForBonus = { bonus1: false, bonus2: false, bonus3: false };
    document.getElementById('claimBonusRewardBtn').style.display = 'none';
    document.getElementById('claimBonusRewardBtn').disabled = true;
    document.getElementById('claimCooldownInfo').style.display = 'block';
}

function updateBonusRewardCooldownDisplay() {
    const cooldownInfo = document.getElementById('claimCooldownInfo');
    const rewardTimerSpan = document.getElementById('rewardTimer');
    const now = Date.now();
    const timeRemaining = BONUS_AD_CLAIM_COOLDOWN - (now - lastBonusRewardClaimTime);

    if (timeRemaining <= 0) {
        cooldownInfo.style.display = 'none';
        rewardTimerSpan.innerText = "00:00";
        // Ensure claim button is enabled if ads were watched
        if (Object.values(watchedAdsForBonus).some(watched => watched)) {
            document.getElementById('claimBonusRewardBtn').disabled = false;
            document.getElementById('claimBonusRewardBtn').style.display = 'inline-block';
        }
        if (bonusRewardTimerInterval) clearInterval(bonusRewardTimerInterval);
        return;
    }

    cooldownInfo.style.display = 'block';
    if (!bonusRewardTimerInterval) {
        bonusRewardTimerInterval = setInterval(updateBonusRewardCooldownDisplay, 1000);
    }

    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    rewardTimerSpan.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Interval for automatic interstitial ads
let autoInterstitialInterval;
const AUTO_INTERSTITIAL_ZONE_ID = AD_ZONES.BACKUP_INTERSTITIAL; // Default backup zone ID

// Function to get a random high-CPM interstitial ad function
function getRandomInterstitialAd() {
    const availableAds = [
        monetagAds.show_10337853,
        monetagAds.show_10276123,
        monetagAds.show_10337795,
        monetagAds.show_GENERIC // Backup ad
    ];
    // Simple random selection. More sophisticated logic could prioritize based on CPM data if available.
    return availableAds[Math.floor(Math.random() * availableAds.length)];
}

async function triggerAutoInterstitialAd() {
    const adFunc = getRandomInterstitialAd();
    try {
        await adFunc();
        console.log("Auto interstitial ad shown.");
    } catch (e) {
        console.warn("Auto interstitial ad failed to show:", e);
    }
}

function startAutoInterstitialAdInterval() {
    if (!autoInterstitialInterval) {
        // Trigger immediately on start
        triggerAutoInterstitialAd();
        // Set interval
        autoInterstitialInterval = setInterval(triggerAutoInterstitialAd, AUTO_INTERSTITIAL_COOLDOWN);
    }
}

function stopAutoInterstitialAdInterval() {
    if (autoInterstitialInterval) {
        clearInterval(autoInterstitialInterval);
        autoInterstitialInterval = null;
    }
}

// Chat specific ad logic (unchanged from previous version)
async function processMessage() {
    const text = document.getElementById("messageInput").value.trim();
    if (!text) { alert("Message cannot be empty!"); return; }

    const now = Date.now();
    const cooldownMs = CHAT_COOLDOWNS[currentChatMode];
    
    if (now - lastSentTime[currentChatMode] < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastSentTime[currentChatMode])) / 1000);
        document.getElementById('cooldownDisplay').innerText = `Cooldown active. Wait ${remaining} seconds.`;
        return;
    }
    document.getElementById('cooldownDisplay').innerText = '';

    // Trigger rewarded ads for chat messages
    const adsShown = await triggerRewardedAdsForChat(); 
    await sendMessage(text); 

    if (adsShown) {
        if (currentChatMode === 'elementary') {
            await updateBalance(REWARD_AMOUNT_CHAT);
            showRewardAnimation();
        } else { // Highschool & College
            document.getElementById("sendBtn").style.display = "none";
            document.getElementById("claimRewardBtn").style.display = "inline-block";
        }
    } else {
        alert("Ads could not be shown. No reward for this message.");
    }

    lastSentTime[currentChatMode] = now;
    await updateUserData({ lastSentTime: lastSentTime });
    document.getElementById("messageInput").value = "";
}

// Function specifically for chat-related rewarded ads
async function triggerRewardedAdsForChat() {
    // Use a selection of high-CPM rewarded ads
    const rewardedAdFuncs = [
        monetagAds.show_10276123, 
        monetagAds.show_10337795, 
        monetagAds.show_10337853
    ];
    const randomAd = rewardedAdFuncs[Math.floor(Math.random() * rewardedAdFuncs.length)];
    try {
        await randomAd();
        // Optionally show a second ad for potentially higher CPM, if strategy dictates
        // await randomAd(); 
        return true;
    } catch (e) {
        console.warn("Rewarded ad for chat failed:", e);
        alert("Ads were blocked or an error occurred. Please disable ad blockers to support us.");
        return false; 
    }
}

async function sendMessage(text) {
    await db.collection("messages").add({
        user: username,
        text: text,
        mode: currentChatMode,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    loadMessages(); // Refresh chat after sending
}

async function claimReward() {
    await updateBalance(REWARD_AMOUNT_CHAT);
    showRewardAnimation();
    document.getElementById("claimRewardBtn").style.display = "none";
    document.getElementById("sendBtn").style.display = "inline-block";
}

async function updateBalance(amount) {
    currentBalance += amount;
    await updateUserData({ balance: currentBalance });
    updateUI();
}

// Pagination Handlers
function updatePaginationControls(paginationKey, dataLength) {
    const state = paginationState[paginationKey];
    const prevBtn = document.getElementById(`prevPage${capitalize(paginationKey)}`);
    const nextBtn = document.getElementById(`nextPage${capitalize(paginationKey)}`);
    const pageInfo = document.getElementById(`${capitalize(paginationKey)}PageInfo`);

    if(prevBtn) prevBtn.disabled = state.currentPage === 1;
    if(nextBtn) nextBtn.disabled = dataLength < PAGE_SIZES[paginationKey];
    if(pageInfo) pageInfo.innerText = `Page ${state.currentPage}`;
}
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

async function loadMessages() {
    let query = db.collection("messages")
                  .where("mode", "==", currentChatMode)
                  .orderBy("timestamp", "desc")
                  .limit(PAGE_SIZES.chat);

    if (paginationState.chat.currentPage > 1 && paginationState.chat.lastVisible) {
        query = query.startAfter(paginationState.chat.lastVisible);
    }

    const snapshot = await query.get();
    const container = document.getElementById('msg-box');
    container.innerHTML = '';
    
    if (snapshot.empty && paginationState.chat.currentPage > 1) {
        paginationState.chat.currentPage--;
        loadMessages();
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'N/A';
        container.innerHTML += `<div class="msg"><b>${data.user}</b> (${date}): ${data.text}</div>`;
    });
    container.scrollTop = container.scrollHeight;

    paginationState.chat.firstVisible = snapshot.docs[0];
    paginationState.chat.lastVisible = snapshot.docs[snapshot.docs.length - 1];
    updatePaginationControls('chat', snapshot.docs.length);
}

function navigateChatPage(direction) {
    paginationState.chat.currentPage += direction;
    loadMessages();
}

async function cleanupOldMessages() {
    const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
    const oldMsgs = await db.collection("messages").where("timestamp", "<", threeDaysAgo).get();
    const batch = db.batch();
    oldMsgs.forEach(doc => batch.delete(doc.ref));
    if (oldMsgs.size > 0) {
        console.log(`Deleted ${oldMsgs.size} old messages.`);
        await batch.commit();
    }
}

/* ================= ONLINE USERS LOGIC ================= */
async function updateOnlineStatus() {
    await db.collection("onlineUsers").doc(username).set({
        username: username,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

function startOnlineUserUpdates() {
    if (!onlineUsersInterval) {
        onlineUsersInterval = setInterval(() => {
            updateOnlineStatus();
            loadOnlineUsers(); // Refresh list periodically
        }, ONLINE_UPDATE_INTERVAL);
        updateOnlineStatus(); // Initial update
    }
}
function stopOnlineUserUpdates() {
    if (onlineUsersInterval) {
        clearInterval(onlineUsersInterval);
        onlineUsersInterval = null;
    }
}

async function loadOnlineUsers() {
    const tenSecondsAgo = new Date(Date.now() - (10 * 1000)); // Active if last seen in 10 seconds
    let query = db.collection("onlineUsers")
                  .where("lastActive", ">=", tenSecondsAgo)
                  .orderBy("lastActive", "desc")
                  .limit(PAGE_SIZES.onlineUsers);

    if (paginationState.onlineUsers.currentPage > 1 && paginationState.onlineUsers.lastVisible) {
        query = query.startAfter(paginationState.onlineUsers.lastVisible);
    }

    const snapshot = await query.get();
    const container = document.getElementById('onlineUsersList');
    container.innerHTML = '';
    
    // Fetch all users for total count (expensive, ideally use Cloud Function)
    const allOnlineSnapshot = await db.collection("onlineUsers").where("lastActive", ">=", tenSecondsAgo).get();
    document.getElementById('onlineUsersCount').innerText = allOnlineSnapshot.size;

    if (snapshot.empty && paginationState.onlineUsers.currentPage > 1) {
        paginationState.onlineUsers.currentPage--;
        loadOnlineUsers();
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        container.innerHTML += `
            <div class="online-user-item">
                <span><span class="status-dot"></span> ${data.username}</span>
                <span>Online</span>
            </div>
        `;
    });

    paginationState.onlineUsers.firstVisible = snapshot.docs[0];
    paginationState.onlineUsers.lastVisible = snapshot.docs[snapshot.docs.length - 1];
    updatePaginationControls('onlineUsers', snapshot.docs.length);
}

function navigateOnlinePage(direction) {
    paginationState.onlineUsers.currentPage += direction;
    loadOnlineUsers();
}

/* ================= WITHDRAWAL SYSTEM LOGIC ================= */
let withdrawalTimer;
async function checkFirstTimeWithdrawal() {
    const hasWithdrawn = localStorage.getItem('hasWithdrawnBefore') === 'true';
    if (hasWithdrawn) {
        document.getElementById('firstTimeWithdrawalInfo').style.display = 'none';
        document.getElementById('withdrawalInputs').style.display = 'block';
    } else {
        document.getElementById('firstTimeWithdrawalInfo').style.display = 'block';
        document.getElementById('withdrawalInputs').style.display = 'none';
        document.getElementById('activateWithdrawalBtn').disabled = false;
        document.getElementById('youtubeTimer').innerText = '30';
    }
}

function startWithdrawalActivation() {
    document.getElementById('activateWithdrawalBtn').disabled = true;
    let timer = 30;
    document.getElementById('youtubeTimer').innerText = timer;
    window.open("https://www.youtube.com/@TKGAHLOVERS", "_blank", "noopener,noreferrer"); // Open in new tab

    if (youtubeTimerInterval) clearInterval(youtubeTimerInterval);
    youtubeTimerInterval = setInterval(() => {
        timer--;
        document.getElementById('youtubeTimer').innerText = timer;
        if (timer <= 0) {
            clearInterval(youtubeTimerInterval);
            localStorage.setItem('hasWithdrawnBefore', 'true');
            alert('Withdrawal system activated!');
            updateUserData({ hasWithdrawnBefore: true });
            checkFirstTimeWithdrawal(); // Refresh UI
        }
    }, 1000);
}

async function submitWithdrawal() {
    const gcashNumber = document.getElementById('gcashNumberInput').value.trim();
    const amount = parseFloat(document.getElementById('withdrawalAmountInput').value);

    if (!localStorage.getItem('hasWithdrawnBefore') === 'true') { alert("Activate withdrawal system first!"); return; }
    if (!/^\d{11}$/.test(gcashNumber)) { alert("Invalid GCash number format. Use 11 digits."); return; }
    if (isNaN(amount) || amount < 0.02) { alert("Minimum withdrawal is ₱0.02."); return; }
    if (amount > currentBalance) { alert("Insufficient balance."); return; }

    if (!confirm(`Confirm withdrawal of ₱${amount.toFixed(2)} to GCash ${gcashNumber}?`)) return;

    currentBalance -= amount;
    await updateUserData({ balance: currentBalance });

    await db.collection("withdrawals").add({
        username: username,
        gcashNumber: gcashNumber,
        amount: amount,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
    });

    alert(`Withdrawal request submitted!`);
    document.getElementById('withdrawalAmountInput').value = '';
    loadWithdrawalHistory();
    updateUI();
}

async function loadWithdrawalHistory() {
    let query = db.collection("withdrawals")
                  .where("username", "==", username)
                  .orderBy("timestamp", "desc")
                  .limit(PAGE_SIZES.withdrawal);

    if (paginationState.withdrawal.currentPage > 1 && paginationState.withdrawal.lastVisible) {
        query = query.startAfter(paginationState.withdrawal.lastVisible);
    }

    const snapshot = await query.get();
    const tbody = document.getElementById('withdrawalHistoryBody');
    tbody.innerHTML = '';

    if (snapshot.empty && paginationState.withdrawal.currentPage > 1) {
        paginationState.withdrawal.currentPage--;
        loadWithdrawalHistory();
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'N/A';
        tbody.innerHTML += `
            <tr>
                <td>${date}</td>
                <td>₱${data.amount.toFixed(2)}</td>
                <td>${data.gcashNumber}</td>
                <td class="status-${data.status}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</td>
            </tr>
        `;
    });

    paginationState.withdrawal.firstVisible = snapshot.docs[0];
    paginationState.withdrawal.lastVisible = snapshot.docs[snapshot.docs.length - 1];
    updatePaginationControls('withdrawal', snapshot.docs.length);
}

function navigateWithdrawalPage(direction) {
    paginationState.withdrawal.currentPage += direction;
    loadWithdrawalHistory();
}

/* ================= OWNER DASHBOARD LOGIC ================= */
function unlockOwnerFeatures() {
    document.getElementById('ownerAuthInput').style.display = 'block';
    document.getElementById('ownerDashboardMain').style.display = 'none'; // Hide main content until authenticated
}

async function authenticateOwner() {
    const password = document.getElementById('ownerPassword').value;
    if (password === OWNER_PASSWORD) {
        ownerAuthenticated = true;
        document.getElementById('ownerAuthInput').style.display = 'none';
        document.getElementById('ownerDashboardMain').style.display = 'block';
        document.getElementById('ownerPassword').value = ''; // Clear input
        await loadOwnerDashboard();
        resetPagination('ownerDashboard');
        // Show owner controls for viewing total approved withdrawals
        const totalApprovedSnapshot = await db.collection("withdrawals").where("status", "==", "approved").get();
        totalApprovedWithdrawals = totalApprovedSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
        document.getElementById("totalApprovedAmount").innerText = totalApprovedWithdrawals.toFixed(3);
    } else {
        alert("Incorrect Password!");
    }
}

async function loadOwnerDashboard() {
    if (!ownerAuthenticated) return;

    let query = db.collection("withdrawals").orderBy("timestamp", "desc").limit(PAGE_SIZES.ownerDashboard);
    
    if (paginationState.ownerDashboard.currentPage > 1 && paginationState.ownerDashboard.lastVisible) {
        query = query.startAfter(paginationState.ownerDashboard.lastVisible);
    }

    const snapshot = await query.get();
    const tbody = document.getElementById('ownerDashboardBody');
    tbody.innerHTML = '';

    if (snapshot.empty && paginationState.ownerDashboard.currentPage > 1) {
        paginationState.ownerDashboard.currentPage--;
        loadOwnerDashboard();
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'N/A';
        const statusClass = `owner-${data.status}`;
        tbody.innerHTML += `
            <tr>
                <td>${data.username}</td>
                <td>${date}</td>
                <td>₱${data.amount.toFixed(2)}</td>
                <td>${data.gcashNumber}</td>
                <td class="${statusClass}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</td>
                <td>
                    <button class="owner-action-btn owner-approve" onclick="updateWithdrawalStatus('${doc.id}', 'approved', ${data.amount})">Approve</button>
                    <button class="owner-action-btn owner-deny" onclick="updateWithdrawalStatus('${doc.id}', 'denied', 0)">Deny</button>
                </td>
            </tr>
        `;
    });

    paginationState.ownerDashboard.firstVisible = snapshot.docs[0];
    paginationState.ownerDashboard.lastVisible = snapshot.docs[snapshot.docs.length - 1];
    updatePaginationControls('ownerDashboard', snapshot.docs.length);
}

async function updateWithdrawalStatus(withdrawalId, newStatus, approvedAmount = 0) {
    try {
        await db.collection("withdrawals").doc(withdrawalId).update({ status: newStatus });
        // Update total approved amount live
        if (newStatus === 'approved') {
            totalApprovedWithdrawals += approvedAmount;
            document.getElementById("totalApprovedAmount").innerText = totalApprovedWithdrawals.toFixed(3);
        }
        loadOwnerDashboard(); // Refresh the table
        alert(`Withdrawal ${newStatus}.`);
    } catch (error) {
        console.error("Error updating withdrawal status:", error);
        alert("Failed to update status. Please try again.");
    }
}

function navigateOwnerPage(direction) {
    paginationState.ownerDashboard.currentPage += direction;
    loadOwnerDashboard();
}

/* ================= LEADERBOARD LOGIC ================= */
async function loadLeaderboard() {
    // Fetch top earners from a dedicated 'leaderboard' collection
    // This collection should be updated by a Cloud Function or server-side logic
    // For now, we simulate by querying users sorted by balance (less efficient)
    
    let query = db.collection("users")
                  .orderBy("balance", "desc") // Sort by balance (assuming balance reflects earnings)
                  .limit(PAGE_SIZES.leaderboard);

    if (paginationState.leaderboard.currentPage > 1 && paginationState.leaderboard.lastVisible) {
        query = query.startAfter(paginationState.leaderboard.lastVisible);
    }

    const snapshot = await query.get();
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';

    if (snapshot.empty && paginationState.leaderboard.currentPage > 1) {
        paginationState.leaderboard.currentPage--;
        loadLeaderboard();
        return;
    }

    snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const rank = (paginationState.leaderboard.currentPage - 1) * PAGE_SIZES.leaderboard + index + 1;
        // Exclude guests or users with zero balance if needed
        if (data.username.startsWith("Guest_") || data.balance <= 0) return;
        
        tbody.innerHTML += `
            <tr>
                <td class="leader-rank">${rank}</td>
                <td>${data.username}</td>
                <td>₱${data.balance.toFixed(3)}</td>
            </tr>
        `;
    });

    paginationState.leaderboard.firstVisible = snapshot.docs[0];
    paginationState.leaderboard.lastVisible = snapshot.docs[snapshot.docs.length - 1];
    updatePaginationControls('leaderboard', snapshot.docs.length);
}

function startLeaderboardRefresh() {
    if (!leaderboardRefreshInterval) {
        leaderboardRefreshInterval = setInterval(() => {
            resetPagination('leaderboard'); // Reset to page 1 on refresh
            loadLeaderboard();
            checkLeaderboardReset(); // Check if weekly reset is needed
        }, LEADERBOARD_REFRESH_INTERVAL);
        checkLeaderboardReset(); // Initial check
    }
}
function stopLeaderboardRefresh() {
    if (leaderboardRefreshInterval) {
        clearInterval(leaderboardRefreshInterval);
        leaderboardRefreshInterval = null;
    }
}

function checkLeaderboardReset() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    const resetDay = 0; // Sunday

    if (dayOfWeek === resetDay) {
        const lastResetKey = 'leaderboardLastReset';
        const lastReset = localStorage.getItem(lastResetKey);
        
        if (!lastReset || new Date(parseInt(lastReset)) < (now.setHours(0,0,0,0) - 86400000)) { // Check if last reset was before today
            console.log("Performing weekly leaderboard reset...");
            // In a real scenario, this would trigger a Cloud Function to clear the leaderboard collection.
            // Client-side reset is not possible for security reasons.
            localStorage.setItem(lastResetKey, now.getTime().toString());
            document.getElementById("leaderboardResetInfo").innerText = `Resets Weekly (Last: ${now.toLocaleDateString()})`;
            // Reload leaderboard to show reset effect (if data was cleared server-side)
            resetPagination('leaderboard');
            loadLeaderboard(); 
        }
    }
     document.getElementById("leaderboardResetInfo").innerText = `Resets Weekly`; // Update display based on logic
}


function navigateLeaderboardPage(direction) {
    paginationState.leaderboard.currentPage += direction;
    loadLeaderboard();
}

/* ================= HELP SECTION LOGIC ================= */
// Links are handled directly in HTML. No JS needed unless for tracking.

/* ================= REFERRALS LOGIC ================= */
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function activateReferral() {
    const codeInput = document.getElementById('referralCodeInput').value.trim();
    if (!codeInput) { alert("Please enter a referral code."); return; }
    if (codeInput === userSettings.referralCode) { alert("You cannot use your own referral code."); return; }

    const referredBySnapshot = await db.collection("users").where("referralCode", "==", codeInput).limit(1).get();

    if (referredBySnapshot.empty) {
        alert("Invalid referral code.");
        return;
    }

    const referredByDoc = referredBySnapshot.docs[0];
    const referredByUsername = referredByDoc.data().username;

    // Check if already referred or if the referrer exists
    if (userSettings.referredBy) {
        alert("You have already activated a referral code.");
        return;
    }

    try {
        // Update the current user's settings
        await updateUserData({ referredBy: referredByUsername });

        // Update the referrer's data (increment referral count)
        const referrerRef = db.collection("users").doc(referredByUsername);
        await referrerRef.update({
            referralsCount: firebase.firestore.FieldValue.increment(1)
        });
        // Note: Bonus calculation is usually triggered by events (like ad watched by invitee)
        // Here, we just link them. The bonus logic would likely be in a Cloud Function.

        alert(`Referral activated! You are now linked to ${referredByUsername}.`);
        document.getElementById('referralCodeInput').value = '';
        openView('referralsView'); // Refresh view to show updated status
    } catch (error) {
        console.error("Error activating referral:", error);
        alert("Failed to activate referral. Please try again.");
    }
}

async function loadReferralData() {
    document.getElementById('userReferralCode').innerText = userSettings.referralCode;
    document.getElementById('totalReferralBonus').innerText = userSettings.totalReferralBonus.toFixed(3);
    document.getElementById('referralCount').innerText = userSettings.referralsCount;

    if (userSettings.referredBy) {
        document.getElementById('referralInput').style.display = 'none';
    } else {
        document.getElementById('referralInput').style.display = 'flex';
    }

    // Load direct referrals list
    let query = db.collection("users")
                  .where("referredBy", "==", username) // Find users who were referred by the current user
                  .orderBy("createdAt", "desc")
                  .limit(PAGE_SIZES.referrals);

    if (paginationState.referrals.currentPage > 1 && paginationState.referrals.lastVisible) {
        query = query.startAfter(paginationState.referrals.lastVisible);
    }

    const snapshot = await query.get();
    const listContainer = document.getElementById('referralsList');
    listContainer.innerHTML = '';

    if (snapshot.empty && paginationState.referrals.currentPage > 1) {
        paginationState.referrals.currentPage--;
        loadReferralData();
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const referredDate = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'N/A';
        listContainer.innerHTML += `
            <tr>
                <td>${data.username}</td>
                <td>${referredDate}</td>
                <td>${data.username.startsWith('Guest_') ? 'Active' : 'Active'}</td> 
            </tr>
        `;
    });
    paginationState.referrals.firstVisible = snapshot.docs[0];
    paginationState.referrals.lastVisible = snapshot.docs[snapshot.docs.length - 1];
    updatePaginationControls('referrals', snapshot.docs.length);
}

async function claimReferralBonus() {
    if (userSettings.totalReferralBonus <= 0) {
        alert("No bonus available to claim.");
        return;
    }
    await updateBalance(userSettings.totalReferralBonus);
    await updateUserData({ totalReferralBonus: 0 }); // Reset bonus after claiming
    alert(`₱${userSettings.totalReferralBonus.toFixed(3)} bonus claimed!`);
    showRewardAnimation(); // Use the same reward animation for bonus claim
}

function navigateReferralsPage(direction) {
    paginationState.referrals.currentPage += direction;
    loadReferralData();
}

/* ================= REWARD ANIMATIONS ================= */
const rewardAnimations = ['anim-bounce', 'anim-slide-in', 'anim-sparkle', 'anim-fade-up', 'anim-rotate-in'];

function showRewardAnimation() {
    const popupContainer = document.getElementById('rewardPopupContainer');
    const rewardPopup = document.createElement('div');
    rewardPopup.className = 'reward-popup';
    rewardPopup.innerText = 'Reward!'; // Generic text, can be updated

    const randomAnimClass = rewardAnimations[Math.floor(Math.random() * rewardAnimations.length)];
    rewardPopup.classList.add(randomAnimClass);

    popupContainer.appendChild(rewardPopup);

    rewardPopup.addEventListener('animationend', () => {
        popupContainer.removeChild(rewardPopup);
    });
}

function resetPagination(key) {
    paginationState[key] = { currentPage: 1, lastVisible: null, firstVisible: null };
    // Also reset buttons and info display
    const prevBtn = document.getElementById(`prevPage${capitalize(key)}`);
    const nextBtn = document.getElementById(`nextPage${capitalize(key)}`);
    const pageInfo = document.getElementById(`${capitalize(key)}PageInfo`);
    if(prevBtn) prevBtn.disabled = true;
    if(nextBtn) nextBtn.disabled = false; 
    if(pageInfo) pageInfo.innerText = `Page 1`;
}
