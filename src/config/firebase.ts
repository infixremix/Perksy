import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDb8wYhrCvSJryWSum4vCxjEaC9vnYy1aE",
  authDomain: "perksly-7f6a8.firebaseapp.com",
  projectId: "perksly-7f6a8",
  storageBucket: "perksly-7f6a8.firebasestorage.app",
  messagingSenderId: "844666055650",
  appId: "1:844666055650:web:93909ff1c1a86a600767bb",
  measurementId: "G-ECWKHE2S6B"
};

// Initialize Firebase
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);

// Handle auth state changes and persistence
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      await AsyncStorage.setItem('authState', JSON.stringify({
        uid: user.uid,
        email: user.email,
        token: await user.getIdToken()
      }));
    } catch (error) {
      console.error('Error storing auth state:', error);
    }
  } else {
    try {
      await AsyncStorage.removeItem('authState');
    } catch (error) {
      console.error('Error removing auth state:', error);
    }
  }
});

// Function to restore auth state
const restoreAuthState = async () => {
  try {
    const authState = await AsyncStorage.getItem('authState');
    if (authState) {
      const { token } = JSON.parse(authState);
      if (token) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error restoring auth state:', error);
    return false;
  }
};

export { auth, db, restoreAuthState }; 