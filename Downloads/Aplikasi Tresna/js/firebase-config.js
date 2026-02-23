/**
 * LAK Puskesmas - Firebase Configuration & Authentication
 * Placeholder configuration for Cloud Sync feature.
 */

// Replace this configuration with your own Firebase Project settings
const firebaseConfig = {
    apiKey: "AIzaSyBnsfHtlwdMTjN-_5_NF7OgL2bJyozE0pE",
    authDomain: "laporan-lak-puskesmas.firebaseapp.com",
    projectId: "laporan-lak-puskesmas",
    storageBucket: "laporan-lak-puskesmas.firebasestorage.app",
    messagingSenderId: "54954305854",
    appId: "1:54954305854:web:d9bfd78a459ee34eaf246f",
    measurementId: "G-6JDQ0VG8Z2"
};

// Initialize Firebase
let app, db, auth;
let currentUserId = null;

try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();

    // Auto sign-in anonymously to create an identity for this device/user
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("Firebase Auth: Signed in as", currentUserId);
        } else {
            auth.signInAnonymously()
                .catch((error) => {
                    console.error("Firebase Anonymous Auth failed:", error);
                });
        }
    });

} catch (error) {
    console.warn("Firebase configuration is missing or invalid. Cloud Sync will not work until setup is complete.");
}

const FirebaseManager = {
    isConfigured: () => {
        return firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
    },

    getUserId: () => {
        return currentUserId;
    },

    getDb: () => {
        return db;
    }
};

window.FirebaseManager = FirebaseManager;
