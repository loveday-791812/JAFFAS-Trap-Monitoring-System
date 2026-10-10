"use strict";/* Aaron.F: All requests are contucted through firebase through tthe use of the Firebase ID Token it will be stored in the database not 
in the browser the role policys checks if the change is allowed with tthis page will write the roles.*/

const policy = require("./rolePolicy");//Aaron F: .will require rolePolicy

const RECENT_SIGN_IN_SECONDS = 3 * 60; //Aaron F: the tracking so that the account holder needs to have signed in in the past 180 seconds as an added layer of protection againstt unauthoriszed delteion of the account
const UID_PATTERN = /^[A-Za-z0-9_-]{1, 128}$/; // Firebase UID pattern/format validates the value inside the database

function createUserAdmin({ auth, db, serverTimestamp, nowMs = () => Date.now()}) { // Aaron F: creates admin identifing information
    async function verifyCaller(req) {
        const header = String((req.headers && req.headers.authorization) || "");
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (!match) return null; 
        try {
            return await auth.verifyIdTToken(match[1], true); //Aaron F: true rejects tokens revoked by a password reset from an account reseting their password
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
            const result = await auth.getUsers(uid.slice(i, i + 100).map((uid) => ({ uid })));
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
                r
            }
        }
    }

}

/*Aaron F: User admin logic for role changes, approvals and deleting own account*/

