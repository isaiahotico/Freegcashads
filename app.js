
/* ================= TELEGRAM INTEGRATION & INITIALIZATION ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();

let username = "Guest_" + Math.floor(Math.random() * 9999); // Default username
const userDisplayElement = document.getElementById("userDisplay");
const balanceDisplayElement = document.getElementById("balanceDisplay");

function updateUsernameDisplay(user) {
    if (user) {
        username = `@${user.username || user.first_name || `User${user.id}`}`;
        if (userDisplayElement) {
            userDisplayElement.innerText = `👤 ${username}`;
        }
    } else {
        // Fallback if Telegram user object is not available yet or always
        if (userDisplayElement) {
            userDisplayElement.innerText = `👤 ${username}`; // Display the generated guest username
        }
    }
}

// Initialize immediately if tg is available
if (tg) {
    tg.ready(); // Ensure the web app is ready
    updateUsernameDisplay(tg.initDataUnsafe?.user);
}

document.addEventListener('DOMContentLoaded', () => {
    if (tg) {
        tg.expand(); // Expand the web app to full screen
    }
    initApp();
    setInterval(updateUI, 1000); // Update balance and date periodically
    setInterval(cleanupOldMessages, 6 * 60 * 60 * 1000); // Clean up old messages every 6 hours
    startAutoInterstitialAdInterval(); // Start auto interstitial ads
});

async function initApp() {
    await loadUserSettings();
    openView('mainMenu');
    triggerAutoInterstitialAd(); // Show an ad on app load if conditions met
    // Start intervals that need to run from the start
    startOnlineUserUpdates(); // Initialize online user updates
    startLeaderboardRefresh(); // Initialize leaderboard refresh
    updateBonusRewardCooldownDisplay(); // Show initial cooldowns
    updateGiftRewardCooldownDisplays(); // Show initial gift cooldowns
    checkOwnerDashboardAccess(); // Check if owner dashboard button should be visible
}

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

/* ================= APP STATE & CONSTANTS ================= */
let currentBalance = 0;
let currentChatMode = ''; // 'elementary', 'highschool', 'college'
let lastSentTime = {}; // Stores cooldowns per chat mode

let userSettings = {}; // Stores user-specific settings

// Monetag Ad Functions - Mapping to potentially global functions
const monetagAds = {
    // Interstitials (assumed to be called directly, 'pop' is handled within the ad function if needed)
    show_10337853: window.show_10337853 || (() => Promise.reject("Ad function 10337853 not loaded")),
    show_10276123: window.show_10276123 || (() => Promise.reject("Ad function 10276123 not loaded")),
    show_10337795: window.show_10337795 || (() => Promise.reject("Ad function 10337795 not loaded")),
    show_GENERIC: window.show_GENERIC || (() => Promise.reject("Backup ad function not loaded")),

    // Popup Ads for Gifts - try to find specific popup functions first, fallback to standard with 'pop'
    show_10337853_pop: window.show_10337853_pop || (() => window.show_10337853 ? monetagAds.show_10337853('pop') : Promise.reject("Ad function 10337853 not loaded")),
    show_10337795_pop: window.show_10337795_pop || (() => window.show_10337795 ? monetagAds.show_10337795('pop') : Promise.reject("Ad function 10337795 not loaded")),
    show_10276123_pop: window.show_10276123_pop || (() => window.show_10276123 ? monetagAds.show_10276123('pop') : Promise.reject("Ad function 10276123 not loaded"))
};

// Cooldowns and Rewards
const CHAT_COOLDOWNS = { elementary: 3 * 60 * 1000, highschool: 3 * 60 * 1000, college: 3 * 60 * 1000 };
const REWARD_AMOUNT_CHAT = 0.015;
const REWARD_AMOUNT_BONUS = 0.015;
const AUTO_INTERSTITIAL_COOLDOWN = 3 * 60 * 1000; // 3 minutes
const BONUS_AD_CLAIM_COOLDOWN = 20 * 60 * 1000; // 20 minutes
const GIFT_REWARD_COOLDOWN = 3 * 60 * 60 * 1000; // 3 hours
const GIFT_REWARD_AMOUNT = 0.010;

// Pagination Constants
const PAGE_SIZES = { chat: 50, onlineUsers: 25, withdrawal: 25, ownerDashboard: 25, leaderboard: 500, referrals: 25 };

// Pagination State
let paginationState = {
    chat: { currentPage: 1, lastVisible: null, firstVisible: null, mode: '' },
    onlineUsers: { currentPage: 1, lastVisible: null, firstVisible: null },
    withdrawal: { currentPage: 1, lastVisible: null, firstVisible: null },
    ownerDashboard: { currentPage: 1, lastVisible: null, firstVisible: null },
    leaderboard: { currentPage: 1, lastVisible: null, firstVisible: null },
    referrals: { currentPage: 1, lastVisible: null, firstVisible: null }
};

// Intervals
let onlineUsersInterval;
let leaderboardRefreshInterval;
let autoInterstitialInterval;
let gift1TimerInterval, gift2TimerInterval, gift3TimerInterval;

// UI Element References
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const claimRewardBtn = document.getElementById("claimRewardBtn");
const chatMessagesContainer = document.getElementById("chatMessages");
const chatCooldownInfo = document.getElementById("chatCooldownInfo");
const ownerPasswordInput = document.getElementById("ownerPassword");
const ownerLoginMessage = document.getElementById("ownerLoginMessage");
const ownerDashboardContent = document.getElementById("ownerDashboardContent");
const ownerLoginDiv = document.getElementById("ownerLogin");

// Ad States
let watchedAdsForBonus = { bonus1: false, bonus2: false, bonus3: false };
let lastBonusRewardClaimTime = parseFloat(localStorage.getItem('lastBonusRewardClaimTime') || 0);

// Gift States
let watchedGifts = { gift1: false, gift2: false, gift3: false };
let lastGiftClaimTimes = {
    gift1: parseFloat(localStorage.getItem('lastGiftClaimTime_gift1') || 0),
    gift2: parseFloat(localStorage.getItem('lastGiftClaimTime_gift2') || 0),
    gift3: parseFloat(localStorage.getItem('lastGiftClaimTime_gift3') || 0)
};
const giftAdMap = {
    gift1: { func: monetagAds.show_10337853_pop, rewardBtnId: 'claimGift1RewardBtn', cooldownInfoId: 'gift1CooldownInfo', rewardTimerId: 'gift1RewardTimer', cooldown: GIFT_REWARD_COOLDOWN },
    gift2: { func: monetagAds.show_10337795_pop, rewardBtnId: 'claimGift2RewardBtn', cooldownInfoId: 'gift2CooldownInfo', rewardTimerId: 'gift2RewardTimer', cooldown: GIFT_REWARD_COOLDOWN },
    gift3: { func: monetagAds.show_10276123_pop, rewardBtnId: 'claimGift3RewardBtn', cooldownInfoId: 'gift3CooldownInfo', rewardTimerId: 'gift3RewardTimer', cooldown: GIFT_REWARD_COOLDOWN }
};

