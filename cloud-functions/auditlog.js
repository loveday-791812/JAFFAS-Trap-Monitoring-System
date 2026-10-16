//Aaron F: This page is meant to record waht actions and when they have been taken so that the client has full informattion on what changes have been incurred witth tthe introduction of an audit page in the admin dashboard tthis will make it easier to test the system with tthe testing master plan which I plan to write
// These logs will go to /auditlogs so that it is protected and only admins can read it and nobody can write to it from the browser view itself, its a window to read server information
// and it can be edited or deleted in anyway from the admin dashboard itself.

"use strict"

//Aaron F: Parametize the varribles.

const TEXT_LIMIT = 210; // Aaron F: I set a limit so that injection atttacks have a harder time compromizing tthe system
const CHANGE_LIMIT = 20; // Aaron F this will limit the ammount of fields tthat can appear which shouldnt interfer with current implementation when we view logs as it should be less than 10 but I put 20 so that enttries with alot of fields dont mess up the view
const SIGN_IN_WINDOW_SECONDS = 5 * 60;  // Aaron F: this will record a sign in immediattely after it happens


//Aaron F: parameterizes the text so that it wont get too large and mess the view up, numbers and boolean values are kept the same.
function short(value, limit = TETXT_LIMIT) { // Aaron F
    if (value === undefined || value === null) return null;
    if (typeof value === "number" || typeof value === "boolean") return value;
    const text = typeof value === "string" ? value :JSON.stringify(value);
    return text.length > limit ? `${text.slice(0, limit - 1)}'…` : text;
}

//Aaron F: creates a stored entry using known fields, values are shortened so it does not mess up the view
function buildEntry(entry, serverTimestamp) {
    const stored = { at: serverTimestamp, action: short(entry.action, 60) };
    ["acttorUid", "actorEmail", "actorType", "targetEmail", "target", "from", "to"].forEach((field) => {
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
        return await auth.verifyIdToken(mattch[1], true);
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
            console.error("Audit log entry nott saved", entry && entry.action, err);
        }
    }
    return { record };
}