
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Initialize Firebase (v8 syntax)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Monetag Ad Variables
const MONETAG_ZONE = '10276123';
const REWARD_PER_AD = 0.01; // Peso
const REFERRAL_PERCENTAGE = 0.10; // 10%
const MIN_WITHDRAW = 0.02; // Peso

// DOM Elements
const displayName = document.getElementById('display-name');
const balanceDisplay = document.getElementById('balance');
const watchAdBtn = document.getElementById('watch-ad-btn');
const referralCodeSpan = document.getElementById('referral-code');
const leaderboardList = document.getElementById('leaderboard-list');
const chatBox = document.getElementById('chat-box');
const chatMessageInput = document.getElementById('chat-message');
const sendMessageBtn = document.getElementById('send-message-btn');
const gcashNumberInput = document.getElementById('gcash-number');
const withdrawBtn = document.getElementById('withdraw-btn');
const withdrawStatus = document.getElementById('withdraw-status');

// Admin Elements
const adminLoginModal = document.getElementById('admin-login-modal');
const adminPasswordInput = document.getElementById('admin-password');
const loginAdminBtn = document.getElementById('login-admin-btn');
const adminLoginError = document.getElementById('admin-login-error');
const adminDashboard = document.getElementById('admin-dashboard');
const logoutAdminBtn = document.getElementById('logout-admin-btn');
const userList = document.getElementById('user-list');
const broadcastMessageInput = document.getElementById('broadcast-message');
const sendBroadcastBtn = document.getElementById('send-broadcast-btn');

// Initial Setup Modal Elements
const initialSetupModal = document.getElementById('initial-setup-modal');
const setupUsernameInput = document.getElementById('setup-username');
const setupReferralCodeInput = document.getElementById('setup-referral-code');
const completeSetupBtn = document.getElementById('complete-setup-btn');
const setupError = document.getElementById('setup-error');


// --- State Variables ---
let currentUserUid = null;
let isAdminLoggedIn = false;

// --- Helper Functions ---

// Function to generate a random user ID
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Function to get current user's UID
function getCurrentUserUid() {
    if (currentUserUid) return currentUserUid;
    return localStorage.getItem('userUid');
}

// Function to set the current user UID and save to localStorage
function setCurrentUserUid(uid) {
    currentUserUid = uid;
    localStorage.setItem('userUid', uid);
}

// Function to fetch and display user profile (balance, referral code)
async function fetchUserProfile(uid) {
    const userRef = database.ref(`users/${uid}`);
    userRef.on('value', (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            displayName.textContent = userData.name || 'User';
            balanceDisplay.textContent = parseFloat(userData.balance || 0).toFixed(2);
            referralCodeSpan.textContent = userData.referralCode || 'N/A';
        } else {
            // This case should ideally be handled by the initial setup modal
            console.warn("User data not found for UID:", uid, " - triggering initial setup.");
            showInitialSetupModal();
        }
    });
}

// Function to handle ad watching and reward
async function watchAd() {
    withdrawStatus.textContent = ''; // Clear previous status
    const uid = getCurrentUserUid();
    if (!uid) {
        withdrawStatus.textContent = 'Please complete user setup first!';
        showInitialSetupModal();
        return;
    }

    try {
        // Show Rewarded Interstitial Ad
        await show_10276123().then(async () => {
            // Ad successfully watched
            const userRef = database.ref(`users/${uid}`);
            const userSnapshot = await userRef.once('value');
            const userData = userSnapshot.val();

            if (!userData) {
                withdrawStatus.textContent = 'User data not found. Please refresh.';
                return;
            }

            // Update user's balance
            const newBalance = (userData.balance || 0) + REWARD_PER_AD;
            await userRef.update({
                balance: newBalance,
                totalAds: (userData.totalAds || 0) + 1 // For indexing
            });
            console.log('Ad reward added successfully to user!');
            withdrawStatus.textContent = `You earned ${REWARD_PER_AD.toFixed(2)} Peso!`;

            // Client-side referral reward logic (INSECURE without Cloud Functions)
            if (userData.referredBy) {
                const referrerRef = database.ref(`users/${userData.referredBy}`);
                const referrerSnapshot = await referrerRef.once('value');
                const referrerData = referrerSnapshot.val();

                if (referrerData) {
                    const referralReward = REWARD_PER_AD * REFERRAL_PERCENTAGE;
                    const newReferrerBalance = (referrerData.balance || 0) + referralReward;
                    await referrerRef.update({
                        balance: newReferrerBalance
                    });
                    console.log(`Referral reward of ${referralReward.toFixed(2)} Peso added to referrer ${referrerData.name}!`);
                }
            }
        });
    } catch (error) {
        console.error('Error showing ad or adding reward:', error);
        withdrawStatus.textContent = 'Could not show ad or add reward. Please try again later.';
    }
}