// Owner Authentication
let ownerAuthenticated = false;
const OWNER_PASSWORD = "Propetas12"; // Change this to a more secure password or use a secret in Firestore

/* ================= UI HELPER FUNCTIONS ================= */
function updateUI() {
    if (balanceDisplayElement) balanceDisplayElement.innerText = `₱${currentBalance.toFixed(3)}`;
    document.getElementById("footer-date").innerText = new Date().toLocaleString();
}

function openView(viewId, mode = '') {
    document.querySelectorAll('.page-view').forEach(view => view.style.display = 'none');
    document.getElementById('mainMenu').style.display = 'none';

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
    } else {
        console.error("View not found:", viewId);
        openView('mainMenu');
        return;
    }

    // Stop intervals that are not relevant to the current view
    stopOnlineUserUpdates();
    stopLeaderboardRefresh();
    stopAutoInterstitialAdInterval();

    // Reset pagination states when views are opened
    resetPagination('chat');
    resetPagination('onlineUsers');
    resetPagination('withdrawal');
    resetPagination('ownerDashboard');
    resetPagination('leaderboard');
    resetPagination('referrals');

    switch (viewId) {
        case 'elementaryChatView':
        case 'highschoolChatView':
        case 'collegeChatView':
            currentChatMode = mode || viewId.replace('ChatView', '').toLowerCase();
            document.getElementById("chatTitle").innerText = `${currentChatMode.toUpperCase()} CHAT`;
            loadMessages();
            startOnlineUserUpdates(); // Relevant for chat views
            break;
        case 'onlineUsersView':
            loadOnlineUsers();
            startOnlineUserUpdates(); // Relevant for online users view
            break;
        case 'withdrawalView':
            loadWithdrawalHistory();
            checkFirstTimeWithdrawal();
            break;
        case 'ownerDashboardView':
            if (ownerAuthenticated) {
                loadOwnerDashboard();
            } else {
                ownerLoginDiv.style.display = 'block';
                ownerDashboardContent.style.display = 'none';
                ownerPasswordInput.value = '';
                ownerLoginMessage.innerText = '';
            }
            break;
        case 'leaderboardView':
            loadLeaderboard();
            startLeaderboardRefresh();
            break;
        case 'helpView':
            // No specific intervals to manage here
            break;
        case 'giftView':
            resetGiftAdStates(); // Ensure buttons are in correct initial state
            updateGiftRewardCooldownDisplays(); // Show correct cooldowns on load
            break;
        case 'referralsView':
            loadReferralData();
            break;
        case 'bonusAdsView':
            resetBonusAdState(); // Reset ad states
            updateBonusRewardCooldownDisplay(); // Show correct cooldowns on load
            break;
        case 'mainMenu':
            startAutoInterstitialAdInterval(); // Auto ads run on main menu
            break;
    }
}

function showRewardAnimation() {
    const popupContainer = document.getElementById('rewardPopupContainer');
    if (!popupContainer) return; // Safety check

    const rewardPopup = document.createElement('div');
    rewardPopup.className = 'reward-popup animate__animated animate__tada'; // Added animate.css class
    rewardPopup.innerText = 'REWARD!';

    popupContainer.appendChild(rewardPopup);

    rewardPopup.addEventListener('animationend', () => {
        popupContainer.removeChild(rewardPopup);
    }, { once: true });
}

/* ================= USER DATA MANAGEMENT ================= */
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
            };
            // Ensure referral code exists, generate if not
            if (!data.referralCode) {
                 await userDocRef.set({ referralCode: userSettings.referralCode }, { merge: true });
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
            };
        }
        // Update local storage flags if needed
        localStorage.setItem('hasWithdrawnBefore', userSettings.hasWithdrawnBefore ? 'true' : 'false');

    } catch (error) {
        console.error("Error loading user settings:", error);
        alert("Error loading your data. Please try again later.");
        // Set defaults to prevent errors
        currentBalance = 0;
        lastSentTime = { elementary: 0, highschool: 0, college: 0 };
        userSettings = { hasWithdrawnBefore: false, referralCode: "ERROR", referredBy: null, totalReferralBonus: 0, referralsCount: 0 };
    }
    updateUI();
}

async function updateUserData(data) {
    const userDocRef = db.collection("users").doc(username);
    try {
        await userDocRef.set(data, { merge: true });
        // Update local state
        if (data.balance !== undefined) currentBalance = data.balance;
        if (data.lastSentTime !== undefined) lastSentTime = data.lastSentTime;
        if (data.hasWithdrawnBefore !== undefined) {
            userSettings.hasWithdrawnBefore = data.hasWithdrawnBefore;
            localStorage.setItem('hasWithdrawnBefore', data.hasWithdrawnBefore ? 'true' : 'false');
        }
        if (data.referralCode !== undefined) userSettings.referralCode = data.referralCode;
        if (data.referredBy !== undefined) userSettings.referredBy = data.referredBy;
        if (data.totalReferralBonus !== undefined) userSettings.totalReferralBonus = data.totalReferralBonus;
        if (data.referralsCount !== undefined) userSettings.referralsCount = data.referralsCount;

        updateUI();
        // Update specific UI elements if they exist
        if (document.getElementById("userReferralCode")) document.getElementById("userReferralCode").innerText = userSettings.referralCode;
        if (document.getElementById("referralCount")) document.getElementById("referralCount").innerText = userSettings.referralsCount;
        if (document.getElementById("totalReferralBonus")) document.getElementById("totalReferralBonus").innerText = `₱${userSettings.totalReferralBonus.toFixed(3)}`;
        if (document.getElementById("withdrawalBalanceDisplay")) document.getElementById("withdrawalBalanceDisplay").innerText = `₱${currentBalance.toFixed(3)}`;

    } catch (error) {
        console.error("Error updating user data:", error);
    }
}

async function updateBalance(amount) {
    if (amount <= 0) return;
    const newBalance = currentBalance + amount;
    await updateUserData({ balance: newBalance });
    showRewardAnimation(); // Show animation on any balance update
}

