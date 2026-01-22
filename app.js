
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, push, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand(); // Expand app to full screen

// Get User Data from Telegram WebApp
const user = tg.initDataUnsafe?.user || { id: "12345", first_name: "Guest", username: "GuestUser" };
const userId = user.id;
const username = user.username || user.first_name;

// Firebase References
const userRef = ref(db, 'users/' + userId);
const withdrawalsRef = ref(db, 'withdrawals');

// --- INITIALIZATION & REAL-TIME DATA ---
document.getElementById('display-username').innerText = "@" + username;
document.getElementById('ref-link').value = `https://t.me/paperhouseinc_bot/start?startapp=${userId}`;

// Listen for current user's data (balance, referrals, last ad times)
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        document.getElementById('balance').innerText = (data.balance || 0).toFixed(4);
        document.getElementById('ref-count').innerText = data.referrals || 0;
        document.getElementById('total-ref-earnings').innerText = (data.totalReferralEarnings || 0).toFixed(4);
        checkCooldowns(data.lastAdTime, data.lastPopTime);
    } else {
        // New User Registration
        const referrerId = tg.initDataUnsafe?.start_param || null;
        set(userRef, {
            username: username,
            balance: 0.0000, // Initial balance
            referrals: 0,
            totalReferralEarnings: 0.0000,
            referredBy: referrerId,
            lastAdTime: 0,
            lastPopTime: 0,
            joined: Date.now()
        });
        if (referrerId && referrerId !== userId.toString()) { // Ensure a user can't refer themselves
            handleReferral(referrerId);
            tg.showAlert(`Welcome! You were referred by ${referrerId}.`);
        } else if (referrerId === userId.toString()) {
            // Self-referral attempt, maybe log or ignore silently
            console.warn("Self-referral attempt detected and ignored.");
        }
    }
});

// --- REFERRAL LOGIC ---
async function handleReferral(referrerId) {
    const rRef = ref(db, 'users/' + referrerId);
    const snap = await get(rRef);
    if (snap.exists()) {
        const referrerData = snap.val();
        update(rRef, { referrals: (referrerData.referrals || 0) + 1 });
    }
}

// --- AD LOGIC (3 COMBINED) ---
// Helper function to safely call Monetag ads and wait for their completion
function showMonetagAd(type) {
    return new Promise((resolve, reject) => {
        if (typeof show_10276123 === 'function') {
            const adCall = type === 'reward' ? show_10276123 : () => show_10276123('pop');
            
            adCall()
                .then(() => {
                    tg.HapticFeedback.notificationOccurred('success');
                    resolve(); // Ad completed successfully
                })
                .catch(e => {
                    tg.HapticFeedback.notificationOccurred('error');
                    console.error("Monetag Ad Error:", e);
                    reject(e); // Ad failed or user closed prematurely
                });
        } else {
            reject("Monetag SDK not loaded."); // Fallback if SDK isn't available
        }
    });
}

window.startAdSequence = async function(type) {
    const btn = type === 'reward' ? document.getElementById('btn-ads') : document.getElementById('btn-pop');
    btn.disabled = true;
    
    // Simulate short delay for UI feedback
    tg.HapticFeedback.impactOccurred('light');

    try {
        const confirmed = await new Promise(resolve => {
            tg.showConfirm(`You need to view 3 ads to get the ₱0.015 reward. Start?`, (ok) => resolve(ok));
        });

        if (!confirmed) {
            btn.disabled = false;
            return;
        }
        
        for (let i = 1; i <= 3; i++) {
            tg.showScanQrPopup({ text: `Watching Ad ${i} of 3. Please complete to earn...` });
            try {
                await showMonetagAd(type); // Await actual ad completion
                tg.closeScanQrPopup(); // Close after each successful ad
                await new Promise(r => setTimeout(r, 1000)); // Small delay between ads
            } catch (adError) {
                tg.closeScanQrPopup();
                tg.showAlert(`Ad ${i} failed or was skipped. Please try again. No reward credited.`);
                btn.disabled = false;
                return; // Stop sequence on first failure
            }
        }
        
        completeSequence(type); // Only reward if all 3 ads are seen
        tg.HapticFeedback.notificationOccurred('success');
    } catch (e) {
        console.error("Ad sequence error:", e);
        tg.closeScanQrPopup(); // Ensure popup is closed
        tg.showAlert("An error occurred during ad loading. Please try again later.");
        btn.disabled = false;
    }
};

