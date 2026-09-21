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

const SETTINGS_KEY = "twSetttings";     // key for localStorage

//default settings for before anything starts
const DEFAULT_SETTINGS = {
    overdueThreshold: 7,    //matches 7 days
    defaultDateRange: "7d",
    defaultReportFrequency: "Daily",  //default recipients type
};

function twGetSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS}; //keeps default state if nothing is saved

        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }   catch (err) {
        console.error("Couldn't read settings, using defaults:", err);
        return { ...DEFAULT_SETTINGS };
    }
}
window.twGetSettings = twGetSettings //makes this page callable from other pages' JS files

/* fills saved data */
function loadSettingsIntoForm() {
    const settings = twGetSettings();
    document.getElementById("overdue-threshold").value = settings.overdueThreshold;
    document.getElementById("default-date-range").value = settings.defaultDateRange;
    document.getElementById("default-report-frequency").value = settings.defaultReportFrequency;
}

/* runs when save settings button clicked */
function handleSettingsSubmit(e) {
    e.preventDefault();

    const settings = {
        overdueThreshold: Number(document.getElementById("overdue-threshold").value) || DEFAULT_SETTINGS.overdueThreshold,
        defaultDateRange: document.getElementById("default-date-range").value,
        defaultReportFrequency: document.getElementById("default-report-frequency").value,
    };

    /* converts JS into string for localStorage */
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    const confirmation = document.getElementById("save-confirmation");
    confirmation.classList.add("show");
    setTimeout(() => confirmation.classList.remove("show"), 2000);
}

//Set up even listeners
document.addEventListener("DOMContentLoaded", () => {
    twHighlightNav();
    loadSettingsIntoForm();   //shows what has been saved already
    document.getElementById("settings-form").addEventListener("submit", handleSettingsSubmit); 
});