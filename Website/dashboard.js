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
            <td>${twEscape(trap.trapNo)}</td>
            <td>${twEscape(trap.catchDate)}</td>
            <td>${twEscape(trap.resetDate)}</td>
            <td>${twEscape(trap.daysToReset)}</td>
            <td><span class="badge badge-${twEscape(trap.status)}">${statusLabels[trap.status]}</span></td>
        `; //Aaron F: incase bad values are run accross the site from injecting elements that fail to load then it affects everyone who visits the page not just the user.
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

/*Aaron F: The groups are saved per account Saved per account at trapGroups. The database rules only let the signed-in account read or write its own groups. */
const TW_GROUP_LIMIT = 20;
const TW_GROUP_NAME_MAX = 40;

let twUid = null;
let twGroups = {};            // this account's groups
let twCurrentGroup = "";      // "" = all traps
let twEditingGroupId = null;  // null while making a new group
let twPickerSelection = new Set();

function twGroupsRef(groupId) {
    return rtdb.ref(groupId ? `trapGroups/${twUid}/${groupId}` : `trapGroups/${twUid}`);
}

/*Aaron F: trap keys in a group that still exist in Traps and a trap removed from the inventory drops out from the group*/
function twGroupTrapKeys(group) {
    return Object.keys((group && group.traps) || {}).filter((key) => twAllTraps[key]);
}

function twCountLabel(n) {
    return `${n} ${n === 1 ? "trap" : "traps"}`;
}

function twSortedGroups() {
    return Object.entries(twGroups)
        .filter(([, g]) => g && typeof g.name === "string")
        .sort(([, a], [, b]) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/*Aaron F: traps are in order, traps without a number go last */
function twSortedTraps() {
    return Object.entries(twAllTraps)
        .filter(([, t]) => t && typeof t === "object")
        .sort(([keyA, a], [keyB, b]) => {
            const numA = Number(a.trap_num);
            const numB = Number(b.trap_num);
            const isNumA = a.trap_num !== "" && a.trap_num != null && Number.isFinite(numA);
            const isNumB = b.trap_num !== "" && b.trap_num != null && Number.isFinite(numB);
            if (isNumA && isNumB && numA !== numB) return numA - numB;
            if (isNumA !== isNumB) return isNumA ? -1 : 1;
            return String(a.trap_num ?? keyA).localeCompare(String(b.trap_num ?? keyB), undefined, { numeric: true });
        });
}

function twRememberGroup() {
    try {
        localStorage.setItem(`tw.dashboardGroup.${twUid}`, twCurrentGroup);
    } catch (err) {
        /*Aaron F: in case the storage can be blocked, the dashboard just opens on all the traps next time in no way should this feature impact the goal of the project*/
    }
}



/* Event listeners setup once page has loaded */
document.addEventListener("DOMContentLoaded", async () => {
    const user = await window.twAuthReady; //Aaron F: wait for role check
    twUid = user.uid;
    twHighlightNav();

    /*Aaron F: controls that work before the data arrives, so a slow or failed load can't break them */
    document.getElementById("nav-toggle").addEventListener("click", (e) => {
        const nav = document.getElementById("tw-nav");
        const isOpen = nav.classList.toggle("open");
        e.target.setAttribute("aria-expanded", isOpen);
    });

    document.getElementById("help-btn").addEventListener("click", () => {
        twOpenModal("help-modal");
    });

    const modals = ["help-modal", "group-modal", "group-delete-modal"];
    modals.forEach((id) => {
        document.getElementById(id).addEventListener("click", (e) => {
            if (e.target.id === id) twCloseModal(id);   // click on the dimmed background closes it
        });
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") modals.forEach(twCloseModal);
    });

    const settings = await twGetSettings();
    twOverdueDays = Number(settings.overdueThreshold) || 7;
    currentRange = settings.defaultDateRange;
    document.getElementById("date-range-select").value = currentRange;
    document.getElementById("kpi-overdue-label").textContent = `TRAPS OVERDUE (>${settings.overdueThreshold} DAYS)`;

    let groupsLoaded = false;
    try {
        [, groupsLoaded] = await Promise.all([loadData(), twLoadGroups()]);
    } catch (err) {
        console.error("Couldn't load the dashboard data:", err);
        twTableMessage("Couldn't load the trap data. Refresh the page, and if it keeps happening contact the admin (details at the bottom of the page).");
        ["group-new-btn", "group-select", "date-range-select", "download-json-btn", "kpi-triggered-toggle"].forEach((id) => {
            document.getElementById(id).disabled = true;
        });
        return;
    }

    twCurrentGroup = twRecallGroup();
    if (!twGroups[twCurrentGroup]) twCurrentGroup = "";
    twRebuild();
    twRenderGroupBar();
    refreshDashboard();

    if (!groupsLoaded) {
        document.getElementById("group-summary").textContent = "Your groups couldn't be loaded. Refresh the page to try again.";
        document.getElementById("group-new-btn").disabled = true;
    }

    document.getElementById("date-range-select").addEventListener("change", (e) => {
        currentRange = e.target.value;
        refreshDashboard();
    });

    document.getElementById("kpi-triggered-toggle").addEventListener("click", () => {
        showTriggeredPercentage = !showTriggeredPercentage;
        renderTriggered(currentRange);
    });

    document.getElementById("download-json-btn").addEventListener("click", () => {
        downloadJson();
    });

    /*Aaron F: trap groups listeners */
    document.getElementById("group-select").addEventListener("change", (e) => twSelectGroup(e.target.value));
    document.getElementById("group-new-btn").addEventListener("click", () => twOpenGroupModal(null));
    document.getElementById("group-edit-btn").addEventListener("click", () => twOpenGroupModal(twCurrentGroup));
    document.getElementById("group-delete-btn").addEventListener("click", twOpenDeleteGroup);
    document.getElementById("group-form").addEventListener("submit", twHandleGroupSubmit);
    document.getElementById("group-cancel").addEventListener("click", () => twCloseModal("group-modal"));
    document.getElementById("group-trap-search").addEventListener("input", twRenderTrapPicker);
    document.getElementById("group-trap-search").addEventListener("keydown", (e) => {
        if (e.key === "Enter") e.preventDefault();   // Enter in the search box shouldn't save the group
    });

    document.getElementById("group-select-shown").addEventListener("click", () => {
        document.querySelectorAll("#group-trap-list input[type=checkbox]").forEach((box) => {
            box.checked = true;
            twPickerSelection.add(box.value);
        });
        twUpdatePickerCount();
    });
    document.getElementById("group-clear").addEventListener("click", () => {
        twPickerSelection.clear();
        twRenderTrapPicker();
    });

    document.getElementById("group-delete-cancel").addEventListener("click", () => twCloseModal("group-delete-modal"));
    document.getElementById("group-delete-confirm").addEventListener("click", twHandleDeleteGroup);

    /*Aaron F:  clicking a column header sorts it,  clicking it again reverses the order */
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

