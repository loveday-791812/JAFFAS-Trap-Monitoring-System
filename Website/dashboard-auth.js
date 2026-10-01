(function () {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    const LOGIN_URL = "/Website/Login/Login Front-End/login.html";
    const DENIED_URL = "/unauthorized.html"; //Aaron: unautorized redirect page
    const KNOWN_ROLES = ["admin", "manager", "worker"];//Aaron: known roles for the dashboard

    let resolveReady;
    window.twAuthReady = new Promise((resolve) => { resolveReady = resolve; }); //Aaron: make sure the auth is ready before doing anything witth the database

    function goToLogin() { window.location.replace(LOGIN_URL); } //Aaron: redirect to login page
       function goToDenied(reason) { window.location.replace(`${DENIED_URL}?reason=${reason}`); } //Aaron: redirect to denied page with reason

    //function goToLogin() {
    //    window.location.href = LOGIN_URL;
    //} Aaron: redirect to login page old

    //async function enforceRole(user) {
    //    const required = document.body.getAttribute("data-required-role");
    //    if (!required) return true; Aaron: if no required role is specified it allow access old

    async function getrole(user) { //Aaron: get the role of the user from the database
        const snap = await rtdb.ref(`users/${user.uid}/role`).get(); //Aaron: get the role of the user from the database
        return String(snap.val() || "").toLowerCase(); //Aaron: return the role of the user in lowercase

    const allowed = required.split(",").map((r) => r.trim().toLowerCase());

    try {
        const snap = await rtdb.ref(`users/${user.uid}`).get();
        const profile = snap.val() || {};
        const role = (profile.role || "").toLowerCase();

        if (!allowed.includes(role)) {
            alert("You don't have permission to view that page.");
            window.location.href = "/Website/dashboard.html";
            return false;
        }
        return true;
    } catch (err) {
        console.error("Role check failed:", err);
        alert("Could not verify your permissions.");
        goToLogin();
        return false;
    }
}

async function filterNav(user) {
    const nav = document.querySelector(".tw-nav");

    try {
        const snap = await rtdb.ref(`users/${user.uid}`).get();
        const role = ((snap.val() || {}).role || "").toLowerCase();

        document.querySelectorAll(".tw-nav a").forEach((link) => {
            const href = link.getAttribute("href") || "";

            if (href.includes("recipients.html") && role !== "admin") {
                link.style.display = "none";
            }

            if (href.includes("traps.html") && role !== "admin" && role !== "manager") {
                link.style.display = "none";
            }
        });
    } catch (err) {
        console.error("Nav filter failed:", err);
    } finally {
        if (nav) {
        requestAnimationFrame(() => {
            nav.classList.add("ready");
            nav.style.visibility = "visible";
        }); 
    }
}
}

async function afterLogin(user) {
    const ok = await enforceRole(user);
    if (!ok) return;
    await filterNav(user);
}

async function signInWithToken(tok) {
    try {
        const res = await fetch(TW_FUNCTIONS.magicLogin, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tok}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "This link is invalid or has expired.");

        await twAuth.signInWithCustomToken(data.customToken);

        window.history.replaceState({}, document.title, window.location.pathname);

        const user = twAuth.currentUser;
        if (user) await afterLogin(user);
    } catch (err) {
        alert(err.message);
        goToLogin();
    }
}

if (token) {
    signInWithToken(token);
} else {
    twAuth.onAuthStateChanged(async (user) => {
        if (!user) {
            goToLogin();
            return;
        }
        await afterLogin(user);
    });
}
})();