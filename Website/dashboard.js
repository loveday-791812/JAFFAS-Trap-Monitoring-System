/* Dashboard page logic */
/* This file helps with 4 processes 
    1. Highlights the current page in the nav bar
    2. Store and render mock data (KPI and trap table)
    3. Handle the date-range dropdown and column sorting
    4. Build and download a JSON report of what's currently shown
*/

const twNorm = (s) => String(s).trim().toUpperCase();

const twDate = (s) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");

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

let twOverdueDays = 7;
const RESET_GAP_MS = 90 * 60 * 1000;

function twTrapLabels(traps, links) {
    const out = {};
    Object.values(links).forEach((l) => {
        if (!l || !l.transmitter_ID) return;
        const t = traps[l.trap_ID] || Object.values(traps).find((x) => x && String(x.trap_num) === String(l.trap_ID));
        (out[twNorm(l.transmitter_ID)] ||= []).push(t ? t.trap_num : l.trap_ID);
    });
    Object.keys(out).forEach((k) => (out[k] = out[k].join("/")));
    return out;
}

function twOpenModal(modalId) {
    document.getElementById(modalId).classList.add("open");
}

function twCloseModal(modalId) {
    document.getElementById(modalId).classList.remove("open");
}

/* Mock Data */
let twData = { "7d": null, "30d": null, "all": null};
let twTotalTraps = 0;

async function loadData() {
    const [trapsSnap, eventsSnap, txSnap, linkSnap] = await Promise.all([
        rtdb.ref("Traps").once("value"),
        rtdb.ref("Events").once("value"),
        rtdb.ref("Transmitters").once("value"),
        rtdb.ref("TrapTransmitter").once("value"),
    ]);

    const traps = trapsSnap.val() || {};
    const events = eventsSnap.val() || {};
    const transmitters = txSnap.val() || {};
    const labels = twTrapLabels(traps, linkSnap.val() || {});

    const txNorm = {};
    Object.entries(transmitters).forEach(([k, v]) => (txNorm[twNorm(k)] = v));
    twTotalTraps = Object.keys(txNorm).length;

    const eventList = Object.values(events)
        .filter((e) => (e.transmitter_ID || e.trap_ID) != null && e.timeStamp)
        .map((e) => ({ txId: twNorm(e.transmitter_ID || e.trap_ID), date: twDate(e.timeStamp) }))
        .filter((e) => !isNaN(e.date));
    
    twData["7d"] = buildRangeData(eventList, txNorm, labels, 7);
    twData["30d"] = buildRangeData(eventList, txNorm, labels, 30);
    twData["all"] = buildRangeData(eventList, txNorm, labels, null);
};

function buildRangeData(eventList, transmitters, labels, days) {
    const now = Date.now();
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
    const filtered = cutoff ? eventList.filter((e) => e.date >= cutoff) : eventList;

    const latestByTx = {};
    filtered.forEach((e) => {
        if (!latestByTx[e.txId] || e.date > latestByTx[e.txId].date) latestByTx[e.txId] = e;
    });

    const trapRows = Object.entries(latestByTx).map(([txId, ev]) => {
        const ls = transmitters[txId] && transmitters[txId].last_seen ? twDate(transmitters[txId].last_seen) : null;
        const lastSeen = ls && !isNaN(ls) ? Math.max(ls.getTime(), ev.date.getTime()) : ev.date.getTime();
        const pending = now - lastSeen < RESET_GAP_MS;
        const overdue = pending && now - ev.date.getTime() > twOverdueDays * 86400000;
        const status = overdue ? "overdue" : pending ? "pending" : "reset";
        return {
            trapNo: labels[txId] || txId,
            catchDate: ev.date.toLocaleString(),
            resetDate: pending ? "-" : new Date(lastSeen).toLocaleString(),
            daysToReset: pending ? "-" : Number(((lastSeen - ev.date.getTime()) / 86400000).toFixed(1)),
            status,
        };
    });

    const resetTimes = trapRows.map((t) => t.daysToReset).filter((d) => typeof d === "number");
    const  avg = resetTimes.length
        ? (resetTimes.reduce((a, b) => a + b, 0) / resetTimes.length).toFixed(1) + " days"
        : "-";
    return {
        kpis: {
            totalCatches: filtered.length,
            avgTimeToReset: avg,
            trapsOverdue: trapRows.filter((t) => t.status === "overdue").length,
            currentTriggered: trapRows.filter((t) => t.status !== "reset").length,
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
let showTriggeredPercentage = false;

/* Fills in 4 card values on the KPI for the given date range */
function renderKpis(range) {
    const kpis = twData[range].kpis;
    document.getElementById("kpi-total-catches").textContent = kpis.totalCatches;
    document.getElementById("kpi-avg-reset").textContent = kpis.avgTimeToReset;
    document.getElementById("kpi-overdue").textContent = kpis.trapsOverdue;
    renderTriggered(range);
}

function renderTriggered(range) {
    const triggered = twData[range].kpis.currentTriggered;
    const valueEl = document.getElementById("kpi-triggered");
    const btn = document.getElementById("kpi-triggered-toggle");

    if (showTriggeredPercentage && twTotalTraps > 0) {
        const pct = (triggered / twTotalTraps) * 100;
        valueEl.textContent = (Number.isInteger(pct) ? pct : pct.toFixed(1)) + "%";
        btn.textContent = "Show total";
    } else {
        valueEl.textContent = triggered;
        btn.textContent = "Show %";
    }
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
    const settings = await twGetSettings();
    twOverdueDays = Number(settings.overdueThreshold) || 7;
    currentRange = settings.defaultDateRange;
    document.getElementById("date-range-select").value = currentRange;
    document.getElementById("kpi-overdue-label").textContent = `TRAPS OVERDUE (>${settings.overdueThreshold} DAYS)`
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

    /* togle Current Triggered Traps card between count adn % */
    document.getElementById("kpi-triggered-toggle").addEventListener("click", () => {
        showTriggeredPercentage = !showTriggeredPercentage;
        renderTriggered(currentRange);
    });

    document.getElementById("download-json-btn").addEventListener("click", () => {
        downloadJson();
    });

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