// Function to fetch and display leaderboard
async function fetchLeaderboard() {
    const usersRef = database.ref('users');
    usersRef.orderByChild('balance').limitToLast(10).on('value', (snapshot) => {
        const users = [];
        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            users.push({
                name: userData.name,
                balance: userData.balance,
                uid: childSnapshot.key // Use childSnapshot.key for UID
            });
        });
        // Sort by balance in descending order (since limitToLast gives smallest first)
        users.sort((a, b) => b.balance - a.balance);

        leaderboardList.innerHTML = ''; // Clear previous list
        users.forEach((user, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${index + 1}. ${user.name}</span>
                <span>${parseFloat(user.balance).toFixed(2)} Peso</span>
            `;
            leaderboardList.appendChild(listItem);
        });
    });
}

// Function to fetch and display chat messages (now called 'messages')
async function fetchChatMessages() {
    const messagesRef = database.ref('messages'); // Renamed from 'chat' to 'messages'
    messagesRef.orderByChild('time').limitToLast(50).on('value', (snapshot) => { // order by 'time' as per rules
        chatBox.innerHTML = ''; // Clear previous messages
        snapshot.forEach((childSnapshot) => {
            const messageData = childSnapshot.val();
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.innerHTML = `
                <strong>${messageData.sender || 'Anonymous'}:</strong> ${messageData.text}
                <span class="timestamp">${new Date(messageData.time).toLocaleTimeString()}</span>
            `;
            chatBox.appendChild(messageElement);
        });
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
    });
}

// Function to send a chat message
async function sendMessage() {
    const messageText = chatMessageInput.value.trim();
    if (!messageText) return;

    const uid = getCurrentUserUid();
    if (!uid) {
        withdrawStatus.textContent = 'Please complete user setup first!';
        showInitialSetupModal();
        return;
    }

    const userRef = database.ref(`users/${uid}`);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();

    const newMessage = {
        sender: userData ? userData.name : 'Anonymous',
        text: messageText,
        time: firebase.database.ServerValue.TIMESTAMP // Use ServerValue for time
    };

    database.ref('messages').push(newMessage).then(() => { // Push to 'messages' node
        chatMessageInput.value = '';
    }).catch((error) => {
        console.error('Error sending message:', error);
        withdrawStatus.textContent = 'Error sending message.';
    });
}

// Function to handle withdrawal request
async function requestWithdrawal() {
    const uid = getCurrentUserUid();
    if (!uid) {
        withdrawStatus.textContent = 'Please complete user setup first!';
        showInitialSetupModal();
        return;
    }

    const userRef = database.ref(`users/${uid}`);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();

    const currentBalance = parseFloat(userData.balance || 0);
    const gcashNumber = gcashNumberInput.value.trim();

    if (currentBalance < MIN_WITHDRAW) {
        withdrawStatus.textContent = `Your balance is too low. Minimum withdrawal is ${MIN_WITHDRAW.toFixed(2)} Peso.`;
        return;
    }

    if (!gcashNumber || !/^\d{11}$/.test(gcashNumber)) {
        withdrawStatus.textContent = 'Please enter a valid 11-digit GCash number.';
        return;
    }

    withdrawStatus.textContent = `Processing withdrawal of ${currentBalance.toFixed(2)} Peso to ${gcashNumber}...`;

    // Atomically update balance to 0 and record withdrawal request
    const updates = {};
    updates[`users/${uid}/balance`] = 0.00;
    
    const withdrawalId = database.ref('withdrawals').push().key; // Generate key for withdrawal record
    updates[`withdrawals/${withdrawalId}`] = {
        uid: uid,
        name: userData.name,
        gcashNumber: gcashNumber,
        amount: currentBalance,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'Pending'
    };

    database.ref().update(updates).then(() => {
        console.log(`Withdrawal requested: ${currentBalance.toFixed(2)} Peso to ${gcashNumber} by ${userData.name} (UID: ${uid})`);
        gcashNumberInput.value = '';
        balanceDisplay.textContent = '0.00'; // Update UI immediately
        withdrawStatus.textContent = 'Withdrawal request submitted! Please check your GCash (may take some time).';
    }).catch((error) => {
        console.error('Error processing withdrawal:', error);
        withdrawStatus.textContent = 'Failed to process withdrawal. Please try again.';
    });
}

// --- Admin Functions ---
function showAdminLoginModal() {
    adminLoginModal.style.display = 'block';
}

function hideAdminLoginModal() {
    adminLoginModal.style.display = 'none';
    adminPasswordInput.value = '';
    adminLoginError.textContent = '';
}

function loginAdmin() {
    const enteredPassword = adminPasswordInput.value;
    if (enteredPassword === "Propetas12") {
        isAdminLoggedIn = true;
        hideAdminLoginModal();
        adminDashboard.classList.remove('hidden');
        fetchUsersForAdmin();
        console.log('Admin logged in successfully.');
    } else {
        adminLoginError.textContent = 'Incorrect password. Please try again.';
    }
}

function logoutAdmin() {
    isAdminLoggedIn = false;
    adminDashboard.classList.add('hidden');
    console.log('Admin logged out.');
}

async function fetchUsersForAdmin() {
    const usersRef = database.ref('users');
    usersRef.orderByChild('balance').on('value', (snapshot) => { // Order for better display in admin
        userList.innerHTML = ''; // Clear previous list
        const usersArray = [];
        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            usersArray.push({
                uid: childSnapshot.key,
                name: userData.name,
                balance: userData.balance,
                referralCode: userData.referralCode,
                referredBy: userData.referredBy // Display referredBy
            });
        });

        // Sort by balance descending
        usersArray.sort((a, b) => b.balance - a.balance);

        usersArray.forEach((user) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span><strong>${user.name}</strong> (UID: ${user.uid.substring(0, 5)}...)</span>
                <span>Balance: ${parseFloat(user.balance || 0).toFixed(2)} Peso</span>
                <span>Ref Code: ${user.referralCode}</span>
                <span>Referred by: ${user.referredBy ? user.referredBy.substring(0,5) + '...' : 'N/A'}</span>
            `;
            userList.appendChild(listItem);
        });
    });
}

