
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, addDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp, increment, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase, ref, set, onValue, onDisconnect, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// --- Global State & Telegram Web App ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
const user = tg?.initDataUnsafe?.user || { id: "guest_" + Date.now(), username: "Guest_User", first_name: "Guest" };
const username = `@${user.username || user.first_name}`;
const userId = String(user.id);
let balance = 0;
let isFirstWithdrawal = true;
let currentChatType = 'elementary';
const PAGINATION_LIMIT_LEADERBOARD = 500;
const PAGINATION_LIMIT_WITHDRAWAL = 15;
const PAGINATION_LIMIT_OWNER_DASH = 25;

// --- Ad Configuration for Rewarded Ads ---
const rewardedAdSequences = {
    chat: ['show_10276123', 'show_10337795', 'show_10337853'], // For sending chat messages
    bonus1: ['show_10276123'],
    bonus2: ['show_10337795'],
    startup: ['show_10337853'], // Random interstitial on startup
    gift1: ['show_10337853'], // For Gift #1
    gift2: ['show_10337795'], // For Gift #2
    gift3: ['show_10276123'], // For Gift #3
};

// --- Interstitial Ad Configuration (for automatic ads) ---
const interstitialAdsConfig = {
    ad1: { key: 'show_10337853', settings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } },
    ad2: { key: 'show_10276123', settings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } },
    ad3: { key: 'show_10337795', settings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } }
};

// --- Ad Session Management for Interstitials ---
let interstitialSession = {
    lastShown: 0,
    adsShownToday: 0,
    currentSequenceIndex: 0,
    sessionStartTime: Date.now() // Initialize session start time
};

// Function to run interstitial ads with configured settings
async function showInterstitialAd(adKey) {
    const adConfig = interstitialAdsConfig[adKey];
    if (!adConfig || typeof window[adConfig.key] !== 'function') {
        console.error(`Interstitial ad key "${adKey}" or function "${adConfig.key}" not found.`);
        return false;
    }

    const now = Date.now();
    const timeSinceLastAd = now - interstitialSession.lastShown;
    
    // Check if cooldown has passed
    if (timeSinceLastAd < adConfig.settings.interval * 1000) {
        console.log(`Interstitial ad "${adConfig.key}" cooldown active. Remaining: ${(adConfig.settings.interval * 1000 - timeSinceLastAd) / 1000}s`);
        return false;
    }

    // Check if frequency cap for the session is reached
    if (interstitialSession.adsShownToday >= adConfig.settings.frequency) {
        console.log(`Interstitial ad "${adConfig.key}" frequency cap ( ${adConfig.settings.frequency} ) reached for this session.`);
        return false;
    }

    const adFunction = window[adConfig.key];

    try {
        console.log(`Attempting to show interstitial ad: ${adConfig.key}`);
        // Pass the entire object for potential SDK interpretation
        await adFunction({
             type: 'inApp',
             inAppSettings: adConfig.settings
         });
        console.log(`Interstitial ad "${adConfig.key}" shown successfully.`);
        interstitialSession.lastShown = now;
        interstitialSession.adsShownToday++;
        return true;
    } catch (error) {
        console.error(`Failed to show interstitial ad "${adConfig.key}":`, error);
        // Don't alert the user here, as these are background ads. Log the error.
        return false;
    }
}

