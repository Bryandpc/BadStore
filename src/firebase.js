import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAsJI-5NFRZf29lP-IDThBoIyqf3t3fLoY',
  authDomain: 'badtcg-aac68.firebaseapp.com',
  projectId: 'badtcg-aac68',
  storageBucket: 'badtcg-aac68.firebasestorage.app',
  messagingSenderId: '948283160238',
  appId: '1:948283160238:web:ca2d2616223b8128861f3f',
  measurementId: 'G-4TC4KK341J',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
