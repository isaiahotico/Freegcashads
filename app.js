
// Ensure Firebase SDKs are loaded from index.html
const app = window.firebaseApp;
const auth = window.firebaseAuth;
const db = window.firebaseDb;
const { getAuth, signInAnonymously, onAuthStateChanged, signOut, getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp, addDoc } = window.firebaseSDKs;


// --- UI Elements ---
const userIdDisplay = document.getElementById('user-id-display');
const userBalanceDisplay = document.getElementById('user-balance');
const authButton = document.getElementById('auth-button');
const watchRewardedInterstitialBtn = document.getElementById('watch-rewarded-interstitial');
const watchRewardedPopupBtn = document.getElementById('watch-rewarded-popup');
const gcashAmountInput = document.getElementById('gcash-amount');
const gcashNumberInput = document.getElementById('gcash-number');
const requestGcashCashoutBtn = document.getElementById('request-gcash-cashout');
const gcashStatusDiv = document.getElementById('gcash-status');
const transactionHistoryList = document.getElementById('transaction-history');

// --- Global Variables ---
let currentUserId = null;
const MONETAG_REWARD_INTERSTITIAL_AMOUNT = 0.50; // PHP
const MONETAG_REWARD_POPUP_AMOUNT = 0.75; // PHP
const GCASH_MIN_CASHOUT = 50; // PHP

// --- Firebase Functions ---

/**
 * Signs in user anonymously or logs out existing user.
 */
async function handleAuth() {
    if (currentUserId) {
        // User is logged in, log out
        try {
            await signOut(auth);
            alert('You have been signed out.');
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Error signing out. Please try again.');
        }
    } else {
        // User is not logged in, sign in anonymously
        try {
            const userCredential = await signInAnonymously(auth);
            const user = userCredential.user;
            await createUserProfile(user.uid);
            alert('Signed in anonymously!');
        } catch (error) {
            console.error('Error signing in anonymously:', error);
            alert('Error signing in. Please try again.');
        }
    }
}

/**
 * Creates a user profile in Firestore if it doesn't exist.
 * @param {string} uid User ID.
 */
async function createUserProfile(uid) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            userId: uid,
            balance: 0,
            createdAt: serverTimestamp(),
            lastActivity: serverTimestamp()
        });
        console.log(`User profile created for ${uid}`);
    }
}

/**
 * Adds reward to user's balance and logs a transaction.
 * @param {string} uid User ID.
 * @param {number} amount Reward amount.
 * @param {string} type Type of reward (e.g., 'ad_rewarded_interstitial').
 */
async function addReward(uid, amount, type) {
    if (!uid) {
        console.error('No user ID for adding reward.');
        return;
    }
    const userRef = doc(db, 'users', uid);
    try {
        await updateDoc(userRef, {
            balance: window.firebaseSDKs.increment(amount), // Use increment for atomic updates
            lastActivity: serverTimestamp()
        });
        await addDoc(collection(db, `users/${uid}/transactions`), {
            type: type,
            amount: amount,
            timestamp: serverTimestamp(),
            status: 'completed'
        });
        console.log(`Reward of ${amount} added for ${uid}. Type: ${type}`);
    } catch (error) {
        console.error('Error adding reward:', error);
        alert('Failed to add reward. Please contact support.');
    }
}

/**
 * Requests a GCash cash out.
 * @param {string} uid User ID.
 * @param {number} amount Amount to cash out.
 * @param {string} gcashNumber GCash phone number.
 */
