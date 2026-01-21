
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, remove, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Monetag Zone Configurations
// These will be used for both homepage ads and chat inline ads.
const monetagZones = [
    { id: '10276123', sdk_func: show_10276123 }, // Zone 1
    { id: '10337795', sdk_func: show_10337795 }, // Zone 2
    { id: '10337853', sdk_func: show_10337853 }  // Zone 3
];

// --- Constants ---
const MAX_CHAT_MESSAGES = 5000;
const AD_COOLDOWN_SECONDS = 60;                 // 1 minute cooldown for homepage ads
const HOMEPAGE_AD_REWARD_PER_CLICK = 0.015;     // Reward for watching 3 ads per click on homepage
const CHAT_INLINE_AD_REWARD_PER_MESSAGE = 0.012;// Reward for watching 3 inline ads per chat message
const REFERRAL_BONUS_RATE = 0.08;               // 8% referral bonus
const WITHDRAWAL_MINIMUM = 1.00;
const ADMIN_PASSWORD = "Propetas12"; // Keep this secure and consider environment variables for production
const BOT_USERNAME = "Key_52_bot";   // Update this with your actual bot username

// --- Global State ---
let currentUser = null;
let telegramUserId = null; // Stores the Telegram user ID if available
let userId = null;         // The primary UID for the app (Telegram ID or fallback)
let homepageCooldownTime = 0;
let homepageCooldownInterval = null;
let currentTopicId = null;
let activeNavButton = null;

