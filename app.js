
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Configuration ---
    const APP_CONFIG = {
        scriptURL: "https://script.google.com/macros/s/AKfycbxRXuHcrTYC312oaUKm56nZ4xqKGmJZLT7nP1hYwWCMt9HIeV3hUdF61rtLULK2qacu/exec",
        bkLogo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlam0ozt9K851bh-VyDmNQH5dre_iv5OOMtA&s"
    };

    // --- DOM Elements ---
    const elements = {
        form: document.getElementById('purchase-form'),
        submitBtn: document.querySelector('button[type="submit"]'),
        tableBody: document.getElementById('purchase-list'),
        grandTotal: document.getElementById('grand-total'),
        filterBtn: document.getElementById('filter-btn'),
        clearFilterBtn: document.getElementById('clear-filter'),
        startDate: document.getElementById("start-date"),
        endDate: document.getElementById("end-date"),
        printBtn: document.getElementById('print-requisition'),
        excelBtn: document.getElementById('download-excel'),
        printView: document.getElementById('print-view'),
        mainApp: document.getElementById('main-app'),
        backToAppBtn: document.getElementById('back-to-app'),
        printContainer: document.querySelector('.requisition-order')
    };

    // --- State Management ---
    let appState = {
        purchases: [],
        filteredPurchases: []
    };

    // ============================================================
    // 1. DATA FETCHING & RENDERING
    // ============================================================

    async function fetchPurchases() {
        try {
            // Show loading state in table
            elements.tableBody.innerHTML = `
                <tr><td colspan="9" class="text-center py-5 text-muted">
                    <div class="spinner-border text-danger mb-2" role="status"></div>
                    <p class="small mb-0">Syncing with HQ Database...</p>
                </td></tr>`;

            const res = await fetch(APP_CONFIG.scriptURL);
            const data = await res.json();

            // Normalize Data Types
            appState.purchases = data.map(p => ({
                ...p,
                Quantity: parseFloat(p.Quantity) || 0,
                "Unit Cost ($)": parseFloat(p["Unit Cost ($)"]) || 0,
                "Total Cost ($)": parseFloat(p["Total Cost ($)"]) || (parseFloat(p.Quantity) * parseFloat(p["Unit Cost ($)"]))
            }));

            // Initial Render
            appState.filteredPurchases = [...appState.purchases];
            renderTable();
            showToast("Database synced successfully", "success");

        } catch (err) {
            console.error("Fetch Error:", err);
            elements.tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger"><i class="bi bi-exclamation-triangle"></i> Connection Error. Please refresh.</td></tr>`;
            showToast("Failed to load data", "error");
        }
    }

    function renderTable() {
        const { filteredPurchases } = appState;
        elements.tableBody.innerHTML = '';
        let total = 0;

        if (filteredPurchases.length === 0) {
            elements.tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted font-monospace">No records found.</td></tr>`;
            elements.grandTotal.textContent = "0.00";
            return;
        }

        filteredPurchases.forEach((item, index) => {
            total += item["Total Cost ($)"];
            
            // Format Date
            const dateObj = new Date(item["Date"]);
            const displayDate = isNaN(dateObj) ? item["Date"] : dateObj.toLocaleDateString('fr-FR');

            const row = document.createElement('tr');
            row.className = "animate__animated animate__fadeIn";
            row.style.animationDelay = `${index * 0.05}s`; // Staggered animation
            
            row.innerHTML = `
                <td class="ps-4 fw-medium text-dark">${item["Item Name"]}</td>
                <td class="text-end font-monospace">${item.Quantity}</td>
                <td class="text-end font-monospace">${item["Unit Cost ($)"].toFixed(2)}</td>
                <td class="text-end fw-bold text-dark font-monospace">${item["Total Cost ($)"].toFixed(2)}</td>
                <td><span class="badge bg-light text-dark border fw-normal">${item.Location}</span></td>
                <td><small class="text-muted">${item.Recipient}</small></td>
                <td class="text-muted small">${displayDate}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-light text-primary hover-scale" onclick="printSingleItem(${index})">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            `;
            elements.tableBody.appendChild(row);
        });

        // Animate Count Up for Total
        animateValue(elements.grandTotal, parseFloat(elements.grandTotal.textContent), total, 1000);
    }

    // ============================================================
    // 2. FORM SUBMISSION
    // ============================================================

    elements.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // UI Loading State
        const originalBtnText = elements.submitBtn.innerHTML;
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Saving...`;

        const formData = new FormData();
        formData.append("itemName", document.getElementById('item-name').value);
        formData.append("quantity", document.getElementById('quantity').value);
        formData.append("unitCost", document.getElementById('unit-cost').value);
        formData.append("location", document.getElementById('location').value);
        formData.append("recipient", document.getElementById('recipient').value);

        try {
            await fetch(APP_CONFIG.scriptURL, { method: "POST", mode: "no-cors", body: formData });
            
            elements.form.reset();
            showToast("Purchase Order Created!", "success");
            await fetchPurchases(); // Refresh data

        } catch (err) {
            showToast("Error saving purchase", "error");
        } finally {
            elements.submitBtn.disabled = false;
            elements.submitBtn.innerHTML = originalBtnText;
        }
    });

    // ============================================================
    // 3. PRINT GENERATION (Strict Layout Preservation)
    // ============================================================

    function generatePrintDocument(itemsToPrint) {
        const today = new Date();
        const dateLabel = today.toLocaleDateString('fr-FR');
        const prNumber = `PR-${today.getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
        
        // Filter logic summary
        const totalCost = itemsToPrint.reduce((sum, p) => sum + (p["Total Cost ($)"] || 0), 0).toFixed(2);

        // --- ROW GENERATION (Padding to 12 rows for A4) ---
        const MAX_ROWS = 12;
        const rowsHTML = itemsToPrint.map((p, i) => `
            <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td style="text-align:center;">${p["Item Code"] || "-"}</td>
                <td>
                    <strong>${p["Item Name"]}</strong> 
                    <br><span style="font-size:10px; color:#555;">(${p["Recipient"]} @ ${p["Location"]})</span>
                </td>
                <td style="text-align:center;">IT</td>
                <td style="text-align:center;">${p.Quantity}</td>
                <td style="text-align:center;">Unit</td>
                <td style="text-align:center;">ASAP</td>
                <td style="text-align:right;">${p["Unit Cost ($)"].toFixed(2)}</td>
                <td style="text-align:right;">${p["Total Cost ($)"].toFixed(2)}</td>
            </tr>
        `).join('');

        const emptyRowsCount = Math.max(0, MAX_ROWS - itemsToPrint.length);
        const emptyRowsHTML = Array.from({ length: emptyRowsCount }).map(() => `
            <tr>
                <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
        `).join('');

        // --- HTML TEMPLATE INJECTION ---
        elements.printContainer.innerHTML = `
            <header>
                <div class="logo-left">
                    <img src="${APP_CONFIG.bkLogo}" alt="Logo">
                </div>
                <div class="header-title">
                    <h3><strong>General First Food Services SAS</strong></h3>
                    <h4><strong>Purchase Requisition Form</strong></h4>
                </div>
            </header>

            <table class="print-table" style="margin-bottom: 15px;">
                <tr>
                    <td width="25%">Date: <strong>${dateLabel}</strong></td>
                    <td width="25%">PR no.: <strong>${prNumber}</strong></td>
                    <td width="15%">OPEX: ☐</td>
                    <td width="20%">MR no.: .................</td>
                    <td width="15%">CAPEX: ☐</td>
                </tr>
            </table>

            <div style="margin-bottom: 10px; border: 1px solid #000; padding: 5px;">
                <strong>User Information:</strong>
                <table style="width:100%; border:none;">
                    <tr>
                        <td style="border:none;">Name: .......................................</td>
                        <td style="border:none;">Dept: <strong>IT Department</strong></td>
                        <td style="border:none;">Loc: .......................................</td>
                    </tr>
                </table>
            </div>

            <table class="print-table item-table">
                <thead>
                    <tr>
                        <th width="5%">No.</th>
                        <th width="10%">Code</th>
                        <th width="35%">Description</th>
                        <th width="10%">Cat</th>
                        <th width="8%">Qty</th>
                        <th width="8%">UOM</th>
                        <th width="8%">Date</th>
                        <th width="10%">Unit (MAD)</th>
                        <th width="10%">Total (MAD)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                    ${emptyRowsHTML}
                    <tr>
                        <td colspan="8" style="text-align:right; font-weight:bold; background:#f0f0f0;">GRAND TOTAL (MAD):</td>
                        <td style="text-align:right; font-weight:bold; background:#f0f0f0;">${totalCost}</td>
                    </tr>
                </tbody>
            </table>

            <div class="border-split">
                <div class="left">
                    <strong>Delivery Address:</strong><br>
                    Siège Social (Headquarters)<br>
                    Casablanca
                </div>
                <div class="right">
                    <strong>Remarks:</strong><br>
                    <br>
                </div>
            </div>

            <table class="sign-table">
                <tr>
                    <td>Requested by:<span class="sign-line"></span><span style="font-size:10px;">IT Manager</span></td>
                    <td>Approved by:<span class="sign-line"></span><span style="font-size:10px;">Purchase Manager</span></td>
                    <td>Reviewed by:<span class="sign-line"></span><span style="font-size:10px;">Finance Manager</span></td>
                    <td>Approved by:<span class="sign-line"></span><span style="font-size:10px;">General Manager</span></td>
                </tr>
            </table>
        `;
    }

    // ============================================================
    // 4. EVENT LISTENERS & UTILS
    // ============================================================

    // Print Button Click
    elements.printBtn.addEventListener('click', () => {
        if (appState.filteredPurchases.length === 0) {
            showToast("No items to print", "info");
            return;
        }
        generatePrintDocument(appState.filteredPurchases);
        elements.printView.classList.remove('d-none');
    });

    // Back to App from Print View
    elements.backToAppBtn.addEventListener('click', () => {
        elements.printView.classList.add('d-none');
    });

    // Filter Logic
    elements.filterBtn.addEventListener('click', () => {
        const start = elements.startDate.value ? new Date(elements.startDate.value) : null;
        const end = elements.endDate.value ? new Date(elements.endDate.value) : null;

        if (start && end) {
            // Set end date to end of day
            end.setHours(23, 59, 59);
            
            appState.filteredPurchases = appState.purchases.filter(p => {
                const pDate = new Date(p["Date"]);
                return pDate >= start && pDate <= end;
            });
            renderTable();
            showToast("Filter applied", "success");
        } else {
            showToast("Please select valid dates", "info");
        }
    });

    elements.clearFilterBtn.addEventListener('click', () => {
        elements.startDate.value = '';
        elements.endDate.value = '';
        appState.filteredPurchases = [...appState.purchases];
        renderTable();
    });

    // Excel Download
    elements.excelBtn.addEventListener('click', () => {
        const ws = XLSX.utils.json_to_sheet(appState.filteredPurchases);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Purchases");
        XLSX.writeFile(wb, "BK_IT_Purchases.xlsx");
        showToast("Excel downloaded", "success");
    });

    // Global Toast Function
    window.showToast = (msg, type = 'success') => {
        const toastContainer = document.getElementById('toastContainer');
        const color = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-primary';
        const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-exclamation-octagon-fill' : 'bi-info-circle-fill';
        
        const el = document.createElement('div');
        el.className = `toast align-items-center text-white ${color} border-0 show animate__animated animate__fadeInUp`;
        el.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi ${icon} me-2"></i> ${msg}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>`;
        
        toastContainer.appendChild(el);
        setTimeout(() => {
            el.classList.remove('animate__fadeInUp');
            el.classList.add('animate__fadeOutDown');
            setTimeout(() => el.remove(), 500);
        }, 3000);
    };

    // Number Animation Utility
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = (progress * (end - start) + start).toFixed(2);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Expose print single item globally for onclick handler
    window.printSingleItem = (index) => {
        const item = appState.filteredPurchases[index];
        generatePrintDocument([item]);
        elements.printView.classList.remove('d-none');
    };

    // Init
    fetchPurchases();
});
