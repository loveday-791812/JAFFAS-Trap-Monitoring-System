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

//Aaron F: audit roles named with the same role names as the Recipients page
const TW_AUDIT_ROLES = { worker: "Farmer", manager: "Farm Manager", admin: "Admin", pending: "Waiting for approval" };

// Aaron F: records who made a change when no person was signed in to the website
const TW_AUDIT_ACTORS = { system: "System or Firebase console", unauthenticated: "Not signed in", unknown: "Unknown" };

