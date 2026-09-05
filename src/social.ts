// Cloud-account + friends service, backed by Firebase Auth + Firestore.
// Everything here is optional: the app runs fully offline without it. Friends
// features light up only once the user signs into a cloud account.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, type User,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, limit,
  onSnapshot, updateDoc, addDoc, writeBatch, runTransaction,
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
  xp?: number;           // published for the friends leaderboard
  streak?: number;
  pro?: boolean;         // Pro features unlocked
  pendingPro?: boolean;  // an admin sent a Pro key; user can redeem it
  banned?: boolean;      // set by an admin
  banReason?: string;
  banUntil?: number;     // 0 = permanent, else timestamp
  role?: string;         // 'admin' | 'mod' | 'user'
}

export interface FriendRequest { fromUid: string; fromUsername: string; fromName: string }
export interface Friend { uid: string; username: string; displayName: string; avatarType?: string; avatarPreset?: string; avatarColor?: string; avatarPhoto?: string; xp?: number; streak?: number }

export interface SharedReminder { id: string; title: string; description: string; triggerAt: number; repeat: string; ownerUid: string; ownerName: string; members: string[]; withName: string }
export interface Space { id: string; name: string; members: string[]; withName: string }
export interface SpaceNote { id: string; x: number; y: number; text: string; colors: string[] }

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
  xp?: number;
  streak?: number;
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
    xp: p.xp ?? 0,
    streak: p.streak ?? 0,
    displayLower: (p.displayName || username).toLowerCase(), // for name search
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

  // Claim the handle atomically so two sign-ups can't grab the same name.
  const unameRef = doc(db, 'usernames', handle);
  await runTransaction(db, async tx => {
    const snap = await tx.get(unameRef);
    if (snap.exists() && snap.data().uid !== uid) throw new Error('That username is already taken.');
    tx.set(unameRef, { uid });
  });
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

// Live subscription to my own account doc (pro / pending / ban status).
export function watchMyDoc(uid: string, cb: (p: CloudProfile | null) => void): () => void {
  return onSnapshot(doc(db, 'users', uid), snap => cb(snap.exists() ? (snap.data() as CloudProfile) : null), () => cb(null));
}

// Redeem a pending Pro grant (only works because an admin set pendingPro; rules enforce this).
export async function redeemPro(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { pro: true, pendingPro: false });
}

// ---- admin actions (rules enforce that only staff/admins can do these) ----
export async function adminSendProKey(uid: string): Promise<void> { await updateDoc(doc(db, 'users', uid), { pendingPro: true }); }
export async function adminRevokePro(uid: string): Promise<void> { await updateDoc(doc(db, 'users', uid), { pro: false, pendingPro: false }); }
export async function adminBan(uid: string, reason: string, until: number): Promise<void> { await updateDoc(doc(db, 'users', uid), { banned: true, banReason: reason, banUntil: until }); }
export async function adminUnban(uid: string): Promise<void> { await updateDoc(doc(db, 'users', uid), { banned: false, banReason: '', banUntil: 0 }); }
export async function adminSetRole(uid: string, role: string): Promise<void> { await updateDoc(doc(db, 'users', uid), { role }); }

// ---- global events / broadcast (one shared config doc everyone reads) ----
export interface GlobalConfig { announce?: string; rushMultiplier?: number; rushEndsAt?: number; updatedBy?: string }
export function watchGlobal(cb: (g: GlobalConfig | null) => void): () => void {
  return onSnapshot(doc(db, 'config', 'global'), snap => cb(snap.exists() ? (snap.data() as GlobalConfig) : null), () => cb(null));
}
export async function adminStartRush(multiplier: number, minutes: number, by: string): Promise<void> {
  await setDoc(doc(db, 'config', 'global'), { rushMultiplier: multiplier, rushEndsAt: Date.now() + minutes * 60000, updatedBy: by }, { merge: true });
}
export async function adminStopRush(): Promise<void> {
  await setDoc(doc(db, 'config', 'global'), { rushMultiplier: 1, rushEndsAt: 0 }, { merge: true });
}
export async function adminSetAnnounce(text: string, by: string): Promise<void> {
  await setDoc(doc(db, 'config', 'global'), { announce: text, updatedBy: by }, { merge: true });
}

