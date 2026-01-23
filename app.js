
// --- Firebase Configuration ---
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase, ref, set, get, update, onValue, push, query, orderByChild, limitToLast, serverTimestamp } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N3MXAVFTn7c", // Replace with your actual Firebase API Key
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// --- Global Constants & Variables ---
const REWARD_PER_AD = 0.012; // PHP per ad
const OWNER_PASSWORD = "Propetas6"; // INSECURE: Hardcoded password for demo
const PAGINATION_LIMIT = 15;
let currentUser = null;
let currentLeaderboardWeekId = '';
let withdrawalRequests = [];
let currentPage = 1;
let totalPages = 1;

// --- DOM Elements ---
const authSection = document.getElementById('auth-section');
const mainAppSection = document.getElementById('main-app-section');
const ownerDashboardSection = document.getElementById('owner-dashboard-section');

// Auth elements
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authTelegram = document.getElementById('auth-telegram');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const authMessage = document.getElementById('auth-message');
const logoutBtn = document.getElementById('logout-btn');

// User Dashboard elements
const displayUsername = document.getElementById('display-username');
const displayTelegram = document.getElementById('display-telegram');
const userBalance = document.getElementById('user-balance');
const adsWatchedCount = document.getElementById('ads-watched-count');
const showRewardedAdBtn = document.getElementById('show-rewarded-ad-btn');

// Leaderboard elements
const leaderboardTableBody = document.querySelector('#leaderboard-table tbody');
const leaderboardResetInfo = document.getElementById('leaderboard-reset-info');

// Withdrawal elements
const gcashNumberInput = document.getElementById('gcash-number');
const withdrawalAmountInput = document.getElementById('withdrawal-amount');
const requestWithdrawalBtn = document.getElementById('request-withdrawal-btn');
const withdrawalMessage = document.getElementById('withdrawal-message');

// Owner Dashboard elements
const accessOwnerDashboardBtn = document.getElementById('access-owner-dashboard-btn');
const ownerPasswordInput = document.getElementById('owner-password-input');
const ownerLoginBtn = document.getElementById('owner-login-btn');
const ownerLogoutBtn = document.getElementById('owner-logout-btn');
const ownerDashboardContent = document.getElementById('owner-dashboard-content');
const withdrawalRequestsTableBody = document.querySelector('#withdrawal-requests-table tbody');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfoSpan = document.getElementById('page-info');


// --- Utility Functions ---
// Removed showLoading function as per requirement

function showSection(sectionId) {
    authSection.classList.add('hidden');
    mainAppSection.classList.add('hidden');
    ownerDashboardSection.classList.add('hidden');
    document.getElementById(sectionId).classList.remove('hidden');
}

function formatCurrency(amount) {
    return (amount || 0).toFixed(3);
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// --- Monetag Ad Integration ---
async function showRewardedAd() {
    console.log("Attempting to show Rewarded Ad...");
    if (typeof window.show_10337795 !== 'function') {
        console.error("Monetag SDK (show_10337795) is not loaded.");
        alert("Ad service not ready. Please refresh.");
        return;
    }

    showRewardedAdBtn.disabled = true; // Disable button while ad is loading/playing

    try {
        await window.show_10337795(); // Assuming rewarded interstitial for simplicity
        console.log("Rewarded Ad viewed successfully.");
        await giveUserReward("ad_watch");
    } catch (e) {
        console.error("Rewarded Ad failed to load or play:", e);
        alert("Ad unavailable or error occurred. Please try again later.");
    } finally {
        showRewardedAdBtn.disabled = false;
    }
}

async function giveUserReward(rewardType) {
    if (!currentUser) {
        console.error("No user logged in to give reward.");
        return;
    }

    const userRef = ref(database, `users/${currentUser.uid}`);
    const leaderboardUserRef = ref(database, `leaderboard/${currentLeaderboardWeekId}/${currentUser.uid}`);

    try {
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val() || {};
        let currentBalance = userData.balance || 0;
        let currentAdsWatched = userData.adsWatched || 0; // Global count
        let currentTotalEarned = userData.totalEarned || 0; // Total earned across all weeks
        
        const userTelegramId = userData.telegramId || userData.telegramUsername || 'N/A';

        // Update user's personal balance and total earned
        currentBalance += REWARD_PER_AD;
        currentTotalEarned += REWARD_PER_AD;

        await update(userRef, {
            balance: currentBalance,
            adsWatched: currentAdsWatched + 1, // Global count
            totalAds: (userData.totalAds || 0) + 1, // New index field: total lifetime ads
            dailyAds: (userData.dailyAds || 0) + 1, // New index field: daily ads (requires daily reset logic)
            totalEarned: currentTotalEarned, // Global count
            telegramId: userTelegramId // Ensure this field exists for indexing
        });

        // Update leaderboard score for the current week
        const leaderboardSnapshot = await get(leaderboardUserRef);
        const leaderboardUserData = leaderboardSnapshot.val() || {
            username: userData.username || currentUser.email,
            telegramUsername: userData.telegramId || 'N/A', // Use telegramId here too
            totalEarnings: 0,
            adsWatched: 0
        };

        await set(leaderboardUserRef, {
            username: leaderboardUserData.username,
            telegramUsername: leaderboardUserData.telegramUsername,
            totalEarnings: leaderboardUserData.totalEarnings + REWARD_PER_AD,
            adsWatched: leaderboardUserData.adsWatched + 1
        });

        console.log(`User ${currentUser.uid} earned ${REWARD_PER_AD} for ${rewardType}. New balance: ${currentBalance.toFixed(3)}`);
        // UI will update via real-time listeners
    } catch (error) {
        console.error("Error giving user reward:", error);
        alert("Failed to record reward. Please contact support.");
    }
}

// --- Leaderboard Logic ---
function getWeekId(date) {
    const startOfWeek = new Date(date);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() || 7) + 1); // Monday as start of week
    return startOfWeek.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getNextResetDate(currentDate) {
    const nextReset = new Date(currentDate);
    nextReset.setDate(nextReset.getDate() + (7 - (nextReset.getDay() || 7)) + 1); // Next Monday
    nextReset.setHours(0, 0, 0, 0);
    return nextReset.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}