async function sendBroadcastMessage() {
    const message = broadcastMessageInput.value.trim();
    if (!message) {
        alert('Please enter a message to broadcast.');
        return;
    }

    const broadcastRef = database.ref('broadcasts').push();
    broadcastRef.set({
        message: message,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert('Broadcast message sent!');
        broadcastMessageInput.value = '';
    }).catch((error) => {
        console.error('Error sending broadcast:', error);
        alert('Failed to send broadcast message.');
    });
}

// --- Initial User Setup Modal Functions ---
function showInitialSetupModal() {
    initialSetupModal.classList.remove('hidden');
}

function hideInitialSetupModal() {
    initialSetupModal.classList.add('hidden');
    setupUsernameInput.value = '';
    setupReferralCodeInput.value = '';
    setupError.textContent = '';
}

async function completeInitialSetup() {
    const username = setupUsernameInput.value.trim();
    const enteredReferralCode = setupReferralCodeInput.value.trim();

    if (!username) {
        setupError.textContent = 'Username cannot be empty.';
        return;
    }

    if (username.length > 30) {
        setupError.textContent = 'Username too long (max 30 characters).';
        return;
    }

    let newUserUid = generateUserId();
    setCurrentUserUid(newUserUid); // Set temporarily

    let referrerUid = null;
    if (enteredReferralCode) {
        // Find referrer by code (INSECURE client-side)
        const referrerSnapshot = await database.ref('users').orderByChild('referralCode').equalTo(enteredReferralCode).once('value');
        if (referrerSnapshot.exists()) {
            const referrerData = referrerSnapshot.val();
            referrerUid = Object.keys(referrerData)[0]; // Get the UID of the referrer
            console.log("Referral code matched:", enteredReferralCode, "by UID:", referrerUid);
        } else {
            setupError.textContent = 'Invalid referral code. You can proceed without it or try again.';
            // Do not block creation, just warn
        }
    }

    const userRef = database.ref(`users/${newUserUid}`);
    const referralCode = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const initialUserData = {
        name: username,
        balance: 0.00,
        referralCode: referralCode,
        uid: newUserUid, // Store UID within the user object
        joined: firebase.database.ServerValue.TIMESTAMP,
        referredBy: referrerUid || null, // Store referrer's UID
        totalAds: 0
    };

    userRef.set(initialUserData).then(() => {
        console.log('New user created:', initialUserData);
        hideInitialSetupModal();
        fetchUserProfile(newUserUid); // Load new user's profile
    }).catch((error) => {
        console.error('Error creating new user:', error);
        setupError.textContent = 'Error setting up user. Please try again.';
    });
}


