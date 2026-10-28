// Aaron F: I want to add a shared layout for all pages that sign in that include a header and footer
// This file will be for implementting it aswell as implementing a page title, role and purpose in the header
// The footer will include informattion on who to contact if sometthing goes wrong with a trap or something with the site
// the order of operations will load tthis after the dashboard auth confirms that the signed in person is valid for the view they are looking at

(function () {
    const ROLE_LABELS = { worker: "Farmer", manager: "Farm Manager", admin: "Admin", pending: "Waiting for Approval" };

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

        const nameE1 = document.getElementById("tw-admin-name");
        if (nameE1) nameE1.textContent = contact.name;
        const nameWrap = document.getElementById("tw-admin-name-wrap");
        if (nameWrap) nameWrap.hidden = !contact.name;

        const emailE1 = document.getElementById("tw-admin-email");
        if (emailE1) {
            emailE1.textContent = contact.email;
            emailE1.href = `mailto:${contact.email}`;
        }

        const phoneWrap = document.getElementById("tw-admin-phone-wrap");
        const phoneE1 = document.getElementById("tw-admin-phone");
        if (phoneWrap && phoneE1) {
            phoneWrap.hidden = !contact.phone;
            phoneE1.textContent = contact.phone;
            phoneE1.href = contact.phone ? `tel:${contact.phone.replace(/[^0-9+]/g, "")}` : "#";
        }
    }

    async function loadContact() {
        try {
            const snap = await rtdb.ref("Settings/adminContact").once("value");
            renderContact(snap.val());
        } catch (err) {
            renderContact(null); //Aaron F: not signed in or nott allowed, keep the default contact
        }

    }

    function renderSignedIn(user, role) {
        const userE1 = document.getElementById("tw-footer-user");
        if (!userE1) return;
        userE1.textContent = user && user.email ? `Signed in as ${user.email} (${roleLabel(role)})` : "";        
    }
    window.twLayout = {roleLabel, applyPageIdentity, renderContact, loadContact, DEFAULT_CONTACT };

    document.addEventListener("DOMContentLoaded", async () => {
        renderContact(null);
        if (!window.twAuthReady) {
            // Aaron F: pages that don't run the role check like unauthorized.html
            // Aaron F: twAuth is a top-level const in firebase-config.js so it isn't on window
            if (typeof twAuth !== "undefined") twAuth.onAuthStateChanged((user) => { if (user) loadContact(); });
            return;
        }

        const user = await window.twAuthReady;   // Aaron F: resolves only once the role check has finished and passed
        applyPageIdentity(window.twCurrentRole);
        renderSignedIn(user, window.twCurrentRole);
        loadContact();
    });
})();




