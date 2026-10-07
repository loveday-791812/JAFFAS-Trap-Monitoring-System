/* Recipients page logic */
function twHighlightNav() {
    const current = window.location.pathname.split("/").pop() || "recipients.html";
    document.querySelectorAll(".tw-nav a").forEach((link) => {
        const href = link.getAttribute("href");
        if (href === current) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}



/* Adds the open class to a modal overlay so its CSS makes it visible */
function twOpenModal(modalId) {
    document.getElementById(modalId).classList.add("open");
}

/* Removes the open class then hides the modal */
function twCloseModal(modalId) {
    document.getElementById(modalId).classList.remove("open");
}


/* Each recipient has a unique "id" (separate from their name) so we can find/update/remove the right one even if two people happened to share a name. status is either "active" or "paused" — matches the badge-active / badge-paused CSS classes in dashboard-style.css. */
let twRecipients = {};

async function loadRecipients() {
    const snap = await rtdb.ref("Recipients").once("value");
    twRecipients = snap.val() || {};
}

/* keeps track of the next id to hand out when someone click "Add" and starts above the highest id already used */
let twNextId = 5;

/* New 4 report types evry recipient can independently turn on/off. Avoids repeating the same list 3 times below - render, row-toggle-click, and add/edit forms all loop over this. */
const REPORT_TYPES = ["instant", "daily", "weekly", "monthly"];

/* Single letter labels for the table buttons */
const REPORT_TYPE_META = {
    instant: { letter: "I", field: "reportInstant", title: "Instant Reports" },
    daily: { letter: "D", field: "reportDaily", title: "Daily Reports" },
    weekly: { letter: "W", field: "reportWeekly", title: "Weekly Reports" },
    monthly: { letter: "M", field: "reportMonthly", title: "Monthly Reports" },
};

/* There might still be some recipients with the old single report field. This checks the new field first and only falls back to interpreting the old field if the new one was never set so old data still displays sensibly without needing a restructure within the database, while every new save uses the new updated fields */
function getReportFlag(recipient, type) {
    const field = REPORT_TYPE_META[type].field;
    if (recipient[field] !== undefined) return !!recipient[field];

    //legacy fallback - old data only ever had daily weekly or monthly, never instant. This updates that.
    const legacyLabel = type.charAt(0).toUpperCase() + type.slice(1);
    return recipient.report === legacyLabel;
}


/* Rendering - rebuilds the whole recipients table from twRecipients. Called after every add/edit/remove so the table always matches the current data */
function renderRecipients() {
    const tbody = document.getElementById("recipients-tbody");
    tbody.innerHTML = "";

    Object.entries(twRecipients).forEach(([id, recipient]) => {
        const row = document.createElement("tr");

        /* build 4 toggle buttons, grabs from getReportFlag() to reflect the new boolean fields or the legacy single report value correctly */
        const toggleButtons = REPORT_TYPES.map((type) => {
            const meta = REPORT_TYPE_META[type];
            const isOn = getReportFlag(recipient, type);
            return `
                <button
                    type="button"
                    class="report-toggle-btn ${isOn ? "on" : ""}"
                    data-id="${id}"
                    data-type="${type}"
                    title="${meta.title}"
                >${meta.letter}</button>
                `;
        }).join("");

        row.innerHTML = `
        <td>${recipient.name}</td>
        <td>${recipient.email}</td>
        <td><div class="report-toggles">${toggleButtons}</div></td>
        <td>
            <span class="badge badge-${recipient.status}">
                ${recipient.status === "active" ? "✅ Active" : "⏸️ Paused"}
            </span>
        </td>
        <td>
            <button type="button" class="action-link edit" data-id="${id}">Edit</button>
            <button type="button" class="action-link remove" data-id="${id}">Remove</button>
        </td>
        `;
        tbody.appendChild(row);
    });

    attachRowListeners();
}

/* wires up the per-row  controls. Called at the end of renderRecipients() every time the table redraws */
function attachRowListeners() {
    /* clicking on one of the 4 pills flips just that one report type on/off for that recipient */
    document.querySelectorAll(".report-toggle-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            const field = REPORT_TYPE_META[type].field;

            const newValue = !getReportFlag(twRecipients[id], type);

            /* update local copy immediately for button */
            twRecipients[id][field] = newValue;
            e.target.classList.toggle("on", newValue);

            await rtdb.ref(`Recipients/${id}`).update({ [field]: newValue });
        });
    });

    document.querySelectorAll(".action-link.edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            openEditModal(e.target.dataset.id);
        });
    });

    document.querySelectorAll(".action-link.remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            openRemoveModal(e.target.dataset.id);
        });
    });
}

/* Add Recipient modal */
async function openAddModal() {
    /* reset the form to blank/defualt values every time it's opened so leftover text from a previous add attempt doesn't reappear */
    document.getElementById("add-form").reset();

    /* pre-check the 4 toggles based on whatever is set as the default on the settings page rather than always starting as all "off" */
    const settings = await twGetSettings();
    document.getElementById("add-report-instant").checked = settings.defaultReportInstant;
    document.getElementById("add-report-daily").checked = settings.defaultReportDaily;
    document.getElementById("add-report-weekly").checked = settings.defaultReportWeekly;
    document.getElementById("add-report-monthly").checked = settings.defaultReportMonthly;

    twOpenModal("add-modal");
}

