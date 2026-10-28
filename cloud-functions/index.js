const { onRequest } = require("firebase-functions/v2/https");
const { onValueWritten } = require("firebase-functions/v2/database");
const { createAuditLog, createSessionAudit, createAuditTriggers } = require("./auditLog");
const admin = require("firebase-admin");
const { ServerValue } = require("firebase-admin/database"); //Aaron F: testing with an emulator logic: server timestamp; the emulator hides admin.database.ServerValue
const { Resend } = require("resend");
const cors = require("cors")({ origin: ["https://trapwatch.fft.kiwi", "https://trap-watch.web.app", "https://trap-watch.firebaseapp.com"] }); //Aaron F: found the security head er so that other websites can no longer call these from a browser
const crypto = require("crypto");
const MAGIC_TOKEN_TTL_MS = 3 * 60 * 60 * 1000; //Aaron: 3 hours expiration for magic login links

admin.initializeApp();

const rtdb = admin.database();
// Aaron F: Audit log ttracks every important event, and is written to /auditLogs by the server cloud-functions/auditLog.js.
const auditLog = createAuditLog({ db: rtdb, serverTimestamp: ServerValue.TIMESTAMP });
const lookupEmail = (uid) => admin.auth().getUser(uid).then((u) => u.email || null).catch(() => null);
// Aaron F: Database triggers run next to the database in Singapore. Us central is for emulator*/
const AUDIT_TRIGGER_REGION = process.env.FUNCTIONS_EMULATOR === "true" ? "us-central1" : "asia-southeast1";


const CODE_TTL_MS = 10 * 60 * 1000;

const ADMIN_NOTIFY_EMAIL = "jacobdf@outlook.com";
const SITE_URL = "https://trapwatch.fft.kiwi"

const ROLE_LABELS = {worker: "Farmer", manager: "Farm Manager" };

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function newSignupEmailHtml(email, requestedRole) {
    return `
    <div style="font-family:Arial, Helvetica, sans-serif; background:#1a1a1a; padding:30px;">
        <div style="max-width:420px; margin:0 auto; background:#000; border:2px solid #fff; border-radius:16px; padding:28px; text-align:center;">
            <h2 style="color:#fff; margin-bottom:4px;">TrapWatch</h2>
            <p style="color:#ccc; font-size:14px; margin-top:0;">A new user is waiting for your approval</p>
            <div style="color:#fff; background:rgba(255,255,255,0.08); padding:16px; border-radius:10px; margin:20px 0;">
                <div style="font-size:16px; font-weight:bold;">${escapeHtml(email)}</div>
                <div style="font-size:13px; color:#ccc; margin-top:6px;">Requested role: ${escapeHtml(ROLE_LABELS[requestedRole] || requestedRole)}</div>
            </div>
            <a href="${SITE_URL}/recipients.html"
               style="display:inline-block; color:#fff; text-decoration:none; background:rgba(255,255,255,0.15); border:1px solid #fff; border-radius:20px; padding:10px 22px; font-size:14px;">
                Review &amp; approve
            </a>
            <p style="color:#999; font-size:12px; margin-top:20px;">Log in as an admin, then scroll to "Access requests" on the Recipients page.</p>
        </div>
    </div>`;
}

async function getAdminEmails() {
    const snap = await rtdb.ref("users").orderByChild("role").equalTo("admin").get();
    if (!snap.exists()) return [];
    const emails = Object.values(snap.val())
        .map((u) => u && u.email)
        .filter(Boolean);
    return [...new Set(emails)];
}

async function notifyAdminOfSignup(email, requestedRole) {
    let recipients = await getAdminEmails();
    if (recipients.length === 0) recipients = [ADMIN_NOTIFY_EMAIL];

    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = newSignupEmailHtml(email, requestedRole);

    const results = await Promise.allSettled(
        recipients.map((to) =>
            resend.emails.send({
                from: "TrapWatch <no-reply@trapwatch.fft.kiwi>",
                to: [to],
                subject: "TrapWatch: new sign-up waiting for approval",
                html,
            })
        )
    );
    console.log("Notifying admins:", recipients);
    results.forEach((r, i) => {
        if (r.status === "rejected") {
            console.error("Admin email threw for", recipients[i], r.reason);
        } else if (r.value && r.value.error) {
            console.error("Resend rejected email for", recipients[i], JSON.stringify(r.value.error));
        } else {
            console.log("Admin email sent to", recipients[i]);
        }
    });
}


