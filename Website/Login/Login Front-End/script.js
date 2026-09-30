/*===TrapWatch===*/
/*- Password Visibility -*/
function togglePassword(fieldID, button) {
    const field = document.getElementById(fieldID);
    if(field.type === "password") {
        field.type = "text";
        button.textContent = "◉";
    } else {
        field.type = "password";
        button.textContent = "👁";
    }
}

async function twPost(functionName, body){
    const url = TW_FUNCTIONS[functionName];
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
    }
    return data;
}

/*- Signup Form -*/
const signupForm = document.getElementById("signupForm");
if (signupForm) {
signupForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email =
        document.getElementById("email").value.trim();
    const password =
        document.getElementById("password").value;
    const confirmPassword =
        document.getElementById("confirmPassword").value;
    const selectedRole =
        document.querySelector('input[name="role"]:checked');
    const submitBtn = document.getElementById("signupSubmitBtn");

    /*- Check Passwords -*/
    if(password !== confirmPassword) {
        alert("Your passwords do not match.");
        return;
    }
    if (password.length < 8){
        alert("Password must be at least 8 characters");
        return;
    }
    /*- Check Role -*/
    if(!selectedRole) {
        alert("Please select a role.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent= "Creating account...";

    try {
        const data = await twPost("signup", {
            email,
            password,
            role: selectedRole.value,
        });

        document.getElementById("verifyUid").value = data.uid;

        signupForm.style.display = "none";
        document.getElementById("verifyForm").style.display = "block";
        }catch (err) {
            alert(err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account";
        }
    });
}

const verifyForm = document.getElementById("verifyForm");
if (verifyForm) {
    verifyForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const uid = document.getElementById("verifyUid").value;
        const code = document.getElementById("verifyCode").value.trim();
        const submitBtn = document.getElementById("verifySubmitBtn");

        submitBtn.disabled = true;
        submitBtn.textContent = "Confirming...";

        try {
            const data = await twPost("verifyCode", {uid, code});
            window.location.href = `/dashboard.html?token=${encodeURIComponent(data.token)}`;
        } catch (err) {
            alert(err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = "Confirm";
        }
    });
}

const resendCodeLink = document.getElementById("resendCodeLink");
if (resendCodeLink) {
    resendCodeLink.addEventListener("click", async function (event){
        event.preventDefault();
        const uid = document.getElementById("verifyUid").value;

        try {
            await twPost("resendCode", { uid });
            alert("A new code has been sent to your email.");
        }   catch (err) {
            alert(err.message);
        }
    });
}

/*- Login Form -*/
const loginForm = document.getElementById("loginForm");
if(loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        submitBtn.disabled = true;

        try {
            await twAuth.signInWithEmailAndPassword(email, password);
            window.location.href = "/dashboard.html";
        }   catch (err) {
            alert("Login failed: " + err.message);
        }   finally {
            submitBtn.disabled = false;
        }
    });
}

const forgotLink = document.getElementById("forgotLink");
if (forgotLink) {
    const forgotForm = document.getElementById("forgotForm");
    const resetForm = document.getElementById("resetForm");
    let resetEmail= "";

    const showOnly = (form) => {
        [loginForm, forgotForm, resetForm].forEach(f => f.style.display = "none");
        form.style.display = "block";
    };

    forgotLink.addEventListener("click", (e) => {
        e.preventDefault();
        showOnly(forgotForm);
    });
    ["backToLogin1", "backToLogin2"].forEach(id => {
        document.getElementById(id).addEventListener("click", (e) => {
            e.preventDefault();
            showOnly(loginForm);
        });
    });

    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("forgotSubmitBtn");
        resetEmail = document.getElementById("forgotEmail").value.trim();
        btn.disabled = true;
        try {
            await twPost("requestPasswordReset", { email: resetEmail });
            showOnly(resetForm);
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
        }
    });

    resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = document.getElementById("resetCode").value.trim();
        const newPassword = document.getElementById("resetPassword").value;
        const confirm = document.getElementById("resetConfirm").value;
        const btn = document.getElementById("resetSubmitBtn");

        if (newPassword !== confirm) return alert("Your passwords do not match.");

        btn.disabled = true;
        try {
            await twPost("resetPassword", { email: resetEmail, code, newPassword });
            alert("Password updated. You can now log in.");
            resetForm.reset();
            showOnly(loginForm);
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
        }
    });
}