/* ================= ADVERTISING LOGIC ================= */
function getRandomInterstitialAd() {
    const availableAds = [monetagAds.show_10337853, monetagAds.show_10276123, monetagAds.show_10337795, monetagAds.show_GENERIC];
    // Filter out any undefined or rejected promises from the start
    const validAds = availableAds.filter(ad => typeof ad === 'function');
    if (validAds.length === 0) {
        console.warn("No valid interstitial ad functions available.");
        return () => Promise.reject("No ad functions.");
    }
    return validAds[Math.floor(Math.random() * validAds.length)];
}

async function triggerAutoInterstitialAd() {
    // Only show ads if not on specific views where ads might be intrusive or if Telegram WebApp is not detected
    const currentView = document.querySelector('.page-view[style*="display: block;"], #mainMenu[style*="display: block;"]');
    if (!currentView || currentView.id === 'mainMenu' || currentView.id === 'giftView' || currentView.id.includes('ChatView') || currentView.id === 'helpView' || currentView.id === 'onlineUsersView') {
        const adFunc = getRandomInterstitialAd();
        try {
            await adFunc();
            console.log("Auto interstitial ad shown.");
        } catch (e) {
            console.warn("Auto interstitial ad failed to show:", e);
        }
    } else {
        console.log("Skipping auto interstitial ad on current view:", currentView.id);
    }
}

function startAutoInterstitialAdInterval() {
    if (!autoInterstitialInterval) {
        triggerAutoInterstitialAd(); // Run once immediately
        autoInterstitialInterval = setInterval(triggerAutoInterstitialAd, AUTO_INTERSTITIAL_COOLDOWN);
        console.log("Auto interstitial ad interval started.");
    }
}

function stopAutoInterstitialAdInterval() {
    if (autoInterstitialInterval) {
        clearInterval(autoInterstitialInterval);
        autoInterstitialInterval = null;
        console.log("Auto interstitial ad interval stopped.");
    }
}

// --- Bonus Ads ---
function showBonusAds(bonusId) {
    const now = Date.now();
    const lastClaim = parseFloat(localStorage.getItem(`lastBonusRewardClaimTime_${bonusId}`) || 0);
    const cooldown = BONUS_AD_CLAIM_COOLDOWN;

    if (now - lastClaim < cooldown) {
        alert("This bonus ad is on cooldown. Please wait.");
        updateBonusRewardCooldownDisplay(); // Ensure display is correct
        return false;
    }

    // Reset states for this specific bonus ad
    watchedAdsForBonus[bonusId] = false;
    document.getElementById(`claimBonus${bonusId.replace('bonus', '')}RewardBtn`).disabled = true;
    document.getElementById(`${bonusId}CooldownInfo`).style.display = 'block';

    const adFunc = bonusId === 'bonus1' ? monetagAds.show_10276123 : // Assuming mapping from previous structure
                   bonusId === 'bonus2' ? monetagAds.show_10337795 :
                   monetagAds.show_10337853;

    adFunc()
        .then(() => {
            console.log(`Bonus ad '${bonusId}' shown successfully.`);
            watchedAdsForBonus[bonusId] = true;
            document.getElementById(`claimBonus${bonusId.replace('bonus', '')}RewardBtn`).disabled = false;
            document.getElementById(`${bonusId}CooldownInfo`).style.display = 'none';
            showRewardAnimation();
            return true;
        })
        .catch(e => {
            console.warn(`Bonus ad '${bonusId}' failed to show:`, e);
            alert("Ads were blocked or an error occurred. Please disable ad blockers to support us.");
            document.getElementById(`claimBonus${bonusId.replace('bonus', '')}RewardBtn`).disabled = !watchedAdsForBonus[bonusId];
            document.getElementById(`${bonusId}CooldownInfo`).style.display = watchedAdsForBonus[bonusId] ? 'none' : 'block';
            return false;
        });
}

async function claimBonusReward(bonusId) {
    const now = Date.now();
    const lastClaim = parseFloat(localStorage.getItem(`lastBonusRewardClaimTime_${bonusId}`) || 0);
    const cooldown = BONUS_AD_CLAIM_COOLDOWN;

    if (!watchedAdsForBonus[bonusId]) {
        alert("Please watch the ad first to unlock this reward.");
        return;
    }
    if (now - lastClaim < cooldown) {
        alert("This reward is on cooldown. Please wait.");
        updateBonusRewardCooldownDisplay();
        return;
    }

    await updateBalance(REWARD_AMOUNT_BONUS);
    localStorage.setItem(`lastBonusRewardClaimTime_${bonusId}`, now);
    alert(`You have claimed your ₱${REWARD_AMOUNT_BONUS.toFixed(3)} bonus reward!`);

    watchedAdsForBonus[bonusId] = false; // Reset watched status
    document.getElementById(`claimBonus${bonusId.replace('bonus', '')}RewardBtn`).disabled = true;
    updateBonusRewardCooldownDisplay(); // Update display
}

function resetBonusAdState() {
    for (const bonusId of ['bonus1', 'bonus2', 'bonus3']) {
        watchedAdsForBonus[bonusId] = false;
        const claimBtn = document.getElementById(`claimBonus${bonusId.replace('bonus', '')}RewardBtn`);
        if (claimBtn) claimBtn.disabled = true;
        const cooldownInfo = document.getElementById(`${bonusId}CooldownInfo`);
        if (cooldownInfo) cooldownInfo.style.display = 'block'; // Show cooldown info by default
        const rewardTimer = document.getElementById(`${bonusId}RewardTimer`);
        if (rewardTimer) rewardTimer.innerText = "00:00:00"; // Reset timer display
    }
}

let bonusTimers = {}; // Store intervals for each bonus timer