/*Password Logic:Aaron F
1. User requests a password reset by providing their email.
2. A random 6-digit code is generated and hashed, then stored in the database with an expiration timestamp and attempt counter.*/
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown between resends
const MAX_SENDS_PER_HOUR = 5; // Maximum number of sends per hour
const HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const { REQUESTABLE_ROLES } = require("./rolePolicy");// Aaron.F: Roles that can adhere to a role policy whiich is approved by the admin.  Admin can only be granted to already approved roles and those roles can be changed by the admin
const { createUserAdmin } = require("./userAdmin"); // Aaron.F: Functions to create request handlers for admin user management and the self deletet account. This function is used to create users with specific roles and permissions in the system. It ensures that only authorized users can be granted admin access, maintaining the security and integrity of the application.


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
            const { password, role } = req.body || {};
            const email = String((req.body || {}).email || "").trim().toLowerCase();
            if (!email || !password || !role) {
                return res.status(400).json({ error: "Missing email, password, or role"});
            }
            if (!REQUESTABLE_ROLES.includes(role)) { /*Aaron: check if the requested role is valid for self-signup. If not, return an error response. This prevents users from signing up with unauthorized roles. */
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
                role: "pending", //Aaron F: makes the role pending so that they have no permissions untill the admin approves the role of the user
                requestedRole: role, //Aaron F: stores the requested role for the admin to appprove
                verified: false,
                codeHash: hashCode(code),//Aaron: store the hashed version of the code in the database for security. This way, even if someone gains access to the database, they won't see the actual code.
                attempts: 0, //Aaron: initialize the number of attempts to 0. This will be used to track how many times the user has tried to verify their email with the code.
                lastCodeSentAt: Date.now(),//Aaron: store the timestamp of when the code was sent. This will be used to enforce a cooldown period between resends.
                sendWindowStart: Date.now(),//Aaron: store the timestamp of when the current send window started. This will be used to enforce a limit on how many times the code can be sent within a certain time frame.
                sendCount: 1,//Aaron: initialize the send count to 1. This will be used to track how many times the code has been sent within the current send window.
                codeExpiresAt: Date.now() + CODE_TTL_MS,
                createdAt: ServerValue.TIMESTAMP,
            });

            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
                from: "TrapWatch <no-reply@trapwatch.fft.kiwi>",
                to: [email],
                subject: "Your TrapWatch verification code",
                html: codeEmailHtml(code),
            });

            await auditLog.record({ action: "accountt.signup", actorUid: userRecord.uid, actorEmail: email, detail: { requestableRole: role } });
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
            
            if (user.lastCodeSentAt && Date.now() - user.lastCodeSentAt < RESEND_COOLDOWN_MS) {
                return res.status(429).json({ error: "Please wait a minute before requesting another code."}); //Aaron F: this prevents spamming invite codes using own server as an intermediatary, potentailly wasting our limit we have seen this vunrability and have implemented measures to prevent or mitigate it.    
            }

            const code = generateCode();
            await userRef.update({
                codeHash: hashCode(code),
                attempts: 0,
                codeExpiresAt: Date.now() + CODE_TTL_MS,
                lastCodeSentAt: Date.now(),
            });
            /*const code = generateCode(); Aaron F: removed to implement role policy and because it leftt the code unhashed and unencypted
            await userRef.update({ code, codeExpiresAt: Date.now() + CODE_TTL_MS});*/
            
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