// Function to manage the automatic interstitial ad rotation
function manageAutomaticInterstitials() {
    const { ad1, ad2, ad3 } = interstitialAdsConfig;
    const adsToRotate = [ad1, ad2, ad3]; // Array of ad configurations
    const adKeys = ['ad1', 'ad2', 'ad3']; // Corresponding keys

    const showNextInterstitial = async () => {
        const now = Date.now();
        const timeSinceSessionStart = now - interstitialSession.sessionStartTime;
        const sessionDurationLimit = 0.1 * 60 * 60 * 1000; // 0.1 hours in milliseconds

        // Reset session if it's been longer than the session duration limit or if the frequency cap for the entire set is reached (a bit more aggressive)
        if (timeSinceSessionStart > sessionDurationLimit || interstitialSession.adsShownToday >= ad1.settings.frequency + ad2.settings.frequency + ad3.settings.frequency) {
            console.log("Resetting interstitial session.");
            interstitialSession.sessionStartTime = now;
            interstitialSession.lastShown = 0; // Allow showing immediately if cooldown passed
            interstitialSession.adsShownToday = 0;
            interstitialSession.currentSequenceIndex = Math.floor(Math.random() * adsToRotate.length); // Start with a random ad
        }

        const adConfig = adsToRotate[interstitialSession.currentSequenceIndex];
        const currentAdKey = adKeys[interstitialSession.currentSequenceIndex];

        if (!adConfig) {
            console.error("No interstitial ad configuration available.");
            return;
        }

        const adShown = await showInterstitialAd(currentAdKey);

        // Schedule the next attempt
        // Use a longer interval if an ad failed to show, or the configured interval if it succeeded
        const delay = adShown ? adConfig.settings.interval * 1000 : 15000; // Check again in 15 seconds if failed
        setTimeout(showNextInterstitial, delay);

        // Advance to the next ad in the rotation for the next call
        interstitialSession.currentSequenceIndex = (interstitialSession.currentSequenceIndex + 1) % adsToRotate.length;
    };

    // Initial call to start the ad loop after a small delay
    setTimeout(showNextInterstitial, 5000 + Math.random() * 5000); // Initial delay of 5-10 seconds
}


// --- Rewarded Ad Sequence Handler ---
async function runRewardedAdSequence(adKeys) {
    for (const key of adKeys) {
        const adFunction = window[key];
        if (!adFunction) {
            console.error(`Rewarded ad function ${key} not found.`);
            alert(`Error: Ad '${key}' is not available.`);
            return false;
        }
        try {
            console.log(`Running rewarded ad: ${key}`);
            // Monetag rewarded functions might take parameters like 'pop' as per the new requirement
            await adFunction('pop'); 
            console.log(`Rewarded ad ${key} completed.`);
        } catch (e) {
            console.error(`Rewarded ad ${key} failed:`, e);
            alert(`Ad ${key} failed to load or complete. Please try again.`);
            return false;
        }
    }
    return true;
}

// --- Navigation & Routing ---
window.router = (path, params = {}) => {
    appBody.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`page-${path}`).classList.remove('hidden');
    
    if (path === 'home') {
        // Refresh UI if needed
    } else if (path === 'elementary' || path === 'highschool' || path === 'college') {
        currentChatType = path;
        chatTitleDisplay.innerText = path.toUpperCase() + " CHAT";
        loadMessages(path);
    } else if (path === 'gifts') {
        loadGiftStates(); // Load current cooldowns and claim states
    } else if (path === 'withdraw') {
        loadWithdrawalHistory();
    } else if (path === 'owner_dashboard') {
        loadOwnerWithdrawals();
    } else if (path === 'leaderboard') {
        loadLeaderboard();
    }
};

// --- UI & Animation Functions ---
const showRewardPopup = () => {
    const anims = ['animate__bounceInDown', 'animate__zoomInDown', 'animate__flipInX', 'animate__lightSpeedInRight', 'animate__jackInTheBox'];
    const randomAnim = anims[Math.floor(Math.random() * anims.length)];
    rewardContainer.innerHTML = `
        <div class="animate__animated ${randomAnim} glass p-6 rounded-3xl shadow-2xl border-4 border-yellow-400 text-center w-64">
            <h2 class="text-4xl mb-2">💎</h2>
            <p class="font-black text-xl text-indigo-800">+0.015 PHP</p>
            <p class="text-xs font-bold text-slate-400">PAPERHOUSE REWARD</p>
        </div>
    `;
    setTimeout(() => rewardContainer.innerHTML = '', 3000);
};

const updateButtonState = (buttonId, text, disabled = false) => {
    const btn = document.getElementById(buttonId);
    if (btn) {
        btn.innerText = text;
        btn.disabled = disabled;
    }
};

// --- Firebase Initialization & User Management ---
async function initializeUser() {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        await setDoc(userRef, {
            username: username,
            balance: 0,
            lastMsg: 0,
            lastBonus: 0,
            firstWithdrawalDone: false,
            giftCooldowns: { gift1: 0, gift2: 0, gift3: 0 }, // Initialize gift cooldowns
            createdAt: serverTimestamp()
        });
        balance = 0;
        isFirstWithdrawal = true;
    } else {
        const data = userDoc.data();
        balance = data.balance || 0;
        isFirstWithdrawal = !data.firstWithdrawalDone;
        if (isFirstWithdrawal) {
            document.getElementById('withdrawTask').classList.remove('hidden');
        }
    }
    balanceDisplay.innerText = balance.toFixed(3);
    userBar.innerText = `👤 ${username}`;
}