async function completeSequence(type) {
    const snap = await get(userRef);
    const data = snap.val();
    const reward = 0.015;
    const now = Date.now();

    let updates = { balance: (data.balance || 0) + reward };
    if (type === 'reward') updates.lastAdTime = now;
    else updates.lastPopTime = now;

    await update(userRef, updates);
    
    // Referral Commission (10%)
    if (data.referredBy) {
        const refUserRef = ref(db, 'users/' + data.referredBy);
        const rSnap = await get(refUserRef);
        if (rSnap.exists()) {
            const referrerData = rSnap.val();
            const referralCommission = reward * 0.1;
            update(refUserRef, {
                balance: (referrerData.balance || 0) + referralCommission,
                totalReferralEarnings: (referrerData.totalReferralEarnings || 0) + referralCommission
            });
        }
    }
    
    tg.showAlert(`Success! You earned ₱${reward.toFixed(4)}.`);
}

function checkCooldowns(lastAd, lastPop) {
    const now = Date.now();
    const wait = 3 * 60 * 1000; // 3 minutes in milliseconds

    const adDiff = now - (lastAd || 0);
    const btnAds = document.getElementById('btn-ads');
    const cooldownAds = document.getElementById('cooldown-ads');

    if (adDiff < wait) {
        btnAds.disabled = true;
        cooldownAds.innerText = `Next ads in ${Math.ceil((wait - adDiff) / 1000)}s`;
    } else {
        btnAds.disabled = false;
        cooldownAds.innerText = "";
    }

    const popDiff = now - (lastPop || 0);
    const btnPop = document.getElementById('btn-pop');
    const cooldownPop = document.getElementById('cooldown-pop');

    if (popDiff < wait) {
        btnPop.disabled = true;
        cooldownPop.innerText = `Next popups in ${Math.ceil((wait - popDiff) / 1000)}s`;
    } else {
        btnPop.disabled = false;
        cooldownPop.innerText = "";
    }
}

// Auto-Refresh Cooldowns every second
setInterval(() => {
    get(userRef).then(snap => {
        if (snap.exists()) checkCooldowns(snap.val().lastAdTime, snap.val().lastPopTime);
    }).catch(e => console.error("Error checking cooldowns:", e));
}, 1000);


// --- WITHDRAWAL ---
window.requestWithdrawal = async function() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const gcash = document.getElementById('gcash-num').value.trim();
    const snap = await get(userRef);
    const balance = snap.val().balance || 0;

    const minWithdrawal = 0.02; // Minimum withdrawal amount updated
    if (amount < minWithdrawal) return tg.showAlert(`Minimum withdrawal is ₱${minWithdrawal.toFixed(2)}.`);
    if (amount > balance) return tg.showAlert("Insufficient balance.");
    if (!gcash || !/^(09|\+639)\d{9}$/.test(gcash)) return tg.showAlert("Invalid GCash number. Must be 11 digits starting with 09.");

    tg.showConfirm(`Request withdrawal of ₱${amount.toFixed(2)} to GCash ${gcash}?`, async (ok) => {
        if (ok) {
            await update(userRef, { balance: balance - amount }); // Deduct balance immediately
            await push(withdrawalsRef, {
                uid: userId,
                username: username,
                amount: amount,
                method: 'GCash',
                number: gcash,
                status: 'pending',
                time: Date.now()
            });
            tg.showAlert("Withdrawal requested! Please wait for admin approval.");
            document.getElementById('withdraw-amount').value = '';
            document.getElementById('gcash-num').value = '';
            tg.HapticFeedback.notificationOccurred('success');
        }
    });
};

