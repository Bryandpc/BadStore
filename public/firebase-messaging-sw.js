importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAsJI-5NFRZf29lP-IDThBoIyqf3t3fLoY',
  authDomain: 'badtcg-aac68.firebaseapp.com',
  projectId: 'badtcg-aac68',
  storageBucket: 'badtcg-aac68.firebasestorage.app',
  messagingSenderId: '948283160238',
  appId: '1:948283160238:web:ca2d2616223b8128861f3f',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification ?? {}
  if (!title) return
  self.registration.showNotification(title, {
    body: body ?? '',
    icon: '/logo-gengar.png',
    badge: '/logo-gengar.png',
    data: payload.data ?? {},
  })
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus()
      return clients.openWindow('/meus-pedidos')
    })
  )
})
