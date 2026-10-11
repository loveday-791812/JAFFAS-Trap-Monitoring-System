"use strict";/* Aaron.F: All requests are contucted through firebase through tthe use of the Firebase ID Token it will be stored in the database not 
in the browser the role policys checks if the change is allowed with tthis page will write the roles.*/

const policy = require("./rolePolicy");//Aaron F: .will require rolePolicy

const RECENT_SIGN_IN_SECONDS = 3 * 60; //Aaron F: the tracking so that the account holder needs to have signed in in the past 180 seconds as an added layer of protection againstt unauthoriszed delteion of the account
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/; // Firebase UID pattern/format validates the value inside the database

function createUserAdmin({ auth, db, serverTimestamp, nowMs = () => Date.now()}) { // Aaron F: creates admin identifing information
    async function verifyCaller(req) {
        const header = String((req.headers && req.headers.authorization) || "");
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (!match) return null; 
        try {
            return await auth.verifyIdToken(match[1], true); //Aaron F: true rejects tokens revoked by a password reset from an account reseting their password
        } catch (err) {
            return null;
        }
    }

    async function roleOf(uid) { //Aaron F: roleOf function to call
        const snap = await db.ref(`users/${uid}/role`).get();
        return snap.val();
    }
    async function countAdmins() { //Aaron F: to count admins so tthat otther logic can work
        const snap = await db.ref("users").orderByChild("role").equalTo("admin").get();
        return snap.exists() ? Object.keys(snap.val()).length : 0;
    }

    async function audit(entry) { //Aaron F: To create Audit logs
        await db.ref("auditLogs").push({ ...entry, at: serverTimestamp });
    }

    /*Aaron F: admin screen fields so that the logic is contained*/
    async function listUsers() {
        const records = (await db.ref("users").get()).val() || {};
        const uids = Object.keys(records).filter((uid) => UID_PATTERN.test(uid));
        const authByUid = {};
        for (let i = 0; i < uids.length; i += 100) {
            const result = await auth.getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
            result.users.forEach((u) => { authByUid[u.uid] = u; });
        }
        return uids
        .filter((uid) => authByUid[uid])
        .map((uid) => {
            const record = records[uid] || {};
            const account = authByUid[uid];
            return {
                uid,
                email: account.email || record.email || "",
                role: record.role || null,
                requestedRole: record.requestedRole || null, 
                emailVerified: !!account.emailVerified,
                createdAt: (account.metadata && account.metadata.creationTime) || null,

            };
        })
        .sort((a, b) => a.email.localeCompare(b.email));

    }

    /*Aaron F: The function addRecipient will set approved people to the weekly report*/
    async function addRecipient(uid, email) {
        const ref = db.ref(`Recipients/${uid}`);
        if ((await ref.get()).exists()) return;
        await ref.set({ name: email.split("@")[0], email, report: "Weekly", status: "active" });
    }
    /*Aaron F: removal function for removing the persons records and sign in credentials from the database*/
    async function deleteAccountData(uid, email) {
        const updates = {
            [`users/${uid}`]: null,
            [`Recipients/${uid}`]: null,
            [`passwordResets/${uid}`]: null,
        };
        if (email) {
            const wanted = email.trim().toLowerCase();
            const recipients = (await db.ref("Recipients").get()).val() || {};
            Object.entries(recipients).forEach(([key, r]) => {   // also catches older rows saved with capitals
                if (r && typeof r.email === "string" && r.email.trim().toLowerCase() === wanted) {
                    updates[`Recipients/${key}`] = null;
                }
            });
        }
        await db.ref().update(updates);
        try {
            await auth.deleteUser(uid);
        } catch (err) {
            if (err.code !== "auth/user-not-found") throw err;
        }
    }

    const fail = (res, decision) => res.status(decision.status).json({ error: decision.reason });

    /*Aaron F: User admin logic for role changes, approvals and deleting own account*/
    async function handleAdminUsers(req, res) {
        if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
        const caller = await verifyCaller(req);
        if (!caller) return res.status(401).json({ error: "Your sign-in has expired. Sign in again, then retry." });
        
        const { action, uid, role } = req.body || {};
        try {
            if ((await roleOf(caller.uid)) !== "admin") {
                return res.status(403).json({ error: "Only admins can manage user accounts." });
            }
            if (action === "list") return res.status(200).json({ users: await listUsers(), you: caller.uid });

            if (typeof uid !== "string" || !UID_PATTERN.test(uid)) {
                return res.status(400).json({ error: "Missing or invalid account id." });
            }
            
             const target = (await db.ref(`users/${uid}`).get()).val();
            if (!target) return res.status(404).json({ error: "That account no longer exists. Refresh the page." });
            const account = await auth.getUser(uid).catch(() => null);

            if (action === "approve") {
                const decision = policy.decideApproval({
                    targetRole: target.role, emailVerified: !!(account && account.emailVerified), newRole: role,
                });
            if (!decision.ok) return fail(res, decision);
                await db.ref(`users/${uid}`).update({ role, approvedAt: serverTimestamp, approvedBy: caller.uid });
                await addRecipient(uid, (account && account.email) || target.email);
                await audit({ action: "user.approve", actorUid: caller.uid, targetUid: uid, from: target.role, to: role });
                return res.status(200).json({ ok: true });
            }

            if (action === "reject") {
                const decision = policy.decideReject({ targetRole: target.role });
                if (!decision.ok) return fail(res, decision);
                await deleteAccountData(uid, (account && account.email) || target.email);
                await audit({ action: "user.reject", actorUid: caller.uid, targetUid: uid, from: target.role, to: null });
                return res.status(200).json({ ok: true });
            }
            if (action === "setRole") {
                const decision = policy.decideRoleChange({
                    actorUid: caller.uid, targetUid: uid, targetRole: target.role, newRole: role,
                    adminCount: await countAdmins(),
                });
                if (!decision.ok) return fail(res, decision);
                await db.ref(`users/${uid}`).update({ role, roleChangedAt: serverTimestamp, roleChangedBy: caller.uid });
                await audit({ action: "user.setRole", actorUid: caller.uid, targetUid: uid, from: target.role, to: role });
                return res.status(200).json({ ok: true });
            }
            return res.status(400).json({ error: "Unknown action." });
        } catch (err) {
            console.error("adminUsers error:", action, err);
            return res.status(500).json({ error: "That action could not be saved. Please try again." });
        }
    }
    /*Aaron F: Function to delte users acount by themselves*/
    async function handleDeleteMyAccount(req, res) {
        if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
        const caller = await verifyCaller(req);
        if (!caller) return res.status(401).json({ error: "Your sign-in has expired. Sign in again, then retry." });
        try {
            const role = await roleOf(caller.uid);
            const decision = policy.decideSelfDelete({
                role,
                adminCount: role === "admin" ? await countAdmins() : 0,
                authTimeSec: caller.auth_time,
                nowSec: Math.floor(nowMs() / 1000),
                recentSeconds: RECENT_SIGN_IN_SECONDS,
            });
            if (!decision.ok) return fail(res, decision);
            await deleteAccountData(caller.uid, caller.email);
            await audit({ action: "account.delete", actorUid: caller.uid, targetUid: caller.uid, from: role || null, to: null });
            return res.status(200).json({ ok: true });
        } catch (err) {
            console.error("deleteMyAccount error:", err);
            return res.status(500).json({ error: "Your account could not be deleted. Please try again." });
        }
    }

    return { handleAdminUsers, handleDeleteMyAccount, deleteAccountData, listUsers};
}

module.exports = { createUserAdmin, RECENT_SIGN_IN_SECONDS };
