import { createContext, useContext, useEffect, useState } from 'react'
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { app, db, storage } from '../firebase'

const auth = getAuth(app)
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = carregando
  const [profile, setProfile] = useState(null) // { name, phone, photoUrl }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        setProfile(snap.exists() ? snap.data() : null)
      } else {
        setProfile(null)
      }
    })
    return () => unsub()
  }, [])

  const register = (email, password, name) =>
    createUserWithEmailAndPassword(auth, email, password).then(({ user }) =>
      updateProfile(user, { displayName: name })
    )

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const loginGoogle = () =>
    signInWithPopup(auth, new GoogleAuthProvider())

  const logout = () => signOut(auth)

  const saveProfile = async ({ name, phone, photoUrl }) => {
    if (!auth.currentUser) return
    const data = { name, phone, photoUrl: photoUrl ?? null, updatedAt: serverTimestamp() }
    await setDoc(doc(db, 'users', auth.currentUser.uid), data, { merge: true })
    setProfile(prev => ({ ...(prev ?? {}), ...data }))
    if (name !== auth.currentUser.displayName) {
      await updateProfile(auth.currentUser, { displayName: name })
    }
  }

  const uploadProfilePhoto = async (file) => {
    if (!auth.currentUser) return null
    const storageRef = ref(storage, `profile-photos/${auth.currentUser.uid}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(auth.currentUser, { photoURL: url })
    return url
  }

  return (
    <AuthContext.Provider value={{ user, profile, register, login, loginGoogle, logout, saveProfile, uploadProfilePhoto }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
