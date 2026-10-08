const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const cors = require("cors")({ origin: true});
const crypto = require("crypto");
const MAGIC_TOKEN_TTL_MS = 3 * 60 * 60 * 1000; //Aaron: 3 hours expiration for magic login links

admin.initializeApp();

const rtdb = admin.database();

const CODE_TTL_MS = 10 * 60 * 1000;

/*Password Logic:Aaron F
1. User requests a password reset by providing their email.
2. A random 6-digit code is generated and hashed, then stored in the database with an expiration timestamp and attempt counter.*/
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown between resends
const MAX_SENDS_PER_HOUR = 5; // Maximum number of sends per hour
const HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const SELF_SIGNUP_ROLES = ["worker", "manager", "admin"]; // Roles that can self-signup Aaron F Note nott sure if admin shouuld be a self sign up in retrospect.


function generateCode() {
    return crypto.randomInt(100000, 1000000).toString(); // Generates a random 6-digit code thatt can be used for email verification or password reset. The code is generated using the crypto module's randomInt function, which provides a secure way to generate random numbers. The range is set from 100000 to 999999 to ensure that the code is always 6 digits long.
}

/* Aaron F math.random can be predictted so we use crypto.random to generate a secure random token for magic login links. The token is stored in the database and used to create a custom Firebase Auth token for logging in without a password.
function generateCode() {
    return Math.floor(100000  + Math.random() * 900000).toString();
}
*/

function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

async function addToRecipients(uid, email) {
        console.log("addToRecipients start", uid, email);
        try {
            await rtdb.ref(`Recipients/${uid}`).set({
                name: email.split("@")[0],
                email,
                report:"Weekly",
                status: "active",
            });
            console.log("addToRecipients done", uid);
    } catch (err) {
        console.error("addToRecipients error:",err);
    }
}
async function tooManyFromIp(req, bucket, limit, windowMs) {//Aaron: checks if the number of requests from a given IP address exceeds a specified limit within a certain time window. Rate limiting and preventing abuse of the system.DDos preventtion
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
    const key = crypto.createHash("sha256").update(ip).digest("hex");
    const now = Date.now();
    const result = await rtdb.ref(`rateLimits/${bucket}/${key}`).transaction((cur) => {
        if (!cur || now - cur.start > windowMs) return {start: now, count: 1};
        return { start: cur.start, count: cur.count + 1 };
    });
    return result.snapshot.val().count > limit;
}
function codeEmailHtml(code) {
    return `
    <div style="font-family:Arial, Helvetica, sans-serif; background:#1a1a1a; padding:30px;">
        <div style="max-width:420px; margin:0 auto; background:#000; border:2px solid #fff; border-radius:16px; padding:28px; text-align:center;">
            <h2 style="color:#fff; margin-bottom:4px;">TrapWatch</h2>
            <p style="color:#ccc; font-size:14px; margin-top:0;">Verify your email to finish setting up your account</p>
            <div style="font-size:32px; letter-spacing:8px; font-weight:bold; color:#fff; background:rgba(255,255,255,0.08); padding:16px; border-radius:10px; margin:20px 0;">
                ${code}
            </div>
            <p style="color:#999; font-size:12px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
            </div>
        </div>`;
}

exports.signup = onRequest({ secrets: ["RESEND_API_KEY"] }, ((req, res) => {
    cors(req, res, async () => {
        try{
            const { email, password, role } = req.body || {};
            if (!email || !password || !role) {
                return res.status(400).json({ error: "Missing email, password, or role"});
            }
            if (!SELF_SIGNUP_ROLES.includes(role)) { /*Aaron: check if the role is valid for self-signup. If not, return an error response. This prevents users from signing up with unauthorized roles. */
                return res.status(400).json({ error: "Choose a valid role for self-signup."});
            }
            if (await tooManyFromIp(req, "signup", 20, HOUR_MS)) { /*Aaron: check if the number of signup attempts from the same IP address exceeds the limit within the specified time window. If it does, return an error response to prevent abuse. */
                return res.status(429).json({ error: "Too many signup attempts from this IP. Please try again later."});
            }

            const userRecord = await admin.auth().createUser({
                email,
                password,
                emailVerified: false,
            });

            const code = generateCode();

            await rtdb.ref(`users/${userRecord.uid}`).set({
                email,
                role,
                verified: false,
                codeHash: hashCode(code),//Aaron: store the hashed version of the code in the database for security. This way, even if someone gains access to the database, they won't see the actual code.
                attempts: 0, //Aaron: initialize the number of attempts to 0. This will be used to track how many times the user has tried to verify their email with the code.
                lastCodeSentAt: Date.now(),//Aaron: store the timestamp of when the code was sent. This will be used to enforce a cooldown period between resends.
                sendWindowStart: Date.now(),//Aaron: store the timestamp of when the current send window started. This will be used to enforce a limit on how many times the code can be sent within a certain time frame.
                sendCount: 1,//Aaron: initialize the send count to 1. This will be used to track how many times the code has been sent within the current send window.
                codeExpiresAt: Date.now() + CODE_TTL_MS,
                createdAt: admin.database.ServerValue.TIMESTAMP,
            });

            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
                from: "TrapWatch <no-reply@trapwatch.fft.kiwi>",
                to: [email],
                subject: "Your TrapWatch verification code",
                html: codeEmailHtml(code),
            });

            return res.status(200).json({ uid: userRecord.uid });

        } catch (err) {
            console.error("signUp error:", err);
            const message = err.code === "auth/email-already-exists"
                ? "An account with this email already exists."
                : "Could not create account. Please try again";
            return res.status(500).json({ error: message});
        }
    });
}));