// --- Theme/Background Logic ---
const colors = ["#FFC0CB", "#90EE90", "#ADD8E6", "#FFB6C1", "#EE82EE", "#FFFFE0", "#ADFF2F", "#FFA500", "#FFFFFF", "#00FFFF", "#A52A2A"];
document.getElementById("clickArea").addEventListener("click", () => {
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.style.backgroundColor = randomColor;
    document.documentElement.style.setProperty('--main-bg', randomColor);
    
    document.querySelectorAll("button").forEach(btn => {
        const btnRandomColor = colors[Math.floor(Math.random() * colors.length)];
        if (btnRandomColor !== '#FFFFFF' && btnRandomColor !== '#FFFFE0' && btn.id !== 'sendBtn' && !btn.classList.contains('bg-gray-800') && !btn.classList.contains('bg-lime-700') && !btn.classList.contains('bg-black')) { // Avoid making primary buttons unreadable
             btn.style.backgroundColor = btnRandomColor;
        }
    });
});

// --- Realtime Database for Presence ---
function setupPresence() {
    const onlineRef = ref(rtdb, `status/${userId}`);
    const userStatusPayload = { username, status: "online", last: Date.now() };
    set(onlineRef, userStatusPayload);
    onDisconnect(onlineRef).remove();

    const statusListRef = ref(rtdb, 'status');
    onValue(statusListRef, (snapshot) => {
        const data = snapshot.val() || {};
        const users = Object.values(data);
        onlineCountDisplay.innerText = users.length;
        onlineListDisplay.innerHTML = users.slice(0, 25).map(u => `
            <div class="flex justify-between p-2 glass rounded-lg mb-1">
                <span>${u.username}</span>
                <span class="text-green-500 font-bold text-xs">● Online</span>
            </div>
        `).join('');
    });
}

// --- Chat Management ---
let chatMessageUnsubscribe = null;
async function loadMessages(type) {
    if (chatMessageUnsubscribe) chatMessageUnsubscribe(); 
    
    const messagesCol = collection(db, `chat_${type}`);
    const q = query(messagesCol, orderBy("createdAt", "desc"), limit(50));
    
    chatMessageUnsubscribe = onSnapshot(q, (snapshot) => {
        chatBoxDisplay.innerHTML = snapshot.docs.map(doc => `
            <div class="mb-2 p-2 rounded-lg bg-white border-l-4 border-indigo-400 glass-inner">
                <p class="text-[10px] font-bold text-indigo-400">${doc.data().user}</p>
                <p class="text-sm break-words">${doc.data().text}</p>
            </div>
        `).join('');
    });
}

sendBtn.onclick = async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    const lastMsg = userDoc.data()?.lastMsg || 0;
    const cooldown = 180000; // 3 minutes

    if (Date.now() - lastMsg < cooldown) {
        const remaining = Math.ceil((cooldown - (Date.now() - lastMsg)) / 1000);
        chatCooldown.innerText = `Cooldown: ${remaining}s`;
        return;
    }
    chatCooldown.innerText = ''; 

    updateButtonState('sendBtn', 'Loading Ads...', true);
    
    const adKeys = rewardedAdSequences[currentChatType];
    if (await runRewardedAdSequence(adKeys)) {
        try {
            await addDoc(collection(db, `chat_${currentChatType}`), {
                text: text,
                user: username,
                createdAt: serverTimestamp()
            });
            await updateDoc(userRef, {
                balance: increment(0.015),
                lastMsg: Date.now()
            });
            balance += 0.015; 
            balanceDisplay.innerText = balance.toFixed(3);
            showRewardPopup();
            chatInput.value = '';
        } catch (e) {
            console.error("Error sending message:", e);
            alert("Failed to send message. Please try again.");
        }
    }
    updateButtonState('sendBtn', 'Watch 3 Ads to Send (+0.015 PHP)');
};

// --- Gift Functions ---
const GIFT_REWARD_AMOUNT = 0.01;
const GIFT_COOLDOWN = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

