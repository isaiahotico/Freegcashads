
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, remove, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase project configuration!
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

// --- Monetag Zone Configurations ---
// These refer to the SDK functions declared in index.html by the Monetag script.
// Ensure the sdk_func_name matches the 'data-sdk' attribute in your script tags.
const MONETAG_ZONES = [
    { id: '10276123', sdk_func_name: 'show_10276123' },
    { id: '10337795', sdk_func_name: 'show_10337795' },
    { id: '10337853', sdk_func_name: 'show_10337853' }
];

// --- Application Constants ---
const MAX_CHAT_MESSAGES = 100;
const ADMIN_PASSWORD = "Propetas12"; // !!! IMPORTANT: CHANGE THIS TO A SECURE PASSWORD AND DO NOT EXPOSE IN PRODUCTION !!!
const BOT_USERNAME = "Key_52_bot";   // !!! IMPORTANT: UPDATE THIS WITH YOUR ACTUAL TELEGRAM BOT USERNAME !!!

// Ad Rewards
const REGULAR_AD_REWARD = 0.015;
const PREMIUM_AD_REWARD = 0.030;
const TURBO_AD_REWARD = 0.050;

// Ad Cooldowns (in seconds)
const REGULAR_AD_COOLDOWN = 60;   // 1 minute
const PREMIUM_AD_COOLDOWN = 300;  // 5 minutes
const TURBO_AD_DAILY_LIMIT = 3;   // Daily limit for Turbo Ads

const REFERRAL_BONUS_RATE = 0.08; // 8%
const WITHDRAWAL_MINIMUM = 1.00;

// --- Global Application State Variables ---
let currentUser = null;
let telegramUserId = null; // Stores the Telegram user ID if available
let userId = null;         // The primary UID for the app (Telegram ID or fallback local ID)
let currentTopicId = null; // Stores the ID of the topic currently being viewed in the forum

// Cooldown timers
let regularCooldownTime = 0;
let premiumCooldownTime = 0;

let regularCooldownInterval = null;
let premiumCooldownInterval = null;

// --- Helper Functions ---
function getTodayDateString() {
    return new Date().toDateString(); // e.g., "Wed Jan 01 2025"
}

/**
 * Orchestrates the display of Monetag ads. It attempts to show ads from all configured zones.
 * @returns {Promise<number>} The number of ads successfully displayed.
 */
async function triggerMonetagAds() {
    let adsPlayedSuccessfully = 0;
    const adPromises = MONETAG_ZONES.map(zone => {
        if (window[zone.sdk_func_name]) {
            // Use 'inApp' type for aggressive interstitial/pop-under experience
            return window[zone.sdk_func_name]({ type: 'inApp', inAppSettings: { frequency: 1, capping: 0.05, interval: 10, timeout: 3, everyPage: true } })
                .then(() => true) // Resolve with true if ad shows
                .catch(e => {
                    console.warn(`Monetag ad (Zone: ${zone.id}) failed:`, e);
                    return false; // Resolve with false if ad fails
                });
        } else {
            console.error(`Monetag SDK function ${zone.sdk_func_name} not found.`);
            return Promise.resolve(false);
        }
    });

    const results = await Promise.allSettled(adPromises);
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value === true) {
            adsPlayedSuccessfully++;
        }
    });
    return adsPlayedSuccessfully;
}

