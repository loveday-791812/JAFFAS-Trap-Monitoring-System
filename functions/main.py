from firebase_functions import db_fn, scheduler_fn, options
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, db, auth
from datetime import datetime, timedelta
import resend
import secrets
import os
import hashlib
import time

# -- Setup: limit cocurrent instances, connect to Firebase, load the resend email API key ---
set_global_options(max_instances=10)
initialize_app()

resend.api_key = os.environ.get("RESEND_API_KEY")

# Base URL of the dashboard, used to build the links inside emails
DASHBOARD_BASE_URL = "https://trapwatch.fft.kiwi"

# Link to the Trap.NZ site shown as the second button in every email
TRAPNZ_URL = "https://trap.nz"

# Page each role is sent to when they click the email link.
# Roles not listed here eg penidng are sent to the login page instead

ROLE_LANDING_PAGE = {
    "manager": "dashboard.html",
    "worker": "dashboard.html",
}


#---------- Email templates ----------
# Build the HTML for the instant alert email (one trap triggered)
def build_email_html(trap_id, time_str, date_str, trapwatch_url, trapnz_url):
    return f"""
<!DOCTYPE html>    
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
    @media only screen and (max-width: 620px) {{
            .email-container{{
            width: 100% !important;
            max-width: 100% !important;
            }}
            .header-table td {{
                display: block !important;
                width: 100% !important;
                text-align: left !important;
                padding: 4px 0 !important;
            }}
            .header-logo {{
                text-align: left !important;
            }}
            .header-title{{
                padding-left: 0 !important;
                padding-top: 8px !important;
                font-size: 18px !important;
            }}
            .header-date{{
                text-align: left !important;
                padding-top: 4px !important;
                white-space: normal !important;
            }}
            .trap-card {{
                margin-bottom: 12px !important;
            }}
            .btn {{
                display: block !important;
                width: 100% !important;
                max-width: 280px !important;
                margin: 0 auto 12px auto !important;
                text-align: center !important;
                box-sizing: border-box !important;
            }}
        }}
    </style>
    </head>
    <body style="margin:0; padding:0; background:#1a1a1a; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a; padding:20px 0;">
    <tr>
        <td align="center" style="padding:0 10px;">
            <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0"
                style="width:100%; max-width:600px; background:#000000; border:2px solid #ffffff; border-radius:20px; overflow:hidden;">
            
            <!-- Header -->
            <tr>
                <td style="padding:18px 20px 12px 20px;">
                    <table class="header-table" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td class="header-logo" width="50" valign="middle" style="width:50px;">
                            <img src="cid:logo" width="42" height="42" alt="TrapWatch"
                                style="display:block; border-radius:50%; border:0;">
                            </td>
                            <td class="header-title" valign="middle"
                                style="font-family:Arial, Helvetica, sans-serif; font-size:18px; color:#ffffff; padding-left:12px; line-height:1.3;">
                            TrapWatch&nbsp;&nbsp;<span style="color:#e74c3c; font-weight:bold;">! {trap_id} Triggered</span>
                        </td>
                        <td class="header-date" align="right" valign="middle"
                            style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#ffffff; white-space:nowrap; padding-left:10px;">
                        {date_str}
                    </td>
                </tr>
            </table>
        </td>
    </tr>
    
    <!-- Divider -->
    <tr>
        <td style="padding:0 20px;">
            <hr style="border:none; border-top:1px solid #ffffff; margin:0;">
        </td>
    </tr>
    
    <!-- Content area with background -->
    <tr>
    <td background="cid:background"
        style="background-image:url('cid:background'); background-size:cover; background-position:center;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
            <td style="padding:20px;">
    
            <!-- Trap cards -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td style="padding:0 0 12px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0"
                            style="border:1px solid #ffffff; border-radius:10px; background:rgba(0,0,0,0.60);">
                            <tr>
                                <td style="padding:14px 16px; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
                                    <div style="font-size:16px; font-weight:bold; line-height:1.3;">
                                        Trap {trap_id} 
                                    </div>
                                    <div style="font-size:13px; color:#cccccc; margin-top:4px;">
                                        Triggered at {time_str}
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
    
                <!-- Buttons -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                    <tr>
                        <td align="center" style="padding:8px 0;">
                            <a href="{trapwatch_url}" class="btn"
                                style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                          color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                          border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                          use trapwatch.fft.kiwi
                    </a>
                </td>
            </tr>
            <tr>
                <td align="center" style="padding:8px 0;">
                    <a href="{trapnz_url}" class="btn"
                        style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                         color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                         border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                        Trap.NZ
                    </a>
                </td>
            </tr>
        </table>
    
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
        
                </table>
            </td>
        </tr>
    </table>
    </body>
    </html>
"""

