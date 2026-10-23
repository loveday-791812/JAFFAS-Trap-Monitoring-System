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

/*Aaron F: Works out which traps each transmitter belongs to and the trap number(s) to show for it. Uses the TrapTransmitter links first, then the trap IDs the gateway puts on each event. */
function twIndexTraps(traps, links, rawEvents) {
    const keyByNum = {};
    Object.entries(traps).forEach(([key, t]) => {
        if (t && t.trap_num !== undefined && t.trap_num !== null) keyByNum[String(t.trap_num)] = key;
    });

    const split = (raw) => (raw === undefined || raw === null)
        ? []
        : String(raw).split("#")[0].split("/").map((s) => s.trim()).filter(Boolean);
    const keyOf = (id) => (traps[id] ? id : keyByNum[id]);
    const addOnce = (map, tx, value) => {
        map[tx] ||= [];
        if (!map[tx].includes(value)) map[tx].push(value);
    };

    const linkIds = {};   // transmitter => trap IDs written on its TrapTransmitter links
    const eventKeys = {}; // transmitter => trap keys named on its events
    Object.values(links).forEach((l) => {
        if (!l || !l.transmitter_ID) return;
        split(l.trap_ID).forEach((id) => addOnce(linkIds, twNorm(l.transmitter_ID), id));
    });
    
    Object.values(rawEvents).forEach((e) => {
        if (!e || (e.transmitter_ID == null && e.trap_ID == null)) return;
        const tx = twNorm(e.transmitter_ID || e.trap_ID);
        split(e.trap_ID).map(keyOf).filter(Boolean).forEach((key) => addOnce(eventKeys, tx, key));
    });

    const keysByTx = {};
    const labels = {};
    new Set([...Object.keys(linkIds), ...Object.keys(eventKeys)]).forEach((tx) => {
        const fromLinks = (linkIds[tx] || []).map(keyOf).filter(Boolean);
        const keys = [...new Set([...fromLinks, ...(eventKeys[tx] || [])])];
        if (keys.length) keysByTx[tx] = new Set(keys);

        const ids = (linkIds[tx] && linkIds[tx].length) ? linkIds[tx] : (eventKeys[tx] || []);
        if (ids.length) {
            const shown = ids.map((id) => {
                const key = keyOf(id);
                const num = key ? traps[key].trap_num : undefined;
                return String(num !== undefined && num !== null ? num : id);
            });
            labels[tx] = [...new Set(shown)].join("/");   //Aaron F: traps that share a number are shown once
        }
    });
    return { keysByTx, labels };
}
    
    

function twOpenModal(modalId) {
    document.getElementById(modalId).classList.add("open");
}

function twCloseModal(modalId) {
    document.getElementById(modalId).classList.remove("open");
}

/* Aaron F: Data for 3 date ranges, it is rebuilt everytime a selected data within the group changes */
let twData = { "7d": null, "30d": null, "all": null};
let twTotalTraps = 0;

/* Aaron F: Everything is loaded from the database before any group filter takes effect */
let twAllTraps = {};      // Traps, keyed by trap key
let twAllEvents = [];     // [{ txId, date }]
let twAllTx = {};         // Transmitters, keyed by normalised transmitter ID
let twKeysByTx = {};      // transmitter -> Set of trap keys
let twLabels = {};        // transmitter -> trap number(s) to show

async function loadData() {
    const [trapsSnap, eventsSnap, txSnap, linkSnap] = await Promise.all([
        rtdb.ref("Traps").once("value"),
        rtdb.ref("Events").once("value"),
        rtdb.ref("Transmitters").once("value"),
        rtdb.ref("TrapTransmitter").once("value"),
    ]);

    twAllTraps = trapsSnap.val() || {};
    const events = eventsSnap.val() || {};
    const transmitters = txSnap.val() || {};



    const index = twIndexTraps(twAllTraps, linkSnap.val() || {}, events);
    twKeysByTx = index.keysByTx;
    twLabels = index.labels;

    twAllTx = {};
    Object.entries(transmitters).forEach(([k, v]) => (twAllTx[twNorm(k)] = v));

    twAllEvents = Object.values(events)
        .filter((e) => (e.transmitter_ID || e.trap_ID) != null && e.timeStamp)
        .map((e) => ({ txId: twNorm(e.transmitter_ID || e.trap_ID), date: twDate(e.timeStamp) }))
        .filter((e) => !isNaN(e.date));

    twRebuild();
};