async function loadGiftStates() {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    const giftCooldowns = userDoc.data()?.giftCooldowns || { gift1: 0, gift2: 0, gift3: 0 };
    const now = Date.now();

    for (const giftId of ['gift1', 'gift2', 'gift3']) {
        const cooldownEnd = giftCooldowns[giftId] || 0;
        const btn = document.getElementById(`${giftId}Btn`);
        const claimBtn = document.getElementById(`${giftId}Claim`);
        const cooldownDisplay = document.getElementById(`${giftId}Cooldown`);

        if (now >= cooldownEnd) {
            btn.classList.remove('hidden');
            claimBtn.classList.add('hidden');
            cooldownDisplay.innerText = '';
            btn.disabled = false;
        } else {
            btn.classList.add('hidden');
            claimBtn.classList.add('hidden');
            const remaining = Math.ceil((cooldownEnd - now) / 1000);
            cooldownDisplay.innerText = `Available in ${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`;
            btn.disabled = true;
        }
    }
}

window.handleGiftAd = async (giftId) => {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    const giftCooldowns = userDoc.data()?.giftCooldowns || {};
    const cooldownEnd = giftCooldowns[giftId] || 0;
    const now = Date.now();

    if (now < cooldownEnd) {
        const remaining = Math.ceil((cooldownEnd - now) / 1000);
        document.getElementById(`${giftId}Cooldown`).innerText = `Available in ${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`;
        return alert("This gift is still on cooldown.");
    }

    const adKeys = rewardedAdSequences[giftId];
    if (!adKeys) {
        console.error(`No ad sequence found for giftId: ${giftId}`);
        return alert("Gift is unavailable at the moment.");
    }

    const adBtn = document.getElementById(`${giftId}Btn`);
    const claimBtn = document.getElementById(`${giftId}Claim`);
    const cooldownDisplay = document.getElementById(`${giftId}Cooldown`);

    updateButtonState(`${giftId}Btn`, 'Watching Ad...', true);

    if (await runRewardedAdSequence(adKeys)) {
        updateButtonState(`${giftId}Btn`, 'Ad Watched!', false);
        adBtn.classList.add('hidden');
        claimBtn.classList.remove('hidden');
        cooldownDisplay.innerText = ''; // Clear any previous cooldown message
        
        // Temporarily enable claim button after ad watched
        setTimeout(() => {
            claimBtn.classList.remove('hidden'); // Ensure it's visible
            claimBtn.disabled = false;
        }, 1000); // Small delay just in case
    } else {
        // Ad failed, reset button state
        updateButtonState(`${giftId}Btn`, 'Watch Ad for 0.01 PHP', false);
        alert("Ad failed to load. Please try again.");
    }
};

window.claimReward = async (giftId) => {
    const userRef = doc(db, "users", userId);
    const claimBtn = document.getElementById(`${giftId}Claim`);
    const adBtn = document.getElementById(`${giftId}Btn`);
    const cooldownDisplay = document.getElementById(`${giftId}Cooldown`);

    updateButtonState(`${giftId}Claim`, 'Claiming...', true);

    try {
        const now = Date.now();
        await updateDoc(userRef, {
            balance: increment(GIFT_REWARD_AMOUNT),
            [`giftCooldowns.${giftId}`]: now + GIFT_COOLDOWN // Set new cooldown end time
        });
        balance += GIFT_REWARD_AMOUNT;
        balanceDisplay.innerText = balance.toFixed(3);

        claimBtn.classList.add('hidden');
        adBtn.classList.remove('hidden'); // Show the ad button again
        adBtn.disabled = true; // Disable it until cooldown passes
        
        const remaining = GIFT_COOLDOWN / 1000;
        cooldownDisplay.innerText = `Available in ${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`;
        
        alert(`Successfully claimed 0.01 PHP!`);
        loadGiftStates(); // Refresh states to show the disabled ad button and cooldown

    } catch (e) {
        console.error(`Error claiming gift reward for ${giftId}:`, e);
        alert("Failed to claim reward. Please try again.");
        updateButtonState(`${giftId}Claim`, 'Claim 0.01 PHP', false); // Re-enable if failed
    }
};

// --- Withdrawal Functions ---
window.startWithdrawTimer = () => {
    let sec = 30;
    withdrawForm.classList.add('opacity-50', 'pointer-events-none');
    const timerInterval = setInterval(() => {
        taskTimer.innerText = `Unlocking in ${sec}s...`;
        if (sec <= 0) {
            clearInterval(timerInterval);
            taskTimer.innerText = "Verified! ✅";
            withdrawForm.classList.remove('opacity-50', 'pointer-events-none');
            isFirstWithdrawal = false;
            updateDoc(doc(db, "users", userId), { firstWithdrawalDone: true });
        }
        sec--;
    }, 1000);
};