// --- App Object ---
const app = {
    init: async () => {
        // Configure Monetag SDKs for in-app ad display
        monetagZones.forEach(zone => {
            zone.sdk_func({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        });

        let referrerId = null;
        let isTelegramContext = false;

        // Detect Telegram Web App context
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            isTelegramContext = true;
            telegramUserId = window.Telegram.WebApp.initDataUnsafe.user?.id?.toString();

            if (!telegramUserId) {
                alert("Error: Telegram User ID not found. Please ensure you are opening this app from a Telegram chat.");
                document.getElementById('login-screen').style.display = 'flex'; // Ensure login screen is visible if TG ID fails
                return;
            }
            userId = telegramUserId; // Telegram User ID is the primary user identifier
            localStorage.setItem('ph_uid', userId); // Persist Telegram ID locally
            referrerId = window.Telegram.WebApp.initDataUnsafe.start_param;
        } else {
            // Fallback for non-Telegram context (e.g., local dev, direct browser)
            userId = localStorage.getItem('ph_uid');
            if (!userId) { // Generate a temporary ID if none exists (for dev/testing)
                userId = 'U' + Math.floor(Math.random() * 899999 + 100000);
                localStorage.setItem('ph_uid', userId);
            }
        }

        // Load user data or show registration
        if (userId) {
            const userRef = ref(db, `users/${userId}`);
            const snap = await get(userRef);

            if (snap.exists()) {
                currentUser = snap.val();
                // Data integrity check: If user is from Telegram, ensure their telegramId field matches
                if (isTelegramContext && currentUser.telegramId && currentUser.telegramId !== telegramUserId) {
                    console.error(`User ${userId} has conflicting Telegram IDs. Current: ${telegramUserId}, Stored: ${currentUser.telegramId}`);
                    alert("Account conflict detected. Please contact support.");
                    // Optionally force logout or prevent access
                    return; 
                }
                app.launch();
            } else {
                // User ID exists (or was just generated), but no Firebase account. Show registration.
                document.getElementById('login-screen').style.display = 'flex';
            }
        } else {
            // No user ID determined at all.
            alert("Could not determine user ID. Please try opening from Telegram.");
            document.getElementById('login-screen').style.display = 'flex';
        }

        // Store temporary referrer ID from start_param or URL
        if (referrerId) {
            sessionStorage.setItem('temp_referrer_id', referrerId);
        }
    },

    register: async () => {
        const nameInput = document.getElementById('reg-name');
        const gcashInput = document.getElementById('reg-gcash');
        const name = nameInput.value.trim();
        const gcash = gcashInput.value.trim();
        
        if (name.length < 3) return alert("Username must be at least 3 characters long.");
        if (gcash.length < 10 || !/^\d+$/.test(gcash)) return alert("GCash Number must be 10 digits and contain only numbers.");

        let finalReferrer = null;
        // Prioritize Telegram start_param, then session storage, then URL param
        if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
            finalReferrer = window.Telegram.WebApp.initDataUnsafe.start_param;
        } else {
            finalReferrer = sessionStorage.getItem('temp_referrer_id') || new URLSearchParams(window.location.search).get('ref');
        }

        if (finalReferrer === userId) finalReferrer = null; // Prevent self-referral
        if (finalReferrer) {
            const referrerSnap = await get(ref(db, `users/${finalReferrer}`));
            if (!referrerSnap.exists()) {
                finalReferrer = null; // Referrer doesn't exist, nullify
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
            lastAdDate: null, // Stores date string like "Wed Jan 01 2025"
            createdAt: serverTimestamp(), // Use server timestamp for creation
            telegramId: telegramUserId // Store Telegram ID if available
        };

        await set(ref(db, `users/${userId}`), currentUser);
        localStorage.setItem('ph_uid', userId);
        sessionStorage.removeItem('temp_referrer_id'); // Clean up session
        app.launch();
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser.username;
        
        document.getElementById('ref-link').value = `https://t.me/${BOT_USERNAME}/start?start=${userId}`;
        
        app.syncUserData();
        app.loadWithdrawalHistory();
        app.setupPresenceListeners();
        app.loadTopics();
        app.loadChatMessages();
        app.navTo('home'); // Set initial navigation to Home
    },

    // --- Data Syncing ---
    syncUserData: () => {
        const userRef = ref(db, `users/${userId}`);
        onValue(userRef, async (snap) => {
            if (snap.exists()) {
                currentUser = snap.val(); // Update currentUser with latest data

                // Update UI elements that depend on user data
                const bal = currentUser.balance || 0;
                document.getElementById('balance-display').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('big-balance').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('ref-earnings').innerText = `₱${(currentUser.refEarnings || 0).toFixed(2)}`;
                document.getElementById('profile-total-ads').innerText = (currentUser.totalAds || 0);
                document.getElementById('profile-daily-ads').innerText = (currentUser.dailyAds || 0);
                
                // Update referral count (can be optimized if needed)
                const refCountSnap = await get(query(ref(db, 'users'), orderByChild('referredBy'), currentUser.uid));
                document.getElementById('ref-count').innerText = refCountSnap.size || 0;
            } else {
                // User data somehow deleted, force re-registration or error
                alert("Your user data is missing. Please log in again.");
                localStorage.removeItem('ph_uid');
                window.location.reload();
            }
        });
    },

    // --- Earning Functions ---
    playHomepageAds: async () => {
        if (homepageCooldownTime > 0) {
            alert(`Please wait ${homepageCooldownTime} seconds before earning more.`);
            return;
        }

        const rewardAmount = HOMEPAGE_AD_REWARD_PER_CLICK;
        const referralBonus = rewardAmount * REFERRAL_BONUS_RATE;

        let adsPlayedSuccessfully = 0;
        // Show the three Monetag ads (assuming 'show_ZONEID()' plays an interstitial or rewarded video)
        const adPromises = monetagZones.map(zone => zone.sdk_func()); 
        
        try {
            for (const adPromise of adPromises) {
                await adPromise; // Wait for each ad to complete
                adsPlayedSuccessfully++;
            }

            if (adsPlayedSuccessfully === monetagZones.length) {
                const today = new Date().toDateString();
                let userDailyAds = currentUser.dailyAds || 0;
                const userLastAdDate = currentUser.lastAdDate;

                // Reset daily ads if it's a new day
                if (userLastAdDate !== today) {
                    userDailyAds = 0;
                }
                userDailyAds++; // Increment count for this ad click

                // Update user's balance and ad stats
                const newBalance = parseFloat(((currentUser.balance || 0) + rewardAmount).toFixed(4));
                await update(ref(db, `users/${userId}`), {
                    balance: newBalance,
                    totalAds: (currentUser.totalAds || 0) + 1, // Count as 1 ad "click" event
                    dailyAds: userDailyAds,
                    lastAdDate: today
                });

                // Reward upliner if applicable
                if (currentUser.referredBy) {
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
                alert(`Success! Earned ₱${rewardAmount.toFixed(2)} for watching 3 ads.`);
                app.startHomepageAdCooldown(); // Start cooldown after successful ad sequence
            } else {
                alert("Some ads failed to load. Please try again to get the full reward.");
            }
        } catch (error) {
            console.error("Homepage ad playback error:", error);
            alert("Error playing ads. Please try again.");
        }
    },

    startHomepageAdCooldown: () => {
        homepageCooldownTime = AD_COOLDOWN_SECONDS;
        document.getElementById('combined-ad-btn').classList.add('cooldown-active');
        document.getElementById('cooldown-box').classList.remove('hidden');
        document.getElementById('ad-timer').innerText = homepageCooldownTime;
        
        clearInterval(homepageCooldownInterval);
        homepageCooldownInterval = setInterval(() => {
            homepageCooldownTime--;
            document.getElementById('ad-timer').innerText = homepageCooldownTime;
            if (homepageCooldownTime <= 0) {
                clearInterval(homepageCooldownInterval);
                document.getElementById('combined-ad-btn').classList.remove('cooldown-active');
                document.getElementById('cooldown-box').classList.add('hidden');
                alert("Cooldown finished! You can earn again.");
            }
        }, 1000);
    },

    // --- Withdrawal ---
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
            timestamp: serverTimestamp() // Use server timestamp for consistency
        };

        try {
            const newKey = push(ref(db, 'withdrawals')).key;
            await set(ref(db, `withdrawals/${newKey}`), withdrawalRequest);
            // Zero out balance only after successful database write
            await update(ref(db, `users/${userId}`), { balance: 0 }); 
            alert("Withdrawal request submitted! Check history for status.");
        } catch (error) {
            console.error("Withdrawal request failed:", error);
            alert("Failed to submit withdrawal request. Please try again later.");
        }
    },

    loadWithdrawalHistory: () => {
        const historyList = document.getElementById('history-list');
        const historyRef = query(ref(db, 'withdrawals'), orderByChild('timestamp'));

        onValue(historyRef, (snap) => {
            historyList.innerHTML = ""; // Clear current list
            let hasData = false;
            const withdrawalData = [];

            snap.forEach(child => {
                const withdrawal = child.val();
                if (withdrawal.uid === userId) {
                    withdrawalData.push({ key: child.key, ...withdrawal });
                    hasData = true;
                }
            });
            
            // Sort by timestamp, newest first
            withdrawalData.sort((a, b) => b.timestamp - a.timestamp); 

            if (withdrawalData.length === 0) {
                historyList.innerHTML = `<p class="text-center text-slate-500 py-10">No withdrawal history yet.</p>`;
                return;
            }

            withdrawalData.forEach(w => {
                const date = w.timestamp ? new Date(w.timestamp).toLocaleDateString() : 'N/A';
                let statusColor = 'border-yellow-500'; // Default for pending
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

    // --- Navigation ---
    navTo: (sectionId) => {
        // Remove 'hidden' class from the target section and add 'hidden' to all others
        document.querySelectorAll('main section').forEach(s => {
            if (s.id === `sec-${sectionId}`) {
                s.classList.remove('hidden');
            } else {
                s.classList.add('hidden');
            }
        });

        // Update active state for navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('nav-active');
            if (btn.onclick?.toString().includes(`app.navTo('${sectionId}')`)) {
                btn.classList.add('nav-active');
            }
        });

        // Special actions for specific sections on navigation
        switch (sectionId) {
            case 'chat': app.loadChatMessages(); break;
            case 'leaderboard': app.loadLeaderboard(); break;
            case 'topics-list': app.loadTopics(); break;
            case 'profile': app.syncUserData(); break; // Refresh profile data
            case 'admin': app.loadAdminPayouts(); break; // Load admin view if navigated
        }
    },

    // --- Admin Functions ---
    loadAdminPayouts: () => {
        const adminList = document.getElementById('admin-list');
        const withdrawalsRef = query(ref(db, 'withdrawals'), orderByChild('timestamp'));

        onValue(withdrawalsRef, (snap) => {
            adminList.innerHTML = ""; // Clear current list
            let hasPending = false;
            const pendingWithdrawals = [];

            snap.forEach(child => {
                const withdrawal = child.val();
                if (withdrawal.status === 'pending') {
                    pendingWithdrawals.push({ key: child.key, ...withdrawal });
                    hasPending = true;
                }
            });

            pendingWithdrawals.sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp descending

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
                            <button onclick="app.processAdminPayout('${w.key}', 'paid')" class="bg-green-600 text-[10px] px-4 py-2 rounded-lg font-bold">APPROVE</button>
                            <button onclick="app.processAdminPayout('${w.key}', 'rejected')" class="bg-red-600 text-[10px] px-4 py-2 rounded-lg font-bold">REJECT</button>
                        </div>
                    </div>
                `;
            });
        });
    },

    processAdminPayout: async (withdrawalKey, status) => {
        try {
            await update(ref(db, `withdrawals/${withdrawalKey}`), { status: status });
            alert(`Withdrawal ${withdrawalKey} marked as ${status}!`);
        } catch (error) {
            console.error("Admin payout processing failed:", error);
            alert("Failed to update withdrawal status. Please try again.");
        }
    },

    // --- Referral ---
    copyReferralLink: () => {
        const linkInput = document.getElementById('ref-link');
        linkInput.select();
        try {
            document.execCommand('copy');
            alert("Referral link copied!");
        } catch (err) {
            alert("Failed to copy link. Please copy manually.");
        }
    },

    // --- Chat Functions ---
    sendMessage: async () => {
        const chatInput = document.getElementById('chat-input');
        const messageText = chatInput.value.trim();

        if (!messageText) return;

        const inlineRewardAmount = CHAT_INLINE_AD_REWARD_PER_MESSAGE;
        const inlineReferralBonus = inlineRewardAmount * REFERRAL_BONUS_RATE;

        let adsPlayedSuccessfully = 0;
        const inlineAdPromises = monetagZones.map(zone => zone.sdk_func('pop')); // 'pop' might trigger rewarded popup

        try {
            // Attempt to play ads
            for(const adPromise of inlineAdPromises) {
                await adPromise;
                adsPlayedSuccessfully++;
            }

            // Send the message regardless of ad success (as per requirement)
            await push(ref(db, 'messages'), {
                uid: userId,
                u: currentUser.username,
                t: messageText,
                time: serverTimestamp()
            });
            chatInput.value = ""; // Clear input field

            // Reward user and referrer if ads were successful
            if (adsPlayedSuccessfully === monetagZones.length) {
                const newUserBalance = parseFloat(((currentUser.balance || 0) + inlineRewardAmount).toFixed(4));
                await update(ref(db, `users/${userId}`), { balance: newUserBalance });

                if (currentUser.referredBy) {
                    const uplinerRef = ref(db, `users/${currentUser.referredBy}`);
                    const uplinerSnap = await get(uplinerRef);
                    if (uplinerSnap.exists()) {
                        const upliner = uplinerSnap.val();
                        await update(uplinerRef, {
                            balance: parseFloat(((upliner.balance || 0) + inlineReferralBonus).toFixed(4)),
                            refEarnings: parseFloat(((upliner.refEarnings || 0) + inlineReferralBonus).toFixed(4))
                        });
                    }
                }
                alert(`Message sent! Earned ₱${inlineRewardAmount.toFixed(2)} for watching ads.`);
            } else {
                alert("Some ads failed to load. Message sent, but no reward earned this time.");
            }

            // Trim chat history to prevent excessive database growth
            const messagesRef = ref(db, 'messages');
            const snapshot = await get(query(messagesRef, orderByChild('time'), limitToLast(MAX_CHAT_MESSAGES + 1)));
            if (snapshot.numChildren() > MAX_CHAT_MESSAGES) {
                let i = 0;
                snapshot.forEach(child => {
                    // Delete older messages beyond the limit
                    if (i < snapshot.numChildren() - MAX_CHAT_MESSAGES) {
                        remove(child.ref);
                    }
                    i++;
                });
            }

        } catch (error) {
            console.error("Chat message/ad error:", error);
            alert("An error occurred while sending your message or playing ads. Please try again.");
            // Ensure message is still sent if possible, or handle error appropriately
            if (!messageText) chatInput.value = messageText; // Restore input if it was cleared
        }
    },

    loadChatMessages: () => {
        const chatBox = document.getElementById('chat-box');
        const messagesRef = query(ref(db, 'messages'), orderByChild('time'), limitToLast(MAX_CHAT_MESSAGES));

        onValue(messagesRef, (snap) => {
            chatBox.innerHTML = ""; // Clear existing messages
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
                            <p class="text-sm">${msg.t}</p>
                            <span class="text-[8px] text-slate-500 text-right block mt-1">${messageTime}</span>
                        </div>
                    </div>
                `;
            });
            chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
        });
    },

    // --- Leaderboard ---
    loadLeaderboard: () => {
        const lbList = document.getElementById('leaderboard-list');
        // Query for top 20 users by balance
        const leaderboardRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(20)); 

        onValue(leaderboardRef, (snapshot) => {
            lbList.innerHTML = ""; // Clear existing
            let users = [];
            snapshot.forEach(child => { users.push(child.val()); });

            // Sort users by balance in descending order
            users.sort((a, b) => b.balance - a.balance); 

            if (users.length === 0) {
                lbList.innerHTML = `<p class="text-center text-slate-500 py-10">No users found yet.</p>`;
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

    // --- Online Users ---
    setupPresenceListeners: () => {
        const userStatusDatabaseRef = ref(db, `presence/${userId}`);
        
        // Set initial status and onDisconnect handler
        set(userStatusDatabaseRef, {
            username: currentUser.username,
            last_online: serverTimestamp(), // Use server timestamp
            status: "online"
        });
        onDisconnect(userStatusDatabaseRef).remove(); // Remove from presence when disconnected

        // Listen for changes in the presence node
        onValue(ref(db, 'presence'), (snapshot) => {
            let onlineCount = 0;
            const onlineUsersList = document.getElementById('online-users-list');
            onlineUsersList.innerHTML = ""; // Clear previous list
            const presenceData = [];

            snapshot.forEach(child => {
                const user = child.val();
                // Check if user is currently marked as 'online'
                if (user && user.status === 'online') { 
                    presenceData.push({ uid: child.key, ...user });
                    onlineCount++;
                }
            });

            // Sort online users alphabetically by username
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

    // --- Profile ---
    // Data is synced via syncUserData() when profile section is navigated to.
    // This function is mainly for showing user profiles from other sections.
    showUserProfile: async (targetUid) => {
        const userProfileModal = document.getElementById('user-profile-modal');
        const modalUsername = document.getElementById('modal-username');
        const modalTotalAds = document.getElementById('modal-total-ads');
        const modalDailyAds = document.getElementById('modal-daily-ads');

        try {
            const userSnap = await get(ref(db, `users/${targetUid}`));
            if (userSnap.exists()) {
                const userData = userSnap.val();
                modalUsername.innerText = userData.username;
                modalTotalAds.innerText = userData.totalAds || 0;
                modalDailyAds.innerText = userData.dailyAds || 0;
                userProfileModal.style.display = 'flex'; // Show modal
            } else {
                alert("User profile not found.");
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            alert("Could not load user profile at this time.");
        }
    },

    // --- Topics/Forum ---
    showCreateTopicModal: () => {
        document.getElementById('new-topic-title').value = '';
        document.getElementById('new-topic-content').value = '';
        document.getElementById('create-topic-modal').style.display = 'flex';
    },

    submitTopic: async () => {
        const titleInput = document.getElementById('new-topic-title');
        const contentInput = document.getElementById('new-topic-content');
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (title.length < 5 || content.length < 10) {
            return alert("Topic title must be at least 5 characters and content at least 10 characters.");
        }

        const newTopic = {
            title: title,
            content: content,
            creatorUid: userId,
            creatorName: currentUser.username,
            timestamp: serverTimestamp()
        };

        try {
            await push(ref(db, 'topics'), newTopic);
            document.getElementById('create-topic-modal').style.display = 'none'; // Hide modal
            alert("Topic created successfully!");
            app.loadTopics(); // Reload topics list
        } catch (error) {
            console.error("Failed to submit topic:", error);
            alert("Could not create topic. Please try again.");
        }
    },

    loadTopics: () => {
        const topicsList = document.getElementById('topics-list');
        const topicsRef = query(ref(db, 'topics'), orderByChild('timestamp'), limitToLast(20)); // Load latest 20

        onValue(topicsRef, (snap) => {
            topicsList.innerHTML = ""; // Clear list
            let topics = [];
            snap.forEach(child => topics.push({ key: child.key, ...child.val() }));
            
            topics.reverse(); // Display newest first

            if (topics.length === 0) {
                topicsList.innerHTML = `<p class="text-center text-slate-500 py-10">No topics yet. Be the first!</p>`;
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

    viewTopic: (topicId) => {
        currentTopicId = topicId; // Store the currently viewed topic ID
        app.navTo('topic-view');

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
                
                // Setup comment submission for this topic
                document.getElementById('add-comment-btn').onclick = () => app.addCommentToTopic(topicId);
                app.loadCommentsForTopic(topicId); // Load comments for this topic
            } else {
                alert("Topic not found.");
                app.navTo('topics-list'); // Go back if topic doesn't exist
            }
        }, { onlyOnce: true }); // Use onlyOnce to avoid duplicate listeners if data structure changes
    },

    loadCommentsForTopic: (topicId) => {
        const commentsBox = document.getElementById('topic-comments');
        const commentsRef = query(ref(db, `topics/${topicId}/comments`), orderByChild('timestamp'));

        onValue(commentsRef, (snap) => {
            commentsBox.innerHTML = ""; // Clear existing
            let comments = [];
            snap.forEach(child => {
                comments.push({ key: child.key, ...child.val() });
            });

            // Sort comments by timestamp ascending
            comments.sort((a, b) => a.timestamp - b.timestamp); 

            if (comments.length === 0) {
                commentsBox.innerHTML = `<p class="text-center text-slate-500 py-4">No comments yet. Be the first!</p>`;
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
                        <p class="text-sm mt-1">${comment.text}</p>
                    </div>
                `;
            });
            commentsBox.scrollTop = commentsBox.scrollHeight; // Scroll to bottom
        });
    },

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
            commentInput.value = ""; // Clear input field
        } catch (error) {
            console.error("Failed to add comment:", error);
            alert("Could not add comment. Please try again.");
        }
    },

    // --- Utility Functions ---
    copyReferralLink: () => { // Renamed to avoid conflict with general copyRef
        const linkInput = document.getElementById('ref-link');
        linkInput.select();
        try {
            document.execCommand('copy');
            alert("Referral link copied!");
        } catch (err) {
            alert("Failed to copy link. Please copy manually.");
        }
    },

    // Navigation handler function
    nav: (sec) => {
        // Prevent duplicate calls if button is pressed rapidly
        if (activeNavButton && activeNavButton.onclick.toString().includes(`app.nav('${sec}')`)) {
            return;
        }
        app.navTo(sec);
    },
};

// Assign app object to window for global access
window.app = app;

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', app.init);