// Push the latest local profile up to the cloud (called when settings change).
export async function syncProfile(uid: string, username: string, p: ProfileInput): Promise<void> {
  await setDoc(doc(db, 'users', uid), profileDoc(uid, username, p), { merge: true });
}

// Update the mutable profile fields (name, avatar, stats) WITHOUT touching the
// username handle — used to keep a friend's view + the leaderboard current.
export async function updateMyProfile(uid: string, p: ProfileInput): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    displayName: p.displayName,
    avatarType: p.avatarType,
    avatarPreset: p.avatarPreset,
    avatarColor: p.avatarColor,
    avatarPhoto: p.profileVisible && p.avatarType === 'photo' ? p.avatarPhoto : '',
    photoVisible: !!p.profileVisible,
    xp: p.xp ?? 0,
    streak: p.streak ?? 0,
    displayLower: (p.displayName || '').toLowerCase(),
  });
}

export async function searchUsers(term: string, selfUid: string): Promise<CloudProfile[]> {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  // prefix-match either the @username handle or the display name
  const byField = async (field: string): Promise<CloudProfile[]> => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where(field, '>=', t), where(field, '<=', t + ''), limit(15)));
      return snap.docs.map(d => d.data() as CloudProfile);
    } catch { return []; }
  };
  const [byHandle, byName] = await Promise.all([byField('username'), byField('displayLower')]);
  const map = new Map<string, CloudProfile>();
  [...byHandle, ...byName].forEach(u => { if (u.uid !== selfUid) map.set(u.uid, u); });
  return [...map.values()].slice(0, 15);
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
  // Both friendship edges + the request removal in ONE atomic batch, so a
  // friendship can never end up one-sided (it either fully commits or not).
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', me.uid, 'friends', from.fromUid), { uid: from.fromUid, username: from.fromUsername, displayName: from.fromName });
  batch.set(doc(db, 'users', from.fromUid, 'friends', me.uid), { uid: me.uid, username: me.username, displayName: me.displayName });
  batch.delete(doc(db, 'users', me.uid, 'requests', from.fromUid));
  await batch.commit();
}

// Self-heal: guarantee every friend also has ME in their friends list. Fixes any
// one-sided friendships left over from earlier, and makes it truly two-way.
export async function ensureMutual(me: CloudProfile, friends: Friend[]): Promise<void> {
  if (!friends.length) return;
  const batch = writeBatch(db);
  for (const f of friends) {
    batch.set(doc(db, 'users', f.uid, 'friends', me.uid), { uid: me.uid, username: me.username, displayName: me.displayName }, { merge: true });
  }
  await batch.commit();
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
      ? { uid: prof.uid, username: prof.username, displayName: prof.displayName, avatarType: prof.avatarType, avatarPreset: prof.avatarPreset, avatarColor: prof.avatarColor, avatarPhoto: prof.photoVisible ? prof.avatarPhoto : '', xp: prof.xp ?? 0, streak: prof.streak ?? 0 }
      : base);
  }
  return friends;
}

export async function removeFriend(myUid: string, friendUid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', myUid, 'friends', friendUid));
  batch.delete(doc(db, 'users', friendUid, 'friends', myUid));
  await batch.commit();
}

// Live friends list (updates on both devices the moment a request is accepted).
export function watchFriends(uid: string, cb: (list: Friend[]) => void): () => void {
  return onSnapshot(collection(db, 'users', uid, 'friends'), async snap => {
    const out: Friend[] = [];
    for (const d of snap.docs) {
      const base = d.data() as Friend;
      const prof = await getProfile(base.uid);
      out.push(prof
        ? { uid: prof.uid, username: prof.username, displayName: prof.displayName, avatarType: prof.avatarType, avatarPreset: prof.avatarPreset, avatarColor: prof.avatarColor, avatarPhoto: prof.photoVisible ? prof.avatarPhoto : '', xp: prof.xp ?? 0, streak: prof.streak ?? 0 }
        : base);
    }
    cb(out);
  }, () => cb([]));
}

