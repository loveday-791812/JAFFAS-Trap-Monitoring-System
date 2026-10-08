

/* settings page logic */

await window.twAuthReady;  //Aaron: wait for the twAuthReady promise to resolve before running the rest of the code


function twHighlightNav() {
    const current = window.location.pathname.split("/").pop() || "settings.html";
    document.querySelectorAll(".tw-nav a").forEach((link) => {
        const href = link.getAttribute("href");
        if (href === current) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

function twOpenModal(modalId) {
    document.getElementById(modalId).classList.add("open");
}

// hides modal overlay
function twCloseModal(modalId) {
    document.getElementById(modalId).classList.remove("open");
}



/* default settings for before anything starts
   defaultReportFrequency is now replace with 4 independent booleans since a recipient can now choose more that one report type at once. Daily defaults to "true" */
const DEFAULT_SETTINGS = {
    overdueThreshold: 7,    //matches 7 days
    defaultDateRange: "7d",
    defaultReportInstant: false,
    defaultReportDaily: true,    //default recipients type
    defaultReportWeekly: false,
    defaultReportMonthly: false,
    emailNotificationsEnabled: true,
};

async function twGetSettings() {
    try {
        const snap = await rtdb.ref("Settings").once("value");
        const saved = snap.val();
        if (!saved) return { ...DEFAULT_SETTINGS}; //keeps default state if nothing is saved
        
        if (saved.defaultReportDaily === undefined && saved.defautReportDaily !== undefined) {
            saved.defaultReportDaily = saved.defautReportDaily;
        }
        return { ...DEFAULT_SETTINGS, ...saved };
    }   catch (err) {
        console.error("Couldn't read settings, using defaults:", err);
        return { ...DEFAULT_SETTINGS };
    }
}
window.twGetSettings = twGetSettings //makes this page callable from other pages' JS files

const MY_REPORT_FIELDS = {
    instant: "reportInstant",
    daily: "reportDaily",
    weekly: "reportWeekly",
    monthly: "reportMonthly",
};

let twMyRecipientId = null;
let twMyRecipient = null;
let twMyEmail = "";
let twIsAdmin = false;

function twWaitForUser() {
    return new Promise((resolve) => {
        const unsub = twAuth.onAuthStateChanged((user) => {
            if (user) {
                unsub();
                resolve(user);
            }
        });
    });
}

function twMyFlag(recipient, type) {
    if (!recipient) return null;
    const field = MY_REPORT_FIELDS[type];
    if (recipient[field] !== undefined) return !!recipient[field];
    return recipient.report === type.charAt(0).toUpperCase() + type.slice(1);
}

async function twFindMyRecipient(email) {
    const candidates = [...new Set([email, email.toLowerCase()])];
    for (const candidate of candidates) {
        const snap = await rtdb.ref("Recipients").orderByChild("email").equalTo(candidate).once("value");
        if (snap.exists()) {
            const found = snap.val();
            const id = Object.keys(found)[0];
            return { id, record: found[id] };
        }
    }
    return null;
}

async function twLoadMyPreferences(user) {
    const profileSnap = await rtdb.ref(`users/${user.uid}`).get();
    const profile = profileSnap.val() || {};
    twIsAdmin = (profile.role || "").toLowerCase() === "admin";
    twMyEmail = (profile.email || user.email || "").trim();

    const emailLabel = document.getElementById("my-email-label");
    if (emailLabel) emailLabel.textContent = twMyEmail;

    if (!twMyEmail) return;

    const found = await twFindMyRecipient(twMyEmail);
    if (found) {
        twMyRecipientId = found.id;
        twMyRecipient = found.record;
    }

    ["instant", "daily", "weekly", "monthly"].forEach((type) => {
        const box = document.getElementById(`my-report-${type}`);
        box.checked = twMyRecipient ? !!twMyFlag(twMyRecipient, type) : false;
    });

    const note = document.getElementById("my-paused-note");
    if (note) note.style.display = (twMyRecipient && twMyRecipient.status === "paused") ? "block" : "none";
}

async function twSaveMyPreferences() {
    if (!twMyEmail) throw new Error("No email found for this account");

    const flags = {
        reportInstant: document.getElementById("my-report-instant").checked,
        reportDaily: document.getElementById("my-report-daily").checked,
        reportWeekly: document.getElementById("my-report-weekly").checked,
        reportMonthly: document.getElementById("my-report-monthly").checked,
    };

    if (twMyRecipientId) {
        await rtdb.ref(`Recipients/${twMyRecipientId}`).update(flags);
        twMyRecipient = { ...twMyRecipient, ...flags };
    } else {
        const newRef = rtdb.ref("Recipients").push();
        const record = {
            name: twMyEmail.split("@")[0],
            email: twMyEmail,
            status: "active",
            ...flags,
        };
        await newRef.set(record);
        twMyRecipientId = newRef.key;
        twMyRecipient = record;
    }
}

/* fills saved data */
async function loadSettingsIntoForm() {
    const settings = await twGetSettings();
    document.getElementById("overdue-threshold").value = settings.overdueThreshold;
    document.getElementById("default-date-range").value = settings.defaultDateRange;
    document.getElementById("email-notifications-enabled").checked = settings.emailNotificationsEnabled;
}

async function saveAdminSettings() {
    const settings = {
        overdueThreshold : Number(document.getElementById("overdue-threshold").value) || DEFAULT_SETTINGS.overdueThreshold,
        defaultDateRange : document.getElementById("default-date-range").value,
        emailNotificationsEnabled: document.getElementById("email-notifications-enabled").checked,
    };
    await rtdb.ref("Settings").set(settings);
}

/* runs when save settings button clicked */
async function handleSettingsSubmit(e) {
    e.preventDefault();

    try {
        await twSaveMyPreferences();
        if (twIsAdmin) await saveAdminSettings();

        const confirmation = document.getElementById("save-confirmation");
        confirmation.classList.add("show");
        setTimeout(() => confirmation.classList.remove("show"), 2000);
    } catch (err) {
        console.error("Couldn't save settings:", err);
        alert("Couldn't save settings. Please try again");
    }
}


//Set up even listeners
document.addEventListener("DOMContentLoaded", async () => {
    if (!document.getElementById("settings-form")) return;

    twHighlightNav();

    document.getElementById("nav-toggle").addEventListener("click", (e) => {
        const nav = document.getElementById("tw-nav");
        const isOpen = nav.classList.toggle("open");
        e.target.setAttribute("aria-expanded", isOpen);
    });

    document.getElementById("help-btn").addEventListener("click", () => {
        twOpenModal("help-modal");
    });

    document.getElementById("settings-form").addEventListener("submit", handleSettingsSubmit);

    const user = await twWaitForUser();
    await twLoadMyPreferences(user);

    if (twIsAdmin) {
        document.querySelectorAll("[data-admin-only]").forEach((el) => el.removeAttribute("hidden"));
        await loadSettingsIntoForm();
    }
});
