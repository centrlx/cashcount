const firebaseConfig = {
  apiKey:            "AIzaSyBdflTo4CSv2-fmdrZv5M7qUOzY08qUsYs",
  authDomain:        "cashcount-79922.firebaseapp.com",
  projectId:         "cashcount-79922",
  storageBucket:     "cashcount-79922.firebasestorage.app",
  messagingSenderId: "341689199240",
  appId:             "1:341689199240:web:4a75c2b0a3a169741e4d3d"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();