async function initializeLeaderboard() {
    const now = new Date();
    const currentWeek = getWeekId(now);
    const leaderboardResetRef = ref(database, 'globalSettings/leaderboardLastReset');

    try {
        const snapshot = await get(leaderboardResetRef);
        const lastResetTimestamp = snapshot.val();
        let lastResetDate = lastResetTimestamp ? new Date(lastResetTimestamp) : new Date(0); // Epoch if no reset date

        // Determine if a new week has started since last reset
        const lastResetWeek = getWeekId(lastResetDate);

        if (currentWeek !== lastResetWeek) {
            console.log("New week detected. Resetting leaderboard related data for week:", currentWeek);
            await set(leaderboardResetRef, serverTimestamp()); // Update last reset time
            currentLeaderboardWeekId = currentWeek; // Set new week ID
        } else {
            currentLeaderboardWeekId = lastResetWeek;
        }

        console.log("Current leaderboard week ID:", currentLeaderboardWeekId);
        leaderboardResetInfo.textContent = getNextResetDate(new Date(currentLeaderboardWeekId));
        setupLeaderboardListener();

    } catch (error) {
        console.error("Error initializing leaderboard:", error);
    }
}

function setupLeaderboardListener() {
    const leaderboardRef = query(ref(database, `leaderboard/${currentLeaderboardWeekId}`), orderByChild('totalEarnings'), limitToLast(100)); // Top 100 earners
    onValue(leaderboardRef, (snapshot) => {
        const scores = [];
        snapshot.forEach((childSnapshot) => {
            scores.push({ uid: childSnapshot.key, ...childSnapshot.val() });
        });

        // Sort descending by totalEarnings, then adsWatched (if earnings are tied)
        scores.sort((a, b) => b.totalEarnings - a.totalEarnings || b.adsWatched - a.adsWatched);

        leaderboardTableBody.innerHTML = '';
        if (scores.length === 0) {
            leaderboardTableBody.innerHTML = '<tr><td colspan="4">No earners yet this week.</td></tr>';
            return;
        }

        scores.forEach((score, index) => {
            const row = leaderboardTableBody.insertRow();
            row.insertCell(0).textContent = index + 1;
            row.insertCell(1).textContent = score.username || score.telegramUsername || 'N/A';
            row.insertCell(2).textContent = formatCurrency(score.totalEarnings);
            row.insertCell(3).textContent = score.adsWatched;
        });
    });
}

