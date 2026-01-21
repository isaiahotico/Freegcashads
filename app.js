
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
const monetagZones = [
    { id: '10276123', sdk_func_name: 'show_10276123' },
    { id: '10337795', sdk_func_name: 'show_10337795' },
    { id: '10337853', sdk_func_name: 'show_10337853' }
];

// --- Application Constants ---
const MAX_CHAT_MESSAGES = 5000;
const AD_COOLDOWN_SECONDS = 60;                 // 1 minute cooldown for homepage ads
const HOMEPAGE_AD_REWARD_PER_CLICK = 0.015;     // Reward for watching 3 ads per click on homepage
const CHAT_INLINE_AD_REWARD_PER_MESSAGE = 0.012;// Reward for watching 3 inline ads per chat message
const REFERRAL_BONUS_RATE = 0.08;               // 8% referral bonus (e.g., 0.08 for 8%)
const WITHDRAWAL_MINIMUM = 1.00;
const ADMIN_PASSWORD = "Propetas12";             // !!! IMPORTANT: CHANGE THIS TO A SECURE PASSWORD AND DO NOT EXPOSE IN PRODUCTION !!!
const BOT_USERNAME = "Key_52_bot";               // !!! IMPORTANT: UPDATE THIS WITH YOUR ACTUAL TELEGRAM BOT USERNAME !!!

// --- Global Application State Variables ---
let currentUser = null;
let telegramUserId = null; // Stores the Telegram user ID if available
let userId = null;         // The primary UID for the app (Telegram ID or fallback local ID)
let homepageCooldownTime = 0;
let homepageCooldownInterval = null;
let currentTopicId = null; // Stores the ID of the topic currently being viewed in the forum