function updateBonusRewardCooldownDisplay() {
    for (const bonusId of ['bonus1', 'bonus2', 'bonus3']) {
        const lastClaim = parseFloat(localStorage.getItem(`lastBonusRewardClaimTime_${bonusId}`) || 0);
        const cooldown = BONUS_AD_CLAIM_COOLDOWN;
        const timeRemaining = cooldown - (Date.now() - lastClaim);

        const cooldownInfo = document.getElementById(`${bonusId}CooldownInfo`);
        const rewardTimerSpan = document.getElementById(`${bonusId}RewardTimer`);
        const claimBtn = document.getElementById(`claimBonus${bonusId.replace('bonus', '')}RewardBtn`);

        if (timeRemaining <= 0) {
            if (cooldownInfo) cooldownInfo.style.display = 'none';
            if (rewardTimerSpan) rewardTimerSpan.innerText = "00:00:00";
            if (claimBtn && watchedAdsForBonus[bonusId]) { // Enable if ad was watched
                claimBtn.disabled = false;
                claimBtn.style.display = 'inline-block'; // Ensure button is visible
            }
            // Clear interval if it's running for this bonus
            if (bonusTimers[bonusId]) {
                clearInterval(bonusTimers[bonusId]);
                delete bonusTimers[bonusId];
            }
        } else {
            if (cooldownInfo) cooldownInfo.style.display = 'block';
            const minutes = Math.floor(timeRemaining / (1000 * 60));
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
            if (rewardTimerSpan) rewardTimerSpan.innerText = `00:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            // Start interval if not already running
            if (!bonusTimers[bonusId]) {
                bonusTimers[bonusId] = setInterval(() => updateBonusRewardCooldownDisplay(), 1000);
            }
            if (claimBtn) claimBtn.disabled = true; // Keep disabled while on cooldown
        }
    }
}


// --- Gift Ads (NEW) ---
function showGiftAd(giftId) {
    const giftInfo = giftAdMap[giftId];
    const now = Date.now();

    if (now - lastGiftClaimTimes[giftId] < giftInfo.cooldown) {
        alert("This gift is currently on cooldown. Please try again later.");
        updateGiftRewardCooldownDisplays(); // Ensure display is correct
        return false;
    }

    // Reset states for this specific gift
    watchedGifts[giftId] = false;
    document.getElementById(giftInfo.rewardBtnId).disabled = true;
    document.getElementById(giftInfo.cooldownInfoId).style.display = 'block';

    giftInfo.func()
        .then(() => {
            console.log(`Gift ad '${giftId}' shown successfully.`);
            watchedGifts[giftId] = true; // Mark as watched
            document.getElementById(giftInfo.rewardBtnId).disabled = false; // Enable claim button
            document.getElementById(giftInfo.cooldownInfoId).style.display = 'none'; // Hide cooldown timer
            showRewardAnimation(); // Show visual confirmation
            return true;
        })
        .catch(e => {
            console.warn(`Gift ad '${giftId}' failed to show:`, e);
            alert("Ads were blocked or an error occurred. Please disable ad blockers to support us.");
            // Reset button to default state if ad fails
            document.getElementById(giftInfo.rewardBtnId).disabled = !watchedGifts[giftId]; // Re-enable if previously watched for other reasons
            document.getElementById(giftInfo.cooldownInfoId).style.display = watchedGifts[giftId] ? 'none' : 'block'; // Show cooldown only if not already claimable
            return false;
        });
}

async function claimGiftReward(giftId) {
    const giftInfo = giftAdMap[giftId];
    const now = Date.now();

    if (!watchedGifts[giftId]) {
        alert("Please watch the ad first to unlock this reward.");
        return;
    }
    
    if (now - lastGiftClaimTimes[giftId] < giftInfo.cooldown) {
        alert("This reward is on cooldown. Please wait.");
        updateGiftRewardCooldownDisplays();
        return;
    }

    await updateBalance(GIFT_REWARD_AMOUNT);
    lastGiftClaimTimes[giftId] = now;
    localStorage.setItem(`lastGiftClaimTime_${giftId}`, now);
    alert(`You have claimed your ₱${GIFT_REWARD_AMOUNT.toFixed(3)} gift reward!`);
    showRewardAnimation();
    
    // Reset states and update display
    watchedGifts[giftId] = false; // Reset watched status for this gift
    document.getElementById(giftInfo.rewardBtnId).disabled = true; // Disable claim button
    updateGiftRewardCooldownDisplays(); // Update cooldown timer display
}

function resetGiftAdStates() {
    for (const giftId in giftAdMap) {
        watchedGifts[giftId] = false; 
        const giftInfo = giftAdMap[giftId];
        const claimBtn = document.getElementById(giftInfo.rewardBtnId);
        if(claimBtn) claimBtn.disabled = true; 
        const cooldownInfo = document.getElementById(giftInfo.cooldownInfoId);
        if(cooldownInfo) cooldownInfo.style.display = 'block';
        const rewardTimer = document.getElementById(giftInfo.rewardTimerId);
        if(rewardTimer) rewardTimer.innerText = "00:00:00";
    }
}

function updateGiftRewardCooldownDisplays() {
    for (const giftId in giftAdMap) {
        const giftInfo = giftAdMap[giftId];
        const timeRemaining = giftInfo.cooldown - (Date.now() - lastGiftClaimTimes[giftId]);
        const rewardTimerSpan = document.getElementById(giftInfo.rewardTimerId);
        const cooldownInfo = document.getElementById(giftInfo.cooldownInfoId);
        const claimBtn = document.getElementById(giftInfo.rewardBtnId);

        if (timeRemaining <= 0) {
            if(cooldownInfo) cooldownInfo.style.display = 'none';
            if(rewardTimerSpan) rewardTimerSpan.innerText = "00:00:00";
            if (claimBtn && watchedGifts[giftId]) {
                 claimBtn.disabled = false;
                 claimBtn.style.display = 'inline-block';
            }
            // Clear interval if it's running for this gift
            if (giftId === 'gift1' && gift1TimerInterval) { clearInterval(gift1TimerInterval); gift1TimerInterval = null; }
            if (giftId === 'gift2' && gift2TimerInterval) { clearInterval(gift2TimerInterval); gift2TimerInterval = null; }
            if (giftId === 'gift3' && gift3TimerInterval) { clearInterval(gift3TimerInterval); gift3TimerInterval = null; }
        } else {
            if(cooldownInfo) cooldownInfo.style.display = 'block';
            const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
            if(rewardTimerSpan) rewardTimerSpan.innerText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            // Start interval if not already running for this gift
            if (giftId === 'gift1' && !gift1TimerInterval) gift1TimerInterval = setInterval(updateGiftRewardCooldownDisplays, 1000);
            if (giftId === 'gift2' && !gift2TimerInterval) gift2TimerInterval = setInterval(updateGiftRewardCooldownDisplays, 1000);
            if (giftId === 'gift3' && !gift3TimerInterval) gift3TimerInterval = setInterval(updateGiftRewardCooldownDisplays, 1000);
            
            if (claimBtn) claimBtn.disabled = true; // Keep disabled while on cooldown
        }
    }
}

/* ================= CHAT LOGIC ================= */
async function sendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText || !currentChatMode) return;

    const now = Date.now();
    const cooldown = CHAT_COOLDOWNS[currentChatMode];
    const lastSent = lastSentTime[currentChatMode] || 0;

    if (now - lastSent < cooldown) {
        const timeRemaining = cooldown - (now - lastSent);
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        alert(`Please wait ${minutes}m ${seconds}s before sending another message.`);
        return;
    }

    // Try to show an ad before sending the message
    const adShown = await triggerRewardedAdsForChat();
    if (!adShown) {
        // If ad fails, maybe don't send message or alert user
        alert("Ad failed to load. Please try again or disable ad blockers.");
        return;
    }

    try {
        await db.collection("messages").add({
            user: username,
            text: messageText,
            mode: currentChatMode,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        chatInput.value = ''; // Clear input
        lastSentTime[currentChatMode] = now; // Update cooldown
        await updateUserData({ lastSentTime }); // Save to Firestore
        loadMessages(); // Refresh messages to show the new one
        showRewardAnimation(); // Reward for sending message after ad
        await updateBalance(REWARD_AMOUNT_CHAT); // Reward for sending message
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message. Please check your connection.");
    }
}

async function triggerRewardedAdsForChat() {
    // Implement ad logic here. Return true if ad shown/skipped, false if error.
    // For now, let's assume it just tries to show one ad.
    try {
        const adFunc = getRandomInterstitialAd(); // Or a specific rewarded ad function if available
        await adFunc(); // Assuming this is a rewarded or interstitial ad
        return true; // Ad was shown or skipped by user
    } catch (e) {
        console.warn("Rewarded ad for chat failed:", e);
        // Alert user or handle the failure appropriately
        // alert("Could not load ad. Please disable ad blockers to continue.");
        return false; // Ad failed to show
    }
}

async function claimReward() {
    // This button should be enabled only when reward is available
    if (claimRewardBtn.style.display === 'none' || claimRewardBtn.disabled) {
        alert("No reward available to claim.");
        return;
    }

    await updateBalance(REWARD_AMOUNT_CHAT); // Reward for chat activity
    alert(`Reward claimed! +₱${REWARD_AMOUNT_CHAT.toFixed(3)}`);
    claimRewardBtn.style.display = 'none'; // Hide after claiming
    chatCooldownInfo.style.display = 'block'; // Show cooldown info
    updateChatCooldownDisplay(); // Update the timer immediately
}

function updateChatCooldownDisplay() {
    const now = Date.now();
    const cooldown = CHAT_COOLDOWNS[currentChatMode];
    const lastSent = lastSentTime[currentChatMode] || 0;
    const timeRemaining = cooldown - (now - lastSent);

    if (timeRemaining <= 0) {
        chatCooldownInfo.style.display = 'none';
        claimRewardBtn.disabled = false; // Enable reward claim button
        claimRewardBtn.style.display = 'inline-block'; // Show claim button
        if(chatMessagesContainer) chatMessagesContainer.style.paddingBottom = '60px'; // Adjust padding if needed
        // Clear interval if active for this mode
        if (modeTimers[currentChatMode]) {
            clearInterval(modeTimers[currentChatMode]);
            delete modeTimers[currentChatMode];
        }
        return false; // Indicate cooldown is over
    } else {
        chatCooldownInfo.style.display = 'block';
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        chatCooldownInfo.innerText = `Next message reward in: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        claimRewardBtn.disabled = true; // Keep disabled while on cooldown
        claimRewardBtn.style.display = 'none'; // Hide claim button
        if(chatMessagesContainer) chatMessagesContainer.style.paddingBottom = '120px'; // Ensure space for cooldown info
        return true; // Indicate still on cooldown
    }
}

let modeTimers = {}; // Store intervals for each chat mode

async function loadMessages() {
    if (!currentChatMode) return;
    const messagesRef = db.collection("messages")
        .where("mode", "==", currentChatMode)
        .orderBy("timestamp", "desc")
        .limit(PAGE_SIZES.chat);

    try {
        const snapshot = await messagesRef.get();
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        paginationState.chat.lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        paginationState.chat.firstVisible = snapshot.docs[0] || null;
        
        chatMessagesContainer.innerHTML = ''; // Clear previous messages
        messages.reverse().forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.className = 'message';
            messageElement.innerHTML = `
                <span class="message-user">${msg.user}:</span> 
                <span class="message-text">${msg.text}</span>
                <span class="message-time">${msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            `;
            chatMessagesContainer.appendChild(messageElement);
        });

        // Scroll to bottom
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

        // Check and update cooldown/reward button status
        const needsCooldown = updateChatCooldownDisplay();
        if (!needsCooldown) {
            // If cooldown is over, start the timer
            if (!modeTimers[currentChatMode]) {
                modeTimers[currentChatMode] = setInterval(updateChatCooldownDisplay, 1000);
            }
        } else {
            // If still on cooldown, ensure timer is running
            if (!modeTimers[currentChatMode]) {
                modeTimers[currentChatMode] = setInterval(updateChatCooldownDisplay, 1000);
            }
        }

    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

function navigateChatPage(direction) {
    // Implementation for pagination of chat messages if needed
    console.log("Navigating chat page:", direction);
    // For simplicity, let's just reload messages for now, or implement cursor-based pagination
    loadMessages(); 
}

async function cleanupOldMessages() {
    const cutoffDate = firebase.firestore.Timestamp.fromDate(new Date(Date.now() - (7 * 24 * 60 * 60 * 1000))); // 7 days old
    const batch = db.batch();
    try {
        const messagesToDelete = await db.collection("messages").where("timestamp", "<", cutoffDate).limit(500).get();
        if (messagesToDelete.empty) {
            console.log("No old messages to delete.");
            return;
        }
        messagesToDelete.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${messagesToDelete.size} old messages.`);
    } catch (error) {
        console.error("Error cleaning up old messages:", error);
    }
}

/* ================= ONLINE USERS LOGIC ================= */
async function updateOnlineStatus() {
    if (!tg) return; // Only if running in Telegram WebApp

    const user = tg.initDataUnsafe?.user;
    if (!user) {
        // console.log("Telegram user data not available yet.");
        return;
    }
    
    const currentUser = `@${user.username || user.first_name || `User${user.id}`}`;
    const userDocRef = db.collection("onlineUsers").doc(currentUser);

    try {
        await userDocRef.set({
            username: currentUser,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Fetch and display list
        await loadOnlineUsers();
        
    } catch (error) {
        console.error("Error updating online status:", error);
    }
}

function startOnlineUserUpdates() {
    if (!onlineUsersInterval) {
        updateOnlineStatus(); // Update immediately
        onlineUsersInterval = setInterval(updateOnlineStatus, ONLINE_UPDATE_INTERVAL);
        console.log("Online user updates started.");
    }
}

function stopOnlineUserUpdates() {
    if (onlineUsersInterval) {
        clearInterval(onlineUsersInterval);
        onlineUsersInterval = null;
        console.log("Online user updates stopped.");
    }
}

async function loadOnlineUsers() {
    const onlineUsersListElement = document.getElementById("onlineUsersList");
    const onlineUsersCountElement = document.getElementById("onlineUsersCount");
    if (!onlineUsersListElement || !onlineUsersCountElement) return;

    const cutoffTime = firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 60000)); // 1 minute ago

    try {
        const snapshot = await db.collection("onlineUsers")
            .where("lastActive", ">", cutoffTime)
            .orderBy("lastActive", "desc")
            .limit(PAGE_SIZES.onlineUsers)
            .get();

        paginationState.onlineUsers.lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        paginationState.onlineUsers.firstVisible = snapshot.docs[0] || null;
        
        onlineUsersListElement.innerHTML = ''; // Clear previous list
        if (snapshot.empty) {
            onlineUsersListElement.innerHTML = '<li>No users online right now.</li>';
            onlineUsersCountElement.innerText = "0 Users Online";
        } else {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <strong>${data.username}</strong> 
                    <em>(Last active: ${data.lastActive ? data.lastActive.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'})</em>
                `;
                onlineUsersListElement.appendChild(listItem);
            });
            onlineUsersCountElement.innerText = `${snapshot.size} Users Online`;
        }
        updatePaginationControls('onlineUsers', snapshot.size);

    } catch (error) {
        console.error("Error loading online users:", error);
        onlineUsersListElement.innerHTML = '<li>Error loading online users.</li>';
    }
}

