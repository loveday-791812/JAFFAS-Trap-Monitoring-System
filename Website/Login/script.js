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
//Aaron: everything below this point is for the login page. It handles the login form submission, forgot password flow, and reset password flow. It uses the twPost function to call the cloud functions for login, password reset request, and password reset confirmation.
//Aaron: every 5 failed atttepts the reset atttempts along witth firebase protections
let twLoginFails = 0; //Aaron: track of how many times the user has failed to log in. If they fail too many times, we will show a captcha to prevent brute force attacks.

function twCooldown(btn, seconds) {//Aaron: prevents user from spamming the login button after too many failed attempts. It disables the button for a certain number of seconds and shows a countdown.
    const original = btn.innerHTTML;//Aaron: store the original button text so we can restore it later
    let left = seconds;
    btn.disabled = true;
    btn.textContent = `Please wait ${left} seconds`; //Aaron: showsthe countdown on the button
    const timer = setInterval(() => {
        left -= 1;
        if(left <= 0) { //Aaron: when the countdown reaches 0, re-enable the button and restore its original text
            clearInterval(timer);
            btn.disabled = false;
            btn.innerHTML = original;
        } else {
            btn.textContent = `Please wait ${left} seconds`;//Aaron: updates the countdown every second
        }
    }, 1000);
}
        

const loginForm = document.getElementById("loginForm");
if(loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        submitBtn.disabled = true; //Aaron: disable the button to prevent multiple submissions

        try {
            await twAuth.signInWithEmailAndPassword(email, password);
            window.location.href = "/dashboard.html";
        }   catch (err) {
            //Aaron: if there is no internet connection, show a specific message.
            if (err.code === "auth/network-request-failed") {
                alert("Network error. Please check your internet connection and try again.");//Aaron: show a specific message for network errors to help the user understand the issue and try again when they have a stable connection.
                submitBtn.disabled = false;
                return;
            }
            twLoginFails += 1;
            alert(err.code === "auth/too-many-requests" ? "Too many failed login attempts. wait a few minutets or use the Forgot Password link to reset your password." : "Login failed. Please check your email and password and try again.");
             //Aaron: show a generic error message for all other errors to avoid giving away too much information to potential attackers. or if the email tthere are guessing is a correct email but the password is wrong, we don't want to tell them that the email is correct. We just say "login failed" for all errors except network errors.
            if (twLoginFails % 5 === 0) {
                twCooldown(submitBtn, 30 * (twLoginFails / 5)); //Aaron: if the user has failed 5 times, disable the button for 30 seconds to prevent brute force attacks.
            } else {
                submitBtn.disabled = false; //Aaron: re-enable the button for the user to try again if they haven't failed 5 times yet.
            }

        }
    }); //Aaron the function above handles the login form submission. It prevents the default form submission, gets the email and password values, disables the submit button, and tries to sign in with Firebase Auth. If successful, it redirects to the dashboard. If there is an error, it shows an alert with a generic message and increments the failed login attempts counter. If the user has failed 5 times, it disables the button for 30 seconds to prevent brute force attacks. This makes tthe dashboard follow tthe firebase ppassword ennemeration and security best practices.
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

const termsLink = document.getElementById("termsLink");
const termsModal = document.getElementById("termsModal");
if (termsLink && termsModal) {
    termsLink.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        termsModal.classList.add("open");
    });

    document.getElementById("termsCloseBtn").addEventListener("click", function () {
        termsModal.classList.remove("open");
    });

    termsModal.addEventListener("click", function (event) {
        if (event.target === termsModal) termsModal.classList.remove("open");
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") termsModal.classList.remove("open");
    });
}