// --- Main Application Object (Encapsulates all functions) ---
const app = {
    /**
     * Initializes the application.
     * Detects Telegram Web App context, attempts to load existing user data,
     * or prompts for registration if no user is found.
     */
    init: async () => {
        let referrerId = null;
        let isTelegramContext = false;

        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            isTelegramContext = true;
            telegramUserId = window.Telegram.WebApp.initDataUnsafe.user?.id?.toString();

            if (!telegramUserId) {
                console.error("Telegram User ID not found in initDataUnsafe. Cannot proceed.");
                alert("Error: Telegram User ID not found. Please ensure you are opening this app from a Telegram chat.");
                document.getElementById('login-screen').style.display = 'flex';
                return;
            }
            userId = telegramUserId;
            localStorage.setItem('ph_uid', userId);
            referrerId = window.Telegram.WebApp.initDataUnsafe.start_param;
        } else {
            userId = localStorage.getItem('ph_uid');
            if (!userId) {
                userId = 'U' + Math.floor(Math.random() * 899999 + 100000);
                localStorage.setItem('ph_uid', userId);
                console.warn(`Generated a new local user ID: ${userId}. This should ideally be a Telegram ID in production.`);
            }
            referrerId = new URLSearchParams(window.location.search).get('ref');
        }

        if (userId) {
            const userRef = ref(db, `users/${userId}`);
            const snap = await get(userRef);

            if (snap.exists()) {
                currentUser = snap.val();
                if (isTelegramContext && currentUser.telegramId && currentUser.telegramId !== telegramUserId) {
                    console.error(`User ${userId} has conflicting Telegram IDs. Current: ${telegramUserId}, Stored: ${currentUser.telegramId}`);
                    alert("Account conflict detected. Please contact support or clear local data.");
                    localStorage.removeItem('ph_uid');
                    window.location.reload();
                    return;
                }
                app.launch();
            } else {
                document.getElementById('login-screen').style.display = 'flex';
            }
        } else {
            alert("Could not determine user ID. Please try opening from Telegram or ensure cookies are enabled.");
            document.getElementById('login-screen').style.display = 'flex';
        }

        if (referrerId) {
            sessionStorage.setItem('temp_referrer_id', referrerId);
        }
    },

    /**
     * Handles user registration and initial account creation in Firebase.
     */
    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        
        if (name.length < 3) return alert("Username must be at least 3 characters long.");
        if (gcash.length < 10 || !/^\d+$/.test(gcash)) return alert("GCash Number must be 10 digits and contain only numbers.");

        let finalReferrer = null;
        if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
            finalReferrer = window.Telegram.WebApp.initDataUnsafe.start_param;
        } else {
            finalReferrer = sessionStorage.getItem('temp_referrer_id') || new URLSearchParams(window.location.search).get('ref');
        }
        if (finalReferrer === userId) finalReferrer = null;
        
        if (finalReferrer) {
            const referrerSnap = await get(ref(db, `users/${finalReferrer}`));
            if (!referrerSnap.exists()) {
                console.warn(`Referrer ID ${finalReferrer} does not exist. Ignoring.`);
                finalReferrer = null;
            }
        }

        currentUser = {
            uid: userId,
            username: name,
            gcash: gcash,
            balance: 0.0,
            refEarnings: 0.0,
            referredBy: finalReferrer,
            totalAds: 0,
            dailyAds: 0,
            lastAdDate: null,
            premiumAdsViewed: 0,
            lastPremiumAdDate: null,
            turboAdsViewedToday: 0,
            lastTurboAdDate: null,
            createdAt: serverTimestamp(),
            telegramId: telegramUserId
        };

        try {
            await set(ref(db, `users/${userId}`), currentUser);
            localStorage.setItem('ph_uid', userId);
            sessionStorage.removeItem('temp_referrer_id');
            app.launch();
        } catch (error) {
            console.error("Registration failed:", error);
            alert("Registration failed. Please try again.");
        }
    },

    /**
     * Launches the main application interface.
     */
    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser.username;
        document.getElementById('ref-link').value = `https://t.me/${BOT_USERNAME}/start?start=${userId}`;
        
        app.syncUserData();
        app.loadWithdrawalHistory();
        app.setupPresenceListeners();
        app.loadTopics();
        app.startCooldownsFromLastVisit(); // Initialize cooldowns
        
        app.navTo('home');
    },

    // --- Data Synchronization and UI Updates ---

    /**
     * Listens for real-time updates to the current user's data and updates UI.
     */
    syncUserData: () => {
        const userRef = ref(db, `users/${userId}`);
        onValue(userRef, async (snap) => {
            if (snap.exists()) {
                currentUser = snap.val();
                
                // Reset daily stats if it's a new day
                const today = getTodayDateString();
                let shouldUpdateUser = false;

                if (currentUser.lastAdDate !== today) {
                    currentUser.dailyAds = 0;
                    currentUser.lastAdDate = today;
                    shouldUpdateUser = true;
                }
                if (currentUser.lastTurboAdDate !== today) {
                    currentUser.turboAdsViewedToday = 0;
                    currentUser.lastTurboAdDate = today;
                    shouldUpdateUser = true;
                }
                
                if (shouldUpdateUser) {
                    await update(userRef, {
                        dailyAds: currentUser.dailyAds,
                        lastAdDate: currentUser.lastAdDate,
                        turboAdsViewedToday: currentUser.turboAdsViewedToday,
                        lastTurboAdDate: currentUser.lastTurboAdDate
                    });
                }

                const bal = currentUser.balance || 0;
                document.getElementById('balance-display').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('big-balance').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('ref-earnings').innerText = `₱${(currentUser.refEarnings || 0).toFixed(2)}`;
                
                // Profile Section
                document.getElementById('profile-total-ads').innerText = (currentUser.totalAds || 0);
                document.getElementById('profile-daily-ads').innerText = (currentUser.dailyAds || 0);
                document.getElementById('profile-ref-earnings').innerText = `₱${(currentUser.refEarnings || 0).toFixed(2)}`;
                
                // Turbo Ad status
                document.getElementById('turbo-ads-count').innerText = (currentUser.turboAdsViewedToday || 0);
                document.getElementById('turbo-ads-max').innerText = TURBO_AD_DAILY_LIMIT;
                if ((currentUser.turboAdsViewedToday || 0) >= TURBO_AD_DAILY_LIMIT) {
                    document.getElementById('turbo-ad-btn').classList.add('cooldown-active');
                    document.getElementById('turbo-ad-status').innerText = 'DAILY LIMIT REACHED';
                } else {
                    document.getElementById('turbo-ad-btn').classList.remove('cooldown-active');
                    document.getElementById('turbo-ad-status').innerText = `VIEWED TODAY: ${currentUser.turboAdsViewedToday || 0}/${TURBO_AD_DAILY_LIMIT}`;
                }

                // Fetch and update the referral count for the current user
                const refCountSnap = await get(query(ref(db, 'users'), orderByChild('referredBy'), currentUser.uid));
                document.getElementById('ref-count').innerText = refCountSnap.size || 0;
                document.getElementById('profile-referrals').innerText = refCountSnap.size || 0;

            } else {
                console.warn(`User data for ${userId} not found during sync. Re-initializing.`);
                alert("Your account data could not be loaded. Please log in again.");
                localStorage.removeItem('ph_uid');
                window.location.reload();
            }
        });
    },

    // --- Ad Earning Functions (Homepage) ---

    /**
     * Common function to handle ad rewards and referral bonuses.
     */
    grantAdReward: async (rewardAmount, adType) => {
        const today = getTodayDateString();
        let updateData = {
            balance: parseFloat(((currentUser.balance || 0) + rewardAmount).toFixed(4)),
            totalAds: (currentUser.totalAds || 0) + 1,
            dailyAds: (currentUser.dailyAds || 0) + 1,
            lastAdDate: today
        };

        if (adType === 'premium') {
            updateData.premiumAdsViewed = (currentUser.premiumAdsViewed || 0) + 1;
            updateData.lastPremiumAdDate = today;
        } else if (adType === 'turbo') {
            updateData.turboAdsViewedToday = (currentUser.turboAdsViewedToday || 0) + 1;
            updateData.lastTurboAdDate = today;
        }

        await update(ref(db, `users/${userId}`), updateData);

        if (currentUser.referredBy) {
            const referralBonus = rewardAmount * REFERRAL_BONUS_RATE;
            const uplinerRef = ref(db, `users/${currentUser.referredBy}`);
            const uplinerSnap = await get(uplinerRef);
            if (uplinerSnap.exists()) {
                const upliner = uplinerSnap.val();
                await update(uplinerRef, {
                    balance: parseFloat(((upliner.balance || 0) + referralBonus).toFixed(4)),
                    refEarnings: parseFloat(((upliner.refEarnings || 0) + referralBonus).toFixed(4))
                });
            }
        }
        alert(`Success! Earned ₱${rewardAmount.toFixed(2)} from ${adType} ad.`);
    },

    /**
     * Plays regular ads and grants reward.
     */
    playRegularAds: async () => {
        if (regularCooldownTime > 0) return alert(`Please wait ${regularCooldownTime} seconds.`);
        
        const adsPlayed = await triggerMonetagAds();
        if (adsPlayed === MONETAG_ZONES.length) {
            await app.grantAdReward(REGULAR_AD_REWARD, 'regular');
            app.startCooldown('regular');
        } else {
            alert(`Only ${adsPlayed} out of ${MONETAG_ZONES.length} ads loaded. Please try again to get the full reward.`);
        }
    },

    /**
     * Plays premium ads and grants reward.
     */
    playPremiumAds: async () => {
        if (premiumCooldownTime > 0) return alert(`Please wait ${premiumCooldownTime} seconds.`);
        
        const adsPlayed = await triggerMonetagAds();
        if (adsPlayed === MONETAG_ZONES.length) {
            await app.grantAdReward(PREMIUM_AD_REWARD, 'premium');
            app.startCooldown('premium');
        } else {
            alert(`Only ${adsPlayed} out of ${MONETAG_ZONES.length} ads loaded. Please try again to get the full reward.`);
        }
    },

    /**
     * Plays turbo ads and grants reward, respecting daily limit.
     */
    playTurboAds: async () => {
        if ((currentUser.turboAdsViewedToday || 0) >= TURBO_AD_DAILY_LIMIT) {
            return alert(`You have reached your daily limit of ${TURBO_AD_DAILY_LIMIT} Turbo Ads.`);
        }

        const adsPlayed = await triggerMonetagAds();
        if (adsPlayed === MONETAG_ZONES.length) {
            await app.grantAdReward(TURBO_AD_REWARD, 'turbo');
        } else {
            alert(`Only ${adsPlayed} out of ${MONETAG_ZONES.length} ads loaded. Please try again to get the full reward.`);
        }
    },

    /**
     * Starts the cooldown timer for a specific ad type.
     */
    startCooldown: (adType) => {
        let duration, timerElementId, cooldownBoxId, buttonId, cooldownVar, intervalVar;
        
        if (adType === 'regular') {
            duration = REGULAR_AD_COOLDOWN;
            timerElementId = 'regular-ad-timer';
            cooldownBoxId = 'regular-ad-cooldown-box';
            buttonId = 'regular-ad-btn';
            cooldownVar = 'regularCooldownTime';
            intervalVar = 'regularCooldownInterval';
            localStorage.setItem('lastRegularAdTime', Date.now());
        } else if (adType === 'premium') {
            duration = PREMIUM_AD_COOLDOWN;
            timerElementId = 'premium-ad-timer';
            cooldownBoxId = 'premium-ad-cooldown-box';
            buttonId = 'premium-ad-btn';
            cooldownVar = 'premiumCooldownTime';
            intervalVar = 'premiumCooldownInterval';
            localStorage.setItem('lastPremiumAdTime', Date.now());
        } else {
            return; // Invalid adType
        }

        app[cooldownVar] = duration;
        document.getElementById(buttonId).classList.add('cooldown-active');
        document.getElementById(cooldownBoxId).classList.remove('hidden');
        document.getElementById(timerElementId).innerText = app[cooldownVar];
        
        clearInterval(app[intervalVar]);
        app[intervalVar] = setInterval(() => {
            app[cooldownVar]--;
            document.getElementById(timerElementId).innerText = app[cooldownVar];
            if (app[cooldownVar] <= 0) {
                clearInterval(app[intervalVar]);
                document.getElementById(buttonId).classList.remove('cooldown-active');
                document.getElementById(cooldownBoxId).classList.add('hidden');
                alert(`${adType} ad cooldown finished!`);
            }
        }, 1000);
    },

    /**
     * Restores cooldown timers from localStorage on app launch.
     */
    startCooldownsFromLastVisit: () => {
        const checkCooldown = (lastAdTimeKey, cooldownDuration, adType) => {
            const lastAdTime = localStorage.getItem(lastAdTimeKey);
            if (lastAdTime) {
                const elapsed = Math.floor((Date.now() - parseInt(lastAdTime)) / 1000);
                if (elapsed < cooldownDuration) {
                    const remaining = cooldownDuration - elapsed;
                    if (adType === 'regular') regularCooldownTime = remaining;
                    if (adType === 'premium') premiumCooldownTime = remaining;
                    app.startCooldown(adType);
                }
            }
        };

        checkCooldown('lastRegularAdTime', REGULAR_AD_COOLDOWN, 'regular');
        checkCooldown('lastPremiumAdTime', PREMIUM_AD_COOLDOWN, 'premium');
    },

    // --- Withdrawal Logic ---

    /**
     * Submits a withdrawal request.
     */
    requestWithdraw: async () => {
        if (currentUser.balance < WITHDRAWAL_MINIMUM) {
            alert(`Minimum withdrawal is ₱${WITHDRAWAL_MINIMUM.toFixed(2)}.`);
            return;
        }
        
        const withdrawalRequest = {
            uid: userId,
            username: currentUser.username,
            gcash: currentUser.gcash,
            amount: parseFloat(currentUser.balance.toFixed(2)),
            status: 'pending',
            timestamp: serverTimestamp()
        };

        try {
            const newKey = push(ref(db, 'withdrawals')).key;
            await set(ref(db, `withdrawals/${newKey}`), withdrawalRequest);
            await update(ref(db, `users/${userId}`), { balance: 0 });
            alert("Withdrawal request submitted! Check history for status.");
        } catch (error) {
            console.error("Withdrawal request failed:", error);
            alert("Failed to submit withdrawal request. Please try again later.");
        }
    },

    /**
     * Loads and displays withdrawal history.
     */
    loadWithdrawalHistory: () => {
        const historyList = document.getElementById('history-list');
        const historyRef = query(ref(db, 'withdrawals'), orderByChild('timestamp'));

        onValue(historyRef, (snap) => {
            historyList.innerHTML = "";
            const withdrawalData = [];

            snap.forEach(child => {
                const withdrawal = child.val();
                if (withdrawal.uid === userId) {
                    withdrawalData.push({ key: child.key, ...withdrawal });
                }
            });
            
            withdrawalData.sort((a, b) => b.timestamp - a.timestamp);

            if (withdrawalData.length === 0) {
                historyList.innerHTML = `<p class="text-center text-slate-500 py-10">No withdrawal history yet.</p>`;
                return;
            }

            withdrawalData.forEach(w => {
                const date = w.timestamp ? new Date(w.timestamp).toLocaleDateString() : 'N/A';
                let statusColor = 'border-yellow-500';
                let statusTextClass = 'text-yellow-500';
                
                if (w.status === 'paid') {
                    statusColor = 'border-green-500';
                    statusTextClass = 'text-green-500';
                } else if (w.status === 'rejected') {
                    statusColor = 'border-red-500';
                    statusTextClass = 'text-red-500';
                }

                historyList.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center border-l-4 ${statusColor}">
                        <div>
                            <p class="text-sm font-bold">₱${w.amount.toFixed(2)}</p>
                            <p class="text-[10px] text-slate-500">${date}</p>
                        </div>
                        <span class="text-[10px] uppercase font-black ${statusTextClass}">${w.status}</span>
                    </div>
                `;
            });
        });
    },

    // --- Navigation Logic ---

    /**
     * Handles navigation between different sections.
     */
    navTo: (sectionId) => {
        if (sectionId === 'admin') {
            const pw = prompt("Enter Admin Password:");
            if (pw !== ADMIN_PASSWORD) {
                alert("Access Denied");
                sectionId = 'home';
            } else {
                app.loadAdminPayouts();
            }
        }
        
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        
        const targetSection = document.getElementById(`sec-${sectionId}`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        } else {
            console.error(`Section with ID 'sec-${sectionId}' not found. Defaulting to home.`);
            document.getElementById('sec-home').classList.remove('hidden');
            sectionId = 'home';
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.onclick?.toString().includes(`app.navTo('${sectionId}')`)) {
                btn.classList.add('nav-active');
            }
        });

        switch (sectionId) {
            case 'chat': app.loadChatMessages(); break;
            case 'leaderboard': app.loadLeaderboard(); break;
            case 'topics-list': app.loadTopics(); break;
            case 'profile': app.syncUserData(); break; // Ensure profile data is fresh
            case 'online': app.setupPresenceListeners(); break; // Re-init listener just in case
        }
    },

    // --- Admin Functions ---

    /**
     * Loads and displays all pending withdrawal requests for admin.
     */
    loadAdminPayouts: () => {
        const adminList = document.getElementById('admin-list');
        const withdrawalsRef = query(ref(db, 'withdrawals'), orderByChild('timestamp'));

        onValue(withdrawalsRef, (snap) => {
            adminList.innerHTML = "";
            const pendingWithdrawals = [];

            snap.forEach(child => {
                const withdrawal = child.val();
                if (withdrawal.status === 'pending') {
                    pendingWithdrawals.push({ key: child.key, ...withdrawal });
                }
            });

            pendingWithdrawals.sort((a, b) => b.timestamp - a.timestamp);

            if (pendingWithdrawals.length === 0) {
                adminList.innerHTML = `<p class="text-center text-slate-500 py-10">No pending withdrawals.</p>`;
                return;
            }

            pendingWithdrawals.forEach(w => {
                adminList.innerHTML += `
                    <div class="glass p-4 rounded-xl">
                        <p class="text-xs font-bold">User: ${w.username} (GCash: ${w.gcash})</p>
                        <h3 class="text-xl font-black text-white">₱${w.amount.toFixed(2)}</h3>
                        <div class="flex gap-2 mt-3">
                            <button onclick="app.processAdminPayout('${w.key}', 'paid')" class="bg-green-600 text-[10px] px-4 py-2 rounded-lg font-bold text-white">APPROVE</button>
                            <button onclick="app.processAdminPayout('${w.key}', 'rejected')" class="bg-red-600 text-[10px] px-4 py-2 rounded-lg font-bold text-white">REJECT</button>
                        </div>
                    </div>
                `;
            });
        });
    },

    /**
     * Processes an admin action (approve or reject) for a withdrawal.
     */
    processAdminPayout: async (withdrawalKey, status) => {
        try {
            await update(ref(db, `withdrawals/${withdrawalKey}`), { status: status });
            alert(`Withdrawal ${withdrawalKey} marked as ${status}!`);
        } catch (error) {
            console.error("Admin payout processing failed:", error);
            alert("Failed to update withdrawal status. Please try again.");
        }
    },

    // --- Referral Link Handling ---

    /**
     * Copies the user's referral link to the clipboard.
     */
    copyReferralLink: () => {
        const linkInput = document.getElementById('ref-link');
        linkInput.select();
        linkInput.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            alert("Referral link copied!");
        } catch (err) {
            console.error("Failed to copy referral link:", err);
            alert("Failed to copy link. Please manually copy from the input field.");
        }
    },

    // --- Chat Room Functions ---

    /**
     * Sends a message to the chat room (no ads here).
     */
    sendMessage: async () => {
        const chatInput = document.getElementById('chat-input');
        const messageText = chatInput.value.trim();

        if (!messageText) return;

        try {
            await push(ref(db, 'messages'), {
                uid: userId,
                u: currentUser.username,
                t: messageText,
                time: serverTimestamp()
            });
            chatInput.value = "";
            app.trimChatHistory();
        } catch (error) {
            console.error("Failed to send message:", error);
            alert("Failed to send message. Please try again.");
        }
    },

    /**
     * Loads and displays chat messages in real-time.
     */
    loadChatMessages: () => {
        const chatBox = document.getElementById('chat-box');
        const messagesRef = query(ref(db, 'messages'), orderByChild('time'), limitToLast(MAX_CHAT_MESSAGES));

        onValue(messagesRef, (snap) => {
            chatBox.innerHTML = "";
            snap.forEach(child => {
                const msg = child.val();
                const isMyMessage = msg.uid === userId;
                const messageClass = isMyMessage ? 'my-chat-message' : '';
                const usernameClass = isMyMessage ? 'text-blue-200' : 'text-yellow-500';
                const messageTime = msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                chatBox.innerHTML += `
                    <div class="flex ${isMyMessage ? 'justify-end' : 'justify-start'}">
                        <div class="chat-message-bubble ${messageClass}">
                            <button onclick="event.stopPropagation(); app.showUserProfile('${msg.uid}')" class="text-[9px] ${usernameClass} font-black mb-1">${msg.u}</button>
                            <p class="text-sm text-white">${msg.t}</p>
                            <span class="text-[8px] text-slate-500 text-right block mt-1">${messageTime}</span>
                        </div>
                    </div>
                `;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    },

    /**
     * Trims old chat messages from the database.
     */
    trimChatHistory: async () => {
        const messagesRef = ref(db, 'messages');
        const snapshot = await get(query(messagesRef, orderByChild('time'), limitToLast(MAX_CHAT_MESSAGES + 1)));
        if (snapshot.numChildren() > MAX_CHAT_MESSAGES) {
            let i = 0;
            snapshot.forEach(child => {
                if (i < snapshot.numChildren() - MAX_CHAT_MESSAGES) {
                    remove(child.ref);
                }
                i++;
            });
        }
    },

    // --- Leaderboard Functions ---

    /**
     * Loads and displays the top users by balance.
     */
    loadLeaderboard: () => {
        const lbList = document.getElementById('leaderboard-list');
        const leaderboardRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(20)); 

        onValue(leaderboardRef, (snapshot) => {
            lbList.innerHTML = "";
            let users = [];
            snapshot.forEach(child => { users.push(child.val()); });

            users.sort((a, b) => b.balance - a.balance); 

            if (users.length === 0) {
                lbList.innerHTML = `<p class="text-center text-slate-500 py-10">No users found yet. Be the first to earn!</p>`;
                return;
            }

            users.forEach((user, index) => {
                lbList.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center">
                        <span class="flex items-center gap-2">
                            <span class="font-bold text-yellow-500">${index + 1}.</span>
                            <button onclick="event.stopPropagation(); app.showUserProfile('${user.uid}')" class="font-bold text-white hover:text-yellow-500 transition">${user.username}</button>
                        </span>
                        <span class="text-green-400 font-bold">₱${user.balance.toFixed(2)}</span>
                    </div>
                `;
            });
        });
    },

    // --- Online Users Functions ---

    /**
     * Sets up presence tracking and displays online users.
     */
    setupPresenceListeners: () => {
        const userStatusDatabaseRef = ref(db, `presence/${userId}`);
        
        set(userStatusDatabaseRef, {
            username: currentUser.username,
            last_online: serverTimestamp(),
            status: "online"
        });
        onDisconnect(userStatusDatabaseRef).remove(); 

        const onlineUsersList = document.getElementById('online-users-list');
        onValue(ref(db, 'presence'), (snapshot) => {
            let onlineCount = 0;
            onlineUsersList.innerHTML = "";
            const presenceData = [];

            snapshot.forEach(child => {
                const user = child.val();
                if (user && user.status === 'online') {
                    presenceData.push({ uid: child.key, ...user });
                    onlineCount++;
                }
            });

            presenceData.sort((a, b) => a.username.localeCompare(b.username));

            if (presenceData.length === 0) {
                onlineUsersList.innerHTML = '<p class="text-center text-slate-500 py-4">No one online right now.</p>';
            } else {
                presenceData.forEach(user => {
                    onlineUsersList.innerHTML += `
                        <div class="glass p-3 rounded-xl flex items-center justify-between">
                            <button onclick="event.stopPropagation(); app.showUserProfile('${user.uid}')" class="font-bold text-yellow-300 flex items-center gap-2 hover:text-white transition">
                                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                ${user.username}
                            </button>
                        </div>`;
                });
            }
            document.getElementById('online-users-count').innerText = onlineCount;
        });
    },

    // --- Profile & User Modal Functions ---

    /**
     * Displays a modal with detailed statistics for a specific user.
     */
    showUserProfile: async (targetUid) => {
        const userProfileModal = document.getElementById('user-profile-modal');
        const modalUsername = document.getElementById('modal-username');
        const modalTotalAds = document.getElementById('modal-total-ads');
        const modalDailyAds = document.getElementById('modal-daily-ads');
        const modalReferrals = document.getElementById('modal-referrals');

        try {
            const userSnap = await get(ref(db, `users/${targetUid}`));
            if (userSnap.exists()) {
                const userData = userSnap.val();
                modalUsername.innerText = userData.username;
                modalTotalAds.innerText = userData.totalAds || 0;
                modalDailyAds.innerText = userData.dailyAds || 0;
                
                const refCountSnap = await get(query(ref(db, 'users'), orderByChild('referredBy'), targetUid));
                modalReferrals.innerText = refCountSnap.size || 0;

                userProfileModal.style.display = 'flex';
            } else {
                alert("User profile not found.");
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            alert("Could not load user profile at this time.");
        }
    },

    /**
     * Hides a modal.
     */
    hideModal: (modalId) => {
        document.getElementById(modalId).style.display = 'none';
    },

    // --- Topics/Forum Functions ---

    /**
     * Shows the modal for creating a new topic.
     */
    showCreateTopicModal: () => {
        document.getElementById('new-topic-title').value = '';
        document.getElementById('new-topic-content').value = '';
        document.getElementById('create-topic-modal').style.display = 'flex';
    },

    /**
     * Submits a new topic to the forum.
     */
    submitTopic: async () => {
        const titleInput = document.getElementById('new-topic-title');
        const contentInput = document.getElementById('new-topic-content');
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (title.length < 5) return alert("Topic title must be at least 5 characters long.");
        if (content.length < 10) return alert("Topic content must be at least 10 characters long.");

        const newTopic = {
            title: title,
            content: content,
            creatorUid: userId,
            creatorName: currentUser.username,
            timestamp: serverTimestamp()
        };

        try {
            await push(ref(db, 'topics'), newTopic);
            app.hideModal('create-topic-modal');
            alert("Topic created successfully!");
            app.loadTopics();
        } catch (error) {
            console.error("Failed to submit topic:", error);
            alert("Could not create topic. Please try again.");
        }
    },

    /**
     * Loads and displays the list of topics.
     */
    loadTopics: () => {
        const topicsList = document.getElementById('topics-list');
        const topicsRef = query(ref(db, 'topics'), orderByChild('timestamp'), limitToLast(20)); 

        onValue(topicsRef, (snap) => {
            topicsList.innerHTML = "";
            let topics = [];
            snap.forEach(child => topics.push({ key: child.key, ...child.val() }));
            
            topics.reverse();

            if (topics.length === 0) {
                topicsList.innerHTML = `<p class="text-center text-slate-500 py-10">No topics yet. Be the first to create one!</p>`;
                return;
            }

            topics.forEach(topic => {
                const date = topic.timestamp ? new Date(topic.timestamp).toLocaleString() : 'N/A';
                topicsList.innerHTML += `
                    <div onclick="app.viewTopic('${topic.key}')" class="glass p-5 rounded-2xl cursor-pointer hover:bg-slate-800 transition">
                        <h4 class="font-bold text-md text-yellow-500">${topic.title}</h4>
                        <p class="text-xs text-slate-400 mb-2">
                            by 
                            <button onclick="event.stopPropagation(); app.showUserProfile('${topic.creatorUid}')" class="text-white hover:underline">${topic.creatorName}</button> 
                            - ${date}
                        </p>
                        <p class="text-sm text-slate-300 line-clamp-2">${topic.content}</p>
                    </div>
                `;
            });
        });
    },

    /**
     * Displays a single topic along with its comments.
     */
    viewTopic: (topicId) => {
        currentTopicId = topicId;
        app.navTo('sec-topic-view'); // Changed to use actual section ID

        const topicRef = ref(db, `topics/${topicId}`);
        onValue(topicRef, (snap) => {
            if (snap.exists()) {
                const topicData = snap.val();
                const date = topicData.timestamp ? new Date(topicData.timestamp).toLocaleString() : 'N/A';
                
                document.getElementById('topic-view-title').innerText = topicData.title;
                document.getElementById('topic-view-creator').innerHTML = `
                    by <button onclick="event.stopPropagation(); app.showUserProfile('${topicData.creatorUid}')" class="text-white hover:underline">${topicData.creatorName}</button> - ${date}
                `;
                document.getElementById('topic-view-content').innerText = topicData.content;
                
                document.getElementById('add-comment-btn').onclick = () => app.addCommentToTopic(topicId);
                app.loadCommentsForTopic(topicId);
            } else {
                alert("Topic not found or was deleted.");
                app.navTo('topics-list');
            }
        });
    },

    /**
     * Loads and displays comments for a specific topic.
     */
    loadCommentsForTopic: (topicId) => {
        const commentsBox = document.getElementById('topic-comments');
        const commentsRef = query(ref(db, `topics/${topicId}/comments`), orderByChild('timestamp'));

        onValue(commentsRef, (snap) => {
            commentsBox.innerHTML = "";
            let comments = [];
            snap.forEach(child => {
                comments.push({ key: child.key, ...child.val() });
            });

            comments.sort((a, b) => a.timestamp - b.timestamp);

            if (comments.length === 0) {
                commentsBox.innerHTML = `<p class="text-center text-slate-500 py-4">No comments yet. Be the first to reply!</p>`;
                return;
            }

            comments.forEach(comment => {
                const date = comment.timestamp ? new Date(comment.timestamp).toLocaleString() : 'N/A';
                const isMyComment = comment.commenterUid === userId;
                const usernameClass = isMyComment ? 'text-blue-200' : 'text-yellow-500';
                
                commentsBox.innerHTML += `
                    <div class="bg-slate-800 p-3 rounded-xl">
                        <p class="text-xs ${usernameClass} font-bold">
                            <button onclick="event.stopPropagation(); app.showUserProfile('${comment.commenterUid}')" class="text-white hover:underline">${comment.commenterName}</button> 
                            <span class="text-slate-500 font-normal ml-1">${date}</span>
                        </p>
                        <p class="text-sm mt-1 text-white">${comment.text}</p>
                    </div>
                `;
            });
            commentsBox.scrollTop = commentsBox.scrollHeight;
        });
    },

    /**
     * Adds a new comment to the viewed topic.
     */
    addCommentToTopic: async (topicId) => {
        const commentInput = document.getElementById('comment-input');
        const commentText = commentInput.value.trim();

        if (!commentText) return;

        const newComment = {
            commenterUid: userId,
            commenterName: currentUser.username,
            text: commentText,
            timestamp: serverTimestamp()
        };

        try {
            await push(ref(db, `topics/${topicId}/comments`), newComment);
            commentInput.value = "";
        } catch (error) {
            console.error("Failed to add comment:", error);
            alert("Could not add comment. Please try again.");
        }
    }
};

// Expose the 'app' object to the global window scope
window.app = app;

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', app.init);
