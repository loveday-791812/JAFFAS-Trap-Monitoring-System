//Aaron F: Audit page is an admin only view where listed events are saved in auditLogs, with the newest logs appearing first
// The database server writes the entries and lets the admin read them. 
//Every value goes on the page with textContent, so stored text can never run as code.

const TW_AUDIT_PAGE_SIZE = 100; //Aaron F: max events loaded at a time

//Aaron F: What each event is called on the page, and what Show filter it belongs to 
const TW_AUDIT_EVENTS = {
    "account.signup": { label: "Signed up", group: "account" },
    "account.verify": { label: "Verified their email", group: "account" },
    "account.delete": { label: "Deleted their own account", group: "account" },
    "user.approve": { label: "Approved a sign-up", group: "account" },
    "user.reject": { label: "Rejected a sign-up", group: "account" },
    "user.setRole": { label: "Changed a role", group: "account" },
    "password.resetRequest": { label: "Asked for a password reset", group: "account" },
    "password.reset": { label: "Reset their password", group: "account" },
    "session.signIn": { label: "Signed in", group: "session" },
    "session.signOut": { label: "Signed out", group: "session" },
    "trap.create": { label: "Added a trap", group: "data" },
    "trap.update": { label: "Edited a trap", group: "data" },
    "trap.delete": { label: "Removed a trap", group: "data" },
    "recipient.create": { label: "Added a recipient", group: "data" },
    "recipient.update": { label: "Edited a recipient", group: "data" },
    "recipient.delete": { label: "Removed a recipient", group: "data" },
    "settings.create": { label: "Saved settings", group: "data" },
    "settings.update": { label: "Changed settings", group: "data" },
    "settings.delete": { label: "Cleared settings", group: "data" },
    "security.denied": { label: "Refused: not an admin", group: "security" },
    "security.lockout": { label: "Locked out after too many tries", group: "security" },
    "role.changedOutsideApp": { label: "Role changed outside TrapWatch", group: "security" },
};

// Aaron F: audit roles named with the same role names as the Recipients page
const TW_AUDIT_ROLES = { worker: "Farmer", manager: "Farm Manager", admin: "Admin", pending: "Waiting for approval" };

// Aaron F: records who made a change when no person was signed in to the website
const TW_AUDIT_ACTORS = { system: "System or Firebase console", unauthenticated: "Not signed in", unknown: "Unknown" };

// Aaron F: Plain words for the values the server stores
const TW_AUDIT_WORDS = {
    password: "password", emailLink: "email link",
    verifyCode: "email code check", resetPassword: "password reset", adminUsers: "user management",
};

let twAuditEntries = [];     // Aaron F: the loaded events display the newest first
let twAuditOldestKey = null; //Aaron F: Load older events carries on from here

function twAuditEvent(action) {
    return TW_AUDIT_EVENTS[action] || { label: action || "Unknown event", group: "other" };
}

function twAuditRole(role) {
    return TW_AUDIT_ROLES[role] || role || "No role";
}