# Maps eahc report type to the checkbox field stored on a recipient in /Recipients
REPORT_FLAGS = {
    "Instant": "reportInstant",
    "Daily": "reportDaily",
    "Weekly": "reportWeekly",
    "Monthly": "reportMonthly",
}

# Master on/off switch for all emails (settings page) emails are on unless set to false
def emails_enabled():
    return db.reference("/Settings/emailNotificationsEnabled").get() is not False

# Returns the email adresses that should recieve a given report type 
def get_recipients(report_type):
    if not emails_enabled():
        print("Email notifications disabled in Settings - skipping")
        return[]
    flag = REPORT_FLAGS[report_type]
    recipients = db.reference("/Recipients").get() or {}
    out = []
    for r in recipients.values():  # type: ignore
        if not isinstance(r, dict) or r.get("status") != "active" or not r.get("email"):
            continue
        if r.get("emailEnabled") is False:
            continue
        # Use the per-report checkbox if present
        if flag in r:
            opted_in = r[flag] is True
        else:
            opted_in = r.get("report") == report_type
        if opted_in:
            out.append(r["email"])
    return out

# Looks up a user in /users by email 
def find_user_by_email(email):
    all_users = db.reference("/users").get() or {}

    if not isinstance(all_users, dict):
        return None, None

    for uid, data in all_users.items():
        if isinstance(data, dict) and data.get("email") == email:
            return uid, data.get("role")
    return None, None

# Builds the "View TrapWatch" link Known users get a one time login link
# token only valid for three hours 
def build_trapwatch_link(email):
    uid, role = find_user_by_email(email)

    if not uid or role not in ROLE_LANDING_PAGE:
        return f"{DASHBOARD_BASE_URL}/Login/login.html"

    # Create a random token and save only its SHA-256 hash and expiry against the user 
    token = secrets.token_hex(32)
    db.reference(f"users/{uid}").update({
        "magicTokenHash": hashlib.sha256(token.encode()).hexdigest(),
        "magicTokenExpiresAt": int(time.time() * 1000) + 3 * 60 * 60 * 1000,
    })

    landing_page = ROLE_LANDING_PAGE.get(role, "dashboard.html")

    return f"{DASHBOARD_BASE_URL}/{landing_page}?token={token}"

# Converts an ISO timestamp string to a database (timezone removed). Returns none if it cant be read 
def parse_iso(s):
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        return None

    
# Returns the traps triggered in the last 24 hours
def get_events_today():
    now = datetime.now()
    start = now - timedelta(hours=24)
    all_events = db.reference("/Events").get() or {}
    labels = get_trap_labels()

    seen = {}
    for event_id, data in all_events.items(): # type: ignore
        if not isinstance(data, dict):
            continue
        raw_id = data.get("transmitter_ID") or data.get("trap_ID")
        timestamp = data.get("timeStamp")
        if not raw_id or not timestamp:
            continue
        try:
            dt = datetime.fromisoformat(timestamp)
        except (ValueError, TypeError):
            continue
        if start <= dt <= now:
            trap_id = labels.get(str(raw_id).strip().upper(), str(raw_id))
            if trap_id not in seen or dt < seen[trap_id]:
                seen[trap_id] = dt
    return seen

# Realtime DB sometimes returns a list instead of dict
def _as_dict(node):
    if isinstance(node, dict):
        return node
    if isinstance(node, list):
        return {str(i): v for i, v in enumerate(node) if v}
    return {}

# Maps a raw transmitter/event ID to the trao numbers
def get_trap_labels():
    traps = _as_dict(db.reference("/Traps").get())
    links = _as_dict(db.reference("/TrapTransmitter").get())

    num_by_key = {k: str(t.get("trap_num", k)) for k, t in traps.items() if isinstance(t,dict)}

    labels = {}
    for link in links.values():
        if not isinstance(link, dict) or not link.get("transmitter_ID"):
            continue
        tx = str(link["transmitter_ID"]).strip().upper()
        for raw in str(link.get("trap_ID", "")).split("#")[0].split("/"):
            raw = raw.strip()
            if not raw:
                continue
            num = num_by_key.get(raw, raw)
            nums = labels.setdefault(tx, [])
            if num not in nums:
                nums.append(num)
    return {tx: " / ".join(nums) for tx, nums in labels.items()}



