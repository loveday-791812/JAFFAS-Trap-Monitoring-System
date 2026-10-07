/* settings page logic */
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
    defautReportDaily: true,    //default recipients type
    defaultReportWeekly: false,
    defaultReportMonthly: false,
    emailNotificationsEnabled: true,
};

async function twGetSettings() {
    try {
        const snap = await rtdb.ref("Settings").once("value");
        const saved = snap.val();
        if (!saved) return { ...DEFAULT_SETTINGS}; //keeps default state if nothing is saved

        return { ...DEFAULT_SETTINGS, ...saved };
    }   catch (err) {
        console.error("Couldn't read settings, using defaults:", err);
        return { ...DEFAULT_SETTINGS };
    }
}
window.twGetSettings = twGetSettings //makes this page callable from other pages' JS files

/* fills saved data */
async function loadSettingsIntoForm() {
    const settings = await twGetSettings();
    document.getElementById("overdue-threshold").value = settings.overdueThreshold;
    document.getElementById("default-date-range").value = settings.defaultDateRange;
    document.getElementById("default-report-instant").checked = settings.defaultReportInstant;
    document.getElementById("default-report-daily").checked = settings.defautReportDaily;
    document.getElementById("default-report-weekly").checked = settings.defaultReportWeekly;
    document.getElementById("default-report-monthly").checked = settings.defaultReportMonthly;
    document.getElementById("email-notifications-enabled").checked = settings.emailNotificationsEnabled;
}

/* runs when save settings button clicked */
async function handleSettingsSubmit(e) {
    e.preventDefault();

    const settings = {
        overdueThreshold: Number(document.getElementById("overdue-threshold").value) || DEFAULT_SETTINGS.overdueThreshold,
        defaultDateRange: document.getElementById("default-date-range").value,
        defaultReportInstant: document.getElementById("default-report-instant").checked,
        defautReportDaily: document.getElementById("default-report-daily").checked,
        defaultReportWeekly: document.getElementById("default-report-weekly").checked,
        defaultReportMonthly: document.getElementById("default-report-monthly").checked,
        emailNotificationsEnabled: document.getElementById("email-notifications-enabled").checked,
    };

    try {
        await rtdb.ref("Settings").set(settings);

        const confirmation = document.getElementById("save-confirmation");
        confirmation.classList.add("show");
        setTimeout(() => confirmation.classList.remove("show"), 2000);
    } catch (err) {
        console.error("Couldn't save settings:", err);
        alert("Couldn't save setting. Please try again");
    }
}

//Set up even listeners
document.addEventListener("DOMContentLoaded", async () => {
    twHighlightNav();
    await loadSettingsIntoForm();   //shows what has been saved already

    document.getElementById("nav-toggle").addEventListener("click", (e) => {
        const nav = document.getElementById("tw-nav");
        const isOpen = nav.classList.toggle("open");
        e.target.setAttribute("aria-expanded", isOpen);
    });

    document.getElementById("help-btn").addEventListener("click", () => {
        twOpenModal("help-modal");
    });

    document.getElementById("settings-form").addEventListener("submit", handleSettingsSubmit); 
});
