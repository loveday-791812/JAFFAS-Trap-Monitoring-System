// Signs a user in from a link containing ?token=...
// then sends them to the page in ?next=( defaults to dashbaord)

(function() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const next = params.get("next") || "dashboard.html";
    const statusEl = document.getElementById("status");

    const LOGIN_PAGE = "/Login/login.html";

    // Shows a message and redirects to the normal login page
    function goToLogin(message) {
        if (statusEl) statusEl.textContent = message || "Redirecting to login...";
        setTimeout(() => {
            window.location.href = LOGIN_PAGE;
        }, 2000);
        window.location.href = LOGIN_PAGE;
    }

// No token ine link, so there is nothing to sign in with
if (!token) {
    goToLogin("No token provided. Redirecting to login...");
    return;
}

// Sign in with the Firebase custom token, then continue to the requested page
twAuth.signInWithCustomToken(token)
    .then(() => {
        window.location.href = next;
    })
    .catch((err) => {
        console.error("Token sign-in failed:", err);
        goToLogin("Invalid token. Redirecting to login...");
    });
})();