# Runs automatically each time a new trap event is written to /Events
@db_fn.on_value_created(
    reference="/Events/{event_id}",
    region="asia-southeast1"
)
def send_trap_alert(event: db_fn.Event) -> None:
    """
    Fires when a new entry is written to /Events
    """
    data = event.data
    raw_id = data.get("transmitter_ID") or data.get("trap_ID", "Unknown")
    trap_id = get_trap_labels().get(str(raw_id).strip().upper(), str(raw_id))
    timestamp = data.get("timeStamp")

    dt = parse_iso(timestamp) if timestamp else None
    if dt is None:
        dt = datetime.now()

    # cross platform dafe time formatting
    time_str = dt.strftime("%I:%M%p").lstrip("0").lower()
    day_num = dt.day
    suffix = "th" if 11 <= day_num <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day_num % 10, "th")
    date_str = dt.strftime("%a") + f" {day_num}{suffix} " + dt.strftime("%b")

    recipients = get_recipients("Instant")
    if not recipients:
        print("No active instant recipients - skipping email")
        return

    for email in recipients:
        trapwatch_url = build_trapwatch_link(email)

        html_body = build_email_html(
            trap_id,
            time_str,
            date_str,
            trapwatch_url,
            TRAPNZ_URL
        )   
        _send_single_email(email, html_body, f"TrapWatch: Trap {trap_id} Triggered")

    print(f"Alert emails sent to recipients")

# One stat tile used in weekly report
def stat_box(number, label):
    return f"""
    <td class="stat-box" width="33%" style="padding:6px; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
            style="border:1px solid #ffffff; border-radius:14px; background:rgba(0,0,0,0.60);">
        <tr>
            <td align="center" style="padding:18px 8px; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
            <div style="font-size:32px; font-weight:bold; line-height:1.1;">{number}</div>
            <div style="font-size:13px; margin-top:6px;">{label}</div>
        </td>
    </tr>
</table>
</td>
    """

# Builds the HTML for the weekly report
def build_weekly_html(date_range, traps_triggered, pending_reset, avg_time_to_reset, trapwatch_url, trapnz_url):
    return f"""
<html>
<head>
<meta charset ="utf-8">
<meta name ="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
 @media only screen and (max-width: 620px) {{
            .email-container{{
            width: 100% !important;
            max-width: 100% !important;
            }}
            .header-table td {{
                display: block !important;
                width: 100% !important;
                text-align: left !important;
                padding: 4px 0 !important;
            }}
            .header-logo {{
                text-align: left !important;
            }}
            .header-title{{
                padding-left: 0 !important;
                padding-top: 8px !important;
                font-size: 18px !important;
            }}
            .header-date{{
                text-align: left !important;
                padding-top: 4px !important;
                white-space: normal !important;
            }}
            .trap-card {{
                margin-bottom: 12px !important;
            }}
            .btn {{
                display: block !important;
                width: 100% !important;
                max-width: 280px !important;
                margin: 0 auto 12px auto !important;
                text-align: center !important;
                box-sizing: border-box !important;
            }}
            .stat-box {{
                display: block !important;
                width: 100% !important;
                padding: 6px !important;
            }}
        }}
    </style>


</head>
<body style="margin:0; padding:0; background:#1a1a1a; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a; padding:20px 0;">
<tr>
    <td align="center" style="padding:0 10px;">
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0"
            style="width:100%; max-width:600px; background:#000000; border:2px solid #ffffff; border-radius:20px; overflow:hidden;">
        
        <!-- Header -->
        <tr>
            <td style="padding:18px 20px 12px 20px;">
                <table class="header-table" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td class="header-logo" width="50" valign="middle" style="width:50px;">
                        <img src="cid:logo" width="42" height="42" alt="TrapWatch"
                            style="display:block; border-radius:50%; border:0;">
                        </td>
                        <td class="header-title" valign="middle"
                            style="font-family:Arial, Helvetica, sans-serif; font-size:18px; color:#ffffff; padding-left:12px; line-height:1.3;">
                        TrapWatch
                    </td>
                    <td class="header-date" align="right" valign="middle"
                        style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#ffffff; white-space:nowrap; padding-left:10px;">
                    {date_range}
                </td>
            </tr>
        </table>
    </td>
</tr>

<!-- Divider -->
<tr>
    <td style="padding:0 20px;">
        <hr style="border:none; border-top:1px solid #ffffff; margin:0;">
    </td>
</tr>

<!-- Content area with background -->
<tr>
<td background="cid:background"
    style="background-image:url('cid:background'); background-size:cover; background-position:center;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
        <td style="padding:20px;">

        <!-- Week at a glance badge -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td align="center" style="padding:0 0 16px 0;">
                <span style="font-family:Arial, Helvetica, sans-serif; font-size:15px; color:#8e2a4a;
                    background:#f7d9e4; padding:5px 14px; border-radius:4px; display:inline-block;">
                Week at a glance
            </span>
        </td>
    </tr>
</table>
<!-- Stat boxes -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
    {stat_box(traps_triggered, "Traps Triggered")}
    {stat_box(pending_reset, "Pending Reset")}
    {stat_box(avg_time_to_reset, "Avg Time to Reset")}
    </tr>
</table>

             

            <!-- Buttons -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                <tr>
                    <td align="center" style="padding:8px 0;">
                        <a href="{trapwatch_url}" class="btn"
                            style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                      color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                      border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                      Use trapwatch.fft.kiwi
                </a>
            </td>
        </tr>
        <tr>
            <td align="center" style="padding:8px 0;">
                <a href="{trapnz_url}" class="btn"
                    style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                     color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                     border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                    Trap.NZ
                </a>
            </td>
        </tr>
    </table>

                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
    
            </table>
        </td>
    </tr>
</table>
</body>
</html>
"""

