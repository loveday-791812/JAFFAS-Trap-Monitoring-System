/*Aaron F: This will be a admin only page governing the users to approve the sign ups or reject them,
 also change roles and promote admins. Every action is sent to /api/adminUsers. 
 The server checks that you are an admin and applies the rules in cloud-functions/rolePolicy.js. it doesnt write roles to the database *important */

const TW_ROLE_LABELS = { worker: "Farmer", manager: "Farm Manager", admin: "Admin", pending: "Waiting for approval" };

let twUsers = [];
let twMyUid = null;

function twRoleLabel(role) {
    return TW_ROLE_LABELS[role] || "No role";
}

function twUsersStatus(message, isError = false) {
    const el = document.getElementById("users-status");
    el.textContent = message;
    el.classList.toggle("is-error", isError); 
}

function twCell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
}

function twEmptyRow(tbody, columns, message) {
    const row = document.createElement("tr");
    const td = twCell(message);
    td.colSpan = columns;
    row.appendChild(td);
    tbody.appendChild(row);
}

function twRoleSelect(roles, selected, label) {
    const select = document.createElement("select");
    select.setAttribute("aria-label", label);
    roles.forEach((role) => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = TW_ROLE_LABELS[role];
        option.selected = role === selected;
        select.appendChild(option);
    });
    return select;

}

function twButtton(text, className, onclick, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener("click", onclick);
    return button;
}

function twFormatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "-"
        : date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function renderAccessRequests() {
    const tbody = document.getElementById("requests-tbody");
    tbody.replaceChildren();
    const pending = twUsers.filter((u) => u.role === "pending");
    if (!pending.length) return twEmptyRow(tbody, 6, "No one is waiting for approval.");

    pending.forEach((u) => {
        const row = document.createElement("tr");
        row.appendChild(twCell(u.email));
        row.appendChild(twCell(twRoleLabel(u.requestedRole)));
        row.appendChild(twCell(u.emailVerified ? "Yes" : "Not yet"));
        row.appendChild(twCell(twFormatDate(u.createdAt)));

        const select = twRoleSelect(["worker", "manager"], u.requestedRole === "manager" ? "manager" : "worker", `Approve ${u.email} as`);
        const selectCell = document.createElement("td");
        selectCell.appendChild(select);
        row.appendChild(selectCell);

        const actions = document.createElement("td");
        const buttons = document.createElement("div");
        buttons.className = "users-actions";
        const approve = twButton("Approve", "btn btn-primary", () => twApprove(u, select.value), !u.emailVerified);
        if (!u.emailVerified) approve.title = "Need to verify the email first.";
        buttons.appendChild(approve);
        buttons.appendChild(twButton("Reject", "btn btn-outline", () => twReject(u)));
        actions.appendChild(buttons);
        row.appendChild(actions);
        tbody.appendChild(row);
    });
}

function renderUserAccounts() {
    const tbody = document.getElementById("accounts-tbody");
    tbody.replaceChildren();
    const accounts = twUsers.filter((u) => u.role !== "pending");
    if (!accounts.length) return twEmptyRow(tbody, 4, "No approved accounts yet.");

    accounts.forEach((u) => {
        const isMe = u.uid === twMyUid;
        const row = document.createElement("tr");
        row.appendChild(twCell(isMe ? `${u.email} (you)` : u.email));
        row.appendChild(twCell(twRoleLabel(u.role)));

        const selectCell = document.createElement("td");
        const actions = document.createElement("td");
        const buttons = document.createElement("div");
        buttons.className = "users-actions";
        actions.appendChild(buttons);

        if (isMe) {
            selectCell.textContent = "-";
            buttons.textContent = "Ask another admin to change your role.";
        } else if (["worker", "manager", "admin"].includes(u.role)) {
            const select = twRoleSelect(["worker", "manager"], u.role === "manager" ? "manager" : "worker", `New role for ${u.email}`);
            selectCell.appendChild(select);
            buttons.appendChild(twButton(u.role === "admin" ? "Remove admin" : "Save role", "btn btn-outline", () => twSetRole(u, select.value)));
            if (u.role !== "admin") buttons.appendChild(twButton("Make admin", "btn btn-primary", () => twSetRole(u, "admin")));
        } else {
            selectCell.textContent = "-";
            buttons.textContent = "No role recorded. Set one in the Firebase console.";
        }
        row.appendChild(selectCell);
        row.appendChild(actions);
        tbody.appendChild(row);
    });
}

async function twLoadUsers() {
    const data = await twAuthPost("adminUsers", { action: "list" });
    twUsers = data.users || [];
    twMyUid = data.you || null;
    renderAccessRequests();
    renderUserAccounts();
}

/*Aaron F: reloads tables and reports tthe results in a status line in one change*/
async function twRunUserChange(action, payload, successMessage) {
    twUsersStatus("Saving…");
    document.querySelectorAll(".users-table button").forEach((b) => { b.disabled = true; });
    try {
        await twAuthPost("adminUsers", { action, ...payload });
        await twLoadUsers();
        twUsersStatus(successMessage);
        return true;
    } catch (err) {
        twUsersStatus(err.message, true);
        await twLoadUsers().catch(() => {});
        return false;
    }
}

async function twApprove(u, role) {
    const ok = await twRunUserChange("approve", { uid: u.uid, role }, `Approved ${u.email} as ${twRoleLabel(role)}.`);
    if (ok) {                       // approval also adds them to the recipients list (weekly report)
        await loadRecipients();
        renderRecipients();
    }
}

async function twReject(u) {
    if (!confirm(`Reject the sign-up for ${u.email}? Their account will be deleted.`)) return;
    await twRunUserChange("reject", { uid: u.uid }, `Rejected the sign-up for ${u.email}. Their account has been deleted.`);
}

async function twSetRole(u, role) {
    if (role === "admin" && !confirm(`Make ${u.email} an admin? Admins can approve people and change anyone's role.`)) return;
    if (u.role === "admin" && !confirm(`Remove admin access from ${u.email}? They will become ${twRoleLabel(role)}.`)) return;
    await twRunUserChange("setRole", { uid: u.uid, role }, `${u.email} is now ${twRoleLabel(role)}.`);
}

document.addEventListener("DOMContentLoaded", async () => {
    await window.twAuthReady;
    try {
        await twLoadUsers();
    } catch (err) {
        twUsersStatus(`Couldn't load user accounts. ${err.message}`, true);
    }
});