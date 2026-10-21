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

    
}