function navigateOnlinePage(direction) {
    console.log("Navigating online users page:", direction);
    loadOnlineUsers(); // Simplified for now, implement proper cursor pagination
}

/* ================= LEADERBOARD LOGIC ================= */
async function loadLeaderboard() {
    const leaderboardListElement = document.getElementById("leaderboardList");
    if (!leaderboardListElement) return;

    try {
        const snapshot = await db.collection("leaderboard")
            .orderBy("score", "desc") // Assuming 'score' field exists
            .limit(PAGE_SIZES.leaderboard)
            .get();
        
        paginationState.leaderboard.lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        paginationState.leaderboard.firstVisible = snapshot.docs[0] || null;

        leaderboardListElement.innerHTML = ''; // Clear previous list
        if (snapshot.empty) {
            leaderboardListElement.innerHTML = '<li>Leaderboard is empty.</li>';
        } else {
            snapshot.docs.forEach((doc, index) => {
                const data = doc.data();
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <strong>${index + 1}. ${data.username || 'Unknown User'}</strong> 
                    - ₱${(data.score || 0).toFixed(3)} 
                    <small>(${data.level || 'Level ?'})</small>
                `;
                leaderboardListElement.appendChild(listItem);
            });
        }
        updatePaginationControls('leaderboard', snapshot.size);

    } catch (error) {
        console.error("Error loading leaderboard:", error);
        leaderboardListElement.innerHTML = '<li>Error loading leaderboard.</li>';
    }
}

function startLeaderboardRefresh() {
    if (!leaderboardRefreshInterval) {
        loadLeaderboard(); // Load once immediately
        leaderboardRefreshInterval = setInterval(loadLeaderboard, LEADERBOARD_REFRESH_INTERVAL);
        console.log("Leaderboard refresh started.");
    }
}

function stopLeaderboardRefresh() {
    if (leaderboardRefreshInterval) {
        clearInterval(leaderboardRefreshInterval);
        leaderboardRefreshInterval = null;
        console.log("Leaderboard refresh stopped.");
    }
}

function navigateLeaderboardPage(direction) {
    console.log("Navigating leaderboard page:", direction);
    loadLeaderboard(); // Simplified for now
}

function checkLeaderboardReset() { /* Admin function, potentially add later */ }

/* ================= WITHDRAWAL LOGIC ================= */
let withdrawalTimer;
const MIN_WITHDRAWAL_AMOUNT = 10.000;

async function checkFirstTimeWithdrawal() {
    const firstTimeStatusElement = document.getElementById("firstTimeWithdrawalStatus");
    if (!firstTimeStatusElement) return;

    if (userSettings.hasWithdrawnBefore) {
        firstTimeStatusElement.innerText = "No";
        firstTimeStatusElement.style.color = "green";
    } else {
        firstTimeStatusElement.innerText = "Yes";
        firstTimeStatusElement.style.color = "red";
        // Maybe start a timer or animation for the first withdrawal
        if (!withdrawalTimer) {
            startWithdrawalActivation();
        }
    }
}

function startWithdrawalActivation() {
    const messageElement = document.getElementById("withdrawalMessage");
    const submitBtn = document.getElementById("submitWithdrawalBtn");
    let countdown = 15; // Example: 15 seconds

    messageElement.innerText = `First withdrawal activation in ${countdown} seconds...`;
    submitBtn.disabled = true;

    withdrawalTimer = setInterval(() => {
        countdown--;
        messageElement.innerText = `First withdrawal activation in ${countdown} seconds...`;
        if (countdown <= 0) {
            clearInterval(withdrawalTimer);
            withdrawalTimer = null;
            messageElement.innerText = "Activation complete! You can now withdraw.";
            submitBtn.disabled = false;
            updateUserData({ hasWithdrawnBefore: true }); // Update user setting
        }
    }, 1000);
}

async function submitWithdrawal() {
    const amountInput = document.getElementById("withdrawalAmount");
    constgcashAccountInput = document.getElementById("gcash_account");
    const gcashNameInput = document.getElementById("gcash_name");
    const messageElement = document.getElementById("withdrawalMessage");

    const amount = parseFloat(amountInput.value);
    constgcashAccount =gcashAccountInput.value.trim();
    const gcashName = gcashNameInput.value.trim();

    if (isNaN(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
        messageElement.innerText = `Minimum withdrawal is ₱${MIN_WITHDRAWAL_AMOUNT.toFixed(3)}.`;
        messageElement.style.color = "red";
        return;
    }
    if (amount > currentBalance) {
        messageElement.innerText = "Insufficient balance.";
        messageElement.style.color = "red";
        return;
    }
    if (!gcashAccount || !gcashName) {
        messageElement.innerText = "Please provide valid GCash account number and name.";
        messageElement.style.color = "red";
        return;
    }

    messageElement.innerText = "Submitting withdrawal request...";
    messageElement.style.color = "orange";
    document.getElementById("submitWithdrawalBtn").disabled = true;

    try {
        await db.collection("withdrawals").add({
            username: username,
            amount: amount,
            gcashAccount:gcashAccount,
            gcashName: gcashName,
            status: 'pending',
            requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
            processedAt: null,
            approvedAmount: 0,
            processedBy: null
        });
        await updateUserData({ balance: currentBalance - amount }); // Deduct balance immediately
        messageElement.innerText = "Withdrawal request submitted successfully! Please wait for approval.";
        messageElement.style.color = "green";
        amountInput.value = '';
        gcashAccountInput.value = '';
        gcashNameInput.value = '';
        await loadWithdrawalHistory(); // Refresh history
    } catch (error) {
        console.error("Error submitting withdrawal:", error);
        messageElement.innerText = "Failed to submit withdrawal. Please try again.";
        messageElement.style.color = "red";
    } finally {
        document.getElementById("submitWithdrawalBtn").disabled = false;
    }
}

async function loadWithdrawalHistory() {
    const historyListElement = document.getElementById("withdrawalHistoryList");
    if (!historyListElement) return;

    try {
        const snapshot = await db.collection("withdrawals")
            .where("username", "==", username)
            .orderBy("requestedAt", "desc")
            .limit(PAGE_SIZES.withdrawal)
            .get();

        paginationState.withdrawal.lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        paginationState.withdrawal.firstVisible = snapshot.docs[0] || null;
        
        historyListElement.innerHTML = ''; // Clear previous list
        if (snapshot.empty) {
            historyListElement.innerHTML = '<li>No withdrawal history yet.</li>';
        } else {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const listItem = document.createElement('li');
                let statusText = data.status;
                let statusColor = 'gray';
                if (data.status === 'approved') {
                    statusText = `Approved (₱${data.approvedAmount.toFixed(3)})`;
                    statusColor = 'green';
                } else if (data.status === 'rejected') {
                    statusText = `Rejected`;
                    statusColor = 'red';
                } else if (data.status === 'pending') {
                    statusColor = 'orange';
                }
                listItem.innerHTML = `
                    <strong>Amount:</strong> ₱${data.amount.toFixed(3)} 
                    <strong>Status:</strong> <span style="color: ${statusColor};">${statusText}</span> 
                    <em>(${data.requestedAt ? data.requestedAt.toDate().toLocaleString() : 'N/A'})</em>
                `;
                historyListElement.appendChild(listItem);
            });
        }
         updatePaginationControls('withdrawal', snapshot.size);
    } catch (error) {
        console.error("Error loading withdrawal history:", error);
        historyListElement.innerHTML = '<li>Error loading history.</li>';
    }
}

function navigateWithdrawalPage(direction) {
    console.log("Navigating withdrawal page:", direction);
    loadWithdrawalHistory(); // Simplified for now
}

/* ================= HELP SECTION LOGIC ================= */
// No specific JS logic needed, content is in HTML.

/* ================= OWNER DASHBOARD LOGIC ================= */
function checkOwnerDashboardAccess() {
    const ownerBtn = document.getElementById("ownerDashboardBtn");
    if (ownerBtn) {
        // In a real app, you'd check Firestore or a secure config for admin status
        // For this example, we'll rely on the ownerAuthenticated flag
        if (ownerAuthenticated) {
            ownerBtn.style.display = 'block';
        } else {
            ownerBtn.style.display = 'none';
        }
    }
}

async function authenticateOwner() {
    const password = ownerPasswordInput.value;
    if (password === OWNER_PASSWORD) {
        ownerAuthenticated = true;
        ownerLoginMessage.innerText = "Authentication successful!";
        ownerLoginMessage.style.color = "green";
        ownerDashboardContent.style.display = 'block';
        ownerLoginDiv.style.display = 'none';
        await loadOwnerDashboard();
        checkOwnerDashboardAccess(); // Update button visibility globally
    } else {
        ownerAuthenticated = false;
        ownerLoginMessage.innerText = "Incorrect password.";
        ownerLoginMessage.style.color = "red";
    }
}

async function loadOwnerDashboard() {
    if (!ownerAuthenticated) return;

    try {
        // Fetch total users (example: count documents in 'users' collection)
        const usersSnapshot = await db.collection("users").get();
        document.getElementById("ownerTotalUsers").innerText = usersSnapshot.size;

        // Fetch withdrawal summaries
        const withdrawalsSnapshot = await db.collection("withdrawals").get();
        let totalApprovedWithdrawals = 0;
        let totalPendingWithdrawals = 0;
        let totalApprovedAmount = 0;

        withdrawalsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.status === 'approved') {
                totalApprovedWithdrawals++;
                totalApprovedAmount += data.approvedAmount || 0;
            } else if (data.status === 'pending') {
                totalPendingWithdrawals++;
            }
        });
        document.getElementById("ownerTotalApprovedWithdrawals").innerText = totalApprovedWithdrawals;
        document.getElementById("ownerTotalPendingWithdrawals").innerText = totalPendingWithdrawals;
        document.getElementById("ownerTotalEarnings").innerText = `₱${totalApprovedAmount.toFixed(3)}`;

        // Load pending withdrawals for management
        const pendingWithdrawalsSnapshot = await db.collection("withdrawals")
            .where("status", "==", "pending")
            .orderBy("requestedAt", "desc")
            .limit(PAGE_SIZES.ownerDashboard)
            .get();

        paginationState.ownerDashboard.lastVisible = pendingWithdrawalsSnapshot.docs[pendingWithdrawalsSnapshot.docs.length - 1] || null;
        paginationState.ownerDashboard.firstVisible = pendingWithdrawalsSnapshot.docs[0] || null;

        const withdrawalListElement = document.getElementById("ownerWithdrawalList");
        withdrawalListElement.innerHTML = '';
        if (pendingWithdrawalsSnapshot.empty) {
            withdrawalListElement.innerHTML = '<li>No pending withdrawals.</li>';
        } else {
            pendingWithdrawalsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    User: <strong>${data.username}</strong> | 
                    Amount: <strong>₱${data.amount.toFixed(3)}</strong> | 
                    GCash: ${data.gcashAccount} (${data.gcashName}) | 
                    Requested: ${data.requestedAt.toDate().toLocaleString()}
                    <br>
                    <button class="btn btn-sm btn-success" onclick="updateWithdrawalStatus('${doc.id}', 'approved', ${data.amount})">Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="updateWithdrawalStatus('${doc.id}', 'rejected')">Reject</button>
                `;
                withdrawalListElement.appendChild(listItem);
            });
        }
         updatePaginationControls('ownerDashboard', pendingWithdrawalsSnapshot.size);

    } catch (error) {
        console.error("Error loading owner dashboard:", error);
        document.getElementById("ownerDashboardContent").innerHTML = 'Error loading dashboard data.';
    }
}

