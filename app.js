
// --- Firebase Configuration ---
// Ensure these keys match your Firebase project settings
import { initializeApp } from "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, off, push, child, get, increment } from "https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
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

// --- DOM Elements ---
const authSection = document.getElementById('auth-section');
const appContent = document.getElementById('app-content');
const userInfo = document.getElementById('user-info');
const userDisplayName = document.getElementById('user-display-name');
const userBalance = document.getElementById('user-balance');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const autoReferralMessage = document.getElementById('auto-referral-message');

// Ad Watchers
const watchAdBtns = document.querySelectorAll('.watch-ad-btn');
const cooldownTimers = document.querySelectorAll('.cooldown-timer');

// Features
const goToChatBtn = document.getElementById('go-to-chat');
const chatRoomSection = document.getElementById('chat-room');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const backToAppBtns = document.querySelectorAll('.back-to-app'); // Collect all back buttons

const goToLeaderboardBtn = document.getElementById('go-to-leaderboard');
const leaderboardSection = document.getElementById('leaderboard');
const leaderboardList = document.getElementById('leaderboard-list');

const goToProfileBtn = document.getElementById('go-to-profile');
const profileSection = document.getElementById('profile');
const profileNameSpan = document.getElementById('profile-name');
const profileEmailSpan = document.getElementById('profile-email');
const profileReferralCodeSpan = document.getElementById('profile-referral-code');
const editProfileBtn = document.getElementById('edit-profile-btn');
const editProfileForm = document.getElementById('edit-profile-form');
const editNameInput = document.getElementById('edit-name');
const saveProfileBtn = document.getElementById('save-profile-btn');

const referralCodeSpan = document.getElementById('referral-code');
const referralInput = document.getElementById('referral-input');
const applyReferralBtn = document.getElementById('apply-referral');

const withdrawAmountInput = document.getElementById('withdraw-amount');
const gcashNumberInput = document.getElementById('gcash-number');
const withdrawBtn = document.getElementById('withdraw-btn');
const withdrawStatus = document.getElementById('withdraw-status');

// --- Global Variables ---
let currentUser = null;
let adCooldowns = {}; // { adId: timestamp }
let adRewards = {
    'watch-ad-1': 0.01,
    'watch-ad-2': 0.02,
    'watch-ad-3': 0.03
};
let adIntervals = { // in minutes
    'watch-ad-1': 5,
    'watch-ad-2': 10,
    'watch-ad-3': 15
};
let pendingReferralCode = null; // To store referral code from URL

// --- Functions ---

// Helper to get URL query parameter
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// UI Management
function showSection(sectionToShow) {
    document.querySelectorAll('main section').forEach(section => {
        section.style.display = 'none';
    });
    sectionToShow.style.display = 'block';
}

function updateUIForUser(user) {
    if (user) {
        currentUser = user;
        userDisplayName.textContent = user.displayName || user.email.split('@')[0];
        // Fetch balance from Firebase
        const userRef = ref(database, `users/${user.uid}/balance`);
        onValue(userRef, (snapshot) => {
            const balance = snapshot.val() || 0;
            userBalance.textContent = balance.toFixed(2);
        });
        // Fetch referral code
        const referralRef = ref(database, `users/${user.uid}/referralCode`);
        onValue(referralRef, (snapshot) => {
            const code = snapshot.val() || 'N/A';
            referralCodeSpan.textContent = code;
            profileReferralCodeSpan.textContent = code;
        });

        authSection.style.display = 'none';
        appContent.style.display = 'block';
        initAdCooldowns(); // Initialize cooldowns when user logs in
    } else {
        currentUser = null;
        userDisplayName.textContent = 'Guest';
        userBalance.textContent = '0.00';
        authSection.style.display = 'block';
        appContent.style.display = 'none';
        showSection(authSection);
    }

    // Hide auto-referral message once logged in/out
    autoReferralMessage.style.display = 'none';
    referralInput.disabled = false; // Enable manual referral input by default
    applyReferralBtn.disabled = false;
}

