// Cloud-account + friends service, backed by Firebase Auth + Firestore.
// Everything here is optional: the app runs fully offline without it. Friends
// features light up only once the user signs into a cloud account.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, type User,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, limit,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export interface CloudProfile {
  uid: string;
  username: string;      // lowercased handle, unique
  displayName: string;
  avatarType: 'monogram' | 'preset' | 'photo';
  avatarPreset: string;
  avatarColor: string;
  avatarPhoto: string;   // '' unless the user shares it (profileVisible)
  photoVisible: boolean;
}

export interface FriendRequest { fromUid: string; fromUsername: string; fromName: string }
export interface Friend { uid: string; username: string; displayName: string; avatarType?: string; avatarPreset?: string; avatarColor?: string; avatarPhoto?: string }

export const currentUid = (): string | null => auth.currentUser?.uid ?? null;

export function watchCloudAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

// ---- profile fields the caller supplies (from local settings) ----
export interface ProfileInput {
  displayName: string;
  avatarType: 'monogram' | 'preset' | 'photo';
  avatarPreset: string;
  avatarColor: string;
  avatarPhoto: string;
  profileVisible: boolean;
}

function profileDoc(uid: string, username: string, p: ProfileInput) {
  return {
    uid,
    username,
    displayName: p.displayName || username,
    avatarType: p.avatarType,
    avatarPreset: p.avatarPreset,
    avatarColor: p.avatarColor,
    // only publish the photo when the user has opted in
    avatarPhoto: p.profileVisible && p.avatarType === 'photo' ? p.avatarPhoto : '',
    photoVisible: !!p.profileVisible,
  };
}

export async function cloudSignUp(email: string, password: string, username: string, p: ProfileInput): Promise<CloudProfile> {
  const handle = username.trim().toLowerCase();
  if (handle.length < 2) throw new Error('Pick a username of at least 2 characters.');

  // Create the account (this also signs the user in). If the email already
  // exists — e.g. from an earlier attempt that didn't finish — sign in instead
  // and finish setting up the profile, so "Create account" always lands them in.
  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    uid = cred.user.uid;
  } catch (e: any) {
    if (e?.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      uid = cred.user.uid;
      const existingProfile = await getProfile(uid);
      if (existingProfile) return existingProfile; // already fully set up
    } else {
      throw e;
    }
  }

  const unameRef = doc(db, 'usernames', handle);
  const existing = await getDoc(unameRef);
  if (existing.exists() && existing.data().uid !== uid) {
    throw new Error('That username is already taken.');
  }
  await setDoc(unameRef, { uid });
  const data = profileDoc(uid, handle, p);
  await setDoc(doc(db, 'users', uid), data);
  return data;
}

export async function cloudSignIn(email: string, password: string): Promise<CloudProfile | null> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return getProfile(cred.user.uid);
}

export async function cloudSignOut(): Promise<void> { await signOut(auth); }

export async function getProfile(uid: string): Promise<CloudProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as CloudProfile) : null;
}

// Push the latest local profile up to the cloud (called when settings change).
export async function syncProfile(uid: string, username: string, p: ProfileInput): Promise<void> {
  await setDoc(doc(db, 'users', uid), profileDoc(uid, username, p), { merge: true });
}

export async function searchUsers(term: string, selfUid: string): Promise<CloudProfile[]> {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const q = query(
    collection(db, 'users'),
    where('username', '>=', t),
    where('username', '<=', t + ''),
    limit(15),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CloudProfile).filter(u => u.uid !== selfUid);
}

export async function sendFriendRequest(me: CloudProfile, toUid: string): Promise<void> {
  await setDoc(doc(db, 'users', toUid, 'requests', me.uid), {
    fromUid: me.uid, fromUsername: me.username, fromName: me.displayName,
  });
}

export async function listIncomingRequests(uid: string): Promise<FriendRequest[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'requests'));
  return snap.docs.map(d => d.data() as FriendRequest);
}

export async function acceptFriendRequest(me: CloudProfile, from: FriendRequest): Promise<void> {
  // write the friendship on both sides, then clear the request
  await setDoc(doc(db, 'users', me.uid, 'friends', from.fromUid), {
    uid: from.fromUid, username: from.fromUsername, displayName: from.fromName,
  });
  await setDoc(doc(db, 'users', from.fromUid, 'friends', me.uid), {
    uid: me.uid, username: me.username, displayName: me.displayName,
  });
  await deleteDoc(doc(db, 'users', me.uid, 'requests', from.fromUid));
}

export async function declineFriendRequest(myUid: string, fromUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', myUid, 'requests', fromUid));
}

export async function listFriends(uid: string): Promise<Friend[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'friends'));
  // hydrate each friend's current public profile (for up-to-date avatar/name)
  const friends: Friend[] = [];
  for (const d of snap.docs) {
    const base = d.data() as Friend;
    const prof = await getProfile(base.uid);
    friends.push(prof
      ? { uid: prof.uid, username: prof.username, displayName: prof.displayName, avatarType: prof.avatarType, avatarPreset: prof.avatarPreset, avatarColor: prof.avatarColor, avatarPhoto: prof.photoVisible ? prof.avatarPhoto : '' }
      : base);
  }
  return friends;
}

export async function removeFriend(myUid: string, friendUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', myUid, 'friends', friendUid));
  await deleteDoc(doc(db, 'users', friendUid, 'friends', myUid));
}
