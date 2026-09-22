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

//default settings for before anything starts
const DEFAULT_SETTINGS = {
    overdueThreshold: 7,    //matches 7 days
    defaultDateRange: "7d",
    defaultReportFrequency: "Daily",  //default recipients type
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
    document.getElementById("default-report-frequency").value = settings.defaultReportFrequency;
}

/* runs when save settings button clicked */
async function handleSettingsSubmit(e) {
    e.preventDefault();

    const settings = {
        overdueThreshold: Number(document.getElementById("overdue-threshold").value) || DEFAULT_SETTINGS.overdueThreshold,
        defaultDateRange: document.getElementById("default-date-range").value,
        defaultReportFrequency: document.getElementById("default-report-frequency").value,
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
    document.getElementById("settings-form").addEventListener("submit", handleSettingsSubmit); 
});