const baseURL = "http://127.0.0.1:5000";
let interval = null;
let autoSpeed = 2000;

let chart;
let labels = [];
let supplierData = [];
let warehouseData = [];
let retailerData = [];

const MAX_SUPPLIER = 5000;
const MAX_WAREHOUSE = 2000;
const MAX_RETAILER = 500;

// Real-world scenario data
const scenarios = {
    normal:  { label: "Normal Week",    sales: [35, 42, 38, 45, 33, 40, 37] },
    festival:{ label: "Festival Season",sales: [85, 92, 78, 95, 100, 88, 91] },
    crisis:  { label: "Supply Crisis",  sales: [8,  5,  6,  9,  7,  4,  6]  },
    spike:   { label: "Demand Spike",   sales: [38, 40, 42, 95, 98, 100, 45] }
};

// ─── CHART INIT ───────────────────────────────────────────────
function initChart() {
    const ctx = document.getElementById("chart").getContext("2d");
    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Supplier",
                    data: supplierData,
                    borderColor: "#00e5ff",
                    backgroundColor: "rgba(0,229,255,0.08)",
                    borderWidth: 2.5,
                    pointRadius: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: "Warehouse",
                    data: warehouseData,
                    borderColor: "#ffb300",
                    backgroundColor: "rgba(255,179,0,0.08)",
                    borderWidth: 2.5,
                    pointRadius: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: "Retailer",
                    data: retailerData,
                    borderColor: "#69ff47",
                    backgroundColor: "rgba(105,255,71,0.08)",
                    borderWidth: 2.5,
                    pointRadius: 3,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            animation: { duration: 400 },
            plugins: {
                legend: {
                    labels: { color: "#cde", font: { family: "Share Tech Mono", size: 12 } }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#8ab", font: { family: "Share Tech Mono" } },
                    grid:  { color: "rgba(255,255,255,0.05)" }
                },
                y: {
                    ticks: { color: "#8ab", font: { family: "Share Tech Mono" } },
                    grid:  { color: "rgba(255,255,255,0.07)" }
                }
            }
        }
    });
}

// ─── FETCH STATUS AND UPDATE DASHBOARD ───────────────────────
async function fetchStatus() {
    try {
        const res  = await fetch(baseURL + "/status");
        const data = await res.json();

        // Update stock numbers
        animateNumber("supplier",  data.supplier);
        animateNumber("warehouse", data.warehouse);
        animateNumber("retailer",  data.retailer);

        // Update stock bars (visual bar width %)
        setBar("supplier-bar",  data.supplier,  MAX_SUPPLIER);
        setBar("warehouse-bar", data.warehouse, MAX_WAREHOUSE);
        setBar("retailer-bar",  data.retailer,  MAX_RETAILER);

        // Update prediction
        if (data.demand_history.length > 0) {
            const last = data.demand_history.slice(-5);
            const avg  = Math.floor(last.reduce((a, b) => a + b, 0) / last.length);
            document.getElementById("prediction").innerText = avg;
        }

        // Update chart
        const step = labels.length + 1;
        labels.push("Step " + step);
        supplierData.push(data.supplier);
        warehouseData.push(data.warehouse);
        retailerData.push(data.retailer);
        chart.update();

        // Update alerts
        const alertsList = document.getElementById("alerts");
        alertsList.innerHTML = "";
        const recentAlerts = data.alerts.slice(-6).reverse();
        recentAlerts.forEach(a => {
            const li = document.createElement("li");
            li.innerText = a;
            li.className = a.includes("STOCKOUT") || a.includes("OUT OF STOCK") ? "alert-danger"
                         : a.includes("⚠️") ? "alert-warn"
                         : "alert-ok";
            alertsList.appendChild(li);
        });

        // Update history
        const historyList = document.getElementById("history");
        historyList.innerHTML = "";
        data.history.slice(-10).reverse().forEach(h => {
            const li = document.createElement("li");
            li.innerText = `${h.time}  →  ${h.event}`;
            historyList.appendChild(li);
        });

    } catch (err) {
        console.error("Could not connect to Flask server:", err);
    }
}