# Builds the HTML for the monthly report
def build_monthly_html(date_range, traps_triggered, trapwatch_url, trapnz_url):
    return f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
    @media only screen and (max-width: 620px) {{
            .email-container{{
            width: 100% !important;
            max-width: 100% !important;
            }}
            .header-table td {{
                display: block !important;
                width: 100% !important;
                text-align: left !important;
                padding: 4px 0 !important;
            }}
            .header-logo {{
                text-align: left !important;
            }}
            .header-title{{
                padding-left: 0 !important;
                padding-top: 8px !important;
                font-size: 18px !important;
            }}
            .header-date{{
                text-align: left !important;
                padding-top: 4px !important;
                white-space: normal !important;
            }}
            .trap-card {{
                margin-bottom: 12px !important;
            }}
            .btn {{
                display: block !important;
                width: 100% !important;
                max-width: 280px !important;
                margin: 0 auto 12px auto !important;
                text-align: center !important;
                box-sizing: border-box !important;
            }}
        }}
    </style>
</head>
<body style="margin:0; padding:0; background:#1a1a1a; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a; padding:20px 0;">
<tr>
    <td align="center" style="padding:0 10px;">
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0"
            style="width:100%; max-width:600px; background:#000000; border:2px solid #ffffff; border-radius:20px; overflow:hidden;">
        
        <!-- Header -->
        <tr>
            <td style="padding:18px 20px 12px 20px;">
                <table class="header-table" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td class="header-logo" width="50" valign="middle" style="width:50px;">
                        <img src="cid:logo" width="42" height="42" alt="TrapWatch"
                            style="display:block; border-radius:50%; border:0;">
                        </td>
                        <td class="header-title" valign="middle"
                            style="font-family:Arial, Helvetica, sans-serif; font-size:18px; color:#ffffff; padding-left:12px; line-height:1.3;">
                        TrapWatch
                    </td>
                    <td class="header-date" align="right" valign="middle"
                        style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#ffffff; white-space:nowrap; padding-left:10px;">
                    Monthly Report {date_range}
                </td>
            </tr>
        </table>
    </td>
</tr>

<!-- Divider -->
<tr>
    <td style="padding:0 20px;">
        <hr style="border:none; border-top:1px solid #ffffff; margin:0;">
    </td>
</tr>