exports.resendCode = onRequest({ secrets: ["RESEND_API_KEY"] }, ((req, res) => {
    cors(req, res, async () => {
        try {
            const { uid } = req.body || {};
            if (!uid) return res.status(400).json({ error: "missing uid." });

            const userRef = rtdb.ref(`users/${uid}`);
            const snap = await userRef.get();
            if (!snap.exists()) return res.status(404).json({ error: "Account not found."});

            const user = snap.val();
            if (user.verified) {
                return res.status(400).json({error: "This account is already verified." });
            }
            
            const code = generateCode();
            await userRef.update({ code, codeExpiresAt: Date.now() + CODE_TTL_MS});
            
            const resend = new Resend(process.env.RESEND_API_KEY);
            
            await resend.emails.send({
                from: "TrapWatch <no-reply@trapwatch.fft.kiwi>",
                to: [user.email],
                subject: "Your TrapWatch verification code",
                html: codeEmailHtml(code),
            });

            return res.status(200).json({ success: true});
        } catch (err) {
            console.error("resendCode error:", err);
            return res.status(500).json({ error: "Could not resend code. Please try again."});
        }   
    });
}));


exports.verifyCode = onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { uid, code } = req.body || {};
            if (!uid || !code) return res.status(400).json({ error: "Missing uid or code."});

            if (await tooManyFromIp(req, "verifyCode", 25, HOUR_MS)) {//Aaron: check if the number of verification attempts from the same IP address exceeds the limit within the specified time window. If it does, return an error response to prevent abuse. */
                return res.status(429).json({ error: "Too many verification attempts from this IP. Please try again later."});
            }

            const userRef = rtdb.ref(`users/${uid}`);
            const snap = await userRef.get();
            if (!snap.exists()) return res.status(404).json({ error: "Account not found." });

            const user = snap.val();

            if (user.verified) {
                return res.status(400).json({ error: "This account is already verified"});
            }
                        if (!user.codeExpiresAt || Date.now() > user.codeExpiresAt) {
                return res.status(400).json({ error: "That code has expired. Request a new one." });
            }
       /*   if (user.code !== code) {
                return res.status(400).json({ error: "Incorrect code. Please try again." });
            }*/

            const tx = await userRef.child("attempts").transaction((cur) => (cur || 0) + 1);//Aaron: increment the number of attempts atomically to prevent race conditions. This ensures that even if multiple requests are made simultaneously, the count will be accurate and consistent.
            const attempts = tx.snapshot.val();//Aaron: get the updated number of attempts after the transaction. This will be used to check if the user has exceeded the maximum number of allowed attempts. If they have, we will return an error response and prevent further verification attempts until a new code is requested.
            if (attempts > MAX_ATTEMPTS) {//Aaron: check if the number of attempts exceeds the maximum allowed. If it does, return an error response to prevent brute-force attacks and abuse of the verification system.
                return res.status(429).json({ error: "Too many incorrect attempts.Please request a new code." });//Aaron: return a 429 status code to indicate that the user has exceeded the allowed number of attempts. This helps to prevent abuse and brute-force attacks on the verification system. used 429 because it is a rate limiting error code and fits the context of too many attempts.
            }

            const given = Buffer.from(hashCode(String(code)));//Aaron: hash the provided code and convert it to a Buffer for secure comparison. This ensures that even if someone intercepts the request, they won't see the actual code, only its hashed representation.
            const stored = Buffer.from(user.codeHash || "");//Aaron: retrieve the stored hashed code from the database and convert it to a Buffer for secure comparison. If the stored hash is missing, we use an empty string to prevent errors during comparison.
            if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {//Aaron: comparedthe hashed provided code with the stored hashed code using a timing-safe comparison to prevent timing attacks. If they don't match, return an error response indicating that the code is incorrect.
                const left = MAX_ATTEMPTS - attempts;//Aaron: calculate the number of attempts left for the user. This will be used to provide feedback in the error message, letting the user know how many more attempts they have before they are locked out and need to request a new code.
                return res.status(400).json({//Aaron: returned 400 status code to indicate that the provided code is incorrect. This helps to inform the user that their input was invalid and they need to try again or request a new code if they have exceeded the maximum number of attempts.
                    error: left > 0 ? `Incorrect code. You have ${left} attempt(s) left.` : "Too many incorrect attempts. Please request a new code.",
                });
            }



            const token = generateToken();

            await userRef.update({
                verified: true,
                codeHash: null,//Aaron: clear the stored code hash after successful verification to prevent reuse. This ensures that the code can only be used once and enhances security by removing sensitive information from the database.
                codeExpiresAt: null,
                attempts: 0,
                sendCount: 0,
                sendWindowStart: null,
                lastCodeSentAt: null,
                
                magicToken: null, //Aaron: clear any existing magic token to prevent conflicts. This ensures that the user will receive a new magic token for future logins, and any previous tokens are invalidated for security reasons. The token itself does not store setting information, but it is associated with the user's account in the database. When the user logs in using the magic token, the server can retrieve their settings from the database based on their uid.
                magicTokenHash: null,//Aaron: clear the stored magic token hash after successful login to prevent reuse. This ensures that the magic token can only be used once and enhances security by removing sensitive information from the database.
                magicTokenExpiresAt: Date.now() + MAGIC_TOKEN_TTL_MS,//Aaron: set the expiration timestamp for the magic token to 3 hours from now. This ensures that the token is only valid for a limited time, enhancing security by reducing the window of opportunity for unauthorized access.
            });

            await admin.auth().updateUser(uid, { emailVerified: true });
            await addToRecipients(uid, user.email);

            return res.status(200).json({ token });

        } catch (err) {
            console.error("verifyCode error:", err);
            return res.status(500).json({ error: "Could not verify code. Please try again." });
        }
    });
});