// Authentication
function loginUser(email, password) {
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            updateUIForUser(userCredential.user);
        })
        .catch((error) => {
            alert("Login failed: " + error.message);
        });
}

async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userId = user.uid;
        const displayName = user.email.split('@')[0];
        const referralCode = generateReferralCode(userId); // Generate unique code
        let referredBy = null;
        let referrerUsername = null;

        if (pendingReferralCode) {
            // Find the referrer if a pending code exists from URL
            const referrerSnapshot = await get(ref(database, 'users'));
            if (referrerSnapshot.exists()) {
                let foundReferrerId = null;
                Object.entries(referrerSnapshot.val()).forEach(([rId, rData]) => {
                    if (rData.referralCode === pendingReferralCode) {
                        foundReferrerId = rId;
                        referrerUsername = rData.displayName || rData.email.split('@')[0];
                    }
                });

                if (foundReferrerId && foundReferrerId !== userId) {
                    referredBy = foundReferrerId;
                } else if (foundReferrerId === userId) {
                    // User tried to refer themselves, ignore
                    pendingReferralCode = null;
                } else {
                    // Invalid referral code from URL
                    pendingReferralCode = null;
                }
            }
        }

        // Set initial user data in Firebase
        await set(ref(database, `users/${userId}`), {
            email: user.email,
            displayName: displayName,
            balance: 0.00,
            referralCode: referralCode,
            referredBy: referredBy
        });
        await updateProfile(user, { displayName: displayName });

        if (referredBy) {
            alert(`You have been successfully registered! You were referred by ${referrerUsername || 'someone'}.`);
        } else {
            alert("Registration successful!");
        }

        updateUIForUser(user);
    } catch (error) {
        alert("Registration failed: " + error.message);
    }
}

function logoutUser() {
    signOut(auth).then(() => {
        updateUIForUser(null);
    }).catch((error) => {
        alert("Logout failed: " + error.message);
    });
}

function generateReferralCode(userId) {
    // A simple way to generate a code. For production, consider a more robust method.
    return `PAPER${userId.substring(0, 6).toUpperCase()}`;
}

// Rewarded Ads
function handleWatchAd(adId) {
    if (!currentUser) {
        alert("Please log in to watch ads.");
        return;
    }

    const now = Date.now();
    const lastWatched = localStorage.getItem(`lastWatched_${adId}_${currentUser.uid}`); // Unique per user
    const cooldownMinutes = adIntervals[adId];

    if (lastWatched && (now - parseInt(lastWatched)) < (cooldownMinutes * 60 * 1000)) {
        const remainingTime = cooldownMinutes * 60 * 1000 - (now - parseInt(lastWatched));
        const minutesRemaining = Math.ceil(remainingTime / (60 * 1000));
        alert(`Please wait ${minutesRemaining} minute(s) before watching this ad again.`);
        return;
    }

    // --- Monetag SDK Integration ---
    if (typeof show_10276123 === 'function') {
        // The Monetag rewarded interstitial call
        show_10276123().then(() => {
            // This code executes AFTER the user watches the ad.
            rewardUserForAd(adId);
            localStorage.setItem(`lastWatched_${adId}_${currentUser.uid}`, now.toString()); // Store per user
            updateAdCooldownUI(adId, cooldownMinutes);
            console.log(`Monetag ad for ${adId} completed.`);
            alert('You have seen an ad and earned a reward!'); // User feedback
        }).catch(error => {
            alert('Ad failed to load or play. Please try again.');
            console.error('Monetag SDK error:', error);
        });
    } else {
        alert("Rewarded ad SDK not loaded. Please try again later.");
        console.error("Monetag SDK function 'show_10276123' not found.");
    }
}

