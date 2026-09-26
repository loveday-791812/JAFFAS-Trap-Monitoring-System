/* Dashboard page logic */
/* This file helps with 4 processes 
    1. Highlights the current page in the nav bar
    2. Store and render mock data (KPI and trap table)
    3. Handle the date-range dropdown and column sorting
    4. Build and download a JSON report of what's currently shown
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

function twOpenModal(modalId) {
    document.getElementById(modalId).classList.add("open");
}

function twCloseModal(modalId) {
    document.getElementById(modalId).classList.remove("open");
}

/* Mock Data */
let twData = { "7d": null, "30d": null, "all": null};

async function loadData() {
    const [trapsSnap, eventsSnap] = await Promise.all([
        rtdb.ref("Traps").once("value"),
        rtdb.ref("Events").once("value"),
    ]);

    const traps = trapsSnap.val() || {};
    const events = eventsSnap.val() || {};

    const trapsByNum = {};
    Object.values(traps).forEach((t) => {
        trapsByNum[String(t.trap_num)] = t;
    });

    const eventList = Object.values(events)
        .filter((e) => e.trap_ID != null && e.timeStamp)
        .map((e) => ({
            trapNum: String(e.trap_ID),
            date: new Date(e.timeStamp),
        }));
    
    twData["7d"] = buildRangeData(eventList, trapsByNum, 7);
    twData["30d"] = buildRangeData(eventList, trapsByNum, 30);
    twData["all"] = buildRangeData(eventList, trapsByNum, null);

};

function buildRangeData(eventList, trapsByNum, days) {
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
    const filtered = cutoff ? eventList.filter((e) => e.date >= cutoff) : eventList;

    const latestByTrap = {};
    filtered.forEach((e) => {
        if (!latestByTrap[e.trapNum] || e.date > latestByTrap[e.trapNum].date) {
            latestByTrap[e.trapNum] = e;
        }
    });

    const trapRows = Object.entries(latestByTrap).map(([trapNum, catchEvent]) => {
        const trapInfo = trapsByNum[trapNum] || {};
        const resetAt = trapInfo.reset_at ? new Date(trapInfo.reset_at) : null;
        const daysToReset = resetAt
            ? Math.round((resetAt - catchEvent.date) / 86400000)
            : null;
        
        return {
            trapNo: trapNum,
            catchDate: catchEvent.date.toLocaleString(),
            resetDate: resetAt ? resetAt.toLocaleString() : "-",
            daysToReset: daysToReset ?? "-",
            status: trapInfo.status || "pending", 
        };
    });

    const overdue = trapRows.filter((t) => t.status === "overdue").length;
    const resetTimes = trapRows.map((t) => t.daysToReset).filter((d) => typeof d === "number");
    const  avg = resetTimes.length
        ? (resetTimes.reduce((a, b) => a + b, 0) / resetTimes.length).toFixed(1) + " days"
        : "-";
    return {
        kpis: {
            totalCatches: filtered.length,
            avgTimeToReset: avg,
            trapsOverdue: overdue,
            currentTriggered: trapRows.filter((t) => t.status === "pending").length,
        },
        traps: trapRows,
    };
}

const statusLabels = {
    pending: "⏳ Pending",
    overdue: "⚠️ Overdue",
    reset: "✅ Reset",
};

/* currentRange is for which dropdown option is currently selected (7d, 30d, all).
   currentSort is for which column the table is sorted by as well as which direction. For direction, "1" is ascending and -1 is descending                              */

let currentRange = "7d";
let currentSort = { column: null, direction: 1 };

/* Fills in 4 card values on the KPI for the given date range */
function renderKpis(range) {
    const kpis = twData[range].kpis;
    document.getElementById("kpi-total-catches").textContent = kpis.totalCatches;
    document.getElementById("kpi-avg-reset").textContent = kpis.avgTimeToReset;
    document.getElementById("kpi-overdue").textContent = kpis.trapsOverdue;
    document.getElementById("kpi-triggered").textContent = kpis.currentTriggered;
}

/* renderTable builds the table rows for the given date range, applies the current sort if any, and inserts them into the table body. This function will rerun every time the date range or the sort changes, so the table is always rebuilt from scratch rather than patching individual rows */
function renderTable(range) {
    const traps = [...twData[range].traps];    /* copy the mock data array with [....] */

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

    document.querySelectorAll("th[data-sort]").forEach((th) => {
        const arrow = th.querySelector(".sort-arrow");
        const column = th.getAttribute("data-sort");
        if (column === currentSort.column) {
            arrow.textContent = currentSort.direction === 1 ? "↑" : "↓";
        } else {
            arrow.textContent = "↕";
        }
    });

    const tbody = document.getElementById("traps-tbody");
    tbody.innerHTML = "";   //clears existing rows before rebuilding

    traps.forEach((trap) => {
        const row = document.createElement("tr"); /* the badge-${trap.status} class picks up the right color from dashboard-stye.css (reset = green, overdue = red) */
        row.innerHTML = `
            <td>${trap.trapNo}</td>
            <td>${trap.catchDate}</td>
            <td>${trap.resetDate}</td>
            <td>${trap.daysToReset}</td>
            <td><span class="badge badge-${trap.status}">${statusLabels[trap.status]}</span></td>
        `;
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
        kpis: twData[currentRange].kpis,
        traps: twData[currentRange].traps,
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
document.addEventListener("DOMContentLoaded", async () => {
    twHighlightNav();
    await loadData();
    refreshDashboard();     /* draw the "last 7 days" view */

    document.getElementById("nav-toggle").addEventListener("click", (e) => {
        const nav = document.getElementById("tw-nav");
        const isOpen = nav.classList.toggle("open");
        e.target.setAttribute("aria-expanded", isOpen);
    })

    /* date range dropdown changed -> update which mock dataset is shown */
    document.getElementById("date-range-select").addEventListener("change", (e) => {
        currentRange = e.target.value;
        refreshDashboard();
    });

    /* download button clicked */
    document.getElementById("download-json-btn").addEventListener("click", downloadJson);

    document.getElementById("help-btn").addEventListener("click", () => {
        twOpenModal("help-modal");
    });

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