exports.magicLogin = onRequest((req, res) => {
    cors(req, res, async() => {
        try {
            const { token } = req.body || {}; //Aaron: get the magic token from the request body. This token is used to authenticate the user without requiring a password. It is generated when the user verifies their email and is stored in the database for later use.
            if (!token || typeof token !== "string") {
                return res.status(400).json({ error: "Missing token." });//Aaron: check if the token is missing or not a string. If it is, return a 400 Bad Request response with an error message indicating that the token is required for authentication.
            }

            const invalid = { error: "This link is invalid or has expired." };//Aaron: generic error message for invalid or expired magic login links. This message is returned when the token is not found in the database or has expired, preventing unauthorized access to the user's account.
            const tokenHash = hashCode(token); //Aaron: hash the provided magic token using a secure hashing algorithm. This ensures that even if someone intercepts the request, they won't see the actual token, only its hashed representation. The hashed token is then used to look up the corresponding user in the database.

            const query = await rtdb.ref("users")
                .orderByChild("magicTokenHash")//Aaron: query the database for users with a matching hashed magic token. This allows us to find the user associated with the provided token without exposing sensitive information. The query is limited to the first match to ensure we only retrieve one user, as each magic token should be unique and associated with a single user account.
                .equalTo(tokenHash)
                .limitToFirst(1)
                .get();

            if (!query.exists()) return res.status(404).json(invalid); //Aaron: check if the query returned any results. If not, return a 404 Not Found response with the generic invalid link error message. This indicates that the provided magic token does not match any user in the database, either because it is incorrect or has already been used/expired.
            
            let uid, userData;
            query.forEach((child) => {
                uid = child.key;
                userData = child.val();
            });

            await rtdb.ref(`users/${uid}`).update({
                magicTokenHash: null,// Aaron: invalidate the magic token after successful login
                magicTokenExpiresAt: null,// Aaron: clear the expiration timestamp after successful login
            });

            if (!userData.magicTokenExpiresAt || Date.now() > userData.magicTokenExpiresAt) {
                return res.status(404).json(invalid); //Aaron: check if the magic token has expired. If it has, return a 404 Not Found response with the generic invalid link error message. This prevents users from logging in with an expired token, ensuring that the magic login process remains secure and time-limited.
            }

            const customToken = await admin.auth().createCustomToken(uid); //Aaron: create a custom Firebase Auth token for the user. This token allows the user to authenticate with Firebase without needing a password, enabling a seamless login experience using the magic link. The custom token is generated based on the user's unique identifier (uid) and can be used to sign in to the application securely.

            return res.status(200).json({ customToken });//Aaron: return the custom token in the response, allowing the client to use it for authentication. The client can then sign in with this token to access protected resources and perform actions on behalf of the authenticated user.
        } catch (err) { //Aaron: catch any errors that occur during the magic login process. This includes issues with database queries, token generation, or any other unexpected errors. Logging the error helps with debugging and provides insight into what went wrong during the request.
            console.error("magicLogin error:", err);
            return res.status(500).json({ error: "Could not login. Please try again." });
        }
    });
});


