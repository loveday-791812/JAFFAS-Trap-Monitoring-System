(function () {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    const LOGIN_URL = "/Login/login.html";
    const DENIED_URL = "/unauthorized.html"; //Aaron: unautorized redirect page
    const KNOWN_ROLES = ["admin", "manager", "worker"];//Aaron: known roles for the dashboard

    function goToLogin() {
        window.location.href = LOGIN_URL;
    }

    function filterNav(role) { //Aaron: filter the navigation links based on the user's role
        document.querySelectorAll(".tw-nav a").forEach((link) => {
            const href = link.getAttribute("href") || "";
            if (href.includes("recipients.html") && role !== "admin") link.style.display = "none"; //Aaron: hide the recipients link if the user is not an admin
            if (href.includes("traps.html") && role !== "admin" && role !== "manager") link.style.display = "none"; //Aaron: hide the traps link if the user is not an admin or manager
        });
        const nav = document.querySelector(".tw-nav");
        if (nav) { nav.classList.add("ready"); nav.style.visibility = "visible"; } //Aaron: show the navigation links after filtering
    }

    function goToDenied(reason) {
    window.location.href = `${DENIED_URL}?reason=${reason}`;
    }

    let __resolveReady;
    const twAuthReady = new Promise((r) => { __resolveReady = r; });
    function resolveReady(user) { __resolveReady(user); }

    async function afterLogin(user) { //Aaron: after the user is logged in, check if they have the required role and filter the navigation links
        let role;
        try {//Aaron: try to get the role of the user
            role = await getRole(user);
        } catch (err) {
            console.error("Failed to validate user role:", err);
            alert("Could not verify your role.");
            return goToDenied("error");
        }
        if (role === "pending") return goToDenied("pending"); //Aaron F: The user at this satge has signed up and is waiting for the admin to approve tthe account
        if (!KNOWN_ROLES.includes(role)) return goToDenied("norole");


        const required = document.body.getAttribute("data-required-role");//Aaron: get the required role from the data attribute of the body element
        if (required) {
            const allowed = required.split(",").map((r) => r.trim().toLowerCase()); //Aaron: split the required roles by comma and trim whitespace and convert to lowercase
            if (!allowed.includes(role)) {
                alert("You don't have permission to view that page.");
                return goToDenied("role"); //Aaron F: The role is known but the page doesnt allow it.
            }
        }
        window.twCurrentRole = role; //Aaron F: the page adapts to the role, cosmetic only as the database enfoorces access
        filterNav(role); //Aaron: filter the navigation links based on the user's role
        document.body.classList.add("tw-auth-ok"); //Aaron: make the page visible
        resolveReady(user); //Aaron: resolve the twAuthReady promise with the user object and load datat scriipt
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