
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
const monetagZones = [
    { id: '10276123', sdk_func: show_10276123 }, // Zone 1 (Original)
    { id: '10337795', sdk_func: show_10337795 }, // Zone 2
    { id: '10337853', sdk_func: show_10337853 }  // Zone 3
];

// State Management
let currentUser = null;
let telegramUserId = null; // Stores the Telegram user ID if available
let userId = null;         // The primary UID for the app, will be telegramUserId if from TG
let cooldownTime = 0;
let cooldownInterval = null;
let currentTopicId = null;
const MAX_CHAT_MESSAGES = 5000;
const AD_COOLDOWN_SECONDS = 60; // 1 minute cooldown for homepage ads
const AD_REWARD_PER_CLICK = 0.015; // Reward for watching 3 ads per click on homepage
const CHAT_AD_REWARD_PER_CLICK = 0.012; // Reward for watching 3 inline ads per chat message

const app = {
    init: async () => {
        // Monetag In-App Settings (applied globally for all zones)
        monetagZones.forEach(zone => {
            zone.sdk_func({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
        });

        let referrerId = null;
        let isTelegramContext = false;

        // Check if running within Telegram Web App
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            isTelegramContext = true;
            telegramUserId = window.Telegram.WebApp.initDataUnsafe.user?.id?.toString(); // Get Telegram User ID

            if (!telegramUserId) {
                alert("Error: Telegram User ID not found. Please ensure you are opening this app from a Telegram chat.");
                // Potentially redirect or show an error screen here
                return; 
            }
            
            // For Telegram users, the Telegram ID is the primary application user ID
            userId = telegramUserId;
            localStorage.setItem('ph_uid', userId); // Store Telegram ID locally for persistence
            referrerId = window.Telegram.WebApp.initDataUnsafe.start_param;
        } else {
            // Fallback for non-Telegram context (e.g., local development, direct browser access)
            userId = localStorage.getItem('ph_uid');
            if (!userId) { // If no local storage ID, generate a random one for dev
                userId = 'U' + Math.floor(Math.random() * 899999 + 100000);
                localStorage.setItem('ph_uid', userId);
            }
        }

        if (userId) { // If a userId is determined (either Telegram or fallback)
            const userRef = ref(db, `users/${userId}`);
            const snap = await get(userRef);

            if (snap.exists()) {
                currentUser = snap.val();
                if (isTelegramContext && currentUser.telegramId && currentUser.telegramId !== telegramUserId) {
                    // This scenario should ideally not happen if userId is strictly telegramUserId.
                    // It's a safeguard if a random UID somehow got associated with a different Telegram ID previously.
                    // For now, if UID is Telegram ID, this condition means the UID in Firebase has a conflicting telegramId field.
                    // A stricter approach might involve forcing a logout or showing a conflict message.
                    console.warn("User UID is Telegram ID, but stored telegramId field conflicts. Overriding or logging conflict.");
                }
                app.launch();
            } else {
                // User ID exists (either TG or fallback), but no account in Firebase.
                // Show registration screen.
                document.getElementById('login-screen').classList.remove('hidden');
            }
        } else {
             // No user ID at all (e.g., localStorage cleared, not Telegram, or TG ID failed)
             document.getElementById('login-screen').classList.remove('hidden');
        }

        if (referrerId) {
            sessionStorage.setItem('temp_referrer_id', referrerId);
        }
    },

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

        if (finalReferrer === userId) finalReferrer = null; // Prevent self-referral
        if (finalReferrer) {
            const referrerSnap = await get(ref(db, `users/${finalReferrer}`));
            if (!referrerSnap.exists()) {
                finalReferrer = null; // Referrer doesn't exist
            }
        }

        currentUser = {
            uid: userId, // This is already set by init() (Telegram ID or fallback)
            username: name,
            gcash: gcash,
            balance: 0.0,
            refEarnings: 0.0,
            referredBy: finalReferrer,
            totalAds: 0,
            dailyAds: 0,
            lastAdDate: null,
            createdAt: Date.now()
        };

        if (telegramUserId) {
            currentUser.telegramId = telegramUserId; // Store Telegram ID in user profile for easy lookup/verification
        }

        await set(ref(db, `users/${userId}`), currentUser); // Use the determined userId as the Firebase key
        localStorage.setItem('ph_uid', userId);
        sessionStorage.removeItem('temp_referrer_id');
        app.launch();
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser.username;
        
        const botUsername = "Key_52_bot"; // <-- UPDATE YOUR BOT USERNAME HERE IF IT CHANGES
        document.getElementById('ref-link').value = `https://t.me/${botUsername}/start?start=${userId}`;
        
        app.syncData();
        app.loadHistory();
        app.setupPresence();
        app.loadTopics();
        app.loadChat();
        app.nav('home');
    },

    syncData: () => {
        onValue(ref(db, `users/${userId}`), async (snap) => {
            if (snap.exists()) {
                currentUser = snap.val();
                const bal = currentUser.balance || 0;
                document.getElementById('balance-display').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('big-balance').innerText = `₱${bal.toFixed(2)}`;
                document.getElementById('ref-earnings').innerText = `₱${(currentUser.refEarnings || 0).toFixed(2)}`;
                document.getElementById('profile-total-ads').innerText = (currentUser.totalAds || 0);
                document.getElementById('profile-daily-ads').innerText = (currentUser.dailyAds || 0);
                
                const refCountSnap = await get(query(ref(db, 'users'), orderByChild('referredBy'), currentUser.uid));
                document.getElementById('ref-count').innerText = refCountSnap.size || 0;
            }
        });
    },

    playCombinedAds: async () => {
        if (cooldownTime > 0) {
            alert(`Please wait ${cooldownTime} seconds before earning more.`);
            return;
        }

        const rewardPerClick = AD_REWARD_PER_CLICK; 
        const referralBonusRate = 0.08;
        const referralBonus = rewardPerClick * referralBonusRate;

        let adsPlayedSuccessfully = 0;
        const adPromises = monetagZones.map(zone => zone.sdk_func()); 
        
        try {
            for (const adPromise of adPromises) {
                await adPromise; 
                adsPlayedSuccessfully++;
            }

            if (adsPlayedSuccessfully === monetagZones.length) {
                const today = new Date().toDateString();
                let userDailyAds = currentUser.dailyAds || 0;
                let userLastAdDate = currentUser.lastAdDate;

                if (userLastAdDate !== today) {
                    userDailyAds = 0;
                }
                userDailyAds++;

                const newBalance = parseFloat(((currentUser.balance || 0) + rewardPerClick).toFixed(4));
                await update(ref(db, `users/${userId}`), {
                    balance: newBalance,
                    totalAds: (currentUser.totalAds || 0) + 1, 
                    dailyAds: userDailyAds,
                    lastAdDate: today
                });

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
                alert(`Success! Earned ₱${rewardPerClick.toFixed(2)} for watching 3 ads.`);
                app.startCooldown();
            } else {
                alert("Some ads failed to load. Please try again to get the full reward.");
            }
        } catch (error) {
            console.error("Ad playback error:", error);
            alert("Error playing ads. Please try again.");
        }
    },

    startCooldown: () => {
        cooldownTime = AD_COOLDOWN_SECONDS; 
        document.getElementById('combined-ad-btn').classList.add('cooldown-active');
        document.getElementById('cooldown-box').classList.remove('hidden');
        document.getElementById('ad-timer').innerText = cooldownTime;
        
        clearInterval(cooldownInterval);
        cooldownInterval = setInterval(() => {
            cooldownTime--;
            document.getElementById('ad-timer').innerText = cooldownTime;
            if (cooldownTime <= 0) {
                clearInterval(cooldownInterval);
                document.getElementById('combined-ad-btn').classList.remove('cooldown-active');
                document.getElementById('cooldown-box').classList.add('hidden');
                alert("Cooldown finished! You can earn again.");
            }
        }, 1000);
    },

    requestWithdraw: async () => {
        if (currentUser.balance < 1.00) return alert("Minimum withdrawal is ₱1.00");
        
        const req = {
            uid: userId,
            username: currentUser.username,
            gcash: currentUser.gcash,
            amount: parseFloat(currentUser.balance.toFixed(2)),
            status: 'pending',
            timestamp: Date.now()
        };

        const newKey = push(ref(db, 'withdrawals')).key;
        await set(ref(db, `withdrawals/${newKey}`), req);
        await update(ref(db, `users/${userId}`), { balance: 0 });
        alert("Withdrawal request submitted! Check history for status.");
    },

    loadHistory: () => {
        const historyList = document.getElementById('history-list');
        onValue(query(ref(db, 'withdrawals'), orderByChild('timestamp')), (snap) => {
            historyList.innerHTML = "";
            let hasData = false;
            const withdrawalData = [];
            snap.forEach(child => {
                const w = child.val();
                if (w.uid === userId) {
                    withdrawalData.push({ key: child.key, ...w });
                    hasData = true;
                }
            });
            
            withdrawalData.sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp descending

            withdrawalData.forEach(w => {
                const date = new Date(w.timestamp).toLocaleDateString();
                historyList.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center border-l-4 ${w.status === 'paid' ? 'border-green-500' : w.status === 'rejected' ? 'border-red-500' : 'border-yellow-500'}">
                        <div>
                            <p class="text-sm font-bold">₱${w.amount.toFixed(2)}</p>
                            <p class="text-[10px] text-slate-500">${date}</p>
                        </div>
                        <span class="text-[10px] uppercase font-black ${w.status === 'paid' ? 'text-green-500' : w.status === 'rejected' ? 'text-red-500' : 'text-yellow-500'}">${w.status}</span>
                    </div>
                `;
            });

            if (!hasData) historyList.innerHTML = `<p class="text-center text-slate-500 py-10">No history yet.</p>`;
        });
    },

    nav: (sec) => {
        if (sec === 'admin') {
            const pw = prompt("Admin Password:");
            if (pw !== "Propetas12") {
                alert("Access Denied");
                app.nav('home');
                return;
            }
            app.loadAdmin();
        }
        
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${sec}`).classList.remove('hidden');
        
        const clickedBtn = event.currentTarget;
        if (clickedBtn) clickedBtn.classList.add('nav-active');

        if (sec === 'chat') app.loadChat();
        if (sec === 'leaderboard') app.loadLeaderboard();
        if (sec === 'topics-list') app.loadTopics();
        if (sec === 'profile') app.syncData();
    },

    loadAdmin: () => {
        onValue(ref(db, 'withdrawals'), (snap) => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            let hasPending = false;
            const pendingWithdrawals = [];
            snap.forEach(child => {
                const w = child.val();
                if (w.status === 'pending') {
                    pendingWithdrawals.push({ key: child.key, ...w });
                    hasPending = true;
                }
            });

            pendingWithdrawals.sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp descending

            pendingWithdrawals.forEach(w => {
                list.innerHTML += `
                    <div class="glass p-4 rounded-xl">
                        <p class="text-xs font-bold">${w.username} (${w.gcash})</p>
                        <h3 class="text-xl font-black text-white">₱${w.amount.toFixed(2)}</h3>
                        <div class="flex gap-2 mt-3">
                            <button onclick="app.adminAction('${w.key}', 'paid')" class="bg-green-600 text-[10px] px-4 py-2 rounded-lg font-bold">APPROVE</button>
                            <button onclick="app.adminAction('${w.key}', 'rejected')" class="bg-red-600 text-[10px] px-4 py-2 rounded-lg font-bold">REJECT</button>
                        </div>
                    </div>
                `;
            });

            if (!hasPending) list.innerHTML = `<p class="text-center text-slate-500 py-10">No pending withdrawals.</p>`;
        });
    },

    adminAction: async (key, status) => {
        await update(ref(db, `withdrawals/${key}`), { status: status });
        alert(`Withdrawal ${key} marked as ${status}!`);
    },

    copyRef: () => {
        const link = document.getElementById('ref-link');
        link.select();
        document.execCommand('copy');
        alert("Referral link copied!");
    },

    // Chat Room Functions - RE-INTRODUCED ADS AND REWARD
    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        const messageText = input.value.trim();

        if (!messageText) return;

        const inlineReward = CHAT_AD_REWARD_PER_CLICK; 
        const refBonusRate = 0.08;
        const inlineRefBonus = inlineReward * refBonusRate;

        let adsPlayedSuccessfully = 0;
        // Use 'pop' type for rewarded popups, which can act "inline" or on interaction
        const inlineAdPromises = monetagZones.map(zone => zone.sdk_func('pop')); 

        try {
            // Attempt to play ads sequentially
            for(const adPromise of inlineAdPromises) {
                await adPromise;
                adsPlayedSuccessfully++;
            }

            // Always send the message
            await push(ref(db, 'messages'), {
                uid: userId,
                u: currentUser.username,
                t: messageText,
                time: serverTimestamp()
            });
            input.value = "";

            if (adsPlayedSuccessfully === monetagZones.length) {
                // Reward user for watching inline ads
                const newUserBalance = parseFloat(((currentUser.balance || 0) + inlineReward).toFixed(4));
                await update(ref(db, `users/${userId}`), {
                    balance: newUserBalance
                });

                // Reward referrer
                if (currentUser.referredBy) {
                    const uplinerRef = ref(db, `users/${currentUser.referredBy}`);
                    const uplinerSnap = await get(uplinerRef);
                    if (uplinerSnap.exists()) {
                        const upliner = uplinerSnap.val();
                        await update(uplinerRef, {
                            balance: parseFloat(((upliner.balance || 0) + inlineRefBonus).toFixed(4)),
                            refEarnings: parseFloat(((upliner.refEarnings || 0) + inlineRefBonus).toFixed(4))
                        });
                    }
                }
                alert(`Chat sent! Earned ₱${inlineReward.toFixed(2)} for watching ads.`);
            } else {
                alert("Some inline ads failed to load. Message sent, but no reward earned.");
            }

            // Trim chat history if it exceeds MAX_CHAT_MESSAGES
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

        } catch (error) {
            console.error("Inline ad or message sending error:", error);
            alert("Error processing ads or sending message. Please try again.");
        }
    },

    loadChat: () => {
        const chatBox = document.getElementById('chat-box');
        onValue(query(ref(db, 'messages'), orderByChild('time'), limitToLast(MAX_CHAT_MESSAGES)), (snap) => {
            chatBox.innerHTML = "";
            snap.forEach(c => {
                const m = c.val();
                const isMyMessage = m.uid === userId;
                const messageClass = isMyMessage ? 'my-chat-message' : '';
                const usernameClass = isMyMessage ? 'text-blue-200' : 'text-yellow-500';
                const messageTime = m.time ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                chatBox.innerHTML += `
                    <div class="flex ${isMyMessage ? 'justify-end' : 'justify-start'}">
                        <div class="chat-message-bubble ${messageClass}">
                            <button onclick="event.stopPropagation(); app.showUserProfile('${m.uid}')" class="text-[9px] ${usernameClass} font-black mb-1">${m.u}</button>
                            <p class="text-sm">${m.t}</p>
                            <span class="text-[8px] text-slate-500 text-right block mt-1">${messageTime}</span>
                        </div>
                    </div>
                `;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    },

    loadLeaderboard: () => {
        const lbRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(20)); // Top 20
        onValue(lbRef, (snapshot) => {
            const list = document.getElementById('leaderboard-list');
            list.innerHTML = "";
            let users = [];
            snapshot.forEach(child => { users.push(child.val()); });
            users.sort((a, b) => b.balance - a.balance).forEach((u, i) => {
                list.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center">
                        <span class="flex items-center gap-2">#${i+1} 
                            <button onclick="app.showUserProfile('${u.uid}')" class="font-bold text-white hover:text-yellow-500">${u.username}</button>
                        </span>
                        <span class="text-green-400 font-bold">₱${u.balance.toFixed(2)}</span>
                    </div>
                `;
            });
            if (users.length === 0) list.innerHTML = `<p class="text-center text-slate-500 py-10">No users yet.</p>`;
        });
    },

    setupPresence: () => {
        const userStatusDatabaseRef = ref(db, `presence/${userId}`);
        
        set(userStatusDatabaseRef, {
            username: currentUser.username,
            last_online: Date.now(),
            status: "online"
        });
        onDisconnect(userStatusDatabaseRef).remove(); 

        onValue(ref(db, 'presence'), (snapshot) => {
            let onlineCount = 0;
            const onlineUsersList = document.getElementById('online-users-list');
            onlineUsersList.innerHTML = "";
            const presenceData = [];
            snapshot.forEach(child => {
                const user = child.val();
                if (user.status === 'online') {
                    presenceData.push({ uid: child.key, ...user });
                    onlineCount++;
                }
            });

            presenceData.sort((a, b) => a.username.localeCompare(b.username)); // Sort by username alphabetically

            presenceData.forEach(user => {
                onlineUsersList.innerHTML += `<div class="glass p-3 rounded-xl flex items-center justify-between">
                    <button onclick="app.showUserProfile('${user.uid}')" class="font-bold text-yellow-300 flex items-center gap-2 hover:text-white transition">
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        ${user.username}
                    </button>
                </div>`;
            });
            document.getElementById('online-users-count').innerText = onlineCount; 
            if (onlineCount === 0) onlineUsersList.innerHTML = '<p class="text-center text-slate-500 py-4">No one online yet.</p>';
        });
    },

    showUserProfile: async (targetUid) => {
        const userProfileModal = document.getElementById('user-profile-modal');
        const modalUsername = document.getElementById('modal-username');
        const modalTotalAds = document.getElementById('modal-total-ads');
        const modalDailyAds = document.getElementById('modal-daily-ads');

        const userSnap = await get(ref(db, `users/${targetUid}`));
        if (userSnap.exists()) {
            const userData = userSnap.val();
            modalUsername.innerText = userData.username;
            modalTotalAds.innerText = userData.totalAds || 0;
            modalDailyAds.innerText = userData.dailyAds || 0;
            userProfileModal.style.display = 'flex';
        } else {
            alert("User profile not found.");
        }
    },

    showCreateTopicModal: () => {
        document.getElementById('new-topic-title').value = '';
        document.getElementById('new-topic-content').value = '';
        document.getElementById('create-topic-modal').style.display = 'flex';
    },

    submitTopic: async () => {
        const title = document.getElementById('new-topic-title').value.trim();
        const content = document.getElementById('new-topic-content').value.trim();

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

        await push(ref(db, 'topics'), newTopic);
        document.getElementById('create-topic-modal').style.display = 'none';
        alert("Topic created successfully!");
        app.loadTopics();
    },

    loadTopics: () => {
        const topicsList = document.getElementById('topics-list');
        onValue(query(ref(db, 'topics'), orderByChild('timestamp'), limitToLast(20)), (snap) => {
            topicsList.innerHTML = "";
            let hasTopics = false;
            let topics = [];
            snap.forEach(child => topics.push({ key: child.key, ...child.val() }));
            topics.reverse().forEach(t => { // Display newest first
                hasTopics = true;
                const date = t.timestamp ? new Date(t.timestamp).toLocaleString() : 'N/A';
                topicsList.innerHTML += `
                    <div onclick="app.viewTopic('${t.key}')" class="glass p-5 rounded-2xl cursor-pointer hover:bg-slate-800 transition">
                        <h4 class="font-bold text-md text-yellow-500">${t.title}</h4>
                        <p class="text-xs text-slate-400 mb-2">by <button onclick="event.stopPropagation(); app.showUserProfile('${t.creatorUid}')" class="text-white hover:underline">${t.creatorName}</button> - ${date}</p>
                        <p class="text-sm text-slate-300 line-clamp-2">${t.content}</p>
                    </div>
                `;
            });
            if (!hasTopics) topicsList.innerHTML = `<p class="text-center text-slate-500 py-10">No topics yet. Be the first!</p>`;
        });
    },

    viewTopic: (topicId) => {
        currentTopicId = topicId;
        app.nav('topic-view');

        const topicRef = ref(db, `topics/${topicId}`);
        onValue(topicRef, (snap) => {
            if (snap.exists()) {
                const t = snap.val();
                document.getElementById('topic-view-title').innerText = t.title;
                const date = t.timestamp ? new Date(t.timestamp).toLocaleString() : 'N/A';
                document.getElementById('topic-view-creator').innerHTML = `by <button onclick="event.stopPropagation(); app.showUserProfile('${t.creatorUid}')" class="text-white hover:underline">${t.creatorName}</button> - ${date}`;
                document.getElementById('topic-view-content').innerText = t.content;
                document.getElementById('add-comment-btn').onclick = () => app.addComment(topicId);
                app.loadComments(topicId);
            } else {
                alert("Topic not found.");
                app.nav('topics-list');
            }
        });
    },

    loadComments: (topicId) => {
        const commentsBox = document.getElementById('topic-comments');
        onValue(query(ref(db, `topics/${topicId}/comments`), orderByChild('timestamp')), (snap) => {
            commentsBox.innerHTML = "";
            let hasComments = false;
            const commentData = [];
            snap.forEach(c => {
                commentData.push({ key: c.key, ...c.val() });
                hasComments = true;
            });

            commentData.sort((a, b) => a.timestamp - b.timestamp); // Sort comments by timestamp ascending

            commentData.forEach(comment => {
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
            if (!hasComments) commentsBox.innerHTML = `<p class="text-center text-slate-500 py-4">No comments yet. Be the first!</p>`;
            commentsBox.scrollTop = commentsBox.scrollHeight;
        });
    },

    addComment: async (topicId) => {
        const commentInput = document.getElementById('comment-input');
        if (!commentInput.value.trim()) return;

        const newComment = {
            commenterUid: userId,
            commenterName: currentUser.username,
            text: commentInput.value.trim(),
            timestamp: serverTimestamp()
        };

        await push(ref(db, `topics/${topicId}/comments`), newComment);
        commentInput.value = "";
    }
};

window.app = app;
app.init();