// ─── SET STOCK BAR WIDTH ──────────────────────────────────────
function setBar(id, value, max) {
    const bar = document.getElementById(id);
    const pct = Math.min((value / max) * 100, 100);
    bar.style.width = pct + "%";
    bar.style.background = pct < 15 ? "#ff4444"
                         : pct < 35 ? "#ffb300"
                         : "";
}

// ─── ANIMATE NUMBER CHANGE ────────────────────────────────────
function animateNumber(id, newVal) {
    const el  = document.getElementById(id);
    const old = parseInt(el.innerText) || 0;
    const diff = newVal - old;
    const steps = 12;
    let i = 0;
    const timer = setInterval(() => {
        i++;
        el.innerText = Math.round(old + (diff * i / steps));
        if (i >= steps) { el.innerText = newVal; clearInterval(timer); }
    }, 25);
}

// ─── RUN ONE SIMULATION (RANDOM) ─────────────────────────────
async function runSimulation() {
    await fetch(baseURL + "/simulate", { method: "POST" });
    await fetchStatus();
}

// ─── SUBMIT REAL SALES ────────────────────────────────────────
async function runWithRealSales() {
    const input = document.getElementById("salesInput");
    const sales = parseInt(input.value);

    if (isNaN(sales) || sales < 0) {
        showTag("❌ Please enter a valid number!", "red");
        return;
    }

    await fetch(baseURL + "/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demand: sales })
    });

    await fetchStatus();
    showTag(`✅ Real sales of ${sales} units submitted!`, "green");
    input.value = "";
}

// ─── SHOW TAG BELOW INPUT ─────────────────────────────────────
function showTag(msg, color) {
    const tag = document.getElementById("dataTag");
    tag.innerText = msg;
    tag.style.display = "block";
    tag.style.color    = color === "green" ? "#69ff47" : "#ff4444";
    setTimeout(() => { tag.style.display = "none"; }, 3000);
}

// ─── LOAD SCENARIO ────────────────────────────────────────────
async function loadScenario(type) {
    const scenario = scenarios[type];
    const sales    = scenario.sales;
    const total    = sales.length;

    stopAuto();
    showOverlay(`Loading: ${scenario.label}`);

    for (let i = 0; i < total; i++) {
        updateOverlayProgress(i + 1, total, sales[i]);

        await fetch(baseURL + "/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ demand: sales[i] })
        });

        await fetchStatus();
        await delay(600);
    }

    hideOverlay();
}

// ─── AUTO RUN ─────────────────────────────────────────────────
function startAuto() {
    if (!interval) {
        interval = setInterval(runSimulation, autoSpeed);
    }
}

function stopAuto() {
    clearInterval(interval);
    interval = null;
}

// ─── SPEED CONTROL ───────────────────────────────────────────
function updateSpeed(val) {
    autoSpeed = parseInt(val);
    document.getElementById("speedLabel").innerText = (autoSpeed / 1000) + "s";
    if (interval) {
        stopAuto();
        startAuto();
    }
}

// ─── RESET SYSTEM ────────────────────────────────────────────
async function resetSystem() {
    stopAuto();
    await fetch(baseURL + "/reset", { method: "POST" });

    // Clear chart data
    labels.length        = 0;
    supplierData.length  = 0;
    warehouseData.length = 0;
    retailerData.length  = 0;
    chart.update();

    await fetchStatus();
}

// ─── OVERLAY HELPERS ─────────────────────────────────────────
function showOverlay(text) {
    document.getElementById("overlay").style.display = "flex";
    document.getElementById("overlay-text").innerText = text;
    document.getElementById("progressBar").style.width = "0%";
}

function updateOverlayProgress(current, total, salesValue) {
    const pct = Math.round((current / total) * 100);
    document.getElementById("progressBar").style.width = pct + "%";
    document.getElementById("overlay-text").innerText =
        `Day ${current} of ${total} — Sales: ${salesValue} units`;
}

function hideOverlay() {
    document.getElementById("overlay").style.display = "none";
}

// ─── UTILITY ──────────────────────────────────────────────────
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Allow Enter key on sales input
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("salesInput").addEventListener("keydown", e => {
        if (e.key === "Enter") runWithRealSales();
    });
});

// ─── INIT ─────────────────────────────────────────────────────
initChart();
fetchStatus();
