/* Recipients page logic */
/* This javascript helps with 1) highlighting the current page in the nav bar. 2) Store mock recipient data and render it as a table. 3) open/close the 3 add/edit/remove modals and wire up their forms. 4) update the mock data in memory when a recipient is changed in any way.

IMPORTANT: twRecipients below is FAKE data that only lives in the browser's memory — refreshing the page resets it back to the original 4 people. Once the backend is ready, this is where you'd swap in real API calls (e.g. fetch a list on load, POST/PATCH/DELETE on each action) while keeping the same render functions. */

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

/* Mock Data */
/* Each recipient has a unique "id" (separate from their name) so we can find/update/remove the right one even if two people happened to share a name. status is either "active" or "paused" — matches the badge-active / badge-paused CSS classes in dashboard-style.css. */
let twRecipients = [
    { id: 1, name: "Clint", email: "cllint@kahikatea.com", report: "Weekly", status: "active" },
    { id: 2, name: "Jessie", email: "jessie@kahikatea.com", report: "Daily", status: "active" },
    { id: 3, name: "Jenna", email: "jenna@kahikatea.com", report: "Monthly", status: "active" },
    { id: 4, name: "Dave", email: "dave@kahikatea.com", report: "Weekly", status: "paused" },
];

/* keeps track of the next id to hand out when someone click "Add" and starts above the highest id already used in the mock data */
let twNextId = 5;

/* Rendering - rebuilds the whole recipients table from twRecipients. Called after every add/edit/remove so the table always matches the current data */
function renderRecipients() {
    const tbody = document.getElementById("recipients-tbody");
    tbody.innerHTML = "";

    twRecipients.forEach((recipient) => {
        const row = document.createElement("tr");

        row.innerHTML = `<td>${recipient.name}</td> <td>${recipient.email}</td> <td> <select class="report-select" data-id="${recipient.id}"> <option value="Daily">Daily</option> <option value="Weekly">Weekly</option> <option value="Monthly">Monthly</option> </select> </td> <td> <span class="badge badge-${recipient.status}"> ${recipient.status === "active" ? "Active" : "Paused"} </span> </td> <td> <button type="button" class="action-link edit" data-id="${recipient.id}">Edit</button> <button type="button" class="action-link remove" data-id="${recipient.id}">Remove</button> </td>`;

        /* set the dropdown to show this recipient's current frequency. Done here rather than a selected attribute above becuase the value needs to match exactly */
        row.querySelector(".report-select").value = recipient.report;

        tbody.appendChild(row);
    });

    /* reattach click/change listeners every time, since the buttons and dropdowns above were just recreated from scratch */
    attachRowListeners();
}

/* wires up the per-row  controls. Called at the end of remderRecipients() every time the table redraws */
function attachRowListeners() {
    /* changing frequency directly in the table updates that recipient immediately without needing to open the Edit modal */
    document.querySelectorAll(".report-select").forEach((select) => {
        select.addEventListener("change", (e) => {
            const id = Number(e.target.dataset.id);
            const recipient = twRecipients.find((r) => r.id === id);
            recipient.report = e.target.value;
            /* no need to rerender here as the dropdown already shows the new value */
        });
    });

    document.querySelectorAll(".action-link.edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const id = Number(e.target.dataset.id);
            openEditModal(id);
        });
    });

    document.querySelectorAll(".action-link.remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const id = Number(e.target.dataset.id);
            openRemoveModal(id);
        });
    });
}

/* Add Recipient modal */
function openAddModal() {
    /* reset the form to blank/defualt values every time it's opened so leftover text from a previous add attempt doesn't reappear */
    document.getElementById("add-form").reset();
    twOpenModal("add-modal");
}

function handleAddSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("add-name").value.trim();
    const email = document.getElementById("add-email").value.trim();
    const report = document.getElementById("add-report").value;

    twRecipients.push({
        id: twNextId,
        name,
        email,
        report,
        status: "active",   /*new recipients start active by default */
    });
    twNextId += 1;

    renderRecipients();
    twCloseModal("add-modal");
}

/* Edit Recipient modal - opens the Edit modal pre-filled with one recipient's current details. The hidden edit-id field remembers which recipient we're editing so handleEditSubmit() knows what to update when Save is clicked */
function openEditModal(id) {
    const recipient = twRecipients.find((r) => r.id === id);

    document.getElementById("edit-id").value = recipient.id;
    document.getElementById("edit-name").value = recipient.name;
    document.getElementById("edit-email").value = recipient.email;
    document.getElementById("edit-report").value = recipient.report;

    /* check the radio button matching this recipient's current status */
    const radio = document.querySelector(
        'input[name="edit-status"][value="${recipient.status}"]'
    );
    if (radio) radio.checked = true;

    twOpenModal("edit-modal");
}

function handleEditSubmit(e) {
    e.preventDefault();

    const id = Number(document.getElementById("edit-id").value);
    const recipient = twRecipients.find((r) => r.id === id);

    recipient.name = document.getElementById("edit-name").value.trim();
    recipient.email = document.getElementById("edit-email").value.trim();
    recipient.report = document.getElementById("edit-report").value;

    const checkedRadio = document.querySelector('input[name="edit-status"]:checked');
    if (checkedRadio) recipient.status = checkedRadio.value;

    renderRecipients();
    twCloseModal("edit-modal");
}

/* Remove Recipient modal - opens the Remove modal with the dropdown preset to whichever recipient's Remove button was clicked. The dropdown is rebuilt from scratch each time in case a recipient was added/removed since the last time this modal was opened */
function openRemoveModal(id) {
    const select = document.getElementById("remove-select");
    select.innerHTML = "";

    twRecipients.forEach((recipient) => {
        const option = document. createElement("option");
        option.value = recipient.id;
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
    const recipient = twRecipients.find((r) => r.id === Number(select.value));
    document.getElementById("remove-name-inline").textContent = recipient ? recipient.name : "this recipient";
}

function handleRemoveConfirm() {
    const select = document.getElementById("remove-select");
    const id = Number(select.value);

    twRecipients = twRecipients.filter((r) => r.id !== id);

    renderRecipients();
    twCloseModal("remove-modal");
}

/* Setup Event Listeners once the page has loaded */
document.addEventListener("DOMContentLoaded", () => {
    twHighlightNav();
    renderRecipients();

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