function rewardUserForAd(adId) {
    const rewardAmount = adRewards[adId];
    const userId = currentUser.uid;

    update(ref(database, `users/${userId}`), {
        balance: increment(rewardAmount)
    }).then(() => {
        console.log(`Rewarded ${rewardAmount} Peso for watching ${adId}`);
        // Referral Earning Hook:
        get(child(ref(database, `users/${userId}`), 'referredBy')).then((snapshot) => {
            if (snapshot.exists() && snapshot.val()) {
                const referrerId = snapshot.val();
                const referralBonus = rewardAmount * 0.10; // 10%

                // Add bonus to referrer's balance
                update(ref(database, `users/${referrerId}`), {
                    balance: increment(referralBonus)
                }).then(() => {
                    console.log(`Referral bonus of ${referralBonus.toFixed(2)} Peso granted to referrer ${referrerId}`);
                }).catch(error => {
                    console.error("Error granting referral bonus:", error);
                });
            }
        });
    }).catch((error) => {
        console.error("Error rewarding user:", error);
        alert("Failed to add reward. Please contact support.");
    });
}

function initAdCooldowns() {
    // Load cooldowns from localStorage or initialize if not present
    watchAdBtns.forEach(button => {
        const adId = button.id;
        const lastWatched = localStorage.getItem(`lastWatched_${adId}_${currentUser.uid}`); // Unique per user
        const cooldownMinutes = adIntervals[adId];
        const now = Date.now();

        if (lastWatched) {
            const timeDiff = now - parseInt(lastWatched);
            if (timeDiff < (cooldownMinutes * 60 * 1000)) {
                const remainingTime = cooldownMinutes * 60 * 1000 - timeDiff;
                adCooldowns[adId] = setTimeout(() => {
                    updateAdCooldownUI(adId, 0); // Reset UI
                }, remainingTime);
                updateAdCooldownUI(adId, Math.ceil(remainingTime / (60 * 1000)));
            } else {
                updateAdCooldownUI(adId, 0); // Ready
            }
        } else {
            updateAdCooldownUI(adId, 0); // Ready
        }
    });
}

function updateAdCooldownUI(adId, minutes) {
    const timerElement = document.getElementById(`cooldown-${adId.split('-')[2]}`);
    const button = document.getElementById(adId);

    if (timerElement) {
        if (minutes > 0) {
            timerElement.textContent = `Wait ${minutes} min`;
            button.disabled = true;
        } else {
            timerElement.textContent = 'Ready';
            button.disabled = false;
        }
    }
}

// Chat Room
let chatMessagesRef = null;

function sendMessage() {
    const messageText = chatInput.value.trim();
    if (messageText && currentUser) {
        const messagesRef = ref(database, 'chatMessages');
        const newMessageRef = push(messagesRef);
        set(newMessageRef, {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email.split('@')[0],
            text: messageText,
            timestamp: Date.now()
        });
        chatInput.value = '';
    }
}

function displayChatMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.innerHTML = `<strong>${message.username}:</strong> ${message.text}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
}

function setupChatRoom() {
    const messagesRef = ref(database, 'chatMessages');
    chatMessagesRef = onValue(messagesRef, (snapshot) => {
        chatMessages.innerHTML = ''; // Clear current messages
        const data = snapshot.val();
        if (data) {
            const sortedMessages = Object.entries(data).sort((a, b) => a[1].timestamp - b[1].timestamp);
            sortedMessages.forEach(([key, message]) => {
                displayChatMessage(message);
            });
        }
    });
}

function leaveChatRoom() {
    if (chatMessagesRef) {
        off(chatMessagesRef); // Unsubscribe from Firebase updates
        chatMessagesRef = null;
    }
}

// Leaderboard
let leaderboardRef = null;

function updateLeaderboard() {
    const usersRef = ref(database, 'users');
    leaderboardRef = onValue(usersRef, (snapshot) => {
        leaderboardList.innerHTML = ''; // Clear current list
        const users = snapshot.val();
        if (users) {
            const sortedUsers = Object.entries(users)
                .sort(([, userDataA], [, userDataB]) => userDataB.balance - userDataA.balance)
                .slice(0, 20); // Top 20

            sortedUsers.forEach(([userId, userData], index) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <span>${index + 1}. ${userData.displayName || 'Anonymous'}</span>
                    <span>${userData.balance.toFixed(2)} Peso</span>
                `;
                leaderboardList.appendChild(listItem);
            });
        }
    });
}

