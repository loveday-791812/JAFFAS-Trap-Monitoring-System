const firebaseConfig = {
    apiKey: "AIzaSyClXxRuzYNSg54oPuM5V-ONfqqK3vE2TWs",
    authDomain: "trap-watch.firebaseapp.com",
    databaseURL: "https://trap-watch-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "trap-watch",
    storageBucket: "trap-watch.firebasestorage.app",
    messagingSenderId: "341027839035",
    appId: "1:341027839035:web:25cf1a86cd9e43a9c6101e",
};

firebase.initializeApp(firebaseConfig);
const twAuth = firebase.auth();

const TW_FUNCTIONS = {
    signup: "https://us-central1-trap-watch.cloudfunctions.net/signup",
    resendCode: "https://us-central1-trap-watch.cloudfunctions.net/resendCode",
    verifyCode: "https://us-central1-trap-watch.cloudfunctions.net/verifyCode",
    magicLogin: "https://us-central1-trap-watch.cloudfunctions.net/magicLogin",
};