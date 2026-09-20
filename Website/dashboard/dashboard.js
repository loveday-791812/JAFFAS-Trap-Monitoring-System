/* Dashboard page logic */
/* This file helps with 4 processes 
    1. Highlights the current page in the nav bar
    2. Store and render mock data (KPI and trap table)
    3. Handle the date-range dropdown and column sorting
    4. Build and download a JSON report of what's currently shown
    NOTE: twMockData is fake data. Only use for front-end development.
*/
function twHighlightNav() {
    const current = window.location.pathname.split("/").pop() || "dashboard.html";

    document.querySelectorAll(".tw-nav a").forEach((link) => {
        const href = link.getAttribute("href");
        if (href === current) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

/* Mock Data */
const twMockData = {
    
    "7d": {
        kpis: {
            totalCatches: 12,
            avgTimeToReset: "3.2 days",
            trapsOverdue: 1,
            currentTriggered: 6
        },
        traps: [
            { trapNo: "23", catchDate: "18/08 11:45", resetDate: "-", daysToReset: 6, status: "pending" },
            { trapNo: "41", catchDate: "17/08 19:10", resetDate: "-", daysToReset: 7, status: "overdue" },
            { trapNo: "17", catchDate: "13/08 08:14", resetDate: "14/08 09:00", daysToReset: 1, status: "reset" },
            { trapNo: "08", catchDate: "13/08 15:02", resetDate: "14/08 09:00", daysToReset: 1, status: "reset" },
        ],
    },

    "30d": {
        kpis: {
            totalCatches: 41,
            avgTimeToReset: "2.8 days",
            trapsOverdue: 3,
            currentTriggered: 6,
        },
        traps: [
            { trapNo: "23", catchDate: "18/08 11:45", resetDate: "-", daysToReset: 6, status: "pending"},
            { trapNo: "41", catchDate: "17/08 19:10", resetDate: "-", daysToReset: 7, status: "pending"},
            { trapNo: "17", catchDate: "13/08 08:14", resetDate: "14/08 09:00", daysToReset: 1, status: "reset"},
            { trapNo: "08", catchDate: "13/08 15:02", resetDate: "14/08 09:00", daysToReset: 1, status: "reset"},
            { trapNo: "12", catchDate: "02/08 07:30", resetDate: "10/08 09:00", daysToReset: 8, status: "overdue"},
            { trapNo: "05", catchDate: "28/07 14:20", resetDate: "29/07 09:00", daysToReset: 1, status: "reset"},
            { trapNo: "36", catchDate: "22/07 09:05", resetDate: "-", daysToReset: 8, status: "overdue"},
        ],
    },
    "all": {
        kpis: {
            totalCatches: 96,
            avgTimeToReset: "3.0 days",
            trapsOverdue: 5,
            currentTriggered: 6,
        },
        traps: [
            { trapNo: "23", catchDate: "18/08 11:45", resetDate: "-", daysToReset: 6, status: "pending" },
            { trapNo: "41", catchDate: "17/08 19:10", resetDate: "-", daysToReset: 7, status: "overdue" },
            { trapNo: "17", catchDate: "13/08 08:14", resetDate: "14/08 09:00", daysToReset: 1, status: "reset" },
            { trapNo: "08", catchDate: "13/08 15:02", resetDate: "14/08 09:00", daysToReset: 1, status: "reset" },
            { trapNo: "12", catchDate: "02/08 07:30", resetDate: "10/08 09:00", daysToReset: 8, status: "overdue" },
            { trapNo: "05", catchDate: "28/07 14:20", resetDate: "29/07 09:00", daysToReset: 1, status: "reset" },
            { trapNo: "36", catchDate: "22/07 09:05", resetDate: "-", daysToReset: 8, status: "overdue" },
            { trapNo: "29", catchDate: "14/07 10:00", resetDate: "15/07 09:00", daysToReset: 1, status: "reset" },
            { trapNo: "03", catchDate: "01/07 06:40", resetDate: "-", daysToReset: 9, status: "overdue" },
        ],
    },
};

const statusLabels = {
    pending: "Pending",
    overdue: "Overdue",
    reset: "Reset",
};

/* currentRange is for which dropdown option is currently selected (7d, 30d, all).
   currentSort is for which column the table is sorted by as well as which direction. For direction, "1" is ascending and -1 is descending                              */

let currentRange = "7d";
let currentSort = { column: null, direction: 1 };

/* Fills in 4 card values on the KPI for the given date range */
function renderKpis(range) {
    const kpis = twMockData[range].kpis;
    document.getElementById("kpi-total-catches").textContent = kpis.totalCatches;
    document.getElementById("kpi-avg-reset").textContent = kpis.avgTimeToReset;
    document.getElementById("kpi-overdue").textContent = kpis.trapsOverdue;
    document.getElementById("kpi-triggered").textContent = kpis.currentTriggered;
}

/* renderTable builds the table rows for the given date range, applies the current sort if any, and inserts them into the table body. This function will rerun every time the date range or the sort changes, so the table is always rebuilt from scratch rather than patching individual rows */
function renderTable(range) {
    const traps = [...twMockData[range].traps];   // copy the mock data array so sorting doesn't affect the original

    if (currentSort.column) {
        traps.sort((a, b) => {
            let valA = a[currentSort.column];
            let valB = b[currentSort.column];

            /* lower case strings */
            if (typeof valA === "string") valA = valA.toLowerCase();
            if (typeof valB === "string") valB = valB.toLowerCase();

            if (valA < valB) return -1 * currentSort.direction;
            if (valA > valB) return 1 * currentSort.direction;
            return 0;
        });
    }

    const tbody = document.getElementById("traps-tbody");
    tbody.innerHTML = "";   //clears existing rows before rebuilding

    traps.forEach((trap) => {
        const row = document.createElement("tr"); /* the badge-${trap.status} class picks up the right color from dashboard-stye.css (reset = green, overdue = red) */
        row.innerHTML = `<td>${trap.trapNo}</td> <td>${trap.catchDate}</td> <td>${trap.resetDate}</td> <td>${trap.daysToReset}</td> <td><span class="badge badge-${trap.status}">${statusLabels[trap.status]}</span></td>`;
        tbody.appendChild(row);
    });
}

/* Re-renders both KPI cards and table for whatever selected range. This gets called anytime currentRange changes */
function refreshDashboard() {
    renderKpis(currentRange);
    renderTable(currentRange);
}

/* builds a JSON file out of the current displayed data */
function downloadJson() {
    const payload = {
        dateRange: currentRange,
        generatedAt: new Date().toISOString(),
        kpis: twMockData[currentRange].kpis,
        traps: twMockData[currentRange].traps,
    };

    /* turn the JS object into a downloadable file */
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `trapwatch-report-${currentRange}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);   /* frees up memory for download */
}

/* Event listeners setup once page has loaded */
document.addEventListener("DOMContentLoaded", () => {
    twHighlightNav();
    refreshDashboard();     /* draw the "last 7 days" view */

    /* date range dropdown changed -> update which mock dataset is shown */
    document.getElementById("date-range-select").addEventListener("change", (e) => {
        currentRange = e.target.value;
        refreshDashboard();
    });

    /* download button clicked */
    document.getElementById("download-json-btn").addEventListener("click", downloadJson);

    /* every sortable column header gets a click listener. Clicking the same column twice flips the direction so from ascending to descending and vice versa */
    document.querySelectorAll("th[data-sort]").forEach((th) => {
        th.addEventListener("click", () => {
            const column = th.getAttribute("data-sort");
            if (currentSort.column === column) {
                currentSort.direction *= -1;
            } else {
              currentSort.column = column;
              currentSort.direction = 1;
            }
            renderTable(currentRange);
        });
    });
});