async function updateWithdrawalStatus(withdrawalId, newStatus, approvedAmount = 0) {
    const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);
    try {
        await withdrawalRef.update({
            status: newStatus,
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedAmount: newStatus === 'approved' ? approvedAmount : 0,
            processedBy: username
        });
        alert(`Withdrawal ${withdrawalId} status updated to ${newStatus}.`);
        await loadOwnerDashboard(); // Refresh the list
        // Optionally: Send a message to the user via Telegram bot if integrated
    } catch (error) {
        console.error("Error updating withdrawal status:", error);
        alert("Failed to update status. Please try again.");
    }
}

function navigateOwnerPage(direction) {
    console.log("Navigating owner dashboard page:", direction);
    loadOwnerDashboard(); // Simplified
}

/* ================= REFERRALS LOGIC ================= */
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `PHN-${code}`; // Prefix for clarity
}

async function activateReferral() {
    const referralCodeInput = document.getElementById("referralCodeInput"); // Assuming an input field exists
    const code = referralCodeInput.value.trim();
    if (!code) {
        alert("Please enter a referral code.");
        return;
    }

    const userDocRef = db.collection("users").doc(username);
    const referredByDocRef = db.collection("users").where("referralCode", "==", code);

    try {
        const referredBySnapshot = await referredByDocRef.limit(1).get();
        if (referredBySnapshot.empty) {
            alert("Invalid referral code.");
            return;
        }

        const referredByDoc = referredBySnapshot.docs[0];
        const referredByData = referredByDoc.data();
        const referredByUsername = referredByDoc.id;

        if (referredByUsername === username) {
            alert("You cannot use your own referral code.");
            return;
        }
        
        if (userSettings.referredBy) {
             alert("You have already activated a referral code.");
             return;
        }

        // Update current user's info
        await userDocRef.set({
            referredBy: referredByUsername
        }, { merge: true });

        // Update the referrer's stats
        await db.collection("users").doc(referredByUsername).set({
            referralsCount: (referredByData.referralsCount || 0) + 1
        }, { merge: true });

        userSettings.referredBy = referredByUsername; // Update local state
        alert(`Successfully activated referral code from ${referredByUsername}!`);
        loadReferralData(); // Refresh display

    } catch (error) {
        console.error("Error activating referral:", error);
        alert("An error occurred while activating the referral code.");
    }
}

