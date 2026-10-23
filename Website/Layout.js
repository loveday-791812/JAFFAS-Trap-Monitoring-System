// Aaron F: I want to add a shared layout for all pages that sign in that include a header and footer
// This file will be for implementting it aswell as implementing a page title, role and purpose in the header
// The footer will include informattion on who to contact if sometthing goes wrong with a trap or something with the site
// the order of operations will load tthis after the dashboard auth confirms that the signed in person is valid for the view they are looking at

(function () {
    const ROLES_LABELS = { worker: "Farmer", manager: "Farm Manager", admin: "Admin", pending: "Waiting for Approval" };

    // Aaron F: varible used until admin saves a contact in Settings Page, or when it cant be read
    const DEFAULT_CONTACT = { name: "Farm and Forest Telemetry", email: "insert actual email later in layout.js", phone: "insert contact number can delete later if its not needed" };
    // Aaron F: applying parametization
    const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    function roleLabel(role) {
        return ROLE_LABELS[role] || "Signed in";
    }

    function applyPageIdentity(role) {
        const data = document.body.dataset
        const name = data.pageName || "TrapWatch";
        const purpose = (role === "admin" && data.pagePurposeAdmin) || data.pagePurpose || "";
        const label = roleLabel(role);

        const nameE1 = document.getElementById("tw-page-name");
        if (nameE1) nameE1.textContent =name;

        const pill = document.getElementById("tw-role-pill");
        if (pill) {
            pill.textContent = label;
            pill.title = `You are signed in as ${label}`;
            pill.hidden = false;
        }

        const purposeE1 = document.getElementById("tw-page-purpose");
        if (purposeE1) purposeE1.textContent = purpose;

        document.title = `${name} · ${label} | TrapWatch`;

    }

    function renderContact(saved) {
        const contact = { ...DEFAULT_CONTACT };
        if (saved && typeof saved === "object") {
            if (typeof saved.email === "string" && EMAIL_PATTERN.test(saved.email.trim())) {
                contact.email = saved.email.trim();
                contact.name = typeof saved.name === "string" ? saved.name.trim() : "";
                contact.phone = typeof saved.phone === "string" ? saved.phone.trim() : "";

            }
        }
    }
}