/*Aaron F: Applies the selected group and calculates the 3 time periods */
function twRebuild() {
    const group = twCurrentGroup ? twGroups[twCurrentGroup] : null;
    let events = twAllEvents;
    let transmitters = twAllTx;

    if (group) {
        const wanted = new Set(Object.keys(group.traps || {}));
        const inGroup = (txId) => {
            const keys = twKeysByTx[txId];
            return !!keys && [...keys].some((key) => wanted.has(key));
        };
        events = twAllEvents.filter((e) => inGroup(e.txId));
        transmitters = {};
        Object.entries(twAllTx).forEach(([id, tx]) => {
            if (inGroup(id)) transmitters[id] = tx;
        });
    }

    twTotalTraps = Object.keys(transmitters).length;
    twData["7d"] = buildRangeData(eventList, txNorm, labels, 7);
    twData["30d"] = buildRangeData(eventList, txNorm, labels, 30);
    twData["all"] = buildRangeData(eventList, txNorm, labels, null);
}

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

/*Aaron F: One complete full message row in the trap table */
function twTableMessage(message) {
    const tbody = document.getElementById("traps-tbody");
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = message;
    row.appendChild(cell);
    tbody.replaceChildren(row);
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

    if (!traps.length) {
        const group = twCurrentGroup ? twGroups[twCurrentGroup] : null;
        twTableMessage(group ? `No catches for "${group.name}" in this period.` : "No catches in this period.");
        return;
    }

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
    const group = twCurrentGroup ? twGroups[twCurrentGroup] : null;
    const payload = {
        dateRange: currentRange,
        group: group ? { name: group.name, traps: twGroupTrapKeys(group).map((key) => twAllTraps[key].trap_num ?? key) } : null,
        generatedAt: new Date().toISOString(),
        kpis: twData[currentRange].kpis,
        traps: twData[currentRange].traps,
    };

    /* turn the JS object into a downloadable file */
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const slug = group ? "-" + (String(group.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "group") : "";
    const link = document.createElement("a");
    link.href = url;
    link.download = `trapwatch-report-${currentRange}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);   /* frees up memory for download */
}

/*Aaron F: The groups are saved per account in trapGroups. The database rules only let the signed-in account read or write its own groups. */
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

function twRecallGroup() {
    try {
        return localStorage.getItem(`tw.dashboardGroup.${twUid}`) || "";
    } catch (err) {
        return "";
    }
}

async function twLoadGroups() {
    try {
        const snap = await twGroupsRef().once("value");
        twGroups = snap.val() || {};
        return true;
    } catch (err) {
        console.error("Couldn't load your trap groups:", err);
        twGroups = {};
        return false;
    }
}

function twRenderGroupBar() {
    const select = document.getElementById("group-select");
    select.replaceChildren(new Option("All traps", ""));
    twSortedGroups().forEach(([id, group]) => {
        select.appendChild(new Option(`${group.name} (${twCountLabel(twGroupTrapKeys(group).length)})`, id));
    });

    if (twCurrentGroup && !twGroups[twCurrentGroup]) twCurrentGroup = "";
    select.value = twCurrentGroup;

    const selected = twCurrentGroup ? twGroups[twCurrentGroup] : null;
    document.getElementById("group-edit-btn").disabled = !selected;
    document.getElementById("group-delete-btn").disabled = !selected;

    const summary = document.getElementById("group-summary");
    if (selected) {
        summary.textContent = `Showing the ${twCountLabel(twGroupTrapKeys(selected).length)} in this group`;
    } else {
        const count = Object.keys(twGroups).length;
        summary.textContent = count
            ? `${count} of ${TW_GROUP_LIMIT} groups`
            : "Make a group to see just the traps you look after";
    }
}

function twSelectGroup(groupId) {
    twCurrentGroup = groupId && twGroups[groupId] ? groupId : "";
    twRememberGroup();
    twRenderGroupBar();
    twRebuild();
    refreshDashboard();
}

const TW_PICKED_LIST_MAX = 12;
function twUpdatePickerCount() {
    const nums = twSortedTraps().filter(([key]) => twPickerSelection.has(key)).map(([key, trap]) => String(trap.trap_num ?? key));
    document.getElementById("group-selected-count").textContent = `${twCountLabel(nums.length)} selected`;
    const more = nums.length > TW_PICKED_LIST_MAX ? ` and ${nums.length - TW_PICKED_LIST_MAX} more` : "";
    document.getElementById("group-selected-list").textContent = nums.length
        ? `${nums.length === 1 ? "Trap" : "Traps"} ${nums.slice(0, TW_PICKED_LIST_MAX).join(", ")}${more}`
        : "";
}

/*Aaron F: the list of traps inside the group has every value is set as text, never as HTML */
function twRenderTrapPicker() {
    const list = document.getElementById("group-trap-list");
    const query = document.getElementById("group-trap-search").value.trim().toLowerCase().replace(/^trap\s*/, "");
    list.replaceChildren();

    let shown = 0;
    twSortedTraps().forEach(([key, trap]) => {
        const num = trap.trap_num ?? key;
        const location = typeof trap.trap_location === "string" ? trap.trap_location : "";
        if (query && !String(num).toLowerCase().startsWith(query) && !location.toLowerCase().includes(query)) return;
        shown += 1;

        const option = document.createElement("label");
        option.className = "group-trap-option";

        const box = document.createElement("input");
        box.type = "checkbox";
        box.value = key;
        box.checked = twPickerSelection.has(key);
        box.addEventListener("change", () => {
            if (box.checked) twPickerSelection.add(key);
            else twPickerSelection.delete(key);
            twUpdatePickerCount();
        });

        const numE1 = document.createElement("span");
        numE1.className = "group-trap-num";
        numE1.textContent = `Trap ${num}`;

        const locationE1 = document.createElement("span");
        locationE1.className = "group-trap-loc";
        locationE1.textContent = location || "No location saved";

        option.append(box, numE1, locationE1);

        if ((trap.installed_status || trap.status) === "removed") {
            const flag = document.createElement("span");
            flag.className = "group-trap-flag";
            flag.textContent = "Removed";
            option.appendChild(flag);
        }
        list.appendChild(option);
    });

    if (!shown) {
        const empty = document.createElement("p");
        empty.className = "group-trap-empty";
        empty.textContent = Object.keys(twAllTraps).length ? "No traps match that search." : "No traps have been added yet.";
        list.appendChild(empty);
    }
    twUpdatePickerCount();
}

function twOpenGroupModal(groupId) {
    const group = groupId ? twGroups[groupId] : null;
    twEditingGroupId = group ? groupId : null;
    twPickerSelection = new Set(group ? twGroupTrapKeys(group) : []);

    document.getElementById("group-modal-title").textContent = group ? "Edit group" : "New group";
    document.getElementById("group-save").textContent = group ? "Save changes" : "Create group";
    document.getElementById("group-name").value = group ? group.name : "";
    document.getElementById("group-trap-search").value = "";
    document.getElementById("group-error").textContent = "";

    twRenderTrapPicker();
    twOpenModal("group-modal");
    document.getElementById("group-name").focus();
}

async function twHandleGroupSubmit(e) {
    e.preventDefault();
    const errorE1 = document.getElementById("group-error");
    const saveBtn = document.getElementById("group-save");

    const name = document.getElementById("group-name").value.trim().replace(/\s+/g, " ");
    const keys = [...twPickerSelection].filter((key) => twAllTraps[key]);
    const nameTaken = Object.entries(twGroups).some(([id, g]) =>
        id !== twEditingGroupId && g && String(g.name).toLowerCase() === name.toLowerCase());

    let problem = "";
    if (!name) problem = "Give the group a name.";
    else if (name.length > TW_GROUP_NAME_MAX) problem = `Keep the name to ${TW_GROUP_NAME_MAX} characters or fewer.`;
    else if (nameTaken) problem = `You already have a group called "${name}".`;
    else if (!keys.length) problem = "Tick at least one trap.";
    else if (!twEditingGroupId && Object.keys(twGroups).length >= TW_GROUP_LIMIT) problem = `You can have up to ${TW_GROUP_LIMIT} groups. Delete one first.`;
    errorE1.textContent = problem;
    if (problem) return;

    const traps = {};
    keys.forEach((key) => (traps[key] = true));

    saveBtn.disabled = true;

    try {
        if (twEditingGroupId) {
            await twGroupsRef(twEditingGroupId).update({ name, traps });   // replaces the group's trap list
            twGroups[twEditingGroupId] = { ...twGroups[twEditingGroupId], name, traps };
            twCurrentGroup = twEditingGroupId;
        } else {
            const ref = twGroupsRef().push();
            await ref.set({ name, createdAt: firebase.database.ServerValue.TIMESTAMP, traps });
            twGroups[ref.key] = { name, createdAt: Date.now(), traps };
            twCurrentGroup = ref.key;
        }
        twCloseModal("group-modal");
        twSelectGroup(twCurrentGroup);
    } catch (err) {
        console.error("Couldn't save the trap group:", err);
        errorE1.textContent = "Couldn't save the group. Check your connection and try again.";
    } finally {
        saveBtn.disabled = false;
    }
}

function twOpenDeleteGroup() {
    const group = twCurrentGroup ? twGroups[twCurrentGroup] : null;
    if (!group) return;
    document.getElementById("group-delete-name").textContent = group.name;
    document.getElementById("group-delete-error").textContent = "";
    twOpenModal("group-delete-modal");
}

async function twHandleDeleteGroup() {
    const groupId = twCurrentGroup;
    const btn = document.getElementById("group-delete-confirm");
    if (!groupId) return;

    btn.disabled = true;
    try {
        await twGroupsRef(groupId).remove();
        delete twGroups[groupId];
        twCloseModal("group-delete-modal");
        twSelectGroup("");
    } catch (err) {
        console.error("Couldn't delete the trap group:", err);
        document.getElementById("group-delete-error").textContent = "Couldn't delete the group. Check your connection and try again.";
    } finally {
        btn.disabled = false;
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