function hashCode(code) {
    return crypto.createHash("sha256").update(code).digest("hex");
}

function resetEmailHtml(code) {
    return `
    <div style="font-family:Arial, Helvetica, sans-serif; background:#1a1a1a; padding:30px;">
        <div style="max-width:420px; margin:0 auto; background:#000; border:2px solid #fff; border-radius:16px; padding:28px; text-align:center;">
            <h2 style="color:#fff; margin-bottom:4px;">TrapWatch</h2>
            <p style="color:#ccc; font-size:14px; margin-top:0;">Use this code to reset your password</p>
            <div style="font-size:32px; letter-spacing:8px; font-weight:bold; color:#fff; background:rgba(255,255,255,0.08); padding:16px; border-radius:10px; margin:20px 0;">
                ${code}
            </div>
            <p style="color:#999; font-size:12px;">This code expires in 10 minutes.</p>
        </div>
    </div>`;
}

exports.requestPasswordReset = onRequest({ secrets: ["RESEND_API_KEY"] }, ((req, res) => {
    cors(req, res, async () => {
        try {
            const { email } = req.body || {};
            if (!email) return res.status(400).json({ error: "Missing email."});

            let userRecord;
            try {
                userRecord = await admin.auth().getUserByEmail(email);
            } catch (err) {
                if (err.code === "auth/user-not-found") {
                    return res.status(200).json({ success: true });
                }
                throw err;
            }

            const code = crypto.randomInt(100000, 1000000).toString();

            await rtdb.ref(`passwordResets/${userRecord.uid}`).set({
                codeHash: hashCode(code),
                expiresAt: Date.now() + CODE_TTL_MS,
                attempts: 0,
            });

            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
                from: "TrapWatch <no-reply@trapwatch.fft.kiwi>",
                to: [email],
                subject: "Reset your TrapWatch password",
                html: resetEmailHtml(code),
            });

            return res.status(200).json({ success: true});
        } catch (err) {
            console.error("requestPasswordReset error:", err);
            return res.status(500).json({ error: "Could not send reset code. Please try again." });
        }
    });
}));

exports.resetPassword = onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { email, code, newPassword } = req.body || {};
        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: "Missing Email, code, or new password"});
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: "Password must be atleast 8 charcters."});
        }

        const genericError = { error: "Invalid or expired."};

        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch {
            return res.status(400).json(genericError);
        }
        const ref = rtdb.ref(`passwordResets/${userRecord.uid}`);
        const snap = await ref.get();
        if (!snap.exists()) return res.status(400).json(genericError);

        const reset = snap.val();

        if (Date.now() > reset.expiresAt || reset.attempts >= MAX_ATTEMPTS) {
            await ref.remove();
            return res.status(400).json(genericError);
        }

        const given = Buffer.from(hashCode(String(code)));
        const stored = Buffer.from(reset.codeHash);
        if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)){
            await ref.update({ attempts: reset.attempts + 1 });
            return res.status(400).json(genericError);
        }

        await admin.auth().updateUser(userRecord.uid, { password: newPassword});
        await admin.auth().revokeRefreshTokens(userRecord.uid);
        await ref.remove();

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("resetPassword error:", err);
        return res.status(500).json({ error: "Could not reset password. Please try again."});
    }
        
    });
});