// --- Withdrawal System (User Side) ---
async function requestWithdrawal() {
    if (!currentUser) {
        alert("Please log in to request a withdrawal.");
        return;
    }

    const gcashNumber = gcashNumberInput.value.trim();
    const amount = parseFloat(withdrawalAmountInput.value);
    const telegramUsername = displayTelegram.textContent.trim(); // Get from user's profile

    if (!gcashNumber || !telegramUsername) {
        withdrawalMessage.textContent = "Please ensure your GCash number and Telegram username are provided.";
        return;
    }
    if (isNaN(amount) || amount <= 0.01) { // Minimum withdrawal of 0.01 PHP
        withdrawalMessage.textContent = "Please enter a valid amount greater than 0.01 PHP.";
        return;
    }

    const userRef = ref(database, `users/${currentUser.uid}`);
    try {
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();
        if (!userData || userData.balance < amount) {
            withdrawalMessage.textContent = "Insufficient balance.";
            return;
        }

        // Deduct balance immediately upon request
        const newBalance = userData.balance - amount;
        await update(userRef, { balance: newBalance });

        // Push withdrawal request to Firebase
        const newRequestRef = push(ref(database, 'withdrawals'));
        await set(newRequestRef, {
            uid: currentUser.uid,
            username: userData.username || currentUser.email,
            telegramUsername: telegramUsername,
            gcashNumber: gcashNumber,
            amount: amount,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        withdrawalMessage.textContent = `Withdrawal request for ${formatCurrency(amount)} PHP sent! Your balance is now ${formatCurrency(newBalance)} PHP.`;
        gcashNumberInput.value = '';
        withdrawalAmountInput.value = '';
    } catch (error) {
        console.error("Error requesting withdrawal:", error);
        withdrawalMessage.textContent = "Failed to send withdrawal request. Please try again.";
        // IMPORTANT: If balance deduction succeeded but request failed, user balance needs to be restored.
        // A Cloud Function for this entire process is safer.
    }
}

// --- Owner Dashboard Logic ---
function renderWithdrawalRequests() {
    withdrawalRequestsTableBody.innerHTML = '';
    const startIndex = (currentPage - 1) * PAGINATION_LIMIT;
    const endIndex = startIndex + PAGINATION_LIMIT;
    const paginatedRequests = withdrawalRequests.slice(startIndex, endIndex);

    if (paginatedRequests.length === 0) {
        withdrawalRequestsTableBody.innerHTML = '<tr><td colspan="8">No pending withdrawal requests.</td></tr>';
        return;
    }

    paginatedRequests.forEach(req => {
        const row = withdrawalRequestsTableBody.insertRow();
        row.dataset.requestId = req.id;

        row.insertCell(0).textContent = req.id.substring(0, 8) + '...';
        row.insertCell(1).textContent = req.username;
        row.insertCell(2).textContent = req.telegramUsername;
        row.insertCell(3).textContent = req.gcashNumber;
        row.insertCell(4).textContent = formatCurrency(req.amount);
        row.insertCell(5).textContent = formatTimestamp(req.timestamp);
        const statusCell = row.insertCell(6);
        statusCell.textContent = req.status;
        statusCell.className = `status-${req.status}`;

        const actionCell = row.insertCell(7);
        if (req.status === 'pending') {
            const approveBtn = document.createElement('button');
            approveBtn.textContent = 'Approve';
            approveBtn.className = 'action-btn small-btn';
            approveBtn.onclick = () => handleWithdrawalAction(req.id, 'approved', req.uid, req.amount);
            
            const rejectBtn = document.createElement('button');
            rejectBtn.textContent = 'Reject';
            rejectBtn.className = 'reject-btn small-btn'; // You might want a different style for reject
            rejectBtn.onclick = () => handleWithdrawalAction(req.id, 'rejected', req.uid, req.amount);

            actionCell.appendChild(approveBtn);
            actionCell.appendChild(rejectBtn);
        } else {
            actionCell.textContent = 'Completed';
        }
    });

    totalPages = Math.ceil(withdrawalRequests.length / PAGINATION_LIMIT);
    pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function setupWithdrawalRequestsListener() {
    const requestsRef = query(ref(database, 'withdrawals'), orderByChild('timestamp'));
    onValue(requestsRef, (snapshot) => {
        withdrawalRequests = [];
        snapshot.forEach(childSnapshot => {
            withdrawalRequests.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        // Sort newest first
        withdrawalRequests.sort((a, b) => b.timestamp - a.timestamp);
        renderWithdrawalRequests();
    });
}

async function handleWithdrawalAction(requestId, status, userId, amount) {
    if (!confirm(`Are you sure you want to ${status} request ${requestId}?`)) {
        return;
    }

    const requestRef = ref(database, `withdrawals/${requestId}`);
    try {
        await update(requestRef, {
            status: status,
            processedBy: currentUser.uid,
            processedTimestamp: serverTimestamp()
        });

        if (status === 'rejected') {
            // Refund the user's balance if rejected
            const userRef = ref(database, `users/${userId}`);
            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();
            if (userData) {
                const newBalance = (userData.balance || 0) + amount;
                await update(userRef, { balance: newBalance });
                console.log(`User ${userId} refunded ${amount} due to rejected withdrawal.`);
            }
        }
        ownerMessage.textContent = `Request ${requestId} ${status} successfully.`;
    } catch (error) {
        console.error(`Error processing withdrawal request ${requestId}:`, error);
        ownerMessage.textContent = `Failed to ${status} request ${requestId}.`;
    }
}

// --- Authentication Handlers ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.uid);

        const userProfileRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userProfileRef);
        const userData = snapshot.val();

        if (!userData || !userData.telegramId) { 
            // User exists but missing Telegram, prompt to update or complete registration
            authMessage.textContent = "Please complete your profile (Telegram username).";
            showSection('auth-section');
            return;
        }

        displayUsername.textContent = userData.username || user.email;
        displayTelegram.textContent = userData.telegramId; 

        // Set up real-time listener for user balance and ads watched
        onValue(userProfileRef, (snapshot) => {
            const updatedUserData = snapshot.val();
            userBalance.textContent = formatCurrency(updatedUserData.balance);
            adsWatchedCount.textContent = updatedUserData.adsWatched || 0;
        });

        await initializeLeaderboard(); // Initialize and listen to leaderboard
        showSection('main-app-section'); // Show main app if user is authenticated
    } else {
        currentUser = null;
        console.log("User logged out.");
        showSection('auth-section'); // Show auth screen if no user
    }
});

async function handleLogin() {
    const email = authEmail.value;
    const password = authPassword.value;
    if (!email || !password) {
        authMessage.textContent = "Please enter email and password.";
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, email, password);
        authMessage.textContent = ""; // Clear message on success
    } catch (error) {
        console.error("Login error:", error.message);
        authMessage.textContent = `Login failed: ${error.message}`;
    }
}