// Live incoming friend requests.
export function watchRequests(uid: string, cb: (list: FriendRequest[]) => void): () => void {
  return onSnapshot(collection(db, 'users', uid, 'requests'), snap => cb(snap.docs.map(d => d.data() as FriendRequest)), () => cb([]));
}

// ============================================================
// SHARING — shared reminders + co-edited notepad spaces (realtime).
// ============================================================
const otherMemberName = (data: any, uid: string): string => {
  const other = (data.members || []).find((m: string) => m !== uid);
  return (data.memberNames && data.memberNames[other]) || data.ownerName || 'Friend';
};

export async function createSharedReminder(me: CloudProfile, friend: Friend, r: { title: string; description: string; triggerAt: number; repeat: string }): Promise<void> {
  await addDoc(collection(db, 'sharedReminders'), {
    title: r.title, description: r.description, triggerAt: r.triggerAt, repeat: r.repeat || 'none',
    ownerUid: me.uid, ownerName: me.displayName,
    members: [me.uid, friend.uid],
    memberNames: { [me.uid]: me.displayName, [friend.uid]: friend.displayName },
    createdAt: Date.now(),
  });
}

// Live list of shared reminders that include me.
export function watchSharedReminders(uid: string, cb: (list: SharedReminder[]) => void): () => void {
  const q = query(collection(db, 'sharedReminders'), where('members', 'array-contains', uid));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, title: data.title, description: data.description || '', triggerAt: data.triggerAt, repeat: data.repeat || 'none', ownerUid: data.ownerUid, ownerName: data.ownerName, members: data.members || [], withName: otherMemberName(data, uid) };
    }));
  }, () => cb([]));
}

export async function updateSharedReminder(id: string, patch: any): Promise<void> { await updateDoc(doc(db, 'sharedReminders', id), patch); }
export async function deleteSharedReminder(id: string): Promise<void> { await deleteDoc(doc(db, 'sharedReminders', id)); }

// ---- shared notepad spaces ----
export async function createSpace(me: CloudProfile, friend: Friend): Promise<string> {
  const ref = await addDoc(collection(db, 'spaces'), {
    name: `${me.displayName} & ${friend.displayName}`,
    members: [me.uid, friend.uid],
    memberNames: { [me.uid]: me.displayName, [friend.uid]: friend.displayName },
    createdAt: Date.now(),
  });
  return ref.id;
}

export function watchSpaces(uid: string, cb: (list: Space[]) => void): () => void {
  const q = query(collection(db, 'spaces'), where('members', 'array-contains', uid));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => { const data = d.data() as any; return { id: d.id, name: data.name, members: data.members || [], withName: otherMemberName(data, uid) }; }));
  }, () => cb([]));
}

export async function deleteSpace(spaceId: string): Promise<void> { await deleteDoc(doc(db, 'spaces', spaceId)); }

export function watchSpaceNotes(spaceId: string, cb: (notes: SpaceNote[]) => void): () => void {
  return onSnapshot(collection(db, 'spaces', spaceId, 'notes'), snap => {
    cb(snap.docs.map(d => { const data = d.data() as any; return { id: d.id, x: data.x, y: data.y, text: data.text || '', colors: data.colors || ['#C8553D'] }; }));
  }, () => cb([]));
}

export async function setSpaceNote(spaceId: string, note: SpaceNote): Promise<void> {
  const { id, ...data } = note;
  await setDoc(doc(db, 'spaces', spaceId, 'notes', id), data, { merge: true });
}
export async function deleteSpaceNote(spaceId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'spaces', spaceId, 'notes', noteId));
}
