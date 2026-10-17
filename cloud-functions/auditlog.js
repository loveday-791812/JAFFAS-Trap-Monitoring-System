//Aaron F: This page is meant to record waht actions and when they have been taken so that the client has full informattion on what changes have been incurred witth tthe introduction of an audit page in the admin dashboard tthis will make it easier to test the system with tthe testing master plan which I plan to write
// These logs will go to /auditLogs so that it is protected and only admins can read it and nobody can write to it from the browser view itself, its a window to read server information
// and it can't be edited or deleted in anyway from the admin dashboard itself.

"use strict"

//Aaron F: Parametize the varribles.

const TEXT_LIMIT = 200; // Aaron F: I set a limit so that a request does not creatte a absurdly large entry
const CHANGE_LIMIT = 20; // Aaron F this will limit the ammount of fields tthat can appear which shouldnt interfer with current implementation when we view logs as it should be less than 10 but I put 20 so that enttries with alot of fields dont mess up the view
const SIGN_IN_WINDOW_SECONDS = 5 * 60;  // Aaron F: this will record a sign in immediattely after it happens


//Aaron F: parameterizes the text so that it wont get too large and mess the view up, numbers and boolean values are kept the same.
function short(value, limit = TEXT_LIMIT) { // Aaron F
    if (value === undefined || value === null) return null;
    if (typeof value === "number" || typeof value === "boolean") return value;
    const text = typeof value === "string" ? value :JSON.stringify(value);
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

//Aaron F: creates a stored entry using known fields, values are shortened so it does not mess up the view
function buildEntry(entry, serverTimestamp) {
    const stored = { at: serverTimestamp, action: short(entry.action, 60) };
    ["actorUid", "actorEmail", "actorType","targetUid", "targetEmail", "target", "from", "to"].forEach((field) => {
        const value = short(entry[field]);
        if (value !== null) stored[field] = value;
    });
    const detail = {};
    Object.entries(entry.detail || {}).forEach(([key, value]) => {
        if(key === "changes" && Array.isArray(value)) {
            detail.changes = value.slice(0, CHANGE_LIMIT).map((c) => ({
                field: short(c.field, 60),
                from: short(c.from, 120),
                to: short(c.to, 120),

            }));
        } else if (short(value) !== null) {
            detail[key] = short(value);
        }
    });
    if(Object.keys(detail).length) stored.detail = detail;
    return stored;
}
// Aaron F: creates fields that differentiate bettween versions of the record

function describeChange(before, after) {
    const asObject = (value) => {
        if (value === null || value === undefined) return{};
        return typeof value === "object" && !Array.isArray(value) ? value : { value };
    };
    const oldRecord = asObject(before);
    const newRecord = asObject(after);
    const fields = [...new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])].sort();
    return fields
        .map((field) => ({ field, from: short(oldRecord[field], 120), to: short(newRecord[field], 120) }))
        .filter((change) => change.from !== change.to);
}

//Aaron F: Firebase verification, returns or voids.

async function verifyCaller(auth, req) {
    const match = String((req.headers && req.headers.authorization) || "").match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    try {
        return await auth.verifyIdToken(match[1], true);
    } catch (err) {
        return null;
    }
}

//Aaron F: saves a single entry, a fail is logged but never undoes or blocks the action from being recorded
function createAuditLog({ db, serverTimestamp }) {
    async function record(entry) {
        try {
            await db.ref("auditLogs").push(buildEntry(entry, serverTimestamp));
        } catch (err) {
            console.error("Audit log entry not saved", entry && entry.action, err);
        }
    }
    return { record };
}

//Aaron F: The browser reports its own sign-in or sign-out. The server checks the ID token, so nobody can record an event for someone else.

function createSessionAudit({ auth, record, nowMs = () => Date.now() }) {
    async function handleAuditSession(req, res) {
        if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
        const caller = await verifyCaller(auth, req);
        if (!caller) return res.status(401).json({ error: "Your sign-in has expired. Sign in again, then retry." });

        const event = String((req.body || {}).event || "");
        if (event !== "signIn" && event !== "signOut") return res.status(400).json({ error: "Unknown event." });

        const secondsSinceSignIn = Math.floor(nowMs() / 1000) - (caller.auth_time || 0);
        if (event === "signIn" && secondsSinceSignIn > SIGN_IN_WINDOW_SECONDS) {
            return res.status(200).json({ recorded: false });   //Aaron F: not a sign-in that has just happened
        }
        const method = event === "signIn" && caller.firebase ? caller.firebase.sign_in_provider : null;   //Aaron F: password for the login form
        await record({ action: `session.${event}`, actorUid: caller.uid, actorEmail: caller.email || null, detail: { method } });
        return res.status(200).json({ recorded: true });
    }
    return { handleAuditSession };
}

//Aaron F: Audit naming convention on audit page.

const DATA_KINDS = {
    trap: (row, id) => `Trap ${row && row.trap_num !== undefined && row.trap_num !== null ? row.trap_num : id}`,
    recipient: (row, id) => (row && (row.email || row.name)) || id,
    settings: () => "Settings",
};

//Aaron F: handlers for database trtiggers, recording changes made in tthe browser which functiions currently dont see

function createAuditTriggers({ record, lookupEmail }) {
    //Aaron F: looks at which account made the change, reports tthe signed in users, not sure if the emulator will be able to catch it
    async function actorOf(event) {
        if (event.authType === "app_user" && event.authId) {
            return { actorUid: event.authId, actorEmail: await lookupEmail(event.authId) };
        }
        if (event.authType === "admin") return { actorType: "system" };   //Aaron F: a server function or the Firebase console
        if (event.authType === "unauthenticated") return { actorType: "unauthenticated" };
        return { actorType: "unknown" };
    } 


    //Aaron F: traps, recipients and setttings add, edit and remove (crud) with new and old vlaues
    function dataChange(kind) {
        return async (event) => {
            const before = event.data.before.val();
            const after = event.data.after.val();
            const changes = describeChange(before, after);
            if (!changes.length) return null;
            const action = before === null ? `${kind}.create` : after === null ? `${kind}.delete` : `${kind}.update`;
            const id = Object.values(event.params || {})[0] || "";
            return record({
                action,
                ...(await actorOf(event)),
                target: DATA_KINDS[kind](after || before, id),
                detail: { changes },
            });
        };
    }

    //Aaron F: records the role change made on the firebase server
    async function roleChange(event) {
        const before = event.data.before.val();
        const after = event.data.after.val();
        if(!after) return null; //Aaron F: deltions are recorded by accountt.delete and user.reject
        const fromRole = (before && before.role) || null;
        const toRole = after.role || null; 
        if (fromRole === toRole) return null; //Aaron F: not a role change
        if (!before && toRole === "pending") return null; // Aaron F: normal sign up recorded by account.signup
        if (before && (before.approvedAt !== after.approvedAt || before.roleChangedAt !== after.roleChangedAt)) return null;
        return record({
            action: "role.changedOutsideApp",
            ...(await actorOf(event)),
            targetUid: (event.params && event.params.uid) || null,
            targetEmail: after.email || null,
            from: fromRole,
            to: toRole,
        });    
    }

    return { dataChange, roleChange };
}

module.exports = {
    createAuditLog, createSessionAudit, createAuditTriggers,
    buildEntry, describeChange, verifyCaller, SIGN_IN_WINDOW_SECONDS,

};