<!-- Content area with background -->
<tr>
<td background="cid:background"
    style="background-image:url('cid:background'); background-size:cover; background-position:center;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
        <td style="padding:20px;">

        <!-- Big Number card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td style="padding:0 0 16px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"
                        style="border:1px solid #ffffff; border-radius:14px; background:rgba(0,0,0,.60);">
                    <tr>
                        <td align="center" style="padding:28px 16px; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
                            <div style="font-size:48px; font-weight:bold; line-height:1;">{traps_triggered}</div>
                            <div style="font-size:16px; font-weight:bold; margin-top:8px;">Traps Triggered</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
             

            <!-- Buttons -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                <tr>
                    <td align="center" style="padding:8px 0;">
                        <a href="{trapwatch_url}" class="btn"
                            style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                      color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                      border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                      use trapwatch.fft.kiwi
                </a>
            </td>
        </tr>
        <tr>
            <td align="center" style="padding:8px 0;">
                <a href="{trapnz_url}" class="btn"
                    style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                     color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                     border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                    Trap.NZ
                </a>
            </td>
        </tr>
    </table>

                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
    
            </table>
        </td>
    </tr>
</table>
</body>
</html>

"""

# builds the HTML for the daily trap summary
def build_daily_summary_html(date_str, triggered_traps, trapwatch_url, trapnz_url):
    if triggered_traps:
        header_status = f'<span style="color:#e74c3c; font-weight:bold;">{len(triggered_traps)} Triggered Today</span>'
        trap_cards = ""
        for trap_id, dt in triggered_traps.items():
            time_str = dt.strftime("%I:%M%p").lstrip("0").lower()
            trap_cards += f"""
            <tr>
                <td style="padding:0 0 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"
                        style="border:1px solid #ffffff; border-radius:10px; background:rgba(0,0,0,0.60);">
                    <tr>
                        <td style="padding:14px 16px; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
                            <div style="font-size:16px; font-weight:bold; line-height:1.3;">
                                Trap {trap_id}
                            </div>
                            <div style="font-size:13px; color:#cccccc; margin-top:4px;">
                                First triggered at {time_str}
                            </div>
                        </td>
                    </tr>
                </table>
                </td>
            </tr>
            """
    else:
            header_status = '<span style="color:#2ecc71; font-weight:bold;">No Traps Triggered Today</span>'
            trap_cards = """
            <tr>
                <td style="padding:0 0 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"
                        style="border:1px solid #ffffff; border-radius:10px; background:rgba(0,0,0,0.60);">
                    <tr>
                        <td style="padding:16px; font-family:Arial, Helvetica, sans-serif; color:#ffffff; text-align:center;">
                            No traps triggered in the last 24 hours.
                        </td>
                    </tr>
                </table>
                </td>
            </tr>
            """

    return f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
    @media only screen and (max-width: 620px) {{
            .email-container{{
            width: 100% !important;
            max-width: 100% !important;
            }}
            .header-table td {{
                display: block !important;
                width: 100% !important;
                text-align: left !important;
                padding: 4px 0 !important;
            }}
            .header-logo {{
                text-align: left !important;
            }}
            .header-title{{
                padding-left: 0 !important;
                padding-top: 8px !important;
                font-size: 18px !important;
            }}
            .header-date{{
                text-align: left !important;
                padding-top: 4px !important;
                white-space: normal !important;
            }}
            .trap-card {{
                margin-bottom: 12px !important;
            }}
            .btn {{
                display: block !important;
                width: 100% !important;
                max-width: 280px !important;
                margin: 0 auto 12px auto !important;
                text-align: center !important;
                box-sizing: border-box !important;
            }}
        }}
    </style>
</head>
<body style="margin:0; padding:0; background:#1a1a1a; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a; padding:20px 0;">
<tr>
    <td align="center" style="padding:0 10px;">
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0"
            style="width:100%; max-width:600px; background:#000000; border:2px solid #ffffff; border-radius:20px; overflow:hidden;">

            <!-- Header -->
            <tr>
                <td style="padding:18px 20px 12px 20px;">
                    <table class="header-table" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td class="header-logo" width="50" valign="middle" style="width:50px;">
                            <img src="cid:logo" width="42" height="42" alt="TrapWatch"
                                style="display:block; border-radius:50%; border:0;">
                                    </td>
                        <td class="header-title" valign="middle"
                            style="font-family:Arial, Helvetica, sans-serif; font-size:18px; color:#ffffff; padding-left:12px; line-height:1.3;">
                            TrapWatch&nbsp;&nbsp;Daily Summary&nbsp;&nbsp;{header_status}
                        </td>
                        <td class="header-date" align="right" valign="middle"
                            style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#ffffff; white-space:nowrap; padding-left:10px;">
                            {date_str}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
<!-- Divider -->
<tr>
    <td style="padding:0 20px;">
        <hr style="border:none; border-top:1px solid #ffffff; margin:0;">
    </td>
</tr>

<!-- Content area with background -->
<tr>
<td background="cid:background"
    style="background-image:url('cid:background'); background-size:cover; background-position:center;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
        <td style="padding:20px;">

        <!-- Trap cards -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            {trap_cards}
        </table>

            <!-- Buttons -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                <tr>
                    <td align="center" style="padding:8px 0;">
                        <a href="{trapwatch_url}" class="btn"
                            style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                      color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                      border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                      use trapwatch.fft.kiwi
                </a>
            </td>
        </tr>
        <tr>
            <td align="center" style="padding:8px 0;">
                <a href="{trapnz_url}" class="btn"
                    style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                     color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                     border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                    Trap.NZ
                </a>
            </td>
        </tr>
    </table>

                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
    
            </table>
        </td>
    </tr>
</table>
</body>
</html>

"""
                          