window.requestWithdrawal = async () => {
    const gcash = gcashNumInput.value.trim();
    if (gcash.length < 10 || !/^\d+$/.test(gcash)) {
        return alert("Invalid GCash Number. Please enter a valid 11-digit number.");
    }
    if (balance < 0.02) {
        return alert("Minimum withdrawal is 0.02 PHP.");
    }

    updateButtonState('sendBtn', 'Processing...', true); 
    try {
        await addDoc(collection(db, "withdrawals"), {
            userId, username, gcash, amount: balance, status: "Pending", date: serverTimestamp(), processedBy: null, processedAt: null
        });
        const currentBalance = balance; 
        await updateDoc(doc(db, "users", userId), { balance: 0 });
        balance = 0; 
        balanceDisplay.innerText = balance.toFixed(3);
        alert(`Withdrawal request for ${currentBalance.toFixed(3)} PHP submitted. Please wait for approval.`);
        router('home');
    } catch (e) {
        console.error("Withdrawal error:", e);
        alert("Failed to submit withdrawal request. Please try again.");
    } finally {
        updateButtonState('sendBtn', 'Watch 3 Ads to Send (+0.015 PHP)');
        gcashNumInput.value = '';
    }
};

let withdrawalHistoryUnsubscribe = null;
function loadWithdrawalHistory() {
    if (withdrawalHistoryUnsubscribe) withdrawalHistoryUnsubscribe();

    const withdrawalsRef = collection(db, "withdrawals");
    const q = query(withdrawalsRef, where("userId", "==", userId), orderBy("date", "desc"), limit(PAGINATION_LIMIT_WITHDRAWAL));
    
    withdrawalHistoryUnsubscribe = onSnapshot(q, (snapshot) => {
        withdrawHistoryBody.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.date ? new Date(data.date.seconds * 1000).toLocaleString() : 'N/A';
            const status = data.status;
            const statusColor = status === 'Pending' ? 'text-orange-500' : (status === 'Approved' ? 'text-green-500' : 'text-red-500');
            return `
                <tr class="border-b">
                    <td class="p-2 text-xs">
                        ${data.amount.toFixed(3)} PHP<br>
                        <span class="opacity-60">${data.gcash || 'N/A'}</span>
                    </td>
                    <td class="p-2 font-bold ${statusColor}">${status}</td>
                </tr>
            `;
        }).join('');
    });
}

// --- Bonus Ads ---
window.handleBonus = async (server) => {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    const lastBonus = userDoc.data()?.lastBonus || 0;
    const cooldown = 300000; // 5 minutes

    if (Date.now() - lastBonus < cooldown) {
        const remaining = Math.ceil((cooldown - (Date.now() - lastBonus)) / 1000);
        bonusCooldownDisplay.innerText = `Bonus available in ${Math.floor(remaining / 60)}m ${remaining % 60}s`;
        return;
    }
    bonusCooldownDisplay.innerText = '';

    updateButtonState('sendBtn', 'Loading Ads...', true);

    const adKeys = rewardedAdSequences[server === 1 ? 'bonus1' : 'bonus2'];
    if (await runRewardedAdSequence(adKeys)) {
        try {
            await updateDoc(userRef, {
                balance: increment(0.015),
                lastBonus: Date.now()
            });
            balance += 0.015;
            balanceDisplay.innerText = balance.toFixed(3);
            showRewardPopup();
        } catch (e) {
            console.error("Bonus ad error:", e);
            alert("Failed to get bonus reward. Please try again.");
        }
    }
    updateButtonState('sendBtn', 'Watch 3 Ads to Send (+0.015 PHP)');
};

// --- Owner Dashboard ---
const OWNER_PASSWORD = "Propetas12";
let ownerWithdrawalsUnsubscribe = null;
let totalApprovedWithdrawals = 0;

