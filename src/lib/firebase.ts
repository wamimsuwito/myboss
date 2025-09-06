// This file is now configured for a real Firebase project.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, Timestamp, query, where, limit, orderBy, runTransaction, FieldValue, increment, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDf7LyBES-QM4GaqxCQIIjMFlxKRtXyQvg",
    authDomain: "mymanager-a17ba.firebaseapp.com",
    projectId: "mymanager-a17ba",
    storageBucket: "mymanager-a17ba.firebasestorage.app",
    messagingSenderId: "1081214026393",
    appId: "1:1081214026393:web:401a81a833c3ac1dc5ae08",
    measurementId: "G-Y460R3EJ4V"
};

// Initialize Firebase.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Initialize Analytics if supported
const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);


export { 
    db,
    analytics,
    collection, 
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    getDocs,
    getDoc,
    addDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    query,
    where,
    limit,
    orderBy,
    runTransaction,
    FieldValue,
    increment,
    writeBatch
};
