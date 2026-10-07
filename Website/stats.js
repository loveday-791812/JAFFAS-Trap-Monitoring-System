/* Stats page logic */
function twHighlightNav() {
    const current = window.location.pathname.split("/").pop() || "stats.html";
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

/* reads every catch event from firebase and counts how many times each trap number appears and returns it as a simple object like {
"23": 5} where trap number: total catch count. */
async function loadCatchCounts() {
    const eventsSnap = await rtdb.ref("Events").once("value");
    const events = eventsSnap.val() || {};

    const counts = {};
    Object.values(events).forEach((event) => {
        //skips events w. missing trap id
        if (event.trap_ID == null) return;

        const trapNum = String(event.trap_ID);
        counts[trapNum] = (counts[trapNum] || 0) + 1;
    });

    return counts;
}

/* fills in the 3 summary cads above the chart bas on catch counts */
function renderSummary(counts) {
    const trapNumbers = Object.keys(counts);
    const totalCatches = Object.values(counts).reduce((sum, c) => sum + c, 0);

    document.getElementById("stat-total-catches").textContent = totalCatches;

    if (trapNumbers.length === 0) {
        //showing placeholders when no catches are reported yet
        document.getElementById("stat-top-trap").textContent = "-";
        document.getElementById("stat-avg-per-trap").textContent = "-";
        return;
    }

    /* finds the trap number w. the highest count reduce() keeps only the biggest count */
    const [topTrapNumber, topTrapCount] = Object.entries(counts).reduce((best, current) => (current[1] > best[1] ? current : best)
    );
    document.getElementById("stat-top-trap").textContent = `Trap ${topTrapNumber} (${topTrapCount})`;

    const avgPerTrap = (totalCatches / trapNumbers.length).toFixed(1);
    document.getElementById("stat-avg-per-trap").textContent = avgPerTrap;
}

/* Draws bar chart using Chart.js x-axis is trap no. and y-axis catch count */
function renderChart(counts) {
    //alphanumerical ordering
    const trapNumbers = Object.keys(counts).sort((a, b) => Number(a) - Number(b));
    const catchCounts = trapNumbers.map((trapNum) => counts[trapNum]);

    const canvas = document.getElementById("catches-per-trap-chart");

    new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels: trapNumbers.map((num) => `Trap ${num}`),
            datasets: [
                {
                    label: "Catches",
                    data: catchCounts,
                    backgroundColor: "#2d4a2b",
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {display: false},    //hides catches legend above chart
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {precision: 0},  //round to whole numbers
                },
            },
        },
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    twHighlightNav();

    document.getElementById("nav-toggle").addEventListener("click", (e) => {
        const nav = document.getElementById("tw-nav");
        const isOpen = nav.classList.toggle("open");
        e.target.setAttribute("aria-expanded", isOpen);
    });

    document.getElementById("help-btn").addEventListener("click", () => {
        twOpenModal("help-modal");
    });

    //loads real data to use for bar chart and summary cards
    const counts = await loadCatchCounts();
    renderSummary(counts);
    renderChart(counts);
});