// --- WITHDRAWAL HISTORY (USER) ---
onValue(query(withdrawalsRef, orderByChild('uid')), (snapshot) => {
    let html = "";
    const userWithdrawals = [];
    snapshot.forEach(child => {
        const withdrawal = child.val();
        if (withdrawal.uid === userId) {
            userWithdrawals.push({ ...withdrawal, key: child.key });
        }
    });
    userWithdrawals.reverse().forEach(w => { // Show most recent first
        const statusColor = w.status === 'completed' ? 'color:#2ecc71;' : (w.status === 'pending' ? 'color:#f39c12;' : 'color:#e74c3c;');
        const date = new Date(w.time).toLocaleString();
        html += `<div class="list-item">
                    <span>₱${w.amount.toFixed(2)} to ${w.number}</span>
                    <span style="${statusColor}">${w.status.toUpperCase()}</span>
                    <small style="width:100%; text-align:right;">${date}</small>
                 </div>`;
    });
    document.getElementById('withdraw-history').innerHTML = html || "<p style='text-align:center;'>No withdrawal history.</p>";
});


// --- LEADERBOARD ---
function loadLeaderboard() {
    // Query for top 10 users ordered by balance in descending order
    const topQuery = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    
    // Live listener for leaderboard
    onValue(topQuery, (snap) => {
        let html = "";
        const items = [];
        snap.forEach(child => { items.push(child.val()); });
        items.sort((a, b) => b.balance - a.balance).forEach((u, i) => { // Ensure sorting descending
            html += `<div class="list-item"><span>${i+1}. ${u.username}</span> <b>₱${u.balance.toFixed(4)}</b></div>`;
        });
        document.getElementById('leaderboard-list').innerHTML = html || "<p style='text-align:center;'>No data yet.</p>";
    });
}

// --- ADMIN DASHBOARD ---
window.checkAdmin = function() {
    const pass = document.getElementById('admin-pass').value;
    if(pass === "Propetas12") { // Admin Password
        document.getElementById('admin-login').style.display = "none";
        document.getElementById('admin-content').style.display = "block";
        loadAdminData();
        tg.showAlert("Admin Login Successful!");
        tg.HapticFeedback.notificationOccurred('success');
    } else {
        tg.showAlert("Incorrect Admin Password.");
        tg.HapticFeedback.notificationOccurred('error');
    }
};

function loadAdminData() {
    // Live listener for all withdrawals
    onValue(withdrawalsRef, (snap) => {
        let html = "";
        snap.forEach(child => {
            const w = child.val();
            if(w.status === 'pending') {
                const date = new Date(w.time).toLocaleString();
                html += `<div class="list-item">
                    <span><strong>User:</strong> ${w.username} (ID: ${w.uid})</span>
                    <span><strong>Amount:</strong> ₱${w.amount.toFixed(2)}</span>
                    <span><strong>GCash:</strong> ${w.number}</span>
                    <span><strong>Requested:</strong> ${date}</span>
                    <button onclick="approveWithdrawal('${child.key}')">Approve</button>
                </div>`;
            }
        });
        document.getElementById('admin-withdrawals').innerHTML = html || "<p style='text-align:center;'>No pending withdrawals.</p>";
    });
}

window.approveWithdrawal = async function(key) {
    tg.showConfirm(`Approve withdrawal ${key}?`, async (ok) => {
        if(ok) {
            await update(ref(db, `withdrawals/${key}`), { status: 'completed', approvedBy: username, approvalTime: Date.now() });
            tg.showAlert("Withdrawal approved!");
            tg.HapticFeedback.notificationOccurred('success');
        }
    });
};

// --- TAB SYSTEM ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        const tabId = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(tabId).classList.add('active-tab');
        this.classList.add('active');

        // Load specific data when a tab is opened
        if (tabId === 'leaderboard') loadLeaderboard();
        if (tabId === 'admin' && document.getElementById('admin-content').style.display === 'block') loadAdminData();
        if (tabId === 'withdraw') {
            // Withdrawal history is already live updated via onValue
        }
        tg.HapticFeedback.impactOccurred('light');
    });
});

// Initialize In-App Interstitials (Auto)
if (typeof show_10276123 === 'function') {
    show_10276123({
        type: 'inApp',
        inAppSettings: {
            frequency: 2,
            capping: 0.1, // 0.1 hours = 6 minutes
            interval: 30, // 30 seconds
            timeout: 5,   // 5 seconds delay before first show
            everyPage: false // Session persists across page navigations
        }
    });
} else {
    console.warn("Monetag SDK 'show_10276123' function not found. In-App ads may not work.");
}