exports.verifyCode = onRequest({ secrets: ["RESEND_API_KEY"] }, (req, res) => {    cors(req, res, async () => {
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
                if (attempts === MAX_ATTEMPTS + 1) await auditLog.record({ action: "security.lockout", targetUid: uid, targetEmail: user.email || null, detail: { endpoint: "verifyCode" } })
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
                magicTokenExpiresAt: null, // Aaron F: security measure is now implemented in role policy
            });
           
            await admin.auth().updateUser(uid, { emailVerified: true });
            await auditLog.record({ action: "account.verify", actorUid: uid, actorEmail: user.email || null});

            try {
                await notifyAdminOfSignup(user.email, user.requestedRole);
            } catch (mailErr) {
                console.error("notifyAdminOfSignup failed:", mailErr);
            }

            return res.status(200).json({ verified: true });
          
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
            if (!token) return res.status(400).json({ error: "Missing token."});

            const hash = crypto.createHash("sha256").update(token).digest("hex");
            const now = Date.now();

            const query = await rtdb.ref("users")
                .orderByChild("magicTokenHash")//Aaron: query the database for users with a matching hashed magic token. This allows us to find the user associated with the provided token without exposing sensitive information. The query is limited to the first match to ensure we only retrieve one user, as each magic token should be unique and associated with a single user account.
                .equalTo(hash)
                .limitToFirst(1)
                .get();

                        if (!query.exists()) {
                return res.status(404).json({ error: "This link is invalid or has expired." });
                        }
            
            let uid, userData;
            query.forEach((child) => {
                uid = child.key;
                userData = child.val();
            });

                        if (!userData.magicTokenExpiresAt || now > userData.magicTokenExpiresAt) {
                return res.status(400).json({ error: "This link has expired." });
            }

            await rtdb.ref(`users/${uid}`).update({
                magicTokenHash: null,// Aaron: invalidate the magic token after successful login
                magicTokenExpiresAt: null,// Aaron: clear the expiration timestamp after successful login
            });

            const customToken = await admin.auth().createCustomToken(uid); //Aaron: create a custom Firebase Auth token for the user. This token allows the user to authenticate with Firebase without needing a password, enabling a seamless login experience using the magic link. The custom token is generated based on the user's unique identifier (uid) and can be used to sign in to the application securely.
            await auditLog.record({ action: "session.signIn", actorUid: uid, actorEmail: userData.email || null, detail: { method: "emailLink" } });
            return res.status(200).json({ customToken, role: userData.role, email: userData.email  });//Aaron: return the custom token in the response, allowing the client to use it for authentication. The client can then sign in with this token to access protected resources and perform actions on behalf of the authenticated user.
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
            if (await tooManyFromIp(req, "resetRequest", 10, HOUR_MS)) { //Aaron F: limits password reset codes for at most 10 reset emails an hour from one address
                return res.status(429).json({ error: "Too many reset requests. Please try again later." });
            }

            let userRecord;
            try {
                userRecord = await admin.auth().getUserByEmail(email);
            } catch (err) {
                if (err.code === "auth/user-not-found") {
                    return res.status(200).json({ success: true });
                }
                throw err;
            }

            const resetRef = rtdb.ref(`passwordResets/${userRecord.uid}`);

            const previous = (await resetRef.get()).val() || {};
            const now = Date.now();
            const sameHour = previous.windowStart && now - previous.windowStart < HOUR_MS;
            const sends = sameHour ? (previous.sends || 0) + 1 : 1;
            if (sends > 3) return res.status(200).json({ success: true }); //Aaron F: sends 3 codes an hour limit for one account, so new codes can't be used to keep guessing

            const code = crypto.randomInt(100000, 1000000).toString();

            await resetRef.set({
                codeHash: hashCode(code),
                expiresAt: now + CODE_TTL_MS,
                attempts: 0,
                windowSttart: sameHour ? previous.windowStartt : now,
                sends,
            });

            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
                from: "TrapWatch <no-reply@trapwatch.fft.kiwi>",
                to: [email],
                subject: "Reset your TrapWatch password",
                html: resetEmailHtml(code),
            });

            await auditLog.record({ action: "password.resetRequest", targetUid: userRecord.uid, targetEmail: userRecord.email || null });
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
        if (!reset.codeHash || Date.now() > reset.expiresAt) return res.status(400).json(genericError); // Aaron F: The record stays until the hour is up, so the request limit keeps incrementing

        const tx = await ref.child("attempts").transaction((cur) => (cur || 0) + 1); // Aaron F: it is counted before checking so guesses sent at the same moment can't slip past the bypass the limit set
        const attempts = tx.snapshot.val();
        if (attempts > MAX_ATTEMPTS) {
            if (attempts === MAX_ATTEMPTS + 1) await auditLog.record({ action: "security.lockout", targetUid: userRecord.uid, targetEmail: userRecord.email || null, detail: { endpoint: "resetPassword" } });
            return res.status(400).json(genericError);
        }

        const given = Buffer.from(hashCode(String(code)));
        const stored = Buffer.from(reset.codeHash);
        if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)){
            return res.status(400).json(genericError);
        }

        await admin.auth().updateUser(userRecord.uid, { password: newPassword});
        await admin.auth().revokeRefreshTokens(userRecord.uid);
        await ref.remove();
        await auditLog.record({ action: "password.reset", targetUid: userRecord.uid, targetEmail: userRecord.email || null });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("resetPassword error:", err);
        return res.status(500).json({ error: "Could not reset password. Please try again."});
    }
        
    });
});

/*Aaron F: Self delete for accounts and admin account management logic tthat connects tto userAdmin */ 
const userAdmin = createUserAdmin({
    auth: admin.auth(),
    db:rtdb,
    serverTimestamp: ServerValue.TIMESTAMP,
});

exports.adminUsers = onRequest((req, res) => userAdmin.handleAdminUsers(req, res));
exports.deleteMyAccount = onRequest((req, res) => userAdmin.handleDeleteMyAccount(req, res));

/* Aaron F: Audit logic - sign-ins and sign-outs reported by the browser, and changes made directly in the database. */
const sessionAudit = createSessionAudit({ auth: admin.auth(), record: auditLog.record });
const auditTriggers = createAuditTriggers({ record: auditLog.record, lookupEmail });

exports.auditSession = onRequest((req, res) => sessionAudit.handleAuditSession(req, res));
exports.auditTraps = onValueWritten({ ref: "/Traps/{trapId}", region: AUDIT_TRIGGER_REGION }, auditTriggers.dataChange("trap"));
exports.auditRecipients = onValueWritten({ ref: "/Recipients/{recipientId}", region: AUDIT_TRIGGER_REGION }, auditTriggers.dataChange("recipient"));
exports.auditSettings = onValueWritten({ ref: "/Settings", region: AUDIT_TRIGGER_REGION }, auditTriggers.dataChange("settings"));
exports.auditRoles = onValueWritten({ ref: "/users/{uid}", region: AUDIT_TRIGGER_REGION }, auditTriggers.roleChange);