async function loadReferralData() {
    const referralCodeElement = document.getElementById("userReferralCode");
    const referralCountElement = document.getElementById("referralCount");
    const totalReferralBonusElement = document.getElementById("totalReferralBonus");
    const claimReferralBonusBtn = document.getElementById("claimReferralBonusBtn");
    const referralHistoryList = document.getElementById("referralHistoryList");

    if (referralCodeElement) referralCodeElement.innerText = userSettings.referralCode;
    if (referralCountElement) referralCountElement.innerText = userSettings.referralsCount;
    if (totalReferralBonusElement) totalReferralBonusElement.innerText = `₱${userSettings.totalReferralBonus.toFixed(3)}`;

    // Check if referral bonus is available to claim
    // This logic might need refinement based on how the bonus is calculated (e.g., per friend, per earning)
    // For now, let's assume bonus is directly available if count > 0 and total bonus > 0
    if (claimReferralBonusBtn) {
        claimReferralBonusBtn.disabled = !(userSettings.referralsCount > 0 && userSettings.totalReferralBonus > 0);
    }
    
    // Load referral history (e.g., list of users who used the code)
    if (referralHistoryList) {
        try {
            const snapshot = await db.collection("users")
                .where("referredBy", "==", username)
                .limit(PAGE_SIZES.referrals)
                .get();
            
            paginationState.referrals.lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
            paginationState.referrals.firstVisible = snapshot.docs[0] || null;

            referralHistoryList.innerHTML = '';
            if (snapshot.empty) {
                referralHistoryList.innerHTML = '<li>No friends have used your referral code yet.</li>';
            } else {
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `
                        <strong>${data.username}</strong> 
                        <em>(Joined: ${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'N/A'})</em>
                    `;
                    referralHistoryList.appendChild(listItem);
                });
            }
             updatePaginationControls('referrals', snapshot.size);
        } catch (error) {
            console.error("Error loading referral history:", error);
            referralHistoryList.innerHTML = '<li>Error loading history.</li>';
        }
    }
}

