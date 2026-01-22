import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
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
const db = getFirestore(app);

// Telegram WebApp Setup
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user;
const userId = user ? user.id.toString() : "test_user";

// DOM Elements
const balanceEl = document.getElementById('balance');
const statusEl = document.getElementById('status');

// Load User Balance on Start
async function loadUserData() {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        balanceEl.innerText = `₱ ${userSnap.data().balance.toFixed(2)}`;
    } else {
        await setDoc(userRef, { 
            balance: 0, 
            username: user?.username || "Guest",
            lastUpdate: Date.now() 
        });
        balanceEl.innerText = `₱ 0.00`;
    }
}

// Global Show Ad Function
window.showAd = async function(blockId) {
    statusEl.innerText = "Loading Ad...";
    
    const AdController = window.AdsGram.init({ blockId: blockId });

    AdController.show().then(async (result) => {
        // User watched the ad successfully
        statusEl.innerText = "Ad completed! Rewarding...";
        await rewardUser();
    }).catch((result) => {
        // Ad failed or was skipped
        console.error("Ad Error:", result);
        statusEl.innerText = "Ad not finished. No reward.";
        tg.showAlert("You must watch the full ad to get ₱0.02");
    });
};

// Update Balance in Firestore
async function rewardUser() {
    const userRef = doc(db, "users", userId);
    try {
        await updateDoc(userRef, {
            balance: increment(0.02),
            lastUpdate: Date.now()
        });
        
        // Refresh local UI
        const updatedSnap = await getDoc(userRef);
        balanceEl.innerText = `₱ ${updatedSnap.data().balance.toFixed(2)}`;
        statusEl.innerText = "Reward added! +₱0.02";
        tg.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        console.error("Firestore Error:", error);
        statusEl.innerText = "Error saving reward.";
    }
}

// Initial Load
loadUserData();
