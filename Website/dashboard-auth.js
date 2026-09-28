(function () {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    const LOGIN_URL = "/Login/Login Front-End/login.html";

    function goToLogin() {
        window.location.href = LOGIN_URL;
    }

    async function enforceRole(user) {
        const required = document.body.getAttribute("data-required-role");
        if (!required) return true;
    

    const allowed = required.split(",").map((r) => r.trim().toLowerCase());

    try {
        const snap = await rtdb.ref(`users/${user.uid}`).get();
        const profile = snap.val() || {};
        const role = (profile.role || "").toLowerCase();

        if (!allowed.includes(role)) {
            alert("You don't have permission to view that page.");
            window.location.href = "/dashboard.html";
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