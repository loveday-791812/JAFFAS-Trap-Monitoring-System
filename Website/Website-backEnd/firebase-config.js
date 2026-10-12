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
const rtdb = firebase.database();

const TW_FUNCTIONS = {
    signup: "/api/signup",
    resendCode: "/api/resendCode",
    verifyCode: "/api/verifyCode",
    magicLogin: "/api/magicLogin",
    requestPasswordReset: "/api/requestPasswordReset",
    resetPassword: "/api/resetPassword",
    adminUsers: "/api/adminUsers",
    deleteMyAccount: "/api/deleteMyAccount",
};

   /* Local testing only: on the Hosting emulator (localhost), use the local Auth and Database emulators instead of the live project. */
   if (["localhost", "127.0.0.1"].includes(location.hostname)) {
       if (firebase.auth) firebase.auth().useEmulator("http://127.0.0.1:9099");
       if (firebase.database) firebase.database().useEmulator("127.0.0.1", 9000);
   }

/*Aaron F: function to make the database text safe to be put inside html*/

function twEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/*Aaron F: POSTS to functions as the signed in users, the server will check ID tooken and role for verification*/
async function twAuthPost(functionName, body = {}) {
    const user = twAuth.currentUser;
    if (!user) throw new Error("Your are currently signed out. Sign in and then retry");
    const idToken = await user.getIdToken();
    const res = await fetch(TW_FUNCTIONS[functionName], {
        method: "POST",
        headers: { "Content-Type": "application/json",  Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please refresh and try again");
    return data;
    
}

async function getRole(user) {
    const snap = await rtdb.ref(`users/${user.uid}`).get();
    const profile = snap.val() || {};
    return (profile.role || "").toLowerCase();
}