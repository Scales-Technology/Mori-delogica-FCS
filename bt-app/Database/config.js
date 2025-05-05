import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'

// const firebaseConfig = {
//   apiKey: "AIzaSyDpAX3quNzJbYb5uIr3_2-BKqOKS7gkpaA",
//   authDomain: "rwanda-air.firebaseapp.com",
//   projectId: "rwanda-air",
//   storageBucket: "rwanda-air.appspot.com",
//   messagingSenderId: "833250541422",
//   appId: "1:833250541422:web:b1818dc5422aeae350cb7f",
//   measurementId: "G-QM91ELCZ5D"
// };
const firebaseConfig = {
  apiKey: "AIzaSyDTFQt3jJc0lp-dOwLF4BaFCJPJOeVgJdo",
  authDomain: "happysausage-application.firebaseapp.com",
  databaseURL: "https://happysausage-application-default-rtdb.firebaseio.com",
  projectId: "happysausage-application",
  storageBucket: "happysausage-application.firebasestorage.app",
  messagingSenderId: "429663349448",
  appId: "1:429663349448:web:00478dcd67d5cd40d113fd",
  measurementId: "G-6V8GCS71FZ"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const firebaseApp = app;

const db = getFirestore(app);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});


export { db, auth};