function leaveLeaderboard() {
    if (leaderboardRef) {
        off(leaderboardRef);
        leaderboardRef = null;
    }
}

// Profile
function updateProfileUI() {
    if (currentUser) {
        profileNameSpan.textContent = currentUser.displayName || 'N/A';
        profileEmailSpan.textContent = currentUser.email || 'N/A';
        // Referral code is fetched separately and updated in updateUIForUser
    }
}

function handleEditProfile() {
    editProfileForm.style.display = 'block';
    editNameInput.value = currentUser.displayName || '';
}

function handleSaveProfile() {
    const newName = editNameInput.value.trim();
    if (newName && currentUser) {
        updateProfile(currentUser, { displayName: newName })
            .then(() => {
                // Update Firebase DB as well
                update(ref(database, `users/${currentUser.uid}`), {
                    displayName: newName
                });
                alert('Profile updated successfully!');
                editProfileForm.style.display = 'none';
                updateProfileUI(); // Refresh UI
            })
            .catch(error => {
                alert('Failed to update profile: ' + error.message);
            });
    } else {
        alert('Please enter a valid name.');
    }
}

// Referral System
async function applyReferralCode() {
    const codeToApply = referralInput.value.trim();
    if (!codeToApply || !currentUser) {
        alert("Please enter a valid referral code and ensure you are logged in.");
        return;
    }

    // Check if the current user has already applied a referral
    const userRef = ref(database, `users/${currentUser.uid}`);
    const userSnapshot = await get(child(userRef, 'referredBy'));

    if (userSnapshot.exists() && userSnapshot.val() !== null) {
        alert("You have already used a referral code.");
        return;
    }

    // Find the referrer by their referral code
    const referrerSnapshot = await get(ref(database, 'users'));
    let referrerId = null;
    let referrerUsername = '';

    if (referrerSnapshot.exists()) {
        Object.entries(referrerSnapshot.val()).forEach(([userId, userData]) => {
            if (userData.referralCode === codeToApply) {
                referrerId = userId;
                referrerUsername = userData.displayName || userData.email.split('@')[0];
            }
        });
    }

    if (referrerId && referrerId !== currentUser.uid) {
        await set(child(userRef, 'referredBy'), referrerId);
        alert(`Referral code applied! You are now connected with ${referrerUsername}.`);
        referralInput.value = ''; // Clear input
        referralInput.disabled = true; // Disable further manual entry
        applyReferralBtn.disabled = true;
    } else if (referrerId === currentUser.uid) {
        alert("You cannot use your own referral code.");
    } else {
        alert("Invalid referral code.");
    }
}

// Withdrawal
function handleWithdrawal() {
    const amount = parseFloat(withdrawAmountInput.value);
    const gcashNumber = gcashNumberInput.value.trim();

    if (!currentUser) {
        alert("Please log in to withdraw.");
        return;
    }
    if (isNaN(amount) || amount < 1) {
        alert("Please enter a valid amount of at least 1 Peso.");
        return;
    }
    if (!gcashNumber || !/^\d{10,11}$/.test(gcashNumber)) { // Basic validation for 10-11 digits
        alert("Please enter a valid GCash number.");
        return;
    }

    // Get current balance from Firebase (more reliable than UI display)
    get(child(ref(database, `users/${currentUser.uid}`), 'balance')).then(balanceSnapshot => {
        const currentBalance = balanceSnapshot.val() || 0;
        if (amount > currentBalance) {
            alert("Insufficient balance.");
            return;
        }

        withdrawStatus.textContent = 'Processing withdrawal...';
        withdrawBtn.disabled = true; // Disable button to prevent multiple requests

        // --- GCash Integration (SIMULATED) ---
        // In a real app, this would involve calling a payment gateway or GCash API.
        // This is a placeholder. You'd need to implement secure backend logic for this.
        setTimeout(() => {
            // Simulate successful withdrawal
            update(ref(database, `users/${currentUser.uid}`), {
                balance: increment(-amount)
            }).then(() => {
                // Log the withdrawal request for admin to process
                const withdrawalsRef = ref(database, 'withdrawals');
                push(withdrawalsRef, {
                    userId: currentUser.uid,
                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                    gcashNumber: gcashNumber,
                    amount: amount,
                    timestamp: Date.now(),
                    status: 'Pending' // Admin needs to mark as 'Completed'
                });

                withdrawStatus.textContent = `Withdrawal of ${amount.toFixed(2)} Peso to ${gcashNumber} requested. Please wait for admin approval.`;
                withdrawAmountInput.value = '';
                gcashNumberInput.value = '';
            }).catch(error => {
                console.error("Withdrawal error:", error);
                withdrawStatus.textContent = 'Withdrawal failed. Please try again.';
                alert('Withdrawal failed. Please try again later.');
            }).finally(() => {
                withdrawBtn.disabled = false; // Re-enable button
            });
        }, 2000); // Simulate network delay
    }).catch(error => {
        console.error("Error fetching balance for withdrawal:", error);
        alert("An error occurred while preparing withdrawal. Please try again.");
    });
}