async function requestGcashCashout(uid, amount, gcashNumber) {
    if (!uid) {
        alert('Please sign in to request cash out.');
        return;
    }

    if (amount < GCASH_MIN_CASHOUT) {
        alert(`Minimum cash out amount is ${GCASH_MIN_CASHOUT} PHP.`);
        return;
    }

    if (!gcashNumber || !gcashNumber.match(/^09[0-9]{9}$/)) {
        alert('Please enter a valid GCash number (e.g., 09xxxxxxxxx).');
        return;
    }

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        alert('User profile not found.');
        return;
    }

    const currentBalance = userSnap.data().balance;
    if (currentBalance < amount) {
        alert('Insufficient balance for this cash out request.');
        return;
    }

    try {
        // Deduct balance and create withdrawal request in a batch or transaction for atomicity
        await updateDoc(userRef, {
            balance: window.firebaseSDKs.increment(-amount), // Deduct amount
            lastActivity: serverTimestamp()
        });

        await addDoc(collection(db, 'withdrawalRequests'), {
            userId: uid,
            amount: amount,
            gcashNumber: gcashNumber,
            status: 'pending', // 'pending', 'processing', 'completed', 'failed'
            requestedAt: serverTimestamp()
        });

        await addDoc(collection(db, `users/${uid}/transactions`), {
            type: 'gcash_cashout',
            amount: -amount, // Negative for deduction
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        gcashStatusDiv.className = 'status-message success';
        gcashStatusDiv.textContent = `Cash out request for ${amount} PHP to ${gcashNumber} submitted! Please wait for processing.`;
        gcashAmountInput.value = '';
        gcashNumberInput.value = '';

    } catch (error) {
        console.error('Error requesting cash out:', error);
        gcashStatusDiv.className = 'status-message error';
        gcashStatusDiv.textContent = 'Failed to submit cash out request. Please try again.';
    }
}

// --- Monetag Integration ---

/**
 * Shows a rewarded interstitial ad and grants reward upon completion.
 */
async function showRewardedInterstitial() {
    if (!currentUserId) {
        alert('Please sign in to watch ads and earn rewards.');
        return;
    }
    watchRewardedInterstitialBtn.disabled = true;
    watchRewardedInterstitialBtn.textContent = 'Loading Ad...';
    try {
        await show_10276123(); // Monetag Rewarded Interstitial
        await addReward(currentUserId, MONETAG_REWARD_INTERSTITIAL_AMOUNT, 'ad_rewarded_interstitial');
        alert(`You earned ${MONETAG_REWARD_INTERSTITIAL_AMOUNT} PHP!`);
    } catch (e) {
        console.error('Rewarded Interstitial Ad failed:', e);
        alert('Ad failed or was closed early. No reward granted. Please try another ad.');
    } finally {
        watchRewardedInterstitialBtn.disabled = false;
        watchRewardedInterstitialBtn.textContent = 'Watch Reward Ad (0.50 PHP)';
    }
}

/**
 * Shows a rewarded popup ad and grants reward upon completion.
 */
async function showRewardedPopup() {
    if (!currentUserId) {
        alert('Please sign in to watch ads and earn rewards.');
        return;
    }
    watchRewardedPopupBtn.disabled = true;
    watchRewardedPopupBtn.textContent = 'Loading Ad...';
    try {
        await show_10276123('pop'); // Monetag Rewarded Popup
        await addReward(currentUserId, MONETAG_REWARD_POPUP_AMOUNT, 'ad_rewarded_popup');
        alert(`You earned ${MONETAG_REWARD_POPUP_AMOUNT} PHP!`);
    } catch (e) {
        console.error('Rewarded Popup Ad failed:', e);
        alert('Ad failed or was closed early. No reward granted. Please try another ad.');
    } finally {
        watchRewardedPopupBtn.disabled = false;
        watchRewardedPopupBtn.textContent = 'Watch Bonus Ad (0.75 PHP)';
    }
}

/**
 * Initializes the Monetag In-App Interstitial ad.
 * This ad type doesn't require user interaction to trigger rewards,
 * it runs automatically based on configured frequency.
 * Reward logic for this type would typically be based on impressions/views
 * tracked by Monetag and reconciled server-side, or a passive small reward.
 * For this concept, we'll just initialize it as it runs in the background.
 */
function initializeInAppInterstitial() {
    console.log("Initializing In-App Interstitial...");
    show_10276123({
        type: 'inApp',
        inAppSettings: {
            frequency: 2, // show automatically 2 ads
            capping: 0.1, // within 0.1 hours (6 minutes)
            interval: 30, // with a 30-second interval between them
            timeout: 5, // and a 5-second delay before the first one is shown.
            everyPage: false // The last digit, 0, means that the session will be saved when you navigate between pages.
        }
    });
    console.log("In-App Interstitial initialized. Ads will show automatically.");
}


// --- UI Update & Event Listeners ---

/**
 * Updates the user interface with current user data.
 * @param {object} userSnapshot Firestore document snapshot of the user.
 */
function updateUI(userSnapshot) {
    if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        userBalanceDisplay.textContent = userData.balance.toFixed(2);
    } else {
        userBalanceDisplay.textContent = '0.00';
    }
}

