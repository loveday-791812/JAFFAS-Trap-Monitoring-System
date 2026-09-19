const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const cors = require("cors")({ origin: true});
const crypto = require("crypto");

admin.initializeApp();

const rtdb = admin.database();

const resend = new Resend(process.env.RESEND_API_KEY);
const CODE_TTL_MS = 10 * 60 * 1000;

function generateCode() {
    return Math.floor(100000  + Math.random() * 900000).toString();
}

function generateToken() {
    return crypto.randomBytes(32).toString("hex");
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

exports.signup = onRequest((req, res) => {
    cors(req, res, async () => {
        try{
            const { email, password, role } = req.body || {};
            if (!email || !password || !role) {
                return res.status(400).json({ error: "Missing email, password, or role"});
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
                code,
                codeExpiresAt: Date.now() + CODE_TTL_MS,
                createdAt: admin.database.ServerValue.TIMESTAMP,
            });

            await resend.emails.send({
                from: "onboarding@resend.dev",
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
});

exports.resendCode = onRequest((req, res) => {
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

            await resend.emails.send({
                from: "onboarding@resend.dev",
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
});


exports.verifyCode = onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { uid, code } = req.body || {};
            if (!uid || !code) return res.status(400).json({ error: "Missing uid or code."});

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
            if (user.code !== code) {
                return res.status(400).json({ error: "Incorrect code. Please try again." });
            }

            const token = generateToken();

            await userRef.update({
                verified: true,
                code: null,
                codeExpiresAt: null,
                magicToken: token,
            });

            await admin.auth().updateUser(uid, { emailVerified: true });

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
            const { token } = req.body || {};
            if (!token) return res.status(400).json({ error: "Missing token." });

            const query = await rtdb.ref("users")
                .orderByChild("magicToken")
                .equalTo(token)
                .limitToFirst(1)
                .get();

            if (!query.exists()) {
                return res.status(404).json({ error: "This link is invalid or has expired"});
            }
            
            let uid, userData;
            query.forEach((child) => {
                uid = child.key;
                userData = child.val();
            });

            const customToken = await admin.auth().createCustomToken(uid);

            return res.status(200).json({
                customToken,
                role: userData.role,
                email: userData.email,
                        });
        } catch (err) {
            console.error("magicLogin error:", err);
            return res.status(500).json({ error: "Could not log you in. Please try again." });
        }
    });
});