async function handleRegister() {
    const email = authEmail.value;
    const password = authPassword.value;
    const telegramUsername = authTelegram.value.trim(); // User input is telegram username

    if (!email || !password || !telegramUsername) {
        authMessage.textContent = "Please fill in all fields (Email, Password, Telegram Username).";
        return;
    }
    if (!telegramUsername.startsWith('@') || telegramUsername.length < 2) {
        authMessage.textContent = "Telegram username must start with '@' and be valid.";
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Store user profile data in Realtime Database
        await set(ref(database, `users/${user.uid}`), {
            username: email.split('@')[0], // Default username from email
            telegramId: telegramUsername, // Storing as telegramId for indexing
            balance: 0,
            adsWatched: 0,
            totalEarned: 0, // Lifetime earnings
            totalAds: 0, // For new index
            dailyAds: 0, // For new index
            createdAt: serverTimestamp()
        });

        authMessage.textContent = "Registration successful! You are now logged in.";
    } catch (error) {
        console.error("Registration error:", error.message);
        authMessage.textContent = `Registration failed: ${error.message}`;
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        authEmail.value = '';
        authPassword.value = '';
        authTelegram.value = ''; // Clear telegram input
        leaderboardTableBody.innerHTML = ''; // Clear leaderboard
        withdrawalRequestsTableBody.innerHTML = ''; // Clear withdrawal requests
    } catch (error) {
        console.error("Logout error:", error.message);
        alert("Logout failed. Please try again.");
    }
}

function handleOwnerLogin() {
    const password = ownerPasswordInput.value;
    if (password === OWNER_PASSWORD) {
        ownerMessage.textContent = "Owner dashboard unlocked.";
        ownerDashboardContent.classList.remove('hidden');
        ownerPasswordInput.classList.add('hidden');
        ownerLoginBtn.classList.add('hidden');
        ownerLogoutBtn.classList.remove('hidden');
        setupWithdrawalRequestsListener(); // Start listening for requests
    } else {
        ownerMessage.textContent = "Incorrect password.";
    }
}

function handleOwnerLogout() {
    ownerMessage.textContent = "";
    ownerDashboardContent.classList.add('hidden');
    ownerPasswordInput.classList.remove('hidden');
    ownerPasswordInput.value = '';
    ownerLoginBtn.classList.remove('hidden');
    ownerLogoutBtn.classList.add('hidden');
    // Consider stopping withdrawal requests listener here if needed for performance
}

// --- Event Listeners ---
loginBtn.addEventListener('click', handleLogin);
registerBtn.addEventListener('click', handleRegister);
logoutBtn.addEventListener('click', handleLogout);
showRewardedAdBtn.addEventListener('click', showRewardedAd);
requestWithdrawalBtn.addEventListener('click', requestWithdrawal);
accessOwnerDashboardBtn.addEventListener('click', () => showSection('owner-dashboard-section'));
ownerLoginBtn.addEventListener('click', handleOwnerLogin);
ownerLogoutBtn.addEventListener('click', () => {
    handleOwnerLogout();
    showSection('main-app-section'); // Go back to main user app
});

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderWithdrawalRequests();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderWithdrawalRequests();
    }
});

// Initial logic: onAuthStateChanged handles which section is shown directly.
// No need for a separate DOMContentLoaded listener with loading logic.