async function loadOwnerWithdrawals() {
    const password = prompt("Enter Owner Password:");
    if (password !== OWNER_PASSWORD) {
        alert("Incorrect Password!");
        router('home');
        return;
    }

    if (ownerWithdrawalsUnsubscribe) ownerWithdrawalsUnsubscribe();

    const withdrawalsRef = collection(db, "withdrawals");
    const q = query(withdrawalsRef, orderBy("date", "desc"), limit(PAGINATION_LIMIT_OWNER_DASH)); 

    ownerWithdrawalsUnsubscribe = onSnapshot(q, (snapshot) => {
        ownerWithdrawalRequests.innerHTML = ''; // Clear existing
        totalApprovedWithdrawals = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date ? new Date(data.date.seconds * 1000).toLocaleString() : 'N/A';
            const status = data.status;
            const statusColor = status === 'Pending' ? 'text-orange-500' : (status === 'Approved' ? 'text-green-500' : 'text-red-500');
            
            if (status === 'Approved') {
                totalApprovedWithdrawals += data.amount;
            }

            ownerWithdrawalRequests.innerHTML += `
                <tr data-id="${doc.id}">
                    <td class="p-3">${data.username || 'Unknown'}</td>
                    <td class="p-3">${data.gcash || 'N/A'}</td>
                    <td class="p-3">${data.amount.toFixed(3)} PHP</td>
                    <td class="p-3 text-xs">${date}</td>
                    <td class="p-3 font-bold ${statusColor}">${status}</td>
                    <td class="p-3 flex gap-2">
                        <button onclick="handleOwnerAction('Approved', '${doc.id}')" class="bg-green-500 text-white px-3 py-1 rounded text-xs disabled:opacity-50">Approve</button>
                        <button onclick="handleOwnerAction('Denied', '${doc.id}')" class="bg-red-500 text-white px-3 py-1 rounded text-xs disabled:opacity-50">Deny</button>
                    </td>
                </tr>
            `;
        });
        totalApprovedWithdrawalsDisplay.innerText = totalApprovedWithdrawals.toFixed(3);
    });
}

window.handleOwnerAction = async (newStatus, docId) => {
    const withdrawalRef = doc(db, "withdrawals", docId);
    const row = document.querySelector(`tr[data-id="${docId}"]`);
    const approveBtn = row?.querySelector('button:has(text/Approve)');
    const denyBtn = row?.querySelector('button:has(text/Deny)');

    if (!row || !approveBtn || !denyBtn) return; 

    approveBtn.disabled = true;
    denyBtn.disabled = true;

    try {
        const docSnap = await getDoc(withdrawalRef);
        if (!docSnap.exists() || docSnap.data().status !== 'Pending') {
            alert("This request is no longer pending or does not exist.");
            return;
        }

        await updateDoc(withdrawalRef, { status: newStatus, processedBy: username, processedAt: serverTimestamp() });
        alert(`Withdrawal request ${docId} marked as ${newStatus}.`);

    } catch (e) {
        console.error(`Error updating withdrawal status for ${docId}:`, e);
        alert(`Failed to update status for ${docId}.`);
    }
};

// --- Leaderboard ---
let leaderboardUnsubscribe = null;
async function loadLeaderboard() {
    if (leaderboardUnsubscribe) leaderboardUnsubscribe();

    const withdrawalsRef = collection(db, "withdrawals");
    const q = query(withdrawalsRef, where("status", "==", "Approved"), orderBy("date", "desc"));

    leaderboardUnsubscribe = onSnapshot(q, (snapshot) => {
        const earners = {}; 
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.userId && data.amount && data.username) {
                if (!earners[data.userId]) {
                    earners[data.userId] = { username: data.username, totalEarned: 0 };
                }
                earners[data.userId].totalEarned += data.amount;
            }
        });

        const sortedEarners = Object.values(earners).sort((a, b) => b.totalEarned - a.totalEarned);

        leaderboardListDisplay.innerHTML = sortedEarners.slice(0, PAGINATION_LIMIT_LEADERBOARD).map((earner, index) => `
            <tr>
                <td class="p-2">${index + 1}</td>
                <td class="p-2">${earner.username}</td>
                <td class="p-2 font-bold">${earner.totalEarned.toFixed(3)} PHP</td>
            </tr>
        `).join('');
    });
}

// --- Clock & Startup ---
function startApp() {
    initializeUser();
    setupPresence();
    manageAutomaticInterstitials(); // Start background interstitial ads
    
    setInterval(() => {
        footerClock.innerText = new Date().toLocaleString();
    }, 1000);
    
    router('home');
}

startApp();
