(function() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const next = params.get("next") || "dashboard.html";
    const statusEl = document.getElementById("status");

    const LOGIN_PAGE = "/login/login.html";

    function goToLogin(message) {
        if (statusEl) statusEl.textContent = message || "Redirecting to login...";
        setTimeout(() => {
            window.location.href = LOGIN_PAGE;
        }, 2000);
        window.location.href = LOGIN_PAGE;
    }


if (!token) {
    goToLogin("No token provided. Redirecting to login...");
    return;
}

twAuth.signInWithCustomToken(token)
    .then(() => {
        window.location.href = next;
    })
    .catch((err) => {
        console.error("Token sign-in failed:", err);
        goToLogin("Invalid token. Redirecting to login...");
    });
})();