// --- Event Listeners ---
loginBtn.addEventListener('click', () => loginUser(loginEmailInput.value, loginPasswordInput.value));
// Use registerUser directly now for specific logic
registerBtn.addEventListener('click', () => registerUser(loginEmailInput.value, loginPasswordInput.value));
logoutBtn.addEventListener('click', logoutUser);

watchAdBtns.forEach(button => {
    button.addEventListener('click', () => handleWatchAd(button.id));
});

goToChatBtn.addEventListener('click', () => {
    showSection(chatRoomSection);
    setupChatRoom();
});

sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

goToLeaderboardBtn.addEventListener('click', () => {
    showSection(leaderboardSection);
    updateLeaderboard();
});

goToProfileBtn.addEventListener('click', () => {
    showSection(profileSection);
    updateProfileUI();
});

editProfileBtn.addEventListener('click', handleEditProfile);
saveProfileBtn.addEventListener('click', handleSaveProfile);

applyReferralBtn.addEventListener('click', applyReferralCode);

withdrawBtn.addEventListener('click', handleWithdrawal);

backToAppBtns.forEach(button => {
    button.addEventListener('click', () => {
        showSection(appContent);
        // Clean up listeners if necessary (e.g., chat, leaderboard)
        leaveChatRoom();
        leaveLeaderboard();
    });
});

// --- Initial Load ---
onAuthStateChanged(auth, (user) => {
    // Check for pending referral code from URL only if user is NOT logged in
    if (!user) {
        pendingReferralCode = getUrlParameter('ref');
        if (pendingReferralCode) {
            autoReferralMessage.textContent = `You were invited! Register to automatically join with referral code: ${pendingReferralCode}`;
            autoReferralMessage.style.display = 'block';
            referralInput.value = pendingReferralCode;
            referralInput.disabled = true; // Disable manual input if auto-filled
            applyReferralBtn.disabled = true;
        } else {
            autoReferralMessage.style.display = 'none';
        }
    } else {
        // If user is logged in, clear any pending referral from URL
        pendingReferralCode = null;
    }
    updateUIForUser(user);
});

// Important: Monetag specific In-App Interstitial Example (Optional)
// This code will run when the script loads, potentially showing ads.
// You might want to control when these types of ads appear (e.g., after login, on certain pages).
/*
if (typeof show_10276123 === 'function') {
    // This is an example for inApp interstitial. Adjust settings based on Monetag docs.
    // For example, to show 2 ads within 6 minutes with 30s interval:
    show_10276123({
      type: 'inApp',
      inAppSettings: {
        frequency: 2, // Number of ads
        capping: 0.1, // Time in hours (0.1 hours = 6 minutes)
        interval: 30, // Seconds between ads
        timeout: 5,   // Seconds before first ad
        everyPage: 0  // Save session across page navigations
      }
    }).then(result => {
        console.log('Monetag In-App interstitial ad result:', result);
        // Handle rewards if applicable based on result
    }).catch(error => {
        console.error('Monetag In-App interstitial ad error:', error);
    });
}
*/