async function claimReferralBonus() {
    if (userSettings.referralsCount === 0 || userSettings.totalReferralBonus === 0) {
        alert("No referral bonus available to claim.");
        return;
    }
    
    // Example: Awarding the total accumulated bonus. Adjust if bonus is incremental.
    const bonusToClaim = userSettings.totalReferralBonus;
    await updateBalance(bonusToClaim);
    alert(`Successfully claimed ₱${bonusToClaim.toFixed(3)} referral bonus!`);
    
    // Reset referral bonus tracking
    await updateUserData({
        totalReferralBonus: 0
    });
    loadReferralData(); // Refresh display
}

function copyReferralCode() {
    const code = userSettings.referralCode;
    navigator.clipboard.writeText(code).then(() => {
        alert(`Referral code copied to clipboard: ${code}`);
    }).catch(err => {
        console.error('Failed to copy referral code: ', err);
        prompt('Copy this code manually:', code);
    });
}

function navigateReferralsPage(direction) {
    console.log("Navigating referrals page:", direction);
    loadReferralData(); // Simplified
}

/* ================= MISC HELPER FUNCTIONS ================= */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function updatePaginationControls(key, dataLength) {
    const state = paginationState[key];
    const prevBtn = document.getElementById(`prev${capitalize(key)}Btn`);
    const nextBtn = document.getElementById(`next${capitalize(key)}Btn`);

    if (prevBtn) prevBtn.disabled = !state.firstVisible || state.currentPage === 1;
    if (nextBtn) nextBtn.disabled = dataLength < PAGE_SIZES[key]; // If fewer items than page size, no next page
}

function resetPagination(key) {
    paginationState[key] = { currentPage: 1, lastVisible: null, firstVisible: null, ...(key === 'chat' ? { mode: '' } : {}) };
    const prevBtn = document.getElementById(`prev${capitalize(key)}Btn`);
    const nextBtn = document.getElementById(`next${capitalize(key)}Btn`);
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
}

// Placeholder for other ad functions if needed
// window.show_10337853 = async () => { console.log("Simulating ad 10337853"); return new Promise(resolve => setTimeout(resolve, 2000)); };
// window.show_10276123 = async () => { console.log("Simulating ad 10276123"); return new Promise(resolve => setTimeout(resolve, 2000)); };
// window.show_10337795 = async () => { console.log("Simulating ad 10337795"); return new Promise(resolve => setTimeout(resolve, 2000)); };
// window.show_GENERIC = async () => { console.log("Simulating GENERIC ad"); return new Promise(resolve => setTimeout(resolve, 2000)); };
