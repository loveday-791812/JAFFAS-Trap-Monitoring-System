/* Traps logic page - twTrapInventory is fake data that only exists in the browser's memory - refreshing the page resets it back to the original 4 traps. We will replace it with real API calls */
function twHighlightNav() {

    const current = window.location.pathname.split("/").pop() || "traps.html";

    document.querySelectorAll(".tw-nav a").forEach((link) => {
        const href = link.getAttribute("href");
        if (href === current) {
            link.classList.add("active"); // this is the current page to highlight
        } else {
            link.classList.remove("active"); // not the current page - do not highlight
        }
    });
}

/* makes modal overlay visible */
function twOpenModal(modalId) {
    document.getElementById(modalId).classList.add("open");
}

// hides modal overlay
function twCloseModal(modalId) {
    document.getElementById(modalId).classList.remove("open");
}

/* Mock data */
let twTrapInventory = {};

async function loadTraps() {
    const snap = await rtdb.ref("Traps").once("value");
    twTrapInventory = snap.val() || {};
}

let twNextTrapId = 5; // after the 4 mock data points

const trapStatusLabels = {
    active: "✅ Active",
    removed: "🗑️ Removed",
};


/* Rendering table traps */
function renderTraps() {
    const tbody = document.getElementById("traps-inventory-tbody");
    tbody.innerHTML = "";   // deletes any existing rows

    Object.entries(twTrapInventory).forEach(([id, trap]) => {
        const status = trap.status || "active";
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${trap.trap_num ?? "-"}</td>
            <td>${trap.trap_location || "-"}</td>
            <td>${trap.date_installed || "-"}</td>
            <td><span class="badge badge-${status}">${trapStatusLabels[status] || status}</span></td>
            <td>
                <button type="button" class="action-link edit" data-id="${id}">Edit</button>
                <button type="button" class="action-link remove" data-id="${id}">Remove</button>
            </td>
        `;
        tbody.appendChild(row);   // insert this row into the table
    });

    attachRowListeners();   // listeners for th new buttons
}


function attachRowListeners() {
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

/* Add Trap modal */
function openAddModal() {
    document.getElementById("add-trap-form").reset(); // clears every field
    twOpenModal("add-trap-modal");
}

/* runs when add button is clicked */
async function handleAddSubmit(e) {
    e.preventDefault(); // stops default reloading

        const newTrap = {
        trap_num: document.getElementById("add-trap-no").value.trim(),
        trap_location: document.getElementById("add-trap-location").value.trim(),
        date_installed: document.getElementById("add-trap-date").value.trim(),
        status: "active",   // every new trap is active by default
    };

    const newRef = rtdb.ref("Traps").push();
    await newRef.set(newTrap);
    twTrapInventory[newRef.key] = newTrap;

    renderTraps();
    twCloseModal("add-trap-modal");
}

/* Edit Trap modal */
function openEditModal(id) {
    const trap = twTrapInventory[id]

    document.getElementById("edit-trap-id").value = id;
    document.getElementById("edit-trap-no").value = trap.trap_num ?? "";
    document.getElementById("edit-trap-location").value = trap.trap_location || "";
    document.getElementById("edit-trap-date").value = trap.date_installed || "";

    const status = trap.status || "active";
    const radio = document.querySelector(
        `input[name="edit-trap-status"][value="${status}"]`
    );
    if (radio) radio.checked = true;

    twOpenModal("edit-trap-modal");
}

// runs when the save button is clicked
async function handleEditSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("edit-trap-id").value;
    const updated = {
        trap_num: document.getElementById("edit-trap-no").value.trim(),
        trap_location: document.getElementById("edit-trap-location").value.trim(),
        date_installed: document.getElementById("edit-trap-date").value.trim(),
    }
    
    const checkedRadio = document.querySelector('input[name="edit-trap-status"]:checked');
    if (checkedRadio) updated.status = checkedRadio.value;

    await rtdb.ref(`Traps/${id}`).update(updated);
    twTrapInventory[id] = { ...twTrapInventory[id], ...updated };

    renderTraps();
    twCloseModal("edit-trap-modal");
}

/* Remove Trap modal */
function openRemoveModal(id) {
    const select = document.getElementById("remove-trap-select");
    select.innerHTML = "";

    // build one option per trap currently in inventory
    Object.entries(twTrapInventory).forEach(([key, trap]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = `Trap ${trap.trap_num ?? key} - ${trap.trap_location || "Unknown location"}`;
        select.appendChild(option);
    });

    select.value = id;
    updateRemoveWarningText(); //updates remove warning text
    twOpenModal("remove-trap-modal");
}

function updateRemoveWarningText() {
    const select = document.getElementById("remove-trap-select");
    const trap = twTrapInventory[select.value];
    document.getElementById("remove-trap-name-inline").textContent = trap ? (trap.trap_num ?? select.value) : "this trap";
}

// runs when remove is clicked
async function handleRemoveConfirm() {
    const select = document.getElementById("remove-trap-select")
    const id = select.value;

    await rtdb.ref(`Traps/${id}`).remove();
    delete twTrapInventory[id];

    renderTraps();
    twCloseModal("remove-trap-modal");
}

// Event listener
document.addEventListener("DOMContentLoaded", async () => {
    twHighlightNav();
    await loadTraps();
    renderTraps();

    document.getElementById("help-btn").addEventListener("click", () => {
        twOpenModal("help-modal");
    });

    document.getElementById("nav-toggle").addEventListener("click", (e) => {
        const nav = document.getElementById("tw-nav");
        const isOpen = nav.classList.toggle("open");
        e.target.setAttribute("aria-expanded", isOpen);
    });

    //add trap button click opens Add modal
    document.getElementById("add-trap-btn").addEventListener("click", openAddModal);

    //add/edit form submitted
    document.getElementById("add-trap-form").addEventListener("submit", handleAddSubmit);
    document.getElementById("edit-trap-form").addEventListener("submit", handleEditSubmit);

    //remove button click removes trap
    document.getElementById("confirm-remove-trap-btn").addEventListener("click", handleRemoveConfirm);

    //update warning text to whoever the user is
    document.getElementById("remove-trap-select").addEventListener("change", updateRemoveWarningText);

    //closes the modal when clicked outside
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.classList.remove("open");
        });
    });

    //press esc to close
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal-overlay.open").forEach((overlay) => {
                overlay.classList.remove("open");
            });
        }
    });
});