/**
 * Updates the transaction history list.
 * @param {Array<object>} transactions An array of transaction data.
 */
function updateTransactionHistory(transactions) {
    transactionHistoryList.innerHTML = ''; // Clear existing
    if (transactions.length === 0) {
        transactionHistoryList.innerHTML = '<li>No recent activity.</li>';
        return;
    }
    transactions.forEach(transaction => {
        const li = document.createElement('li');
        const amountDisplay = transaction.amount > 0 ? `+${transaction.amount.toFixed(2)}` : `${transaction.amount.toFixed(2)}`;
        const amountClass = transaction.amount > 0 ? 'text-success' : 'text-danger';
        li.innerHTML = `
            <span>${transaction.type.replace(/_/g, ' ')}</span>
            <span class="${amountClass}">${amountDisplay} PHP</span>
            <span>${new Date(transaction.timestamp?.toDate()).toLocaleString()}</span>
        `;
        transactionHistoryList.appendChild(li);
    });
}

// Event Listeners
authButton.addEventListener('click', handleAuth);
watchRewardedInterstitialBtn.addEventListener('click', showRewardedInterstitial);
watchRewardedPopupBtn.addEventListener('click', showRewardedPopup);
requestGcashCashoutBtn.addEventListener('click', () => requestGcashCashout(
    currentUserId,
    parseFloat(gcashAmountInput.value),
    gcashNumberInput.value
));

// --- Initialization ---

// Firebase Auth State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in.
        currentUserId = user.uid;
        userIdDisplay.textContent = user.isAnonymous ? `Anon-${user.uid.substring(0, 8)}` : user.email; // Customize for email/pass if used
        authButton.textContent = 'Sign Out';
        authButton.classList.remove('primary');
        authButton.classList.add('secondary');
        
        // Listen to user's balance and transactions in real-time
        const userRef = doc(db, 'users', currentUserId);
        onSnapshot(userRef, (docSnap) => {
            updateUI(docSnap);
        });

        const transactionsRef = collection(db, `users/${currentUserId}/transactions`);
        const q = query(transactionsRef, orderBy('timestamp', 'desc'), limit(5));
        onSnapshot(q, (querySnapshot) => {
            const transactions = [];
            querySnapshot.forEach((doc) => {
                transactions.push(doc.data());
            });
            updateTransactionHistory(transactions);
        });

        initializeInAppInterstitial(); // Initialize in-app interstitial when user is logged in
    } else {
        // User is signed out.
        currentUserId = null;
        userIdDisplay.textContent = 'Guest';
        userBalanceDisplay.textContent = '0.00';
        authButton.textContent = 'Sign In / Register';
        authButton.classList.remove('secondary');
        authButton.classList.add('primary');
        transactionHistoryList.innerHTML = '<li>Please sign in to view your activity.</li>';
        gcashStatusDiv.textContent = ''; // Clear status messages
    }
});

// Initial anonymous sign-in attempt on load if not already signed in
// This is handled by onAuthStateChanged. If no user is found, it presents 'Sign In / Register'.
// User explicitly clicks to sign in anonymously.