// --- Event Listeners ---
watchAdBtn.addEventListener('click', watchAd);
sendMessageBtn.addEventListener('click', sendMessage);
chatMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
withdrawBtn.addEventListener('click', requestWithdrawal);

// Admin Login Modal Listeners
document.getElementById('admin-login-trigger').addEventListener('click', showAdminLoginModal);
const adminModalCloseBtn = adminLoginModal.querySelector('.close-button');
adminModalCloseBtn.addEventListener('click', hideAdminLoginModal);
loginAdminBtn.addEventListener('click', loginAdmin);
logoutAdminBtn.addEventListener('click', logoutAdmin);
sendBroadcastBtn.addEventListener('click', sendBroadcastMessage);

// Initial Setup Modal Listeners
completeSetupBtn.addEventListener('click', completeInitialSetup);


// Close modal if clicking outside
window.addEventListener('click', (event) => {
    if (event.target === adminLoginModal) {
        hideAdminLoginModal();
    }
    if (event.target === initialSetupModal && !initialSetupModal.classList.contains('hidden')) {
        // Prevent closing initial setup if it's the first time
        // or if an error message is showing.
        // Forcing user to complete setup.
    }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const userId = getCurrentUserUid();
    if (userId) {
        fetchUserProfile(userId);
    } else {
        // If no user UID in localStorage, show setup modal
        showInitialSetupModal();
    }
    
    fetchLeaderboard();
    fetchChatMessages();

    // For demonstration, a button to trigger admin login
    const adminLoginTrigger = document.createElement('button');
    adminLoginTrigger.id = 'admin-login-trigger';
    adminLoginTrigger.textContent = 'Admin Login';
    adminLoginTrigger.style.position = 'fixed';
    adminLoginTrigger.style.top = '10px';
    adminLoginTrigger.style.right = '10px';
    adminLoginTrigger.style.zIndex = '1000';
    document.body.appendChild(adminLoginTrigger);
});