async function handleAddSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("add-name").value.trim();
    const email = document.getElementById("add-email").value.trim();

    const newRecipient = { 
        name, 
        email, 
        status: "active",
        reportInstant: document.getElementById("add-report-instant").checked,
        reportDaily: document.getElementById("add-report-daily").checked,
        reportWeekly: document.getElementById("add-report-weekly").checked,
        reportMonthly: document.getElementById("add-report-monthly").checked,
    };

    const newRef = rtdb.ref("Recipients").push();
    await newRef.set(newRecipient);

    twRecipients[newRef.key] = newRecipient;

    renderRecipients();
    twCloseModal("add-modal");
}

/* Edit Recipient modal - opens the Edit modal pre-filled with one recipient's current details. The hidden edit-id field remembers which recipient we're editing so handleEditSubmit() knows what to update when Save is clicked */
function openEditModal(id) {
    const recipient = twRecipients[id];
    if (!recipient) return;

    document.getElementById("edit-id").value = id;
    document.getElementById("edit-name").value = recipient.name;
    document.getElementById("edit-email").value = recipient.email;
    
    /* getReportFlag() handles both new-style recipients and any old-style ones with a single report string */
    document.getElementById("edit-report-instant").checked = getReportFlag(recipient, "instant");
    document.getElementById("edit-report-daily").checked = getReportFlag(recipient, "daily");
    document.getElementById("edit-report-weekly").checked = getReportFlag(recipient, "weekly");
    document.getElementById("edit-report-monthly").checked = getReportFlag(recipient, "monthly");

    /* check the radio button matching this recipient's current status */
    const radio = document.querySelector(
        `input[name="edit-status"][value="${recipient.status}"]`
    );
    if (radio) radio.checked = true;

    twOpenModal("edit-modal");
}

async function handleEditSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("edit-id").value;
    const updated  = {
        name: document.getElementById("edit-name").value.trim(),
        email: document.getElementById("edit-email").value.trim(),
        reportInstant: document.getElementById("edit-report-instant").checked,
        reportDaily: document.getElementById("edit-report-daily").checked,
        reportWeekly: document.getElementById("edit-report-weekly").checked,
        reportMonthly: document.getElementById("edit-report-monthly").checked,
    }

    const checkedRadio = document.querySelector('input[name="edit-status"]:checked');
    if (checkedRadio) updated.status = checkedRadio.value;

    await rtdb.ref(`Recipients/${id}`).update(updated);
    twRecipients[id] = { ...twRecipients[id], ...updated };

    renderRecipients();
    twCloseModal("edit-modal");
}

/* Remove Recipient modal - opens the Remove modal with the dropdown preset to whichever recipient's Remove button was clicked. The dropdown is rebuilt from scratch each time in case a recipient was added/removed since the last time this modal was opened */
function openRemoveModal(id) {
    const select = document.getElementById("remove-select");
    select.innerHTML = "";

        Object.entries(twRecipients).forEach(([key, recipient]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = recipient.name;
        select.appendChild(option);
    });

    select.value = id;
    updateRemoveWarningText();
    twOpenModal("remove-modal");
}

/* updates this recipient in the warning box to the selected name */
function updateRemoveWarningText() {
    const select = document.getElementById("remove-select");
    const recipient = twRecipients[select.value];
    document.getElementById("remove-name-inline").textContent = recipient ? recipient.name : "this recipient";
}

async function handleRemoveConfirm() {
    const select = document.getElementById("remove-select");
    const id = (select.value);

    await rtdb.ref(`Recipients/${id}`).remove();
    delete twRecipients[id];

    renderRecipients();
    twCloseModal("remove-modal");
}

/* Setup Event Listeners once the page has loaded */
document.addEventListener("DOMContentLoaded", async () => {
    twHighlightNav();
    await loadRecipients();
    renderRecipients();

    document.getElementById("help-btn").addEventListener("click", () => {
        twOpenModal("help-modal");
    });

    document.getElementById("nav-toggle").addEventListener("click", (e) => {
        const nav = document.getElementById("tw-nav");
        const isOpen = nav.classList.toggle("open");
        e.target.setAttribute("aria-expanded", isOpen);
    });

    document.getElementById("add-recipient-btn").addEventListener("click", openAddModal);
    document.getElementById("add-form").addEventListener("submit", handleAddSubmit);
    document.getElementById("edit-form").addEventListener("submit", handleEditSubmit);
    document.getElementById("confirm-remove-btn").addEventListener("click", handleRemoveConfirm);
    document.getElementById("remove-select").addEventListener("change", updateRemoveWarningText);

    /* clicking the dimmed backdrop closes the current modal */
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.classList.remove("open");
        });
    });

    /* Pressing Escape closes any open modal */
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal-overlay.open").forEach((overlay) => {
                overlay.classList.remove("open");
            });
        }
    });
});