# ---------- Sending and scheduled reports ----------
# Sends one emial through Resend attaching the logo and background images used by the templates
def _send_single_email(recipient_email, html_body, subject):
    with open("assets/trapwatch_logo.png", "rb") as f:
        logo_bytes = list(f.read())
    with open("assets/background.jpg", "rb") as f:
        bg_bytes = list(f.read())

    resend.Emails.send({
        "from": "TrapWatch Alerts <alerts@trapwatch.fft.kiwi>",
        "to": [recipient_email],
        "subject": subject,
        "html": html_body,
        "attachments": [
            {"filename": "trapwatch_logo.png", "content": logo_bytes, "content_id": "logo"}, #type: ignore
            {"filename": "background.jpg", "content": bg_bytes, "content_id": "background"},
        ],
    })

# Weekly report: runs every Thursday 6am (nz time) and covers the last seven days
@scheduler_fn.on_schedule(
    schedule="every thursday 06:00",
    timezone=options.Timezone("Pacific/Auckland"),
    region="asia-southeast1"
    )
def send_weekly_report(event: scheduler_fn.ScheduledEvent) -> None:
    now = datetime.now()
    start_of_week = now - timedelta(days=7)
    date_range = f"{start_of_week.strftime('%d/%m/%y')} - {now.strftime('%d/%m/%y')}"
    traps_triggered, pending_reset, avg_time_to_reset, overdue_count = compute_stats(start_of_week, now)

    recipients = get_recipients("Weekly")
    if not recipients:
        print("No active Weekly recipients")
        return

    for email in recipients:
        trapwatch_url = build_trapwatch_link(email)
        html_body = build_weekly_html(
            date_range,
            traps_triggered,
            pending_reset,
            avg_time_to_reset,
            trapwatch_url,
            TRAPNZ_URL
        )   
        _send_single_email(email, html_body, f"TrapWatch Weekly Report: {date_range}")

    print(f"Weekly report sent - {traps_triggered} triggered, {pending_reset} pending ({overdue_count} overdue)")

# Montlhy report: runs on the 1st of each month at 9am and covers the last 30 days
@scheduler_fn.on_schedule(
    schedule="1 of month 09:00",
    region="asia-southeast1"
)
def send_monthly_report(event: scheduler_fn.ScheduledEvent) -> None:
    now  = datetime.now()
    start_of_month = now - timedelta(days=30)
    date_range = f"{start_of_month.strftime('%d/%m/%y')} - {now.strftime('%d/%m/%y')}"
    traps_triggered, _, _, _ = compute_stats(start_of_month, now)

    recipients = get_recipients("Monthly")
    if not recipients:
        print("No active Monthly recipients")
        return

    for email in recipients:
        trapwatch_url = build_trapwatch_link(email)
        html_body = build_monthly_html(
            date_range,
            traps_triggered,
            trapwatch_url,
            TRAPNZ_URL
        )
        _send_single_email(email, html_body, f"TrapWatch Monthly Report: {date_range}")

    print(f"Monthly report sent {len(recipients)} recipient - {traps_triggered} traps triggered")

