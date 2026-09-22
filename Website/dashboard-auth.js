(function () {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    function goToLogin() {
        window.location.href = "../Login/Login Front-End/login.html";
    }

    async function signInWithToken(token) {
        try {
            const res = await fetch(TW_FUNCTIONS.magicLogin, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "This link is invalid or has expired.");

            await twAuth.signInWithCustomToken(data.customToken);

            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
            alert(err.message);
            goToLogin();
        }
    }

    if (token) {
        signInWithToken(token);
    } else {
        twAuth.onAuthStateChanged((user) => {
            if (!user) goToLogin();
        });
    }
})();