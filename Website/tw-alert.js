// shared alert/confirm popup used across the dashboard pages.
// uses showTwAlert(), closeTwAlert(), twConfirm(), twSetAfterAlert()


(function() {
    "use strict";
    // Builds the popup HTML and adds it to the page 
    function injectModal(){
        if (document.getElementById("twAlertOverlay")) return;

        const wrap = document.createElement("div");
        wrap.innerHTML = `
            <div class="tw-alert-overlay" id="twAlertOverlay" aria-hidden="true">
                <div class="tw-alert-modal"
                    id="twAlertModal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="twAlertTitle"
                    aria-describedby="twAlertMessage">

                <div class="tw-alert-icon" id="twAlertIcon">!</div>

                <div class="tw-alert-content">
                    <h2 id="twAlertTitle">Something went wrong</h2>
                    <p id="twAlertMessage">Please try again</p>
                </div>

                <div id="twAlertButtons">
                    <button type="button" class="tw-alert-button" id="twAlertButton">Ok</button>
            </div>
        </div>
    </div>
`;
document.body.appendChild(wrap.firstElementChild);
}

let afterClose = null; // function to run once the alert is closed
let confirmResolve = null; // resolves the twConfirm() promise

// SHows a simple alert with an OK button 
window.showTwAlert = function (title, message, type = "error") {
    injectModal();

    const overlay = document.getElementById("twAlertOverlay");
    const modal = document.getElementById("twAlertModal");
    const icon = document.getElementById("twAlertIcon");
    const ttl = document.getElementById("twAlertTitle");
    const msg = document.getElementById("twAlertMessage");
    const buttons = document.getElementById("twAlertButtons");

    ttl.textContent = title;
    msg.textContent = message;

    // Pick the icon and color for the alert type
    modal.classList.remove("success", "warning");
    if (type === "success") {
        modal.classList.add("success");
        icon.textContent = "✓";
    } else if (type === "warning") {
        modal.classList.add("warning");
        icon.textContent = "!";
    } else {
        icon.textContent = "!"
    }

    buttons.className = "";

    // Reset the buttons to a single OK
    buttons.innerHTML = `<button type="button" class="tw-alert-button" id="twAlertButton">Ok</button>`;
    document.getElementById("twAlertButton").addEventListener("click", closeTwAlert);
    document.getElementById("twAlertButton").focus();

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
};

// Hides the alert, then runs any function registered with twSetAfterAlert()
window.closeTwAlert = function () {
    const overlay = document.getElementById("twAlertOverlay");
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");

    if (afterClose) {
        const next = afterClose;
        afterClose = null;
        next();
    }
};

// shows a Cancel / COnfirm popup. Returns a promise
window.twConfirm = function (title, message) {
    injectModal();

    return new Promise((resolve) => {
        confirmResolve = resolve;

        const overlay = document.getElementById("twAlertOverlay");
        const modal = document.getElementById("twAlertModal");
        const icon = document.getElementById("twAlertIcon");
        const ttl = document.getElementById("twAlertTitle");
        const msg = document.getElementById("twAlertMessage");
        const buttons = document.getElementById("twAlertButtons");

        ttl.textContent = title;
        msg.textContent = message;

        modal.classList.remove("success");
        modal.classList.add("warning");
        icon.textContent = "!";

        buttons.className = "tw-alert-buttons";

        buttons.innerHTML = `
            <button type="button" class="tw-alert-button tw-alert-cancel" id="twAlertCancel">Cancel</button>
            <button type="button" class="tw-alert-button" id="twAlertConfirm">Confirm</button>
        `;

        document.getElementById("twAlertCancel").addEventListener("click", () => finishConfirm(false));
        document.getElementById("twAlertConfirm").addEventListener("click", () => finishConfirm(true));
        document.getElementById("twAlertConfirm").focus();

        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
    });
};

// Closes the confirm popup and returns the user's choice to twConfirm()
function finishConfirm(result) {
    const overlay = document.getElementById("twAlertOverlay");
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");

    if (confirmResolve) {
        const r = confirmResolve;
        confirmResolve = null;
        r(result);
    }
}

// Clicking the dark background closes the popup
document.addEventListener("click", (e) => {
    const overlay = document.getElementById("twAlertOverlay");
    if (overlay && e.target === overlay) {
        if (confirmResolve) finishConfirm(false);
        else closeTwAlert();
    }
});

// Pressing Escape closes the popup the same way
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const overlay = document.getElementById("twAlertOverlay");
    if (!overlay || !overlay.classList.contains("show")) return;
    if (confirmResolve) finishConfirm(false);
    else closeTwAlert();
});

// Registers a function to run after the next alert is closed 
window.twSetAfterAlert = function (fn) {
    afterClose = fn;
};
})();