# Daily Summary: runs everyday at 6am and lists traps triggered in the last 24 hours 
@scheduler_fn.on_schedule(
    schedule="every day 06:00",
    region="asia-southeast1"
)
def send_daily_summary(event: scheduler_fn.ScheduledEvent) -> None:
    now = datetime.now()
    day_num = now.day
    suffix = "th" if 11 <= day_num <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day_num % 10, "th")
    date_str = now.strftime("%a") + f" {day_num}{suffix} " + now.strftime("%b")

    triggered_traps = get_events_today()

    recipients = get_recipients("Daily")
    if not recipients:
        print("No active Daily recipients")
        return

    for email in recipients:
        trapwatch_url = build_trapwatch_link(email)
        html_body = build_daily_summary_html(
            date_str,
            triggered_traps,
            trapwatch_url,
            TRAPNZ_URL
        )
        subject = (
            f"TrapWatch Daily Summary: {len(triggered_traps)} Triggered Today"
            if triggered_traps else 
            f"TrapWatch Daily Summary: No Traps Triggered Today"
        )
        _send_single_email(email, html_body, subject)

    print(f"Daily summary sent to {len(recipients)} recipient - {len(triggered_traps)} traps triggered")

#---------- Statistics ----------
# Group trap events into streaks per trap, a trap triggereing repeatdly with gaps under 90 minutes counts as one trigger, a longer gap means it was reset and triggered again
# A streak is ongoing (still waiting to be reset) if its latest activity was within 90 minutes
def get_trap_streaks():
    events_ref = db.reference("/Events")
    all_events = events_ref.get() or {}
    by_trap = {}
    for event_id, data in all_events.items(): # type: ignore
        if not isinstance(data, dict):
            continue
        trap_id = str(data.get("transmitter_ID") or data.get("trap_ID") or "").upper()
        if not trap_id:
            continue
        timestamp = data.get("timeStamp")
        if not trap_id or not timestamp:
            continue
        dt = parse_iso(timestamp)
        if dt is None:
            continue
        by_trap.setdefault(trap_id, []).append(dt)

    _tx_raw = db.reference("/Transmitters").get() or {}
    transmitters = {str(k).upper(): v for k, v in _tx_raw.items()} if isinstance(_tx_raw, dict) else {}
    GAP_THRESHOLD = timedelta(minutes=90)
    now = datetime.now()
    streaks = []
    for trap_id, timestamps in by_trap.items():
        timestamps.sort()
        streak_start = timestamps[0]
        streak_end = timestamps[0]
        for ts in timestamps[1:]:
            if ts - streak_end > GAP_THRESHOLD:
                streaks.append({
                    "trap_id": trap_id,
                    "start": streak_start,
                    "end": streak_end,
                    "is_ongoing": False,
                })
                streak_start = ts
            streak_end = ts
        tx = transmitters.get(trap_id) if isinstance(transmitters, dict) else None
        ls = parse_iso((tx or {}).get("last_seen")) if isinstance(tx, dict) else None
        if ls and ls > streak_end:
            streak_end = ls
        is_ongoing = (now - streak_end) <= GAP_THRESHOLD
        streaks.append({
            "trap_id": trap_id,
            "start": streak_start,
            "end": streak_end,
            "is_ongoing": is_ongoing,
        })
    return streaks

# Calculates the report numbers for a date range: traps triggered, traps still pending reset
# average time to reset ( completed streaks only ) and how many pending traps are over 24 hours old.
def compute_stats(start_dt: datetime, end_dt: datetime):
    streaks = get_trap_streaks()
    now = datetime.now()
    triggered_in_period = [s for s in streaks if start_dt <= s["start"] < end_dt]
    traps_triggered = len(triggered_in_period)
    pending = [s for s in streaks if s["is_ongoing"]]
    pending_reset = len(pending)
    overdue = [s for s in pending if (now - s["start"]) >= timedelta(hours=24)]
    overdue_count = len(overdue)
    completed_in_period = [s for s in triggered_in_period if not s["is_ongoing"]]
    if completed_in_period:
        durations = [(s["end"] - s["start"]) for s in completed_in_period]
        avg_seconds = sum(d.total_seconds() for d in durations) / len(durations)
        avg_hours = avg_seconds / 3600
        avg_time_to_reset = f"{avg_hours:.1f}h" if avg_hours < 24 else f"{avg_hours / 24:.1f}d"
    else:
        avg_time_to_reset = "N/A"
    return traps_triggered, pending_reset, avg_time_to_reset, overdue_count

        
    

