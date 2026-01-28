
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

// State Management
let currentUser = null;
let userId = localStorage.getItem('ph_uid') || 'U' + Math.floor(Math.random() * 899999 + 100000);
let cooldownTime = 0;
let cooldownInterval = null;
let currentTopicId = null; // To track which topic is being viewed

const app = {
    init: async () => {
        // Monetag In-App
        show_10276123({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });

        // Check if Telegram WebApp is available for referrer data
        let referrerId = null;
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            referrerId = window.Telegram.WebApp.initDataUnsafe.start_param;
        }

        if (localStorage.getItem('ph_uid')) {
            userId = localStorage.getItem('ph_uid');
            const snap = await get(ref(db, `users/${userId}`));
            if (snap.exists()) {
                currentUser = snap.val();
                app.launch();
            } else {
                // UID exists in local storage but not in DB, force re-register
                localStorage.removeItem('ph_uid');
                alert("Your account data was not found. Please register again.");
            }
        }
        // If not logged in, but came with a referrer link, store it temporarily
        if (referrerId) {
            sessionStorage.setItem('temp_referrer_id', referrerId);
        }
    },

    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        
        if (name.length < 3 || gcash.length < 10) return alert("Please fill details correctly");

        // Prioritize Telegram start_param, then session storage, then URL param
        let finalReferrer = null;
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            finalReferrer = window.Telegram.WebApp.initDataUnsafe.start_param;
        }
        if (!finalReferrer) {
            finalReferrer = sessionStorage.getItem('temp_referrer_id');
        }
        if (!finalReferrer) {
            const urlParams = new URLSearchParams(window.location.search);
            finalReferrer = urlParams.get('ref');
        }

        // Ensure referrerId is not self-referral and actually exists
        if (finalReferrer === userId) finalReferrer = null;
        if (finalReferrer) {
            const referrerSnap = await get(ref(db, `users/${finalReferrer}`));
            if (!referrerSnap.exists()) {
                finalReferrer = null; // Referrer doesn't exist, ignore
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
            createdAt: Date.now()
        };

        await set(ref(db, `users/${userId}`), currentUser);
        localStorage.setItem('ph_uid', userId);
        sessionStorage.removeItem('temp_referrer_id'); // Clear temp referrer
        app.launch();
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser.username;
        
        // Referral link generation for Telegram bot
        const botUsername = "Key_52_bot"; // Replace with your bot's actual username
        document.getElementById('ref-link').value = `https://t.me/${botUsername}/start?start=${userId}`;
        
        app.syncData();
        app.loadHistory();
        app.setupPresence(); // Set up online/offline status
        app.loadTopics(); // Load topics for the forum
        app.loadChat(); // Load chat messages
        app.nav('home'); // Default to home
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
                
                // Fetch referral count
                const refCountSnap = await get(query(ref(db, 'users'), orderByChild('referredBy'), currentUser.uid));
                document.getElementById('ref-count').innerText = refCountSnap.size || 0;
            }
        });
    },

    playAd: (type) => {
        if (cooldownTime > 0) {
            alert(`Please wait ${cooldownTime} seconds before watching another ad.`);
            return;
        }

        const adPromise = (type === 'inter') ? show_10276123() : show_10276123('pop');
        
        adPromise.then(() => {
            app.rewardLogic();
            app.startCooldown();
            alert("Reward Added: ₱0.0075");
        }).catch((e) => {
            console.error("Ad failed:", e);
            alert("Ad failed to load or was interrupted. Please try again.");
        });
    },

    rewardLogic: async () => {
        const reward = 0.0075;
        const refBonusRate = 0.08; // 8% Referral Commission
        const refBonus = reward * refBonusRate; 

        // 1. Update Current User's Ad Counts
        const today = new Date().toDateString();
        let userDailyAds = currentUser.dailyAds || 0;
        let userLastAdDate = currentUser.lastAdDate;

        if (userLastAdDate !== today) {
            userDailyAds = 0; // Reset for a new day
        }
        userDailyAds++;

        const newBalance = parseFloat(((currentUser.balance || 0) + reward).toFixed(4));
        await update(ref(db, `users/${userId}`), {
            balance: newBalance,
            totalAds: (currentUser.totalAds || 0) + 1,
            dailyAds: userDailyAds,
            lastAdDate: today
        });

        // 2. Reward Upliner (Referral System)
        if (currentUser.referredBy) {
            const uplinerRef = ref(db, `users/${currentUser.referredBy}`);
            const uplinerSnap = await get(uplinerRef);
            if (uplinerSnap.exists()) {
                const upliner = uplinerSnap.val();
                await update(uplinerRef, {
                    balance: parseFloat(((upliner.balance || 0) + refBonus).toFixed(4)),
                    refEarnings: parseFloat(((upliner.refEarnings || 0) + refBonus).toFixed(4))
                });
            }
        }
    },

    startCooldown: () => {
        cooldownTime = 30;
        document.getElementById('ad-container').classList.add('cooldown-active');
        document.getElementById('cooldown-box').classList.remove('hidden');
        document.getElementById('ad-timer').innerText = cooldownTime;
        
        clearInterval(cooldownInterval); // Clear any existing interval
        cooldownInterval = setInterval(() => {
            cooldownTime--;
            document.getElementById('ad-timer').innerText = cooldownTime;
            if (cooldownTime <= 0) {
                clearInterval(cooldownInterval);
                document.getElementById('ad-container').classList.remove('cooldown-active');
                document.getElementById('cooldown-box').classList.add('hidden');
                alert("Ad cooldown finished! You can watch another ad.");
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
        await update(ref(db, `users/${userId}`), { balance: 0 }); // Reset balance to 0
        alert("Withdrawal request submitted! Check history for status.");
    },

    loadHistory: () => {
        const historyList = document.getElementById('history-list');
        onValue(query(ref(db, 'withdrawals'), orderByChild('timestamp')), (snap) => {
            historyList.innerHTML = "";
            let hasData = false;
            snap.forEach(child => {
                const w = child.val();
                if (w.uid === userId) {
                    hasData = true;
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
                }
            });
            if (!hasData) historyList.innerHTML = `<p class="text-center text-slate-500 py-10">No history yet.</p>`;
        });
    },

    // Navigation handler
    nav: (sec) => {
        if (sec === 'admin') {
            const pw = prompt("Admin Password:");
            if (pw !== "Propetas12") {
                alert("Access Denied");
                app.nav('home'); // Redirect to home if wrong password
                return;
            }
            app.loadAdmin();
        }
        
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${sec}`).classList.remove('hidden');
        
        // Add nav-active to the clicked button
        const clickedBtn = event.currentTarget;
        if (clickedBtn) clickedBtn.classList.add('nav-active');

        // Specific loads for sections
        if (sec === 'chat') app.loadChat();
        if (sec === 'leaderboard') app.loadLeaderboard();
        if (sec === 'topics-list') app.loadTopics();
        if (sec === 'profile') app.syncData(); // Re-sync to ensure latest profile data
    },

    loadAdmin: () => {
        onValue(ref(db, 'withdrawals'), (snap) => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            let hasPending = false;
            snap.forEach(child => {
                const w = child.val();
                if (w.status === 'pending') {
                    hasPending = true;
                    list.innerHTML += `
                        <div class="glass p-4 rounded-xl">
                            <p class="text-xs font-bold">${w.username} (${w.gcash})</p>
                            <h3 class="text-xl font-black text-white">₱${w.amount.toFixed(2)}</h3>
                            <div class="flex gap-2 mt-3">
                                <button onclick="app.adminAction('${child.key}', 'paid')" class="bg-green-600 text-[10px] px-4 py-2 rounded-lg font-bold">APPROVE</button>
                                <button onclick="app.adminAction('${child.key}', 'rejected')" class="bg-red-600 text-[10px] px-4 py-2 rounded-lg font-bold">REJECT</button>
                            </div>
                        </div>
                    `;
                }
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

    // Chat Room Functions
    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        if (!input.value.trim()) return;
        await push(ref(db, 'messages'), {
            uid: userId,
            u: currentUser.username,
            t: input.value,
            time: serverTimestamp()
        });
        input.value = "";
    },

    loadChat: () => {
        const chatBox = document.getElementById('chat-box');
        onValue(query(ref(db, 'messages'), orderByChild('time'), limitToLast(200)), (snap) => {
            chatBox.innerHTML = "";
            snap.forEach(c => {
                const m = c.val();
                const isMyMessage = m.uid === userId;
                const messageClass = isMyMessage ? 'my-chat-message' : '';
                chatBox.innerHTML += `
                    <div class="flex ${isMyMessage ? 'justify-end' : 'justify-start'}">
                        <div class="chat-message-bubble ${messageClass}">
                            <button onclick="app.showUserProfile('${m.uid}')" class="text-[9px] ${isMyMessage ? 'text-blue-200' : 'text-yellow-500'} font-black mb-1">${m.u}</button>
                            <p class="text-sm">${m.t}</p>
                        </div>
                    </div>
                `;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    },

    // Leaderboard
    if (section === 'leaderboard') app.loadLeaderboard();
    },

    loadLeaderboard: () => {
        const lbRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
        onValue(lbRef, (snapshot) => {
            const list = document.getElementById('leaderboard-list');
            list.innerHTML = "";
            let users = [];
            snapshot.forEach(child => { users.push(child.val()); });
            users.reverse().forEach((u, i) => {
                list.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center">
                        <span>#${i+1} ${u.username}</span>
                        <span class="text-green-400 font-bold">₱${u.balance.toFixed(2)}</span>
                    </div>
                `;
            });
        });
    },

    // Online Users
    setupPresence: () => {
        const userStatusDatabaseRef = ref(db, `presence/${userId}`);
        
        // Set user's online status when they connect
        set(userStatusDatabaseRef, {
            username: currentUser.username,
            last_online: Date.now(),
            status: "online"
        });

        // Remove user's online status when they disconnect
        onDisconnect(userStatusDatabaseRef).remove(); 

        // Listener for all online users
        onValue(ref(db, 'presence'), (snapshot) => {
            let onlineCount = 0;
            const onlineUsersList = document.getElementById('online-users-list');
            onlineUsersList.innerHTML = "";
            snapshot.forEach(child => {
                const user = child.val();
                if (user.status === 'online') {
                    onlineCount++;
                    onlineUsersList.innerHTML += `<div class="glass p-3 rounded-xl flex items-center justify-between">
                        <button onclick="app.showUserProfile('${child.key}')" class="font-bold text-yellow-300 flex items-center gap-2 hover:text-white transition">
                            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            ${user.username}
                        </button>
                    </div>`;
                }
            });
            document.getElementById('online-users-count').innerText = onlineCount; 
            if (onlineCount === 0) onlineUsersList.innerHTML = '<p class="text-center text-slate-500 py-4">No one online yet.</p>';
        });
    },

    // User Profile Modal
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

    // Topic/Forum Features
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
        app.loadTopics(); // Refresh topic list
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
        app.nav('topic-view'); // Switch to topic view section

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
            snap.forEach(c => {
                hasComments = true;
                const comment = c.val();
                const date = comment.timestamp ? new Date(comment.timestamp).toLocaleString() : 'N/A';
                commentsBox.innerHTML += `
                    <div class="bg-slate-800 p-3 rounded-xl">
                        <p class="text-xs text-yellow-400 font-bold">
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

window.app = app; // Expose app to global scope for onclick functions
app.init();