function twAuditWhen(at) {
    const date = new Date(at);
    if (!at || Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// Aaron F: The entries with no actorUid's were made by someone who wasn't signed in, for example a password reset
function twAuditWho(entry) {
    return entry.actorEmail || entry.actorUid || TW_AUDIT_ACTORS[entry.actorType] || "Not signed in";
}

function twAuditAffected(entry) {
    return entry.targetEmail || entry.target || entry.targetUid || "—";
}

//Aaron F: One line is added per entry: the role change, how they signed in, and old changed to new values for data changes 
function twAuditDetails(entry) {
    const detail = entry.detail || {};
    const lines = [];
    if (entry.from && entry.to) lines.push(`${twAuditRole(entry.from)} → ${twAuditRole(entry.to)}`);
    else if (entry.from) lines.push(`Role was ${twAuditRole(entry.from)}`);
    else if (entry.to) lines.push(`New role: ${twAuditRole(entry.to)}`);
    if (detail.requestedRole) lines.push(`Asked for: ${twAuditRole(detail.requestedRole)}`);
    if (detail.method) lines.push(`Using ${TW_AUDIT_WORDS[detail.method] || detail.method}`);
    if (detail.endpoint) lines.push(`In: ${TW_AUDIT_WORDS[detail.endpoint] || detail.endpoint}`);
    if (detail.attempted) lines.push(`Tried: ${detail.attempted}`);
    Object.values(detail.changes || {}).forEach((change) => {
        lines.push(`${change.field}: ${change.from ?? "(empty)"} → ${change.to ?? "(empty)"}`);
    });
    return lines;
}

function twAuditCell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
}

function twAuditRow(entry) {
    const event = twAuditEvent(entry.action);
    const row = document.createElement("tr");
    if (event.group === "security") row.classList.add("audit-security");
    row.appendChild(twAuditCell(twAuditWhen(entry.at)));
    row.appendChild(twAuditCell(event.label));
    row.appendChild(twAuditCell(twAuditWho(entry)));
    row.appendChild(twAuditCell(twAuditAffected(entry)));
    const details = twAuditCell("");
    twAuditDetails(entry).forEach((line) => {
        const div = document.createElement("div");
        div.textContent = line;
        details.appendChild(div);
    });
    row.appendChild(details);
    return row;
}

function twAuditStatus(message, isError = false) {
    const el = document.getElementById("audit-status");
    el.textContent = message;
    el.classList.toggle("is-error", isError);
}

// Aaron F: The function shows the loaded events that match the Show filter and the search box which is needed as a function of the admin to find pertinant events
function twRenderAudit() {
    const group = document.getElementById("audit-category").value;
    const search = document.getElementById("audit-search").value.trim().toLowerCase();
    const shown = twAuditEntries.filter((entry) => {
        if (group !== "all" && twAuditEvent(entry.action).group !== group) return false;
        if (!search) return true;
        const text = [twAuditEvent(entry.action).label, twAuditWho(entry), twAuditAffected(entry), ...twAuditDetails(entry)];
        return text.join(" ").toLowerCase().includes(search);
    });

    const tbody = document.getElementById("audit-tbody");
    tbody.replaceChildren();
    shown.forEach((entry) => tbody.appendChild(twAuditRow(entry)));
    if (!shown.length) {
        const row = document.createElement("tr");
        const td = twAuditCell(twAuditEntries.length ? "No events match these filters." : "No events have been recorded yet.");
        td.colSpan = 5;
        row.appendChild(td);
        tbody.appendChild(row);
    }
    twAuditStatus(`Showing ${shown.length} of ${twAuditEntries.length} loaded events.`);
}

// Aaron F: Loads the newest events, or with older = true the ones before those already loaded
async function twLoadAudit(older) {
    let query = rtdb.ref("auditLogs").orderByKey();   // push keys sort oldest → newest
    if (older) query = query.endBefore(twAuditOldestKey);
    const snap = await query.limitToLast(TW_AUDIT_PAGE_SIZE).once("value");

    const batch = [];
    snap.forEach((child) => {
        batch.push({ key: child.key, ...child.val() });   // keep the braces: returning true would stop forEach early
    });
    batch.reverse();   // newest first

    twAuditEntries = older ? twAuditEntries.concat(batch) : batch;
    if (batch.length) twAuditOldestKey = batch[batch.length - 1].key;
    document.getElementById("audit-more").style.display = batch.length === TW_AUDIT_PAGE_SIZE ? "" : "none";
}

async function twAuditRefresh(older = false) {
    const buttons = [document.getElementById("audit-refresh"), document.getElementById("audit-older")];
    buttons.forEach((button) => { button.disabled = true; });
    twAuditStatus("Loading events…");
    try {
        await twLoadAudit(older);
        twRenderAudit();
    } catch (err) {
        console.error("Audit log failed to load:", err);
        twAuditStatus(`Couldn't load the audit log. ${err.message}`, true);
    } finally {
        buttons.forEach((button) => { button.disabled = false; });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await window.twAuthReady;   // Aaron F: dashboard-auth.js resolves this once an admin is signed in

    document.querySelectorAll(".tw-nav a").forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === "audit.html");
    });

    // Aaron F: the ? hoverable opens it; Got it, the dimmed background or Escape closes it
    const help = document.getElementById("help-modal");
    document.getElementById("help-btn").addEventListener("click", () => help.classList.add("open"));
    document.getElementById("help-close").addEventListener("click", () => help.classList.remove("open"));
    help.addEventListener("click", (e) => { if (e.target === help) help.classList.remove("open"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") help.classList.remove("open"); });

        // Menu button on phones
    document.getElementById("nav-toggle").addEventListener("click", (e) => {
        const isOpen = document.getElementById("tw-nav").classList.toggle("open");
        e.currentTarget.setAttribute("aria-expanded", isOpen);
    });

        document.getElementById("audit-category").addEventListener("change", twRenderAudit);
    document.getElementById("audit-search").addEventListener("input", twRenderAudit);
    document.getElementById("audit-refresh").addEventListener("click", () => twAuditRefresh(false));
    document.getElementById("audit-older").addEventListener("click", () => twAuditRefresh(true));

    await twAuditRefresh(false);
});
