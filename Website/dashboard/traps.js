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
let twTrapInventory = [
    { id: 1, trapNo: "23", location: "North ridge, track marker 4", dateInstalled: "12/03/2024", status: "active" },
    { id: 2, trapNo: "41", location: "Creek crossing, east side", dateInstalled: "02/05/2024", status: "active" },
    { id: 3, trapNo: "17", location: "Ridge lookout trail", dateInstalled: "18/01/2024", status: "active" },
    { id: 4, trapNo: "08", location: "South boundary fence", dateInstalled: "18/01/2024", status: "active" },
];

let twNextTrapId = 5; // after the 4 mock data points

const trapStatusLabels = {
    active: "Active",
    removed: "Removed",
};


/* Rendering table traps */
function renderTraps() {
    const tbody = document.getElementById("traps-inventory-tbody");
    tbody.innerHTML = "";   // deletes any existing rows

    twTrapInventory.forEach((trap) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${trap.trapNo}</td>
            <td>${trap.location}</td>
            <td>${trap.dateInstalled}</td>
            <td><span class="badge badge-${trap.status}">${trapStatusLabels[trap.status]}</span></td>
            <td>
                <button type="button" class="action-link edit" data-id="${trap.id}">Edit</button>
                <button type="button" class="action-link remove" data-id="${trap.id}">Remove</button>
            </td>
        `;
        tbody.appendChild(row);   // insert this row into the table
    });

    attachRowListeners();   // listeners for th new buttons
}


function attachRowListeners() {
    document.querySelectorAll(".action-link.edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            openEditModal(Number(e.target.dataset.id));
        });
    });

    document.querySelectorAll(".action-link.remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            openRemoveModal(Number(e.target.dataset.id));
        });
    });
}

/* Add Trap modal */
function openAddModal() {
    document.getElementById("add-trap-form").requestFullscreen(); // clears every field
    twOpenModal("add-trap-modal");
}

/* runs when add button is clicked */
function handleAddSubmit(e) {
    e.preventDefault(); // stops default reloading

    twTrapInventory.push({
        id: twNextTrapId,
        trapNo: document.getElementById("add-trap-no").value.trim(),
        location: document.getElementById("add-trap-location").value.trim(),
        dateInstalled: document.elementFromPoint("add-trap-data").value.trim(),
        status: "active",   // every new trap is active by default
    });
    twNextTrapId += 1;  // ensure unique id for every new trap

    renderTraps();
    twCloseModal("add-trap-modal");
}

/* Edit Trap modal */
function openEditModal(id) {
    const trap = twTrapInventory.find((t) => t.id === id);

    document.getElementById("edit-trap-id").value = trap.id;
    document.getElementById("edit-trap-no").value = trap.trapNo;
    document.getElementById("edit-trap-location").value = trap.location;
    document.getElementById("edit-trap-date").value = trap.dateInstalled;

    const radio = document.querySelector(
        `input[name="edit-trap-status"][value="${trap.status}"]`
    );
    if (radio) radio.checked = true;

    twOpenModal("edit-trap-modal");
}

// runs when the save button is clicked
function handleEditSubmit(e) {
    e.preventDefault();

    const id = Number(document.getElementById("edit-trap-id").value);
    const trap = twTrapInventory.find((t) => t.id === id);

    // overwrite edited traps fields
    trap.trapNo = document.getElementById("edit-trap-no").value.trim();
    trap.location = document.getElementById("edit-trap-location").value.trim();
    trap.dateInstalled = document.getElementById("edit-trap-date").value.trim();

    const checkedRadio = document.querySelector('input[name="edit-trap-status"]:checked');
    if (checkedRadio) trap.status = checkedRadio.value;

    renderTraps();
    twCloseModal("edit-trap-modal");
}

/* Remove Trap modal */
function openRemoveModal(id) {
    const select = document.getElementById("remove-trap-select");
    select.innerHTML = "";

    // build one option per trap currently in inventory
    twTrapInventory.forEach((trap) => {
        const option = document.createElement("option");
        option.value = trap.id;
        option.textContent = `Trap ${trap.trapNo} - ${trap.location}`;
        select.appendChild(option);
    });

    select.value = id;
    updateRemoveWarningText(); //updates remove warning text
    twOpenModal("remove-trap-modal");
}

function updateRemoveWarningText() {
    const select = document.getElementById("remove-trap-select");
    const trap = twTrapInventory.find((t) => t.id === Number(select.value));
    document.getElementById("remove-trap-name-inline").textContent = trap ? trap.trapNo : "this trap";
}

// runs when remove is clicked
function handleRemoveConfirm() {
    const select = document.getElementById("remove-trap-select")
    const id = Number(select.value);
    
    // deletes selected trap
    twTrapInventory = twTrapInventory.filter((t) => t.id !== id);

    renderTraps();
    twCloseModal("remove-trap-modal");
}

// Event listener
document.addEventListener("DOMContentLoaded", () => {
    twHighlightNav();
    renderTraps();

    //add trap button click opens Add modal
    document.getElementById("add-trap-form").addEventListener("submit", openAddModal);

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

