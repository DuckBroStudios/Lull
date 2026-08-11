// Firebase setup for Lull's optional cloud account (powers the friends feature).
// The local reminder/notepad/gamification app keeps working fully offline — this
// only activates when the user signs into a cloud account for social features.
//
// These keys are safe to ship in the client; Firestore security rules are what
// actually protect the data.
import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC0BFgNYsvjnVNX9dar2-mrjjGZntZfSWY',
  authDomain: 'lull-72471.firebaseapp.com',
  projectId: 'lull-72471',
  storageBucket: 'lull-72471.firebasestorage.app',
  messagingSenderId: '26579045229',
  appId: '1:26579045229:web:236c1a60e72b53d198a864',
};

export const firebaseApp = initializeApp(firebaseConfig);
// Persist the login locally so the user only signs in once — the session is
// restored automatically on every future launch (indexedDB, with a localStorage
// fallback for environments where indexedDB isn't available).
export const auth = initializeAuth(firebaseApp, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
// Force long-polling instead of the streaming WebChannel transport. Electron
// (and some iOS webviews / restricted networks) block the streaming connection,
// which makes Firestore wrongly report the client as "offline". Long-polling
// uses plain HTTPS requests that work everywhere.
export const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true });