// --- Main Application Object (Encapsulates all functions) ---
const app = {
    /**
     * Initializes the application.
     * Detects Telegram Web App context, attempts to load existing user data,
     * or prompts for registration if no user is found.
     */
    init: async () => {
        // Configure Monetag SDKs for in-app ad display globally
        monetagZones.forEach(zone => {
            if (window[zone.sdk_func_name]) { // Check if the SDK function is loaded
                window[zone.sdk_func_name]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
            } else {
                console.warn(`Monetag SDK function ${zone.sdk_func_name} not found. Ads may not function correctly.`);
            }
        });

        let referrerId = null;
        let isTelegramContext = false;

        // Step 1: Detect Telegram Web App context and get user ID
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            isTelegramContext = true;
            telegramUserId = window.Telegram.WebApp.initDataUnsafe.user?.id?.toString();

            if (!telegramUserId) {
                console.error("Telegram User ID not found in initDataUnsafe. Cannot proceed.");
                alert("Error: Telegram User ID not found. Please ensure you are opening this app from a Telegram chat.");
                document.getElementById('login-screen').style.display = 'flex'; // Show login screen if TG ID fails
                return;
            }
            userId = telegramUserId; // Telegram ID is the primary user identifier
            localStorage.setItem('ph_uid', userId); // Persist for returning Telegram users
            referrerId = window.Telegram.WebApp.initDataUnsafe.start_param; // Get referrer from start_param
        } else {
            // Step 2: Fallback for non-Telegram context (e.g., local development, direct browser access)
            userId = localStorage.getItem('ph_uid'); // Try to load existing local ID
            if (!userId) { // If no local ID, generate a new temporary one
                userId = 'U' + Math.floor(Math.random() * 899999 + 100000); // Generate a random unique ID
                localStorage.setItem('ph_uid', userId);
                console.warn(`Generated a new local user ID: ${userId}. This should ideally be a Telegram ID in production.`);
            }
            // For direct access, try URL parameter for referrer
            referrerId = new URLSearchParams(window.location.search).get('ref');
        }

        // Step 3: Check if user exists in Firebase or needs to register
        if (userId) {
            const userRef = ref(db, `users/${userId}`);
            const snap = await get(userRef);

            if (snap.exists()) {
                currentUser = snap.val();
                // Critical check: If in Telegram context, ensure stored telegramId matches.
                // This prevents a local ID from being hijacked by a different Telegram user.
                if (isTelegramContext && currentUser.telegramId && currentUser.telegramId !== telegramUserId) {
                    console.error(`User ${userId} has conflicting Telegram IDs. Current: ${telegramUserId}, Stored: ${currentUser.telegramId}`);
                    alert("Account conflict detected. Please contact support or clear local data.");
                    localStorage.removeItem('ph_uid'); // Clear local ID to force re-registration or proper TG login
                    window.location.reload();
                    return;
                }
                app.launch(); // User found, launch the main application
            } else {
                // User ID (Telegram or generated) exists, but no corresponding Firebase account. Show registration.
                document.getElementById('login-screen').style.display = 'flex';
            }
        } else {
            // This case should ideally not be reached if the above logic is sound.
            alert("Could not determine user ID. Please try opening from Telegram or ensure cookies are enabled.");
            document.getElementById('login-screen').style.display = 'flex';
        }

        // Store referrer ID in session storage if found
        if (referrerId) {
            sessionStorage.setItem('temp_referrer_id', referrerId);
        }
    },

    /**
     * Handles user registration and initial account creation in Firebase.
     * Validates input, checks referrer, and creates a new user entry.
     */
    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        
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
        
        // Validate if the referrer actually exists in the database
        if (finalReferrer) {
            const referrerSnap = await get(ref(db, `users/${finalReferrer}`));
            if (!referrerSnap.exists()) {
                console.warn(`Referrer ID ${finalReferrer} does not exist in the database. Ignoring referral.`);
                finalReferrer = null; // Nullify if referrer doesn't exist
            }
        }

        currentUser = {
            uid: userId, // The already determined userId (Telegram ID or generated local ID)
            username: name,
            gcash: gcash,
            balance: 0.0,
            refEarnings: 0.0,
            referredBy: finalReferrer,
            totalAds: 0,
            dailyAds: 0,
            lastAdDate: null, // Format: "Wed Jan 01 2025"
            createdAt: serverTimestamp(), // Use server timestamp for creation
            telegramId: telegramUserId // Store Telegram ID if user is from Telegram
        };

        try {
            await set(ref(db, `users/${userId}`), currentUser); // Create user in Firebase
            localStorage.setItem('ph_uid', userId); // Ensure local ID is saved
            sessionStorage.removeItem('temp_referrer_id'); // Clean up temporary referrer
            app.launch(); // Launch the application
        } catch (error) {
            console.error("Registration failed:", error);
            alert("Registration failed. Please try again.");
        }
    },

    /**
     * Launches the main application interface after successful login/registration.
     * Hides login screen, displays main app, populates user data, and sets up listeners.
     */
    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser.username;
        
        // Set up the referral link using the BOT_USERNAME constant
        document.getElementById('ref-link').value = `https://t.me/${BOT_USERNAME}/start?start=${userId}`;
        
        // Initialize all real-time listeners and load initial data for various sections
        app.syncUserData();
        app.loadWithdrawalHistory();
        app.setupPresenceListeners();
        app.loadTopics();
        
        app.navTo('home'); // Default to home section on launch
    },

    // --- Data Synchronization and UI Updates ---

    /**
     * Listens for real-time updates to the current user's data in Firebase
     * and updates various UI elements across the application.
     */
    syncUserData: () => {
        const userRef = ref(db, `users/${userId}`);
        onValue(userRef, async (snap) => {
            if (snap.exists()) {
                currentUser = snap.val(); // Update the global currentUser object with the latest data
                
                // Update header and home section balance displays
                const bal = currentUser.balance || 0;
                document.getElementById('balance-display').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('big-balance').innerText = `₱${bal.toFixed(2)}`;

                // Update referral earnings and ad statistics in the profile section
                document.getElementById('ref-earnings').innerText = `₱${(currentUser.refEarnings || 0).toFixed(2)}`;
                document.getElementById('profile-total-ads').innerText = (currentUser.totalAds || 0);
                document.getElementById('profile-daily-ads').innerText = (currentUser.dailyAds || 0);
                
                // Fetch and update the referral count for the current user
                const refCountSnap = await get(query(ref(db, 'users'), orderByChild('referredBy'), currentUser.uid));
                document.getElementById('ref-count').innerText = refCountSnap.size || 0;
            } else {
                console.warn(`User data for ${userId} not found during sync. Forcing re-initialization.`);
                alert("Your account data could not be loaded. Please log in again.");
                localStorage.removeItem('ph_uid'); // Clear local user ID
                window.location.reload(); // Reload to force re-initialization
            }
        });
    },

    // --- Ad Earning Functions (Homepage) ---

    /**
     * Handles the logic for playing homepage ads and rewarding the user.
     * This function triggers multiple Monetag ad zones sequentially.
     */
    playHomepageAds: async () => {
        if (homepageCooldownTime > 0) {
            alert(`Please wait ${homepageCooldownTime} seconds before earning more.`);
            return;
        }

        const rewardAmount = HOMEPAGE_AD_REWARD_PER_CLICK;
        const referralBonus = rewardAmount * REFERRAL_BONUS_RATE;

        let adsPlayedSuccessfully = 0;
        const adPromises = [];

        // Dynamically call each Monetag SDK function for the defined zones
        monetagZones.forEach(zone => {
            if (window[zone.sdk_func_name]) {
                adPromises.push(window[zone.sdk_func_name]()); // Assume default type for homepage
            } else {
                console.error(`Monetag SDK function ${zone.sdk_func_name} is not defined for homepage ads.`);
            }
        });

        if (adPromises.length === 0) {
            alert("Ad SDKs not loaded. Please ensure Monetag scripts are correctly placed and try again later.");
            return;
        }
        
        try {
            // Wait for all ad promises to resolve. `Promise.allSettled` is used
            // to ensure that even if one ad fails, others can still be processed.
            const results = await Promise.allSettled(adPromises);
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    adsPlayedSuccessfully++;
                } else {
                    console.warn(`Monetag ad (Zone ID: ${result.reason?.zoneId || 'unknown'}) failed to load or complete:`, result.reason);
                }
            });

            // Grant reward ONLY if ALL configured ads played successfully
            if (adsPlayedSuccessfully === monetagZones.length) {
                const today = new Date().toDateString(); // e.g., "Wed Jan 01 2025"
                let userDailyAds = currentUser.dailyAds || 0;
                const userLastAdDate = currentUser.lastAdDate;

                // Reset daily ad count if it's a new day
                if (userLastAdDate !== today) {
                    userDailyAds = 0;
                }
                userDailyAds++; // Increment count for this ad click

                // Update user's balance and ad statistics in Firebase
                const newBalance = parseFloat(((currentUser.balance || 0) + rewardAmount).toFixed(4));
                await update(ref(db, `users/${userId}`), {
                    balance: newBalance,
                    totalAds: (currentUser.totalAds || 0) + 1, // Count as 1 ad "click" event
                    dailyAds: userDailyAds,
                    lastAdDate: today
                });

                // Reward upliner (referrer) if applicable
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
                alert(`Only ${adsPlayedSuccessfully} out of ${monetagZones.length} ads loaded successfully. Please try again to get the full reward.`);
            }
        } catch (error) {
            console.error("General homepage ad playback error:", error);
            alert("An unexpected error occurred while playing ads. Please try again.");
        }
    },

    /**
     * Starts the cooldown timer for the homepage ad button.
     * Disables the button and displays a countdown.
     */
    startHomepageAdCooldown: () => {
        homepageCooldownTime = AD_COOLDOWN_SECONDS;
        document.getElementById('combined-ad-btn').classList.add('cooldown-active');
        document.getElementById('cooldown-box').classList.remove('hidden');
        document.getElementById('ad-timer').innerText = homepageCooldownTime;
        
        clearInterval(homepageCooldownInterval); // Clear any existing interval
        homepageCooldownInterval = setInterval(() => {
            homepageCooldownTime--;
            document.getElementById('ad-timer').innerText = homepageCooldownTime;
            if (homepageCooldownTime <= 0) {
                clearInterval(homepageCooldownInterval);
                document.getElementById('combined-ad-btn').classList.remove('cooldown-active');
                document.getElementById('cooldown-box').classList.add('hidden');
                alert("Cooldown finished! You can earn again.");
            }
        }, 1000); // Update every second
    },

    // --- Withdrawal Logic ---

    /**
     * Submits a withdrawal request for the current user's available balance.
     * Ensures balance meets the minimum withdrawal amount.
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
            amount: parseFloat(currentUser.balance.toFixed(2)), // Ensure amount is rounded to 2 decimal places
            status: 'pending', // Initial status
            timestamp: serverTimestamp() // Use server timestamp for consistency
        };

        try {
            const newKey = push(ref(db, 'withdrawals')).key; // Generate a unique key for the withdrawal
            await set(ref(db, `withdrawals/${newKey}`), withdrawalRequest);
            await update(ref(db, `users/${userId}`), { balance: 0 }); // Zero out user's balance after request
            alert("Withdrawal request submitted! Check history for status.");
        } catch (error) {
            console.error("Withdrawal request failed:", error);
            alert("Failed to submit withdrawal request. Please try again later.");
        }
    },

    /**
     * Loads and displays the current user's withdrawal history in real-time.
     * Shows status (pending, paid, rejected) and details.
     */
    loadWithdrawalHistory: () => {
        const historyList = document.getElementById('history-list');
        const historyRef = query(ref(db, 'withdrawals'), orderByChild('timestamp')); // Order by timestamp

        onValue(historyRef, (snap) => {
            historyList.innerHTML = ""; // Clear existing list items
            const withdrawalData = [];

            snap.forEach(child => {
                const withdrawal = child.val();
                if (withdrawal.uid === userId) { // Filter for the current user's withdrawals
                    withdrawalData.push({ key: child.key, ...withdrawal });
                }
            });
            
            withdrawalData.sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp, newest first

            if (withdrawalData.length === 0) {
                historyList.innerHTML = `<p class="text-center text-slate-500 py-10">No withdrawal history yet.</p>`;
                return;
            }

            // Render each withdrawal item
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

    // --- Navigation Logic ---

    /**
     * Handles navigation between different sections of the application.
     * Hides all sections and shows the target section, updating the navigation bar.
     * Includes an admin password check for the admin section.
     * @param {string} sectionId - The ID of the section to navigate to (e.g., 'home', 'chat', 'admin').
     */
    navTo: (sectionId) => {
        // Admin password check
        if (sectionId === 'admin') {
            const pw = prompt("Enter Admin Password:");
            if (pw !== ADMIN_PASSWORD) {
                alert("Access Denied");
                sectionId = 'home'; // Redirect to home if password is wrong
            } else {
                app.loadAdminPayouts(); // Load admin data if password is correct
            }
        }
        
        // Hide all main sections
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        // Remove active styling from all navigation buttons
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        
        // Show the target section
        const targetSection = document.getElementById(`sec-${sectionId}`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        } else {
            console.error(`Section with ID 'sec-${sectionId}' not found. Defaulting to home.`);
            document.getElementById('sec-home').classList.remove('hidden');
            sectionId = 'home'; // Fallback to home
        }

        // Add active styling to the corresponding navigation button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            // Check if the button's onclick attribute targets the current section
            if (btn.onclick?.toString().includes(`app.navTo('${sectionId}')`)) {
                btn.classList.add('nav-active');
            }
        });

        // Trigger specific data loads or updates for sections upon navigation
        switch (sectionId) {
            case 'chat': app.loadChatMessages(); break; // Load chat messages when navigating to chat
            case 'leaderboard': app.loadLeaderboard(); break; // Load leaderboard data
            case 'topics-list': app.loadTopics(); break; // Load forum topics
            case 'profile': app.syncUserData(); break; // Ensure profile data is fresh when viewed
            // Admin payouts are loaded only after password check in the 'admin' block above
        }
    },

    // --- Admin Functions ---

    /**
     * Loads and displays all pending withdrawal requests for admin to process.
     * This function is called only after successful admin password verification.
     */
    loadAdminPayouts: () => {
        const adminList = document.getElementById('admin-list');
        const withdrawalsRef = query(ref(db, 'withdrawals'), orderByChild('timestamp'));

        onValue(withdrawalsRef, (snap) => {
            adminList.innerHTML = ""; // Clear current list
            const pendingWithdrawals = [];

            snap.forEach(child => {
                const withdrawal = child.val();
                if (withdrawal.status === 'pending') { // Only show pending withdrawals
                    pendingWithdrawals.push({ key: child.key, ...withdrawal });
                }
            });

            pendingWithdrawals.sort((a, b) => b.timestamp - a.timestamp); // Newest first

            if (pendingWithdrawals.length === 0) {
                adminList.innerHTML = `<p class="text-center text-slate-500 py-10">No pending withdrawals.</p>`;
                return;
            }

            // Render each pending withdrawal with approve/reject buttons
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

    /**
     * Processes an admin action (approve or reject) for a specific withdrawal request.
     * Updates the status of the withdrawal in the database.
     * @param {string} withdrawalKey - The Firebase key of the withdrawal request.
     * @param {string} status - The new status to set ('paid' or 'rejected').
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
     * The link includes the Telegram bot username and the user's UID as a start parameter.
     */
    copyReferralLink: () => {
        const linkInput = document.getElementById('ref-link');
        linkInput.select(); // Select the text in the input field
        linkInput.setSelectionRange(0, 99999); // For mobile devices
        try {
            document.execCommand('copy'); // Copy the selected text
            alert("Referral link copied!");
        } catch (err) {
            console.error("Failed to copy referral link:", err);
            alert("Failed to copy link. Please manually copy from the input field.");
        }
    },

    // --- Chat Room Functions ---

    /**
     * Sends a message to the chat room. It also triggers inline ads and rewards the user
     * if all ads play successfully. Handles chat history trimming.
     */
    sendMessage: async () => {
        const chatInput = document.getElementById('chat-input');
        const messageText = chatInput.value.trim();

        if (!messageText) return; // Do nothing if message is empty

        const inlineRewardAmount = CHAT_INLINE_AD_REWARD_PER_MESSAGE;
        const inlineReferralBonus = inlineRewardAmount * REFERRAL_BONUS_RATE;

        let adsPlayedSuccessfully = 0;
        const inlineAdPromises = [];

        // Dynamically call each Monetag SDK function for 'pop' type (inline/rewarded popup)
        monetagZones.forEach(zone => {
            if (window[zone.sdk_func_name]) {
                inlineAdPromises.push(window[zone.sdk_func_name]('pop')); // 'pop' for inline popup ads
            } else {
                console.error(`Monetag SDK function ${zone.sdk_func_name} is not defined for chat ads.`);
            }
        });

        // If no ad SDKs are loaded, send message without ads/rewards
        if (inlineAdPromises.length === 0) {
            alert("Ad SDKs not loaded for chat. Message sent, but no reward earned this time.");
            try {
                await push(ref(db, 'messages'), {
                    uid: userId,
                    u: currentUser.username,
                    t: messageText,
                    time: serverTimestamp()
                });
                chatInput.value = ""; // Clear input field
                app.trimChatHistory();
            } catch (error) {
                console.error("Failed to send message without ads:", error);
                alert("Failed to send message. Please try again.");
            }
            return;
        }

        try {
            // Attempt to play ads using Promise.allSettled to handle individual ad failures gracefully
            const results = await Promise.allSettled(inlineAdPromises);
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    adsPlayedSuccessfully++;
                } else {
                    console.warn(`Monetag inline ad (Zone ID: ${result.reason?.zoneId || 'unknown'}) failed:`, result.reason);
                }
            });

            // Always send the message to Firebase, regardless of ad success
            await push(ref(db, 'messages'), {
                uid: userId,
                u: currentUser.username,
                t: messageText,
                time: serverTimestamp()
            });
            chatInput.value = ""; // Clear input field immediately after sending

            // Reward user and referrer ONLY if ALL configured ads played successfully
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
                alert(`Only ${adsPlayedSuccessfully} out of ${monetagZones.length} inline ads loaded successfully. Message sent, but no reward earned this time.`);
            }

            app.trimChatHistory(); // Trim chat history after sending a message

        } catch (error) {
            console.error("Chat message/ad error:", error);
            alert("An error occurred while sending your message or playing ads. Please try again.");
            // If message was not sent, restore input value
            if (chatInput.value === "") chatInput.value = messageText;
        }
    },

    /**
     * Loads and displays chat messages in real-time.
     * Limits the number of displayed messages to prevent excessive memory usage.
     */
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
            chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the bottom of the chat
        });
    },

    /**
     * Trims old chat messages from the database if the total number exceeds `MAX_CHAT_MESSAGES`.
     * This prevents the database from growing indefinitely.
     */
    trimChatHistory: async () => {
        const messagesRef = ref(db, 'messages');
        const snapshot = await get(query(messagesRef, orderByChild('time'), limitToLast(MAX_CHAT_MESSAGES + 1)));
        if (snapshot.numChildren() > MAX_CHAT_MESSAGES) {
            let i = 0;
            snapshot.forEach(child => {
                if (i < snapshot.numChildren() - MAX_CHAT_MESSAGES) {
                    remove(child.ref); // Delete older messages one by one
                }
                i++;
            });
        }
    },

    // --- Leaderboard Functions ---

    /**
     * Loads and displays the top users by balance for the leaderboard section.
     */
    loadLeaderboard: () => {
        const lbList = document.getElementById('leaderboard-list');
        // Query for the top 20 users ordered by balance in descending order
        const leaderboardRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(20)); 

        onValue(leaderboardRef, (snapshot) => {
            lbList.innerHTML = ""; // Clear existing leaderboard items
            let users = [];
            snapshot.forEach(child => { users.push(child.val()); });

            // Sort users by balance in descending order (Firebase orderByChild fetches in ascending, so reverse)
            users.sort((a, b) => b.balance - a.balance); 

            if (users.length === 0) {
                lbList.innerHTML = `<p class="text-center text-slate-500 py-10">No users found yet. Be the first to earn!</p>`;
                return;
            }

            // Render each user in the leaderboard
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
     * Sets up presence tracking for the current user and displays a real-time list of online users.
     * When the user connects, their presence is recorded; when they disconnect, it's removed.
     */
    setupPresenceListeners: () => {
        const userStatusDatabaseRef = ref(db, `presence/${userId}`);
        
        // Set user's initial status to 'online' and update last_online timestamp
        set(userStatusDatabaseRef, {
            username: currentUser.username,
            last_online: serverTimestamp(),
            status: "online"
        });
        // Remove user's presence data when they disconnect (e.g., close browser tab)
        onDisconnect(userStatusDatabaseRef).remove(); 

        // Listen for changes in the 'presence' node to update the online users list
        onValue(ref(db, 'presence'), (snapshot) => {
            let onlineCount = 0;
            const onlineUsersList = document.getElementById('online-users-list');
            onlineUsersList.innerHTML = ""; // Clear previous list
            const presenceData = [];

            snapshot.forEach(child => {
                const user = child.val();
                if (user && user.status === 'online') { // Check for 'online' status
                    presenceData.push({ uid: child.key, ...user });
                    onlineCount++;
                }
            });

            presenceData.sort((a, b) => a.username.localeCompare(b.username)); // Sort alphabetically by username

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
            document.getElementById('online-users-count').innerText = onlineCount; // Update online user count
        });
    },

    // --- Profile & User Modal Functions ---

    /**
     * Displays a modal with detailed statistics for a specific user.
     * This function can be called from various places (leaderboard, chat, online users).
     * @param {string} targetUid - The UID of the user whose profile to display.
     */
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
                userProfileModal.style.display = 'flex'; // Show the modal
            } else {
                alert("User profile not found.");
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            alert("Could not load user profile at this time.");
        }
    },

    // --- Topics/Forum Functions ---

    /**
     * Shows the modal for creating a new topic in the forum.
     * Clears previous input fields.
     */
    showCreateTopicModal: () => {
        document.getElementById('new-topic-title').value = '';
        document.getElementById('new-topic-content').value = '';
        document.getElementById('create-topic-modal').style.display = 'flex'; // Show the create topic modal
    },

    /**
     * Submits a new topic to the forum.
     * Validates input fields before pushing to Firebase.
     */
    submitTopic: async () => {
        const titleInput = document.getElementById('new-topic-title');
        const contentInput = document.getElementById('new-topic-content');
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (title.length < 5) {
            return alert("Topic title must be at least 5 characters long.");
        }
        if (content.length < 10) {
            return alert("Topic content must be at least 10 characters long.");
        }

        const newTopic = {
            title: title,
            content: content,
            creatorUid: userId,
            creatorName: currentUser.username,
            timestamp: serverTimestamp() // Use server timestamp for creation time
        };

        try {
            await push(ref(db, 'topics'), newTopic); // Add new topic to 'topics' node
            document.getElementById('create-topic-modal').style.display = 'none'; // Hide modal
            alert("Topic created successfully!");
            app.loadTopics(); // Reload the topics list to display the new topic
        } catch (error) {
            console.error("Failed to submit topic:", error);
            alert("Could not create topic. Please try again.");
        }
    },

    /**
     * Loads and displays the list of topics in the forum section.
     * Displays the latest 20 topics.
     */
    loadTopics: () => {
        const topicsList = document.getElementById('topics-list');
        // Query for the latest 20 topics, ordered by timestamp
        const topicsRef = query(ref(db, 'topics'), orderByChild('timestamp'), limitToLast(20)); 

        onValue(topicsRef, (snap) => {
            topicsList.innerHTML = ""; // Clear existing list items
            let topics = [];
            snap.forEach(child => topics.push({ key: child.key, ...child.val() }));
            
            topics.reverse(); // Display newest topics first

            if (topics.length === 0) {
                topicsList.innerHTML = `<p class="text-center text-slate-500 py-10">No topics yet. Be the first to create one!</p>`;
                return;
            }

            // Render each topic as a clickable card
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
     * Sets up listeners for real-time comment updates.
     * @param {string} topicId - The ID of the topic to view.
     */
    viewTopic: (topicId) => {
        currentTopicId = topicId; // Store the ID of the currently viewed topic
        app.navTo('topic-view'); // Navigate to the single topic view section

        const topicRef = ref(db, `topics/${topicId}`);
        // Use onValue to get real-time updates for topic details (in case it's edited)
        onValue(topicRef, (snap) => {
            if (snap.exists()) {
                const topicData = snap.val();
                const date = topicData.timestamp ? new Date(topicData.timestamp).toLocaleString() : 'N/A';
                
                document.getElementById('topic-view-title').innerText = topicData.title;
                document.getElementById('topic-view-creator').innerHTML = `
                    by <button onclick="event.stopPropagation(); app.showUserProfile('${topicData.creatorUid}')" class="text-white hover:underline">${topicData.creatorName}</button> - ${date}
                `;
                document.getElementById('topic-view-content').innerText = topicData.content;
                
                // Set the onclick handler for the comment submission button to this specific topic
                document.getElementById('add-comment-btn').onclick = () => app.addCommentToTopic(topicId);
                app.loadCommentsForTopic(topicId); // Load comments for this topic
            } else {
                alert("Topic not found or was deleted.");
                app.navTo('topics-list'); // Go back to topics list if the topic doesn't exist
            }
        });
    },

    /**
     * Loads and displays comments for a specific topic in real-time.
     * @param {string} topicId - The ID of the topic to load comments for.
     */
    loadCommentsForTopic: (topicId) => {
        const commentsBox = document.getElementById('topic-comments');
        // Query for comments under the specific topic, ordered by timestamp
        const commentsRef = query(ref(db, `topics/${topicId}/comments`), orderByChild('timestamp'));

        onValue(commentsRef, (snap) => {
            commentsBox.innerHTML = ""; // Clear existing comments
            let comments = [];
            snap.forEach(child => {
                comments.push({ key: child.key, ...child.val() });
            });

            comments.sort((a, b) => a.timestamp - b.timestamp); // Display comments in chronological order

            if (comments.length === 0) {
                commentsBox.innerHTML = `<p class="text-center text-slate-500 py-4">No comments yet. Be the first to reply!</p>`;
                return;
            }

            // Render each comment
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
            commentsBox.scrollTop = commentsBox.scrollHeight; // Scroll to the bottom to show latest comments
        });
    },

    /**
     * Adds a new comment to the currently viewed topic.
     * @param {string} topicId - The ID of the topic to add the comment to.
     */
    addCommentToTopic: async (topicId) => {
        const commentInput = document.getElementById('comment-input');
        const commentText = commentInput.value.trim();

        if (!commentText) return; // Do nothing if comment is empty

        const newComment = {
            commenterUid: userId,
            commenterName: currentUser.username,
            text: commentText,
            timestamp: serverTimestamp()
        };

        try {
            await push(ref(db, `topics/${topicId}/comments`), newComment); // Push new comment
            commentInput.value = ""; // Clear the input field
        } catch (error) {
            console.error("Failed to add comment:", error);
            alert("Could not add comment. Please try again.");
        }
    }
};

// Expose the 'app' object to the global window scope
// This allows HTML elements to call functions like onclick="app.navTo('home')"
window.app = app;

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', app.init);
