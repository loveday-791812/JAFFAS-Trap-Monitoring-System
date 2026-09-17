from firebase_functions import db_fn, scheduler_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, db
from datetime import datetime, timedelta
import resend

set_global_options(max_instances=10)
initialize_app()

resend.api_key = ""
RECIPIENT_EMAIL = ""

def build_email_html(trap_id, time_str, date_str):
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
                            <a href="#" class="btn"
                                style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                          color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                          border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                          View TrapWatch.com
                    </a>
                </td>
            </tr>
            <tr>
                <td align="center" style="padding:8px 0;">
                    <a href="#" class="btn"
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

@db_fn.on_value_created(
    reference="/Events/{event_id}",
    region="asia-southeast1"
    )
def send_trap_alert(event: db_fn.Event) -> None:
    """
    Fires when a new entry is written to /Events
    """
    data = event.data
    trap_id = data.get("trap_ID", "Unknown")
    timestamp = data.get("timeStamp")

    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp)
        except (ValueError, TypeError):
            dt = datetime.now()
    else:
        dt = datetime.now()

    # cross platform dafe time formatting
    time_str = dt.strftime("%I:%M%p").lstrip("0").lower()
    day_num = dt.day
    suffix = "th" if 11 <= day_num <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day_num % 10, "th")
    date_str = dt.strftime("%a") + f" {day_num}{suffix} " + dt.strftime("%b")

    html_body = build_email_html(trap_id, time_str, date_str)

    with open("assets/trapwatch_logo.png", "rb") as f:
        logo_bytes = list(f.read())
    with open("assets/background.jpg", "rb") as f:
        bg_bytes = list(f.read())

    attachments = [
        {"filename": "trapwatch_logo.png", "content": logo_bytes, "content_id": "logo"},
        {"filename": "background.jpg", "content": bg_bytes, "content_id": "background"},
    ]

    resend.Emails.send({
        "from": "onboarding@resend.dev",
        "to": [RECIPIENT_EMAIL],
        "subject": f"TrapWatch: Trap {trap_id} Triggered",
        "html": html_body,
        "attachments": attachments, # type: ignore
    })

    print(f"Alert email sent")

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

def build_weekly_html(date_range, traps_triggered, pending_reset, avg_time_to_reset):
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
                        <a href="#" class="btn"
                            style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                      color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                      border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                      View TrapWatch.com
                </a>
            </td>
        </tr>
        <tr>
            <td align="center" style="padding:8px 0;">
                <a href="#" class="btn"
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

def build_monthly_html(date_range, traps_triggered):
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
                        <a href="#" class="btn"
                            style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:14px;
                                      color:#ffffff; text-decoration:none; background:rgba(0,0,0,0.65);
                                      border:1px solid #ffffff; border-radius:20px; padding:10px 22px;">
                      View TrapWatch.com
                </a>
            </td>
        </tr>
        <tr>
            <td align="center" style="padding:8px 0;">
                <a href="#" class="btn"
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


def _send_with_images(html_body, subject):
    with open("assets/trapwatch_logo.png", "rb") as f:
        logo_bytes = list(f.read())
    with open("assets/background.jpg", "rb") as f:
        bg_bytes = list(f.read())

    resend.Emails.send({
        "from": "onboarding@resend.dev",
        "to": [RECIPIENT_EMAIL],
        "subject": subject,
        "html": html_body,
        "attachments": [
            {"filename": "trapwatch_logo.png", "content": logo_bytes, "content_id": "logo"},
            {"filename": "background.jpg", "content": bg_bytes, "content_id": "background"},
        ],
    })

@scheduler_fn.on_schedule(
    schedule="every monday 09:00",
    region="asia-southeast1"
    )
def send_weekly_report(event: scheduler_fn.ScheduledEvent) -> None:
    now = datetime.now()
    start_of_week = now - timedelta(days=7)
    date_range = f"{start_of_week.strftime('%d/%m/%y')} - {now.strftime('%d/%m/%y')}"
    traps_triggered, pending_reset, avg_time_to_reset, overdue_count = compute_stats(start_of_week, now)
    html_body = build_weekly_html(date_range, traps_triggered, pending_reset, avg_time_to_reset)
    _send_with_images(html_body, f"TrapWatch Weekly Report: {date_range}")
    print(f"Weekly report sent - {traps_triggered} triggered, {pending_reset} pending ({overdue_count} overdue)")

@scheduler_fn.on_schedule(
    schedule="1 of month 09:00",
    region="asia-southeast1"
)
def send_monthly_report(event: scheduler_fn.ScheduledEvent) -> None:
    now  = datetime.now()
    start_of_month = now - timedelta(days=30)
    date_range = f"{start_of_month.strftime('%d/%m/%y')} - {now.strftime('%d/%m/%y')}"
    traps_triggered, _, _, _ = compute_stats(start_of_month, now)
    html_body = build_monthly_html(date_range, traps_triggered)
    _send_with_images(html_body, f"TrapWatch Monthly Report: {date_range}")
    print(f"Monthly report sent - {traps_triggered} traps triggered")

def get_trap_streaks():
    events_ref = db.reference("/Events")
    all_events = events_ref.get() or {}
    by_trap = {}
    for event_id, data in all_events.items(): # type: ignore
        if not isinstance(data, dict):
            continue
        trap_id = data.get("trap_ID")
        timestamp = data.get("timeStamp")
        if not trap_id or not timestamp:
            continue
        try:
            dt = datetime.fromisoformat(timestamp)
        except (ValueError, TypeError):
            continue
        by_trap.setdefault(trap_id, []).append(dt)

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
        is_ongoing = (now - streak_end) <= GAP_THRESHOLD
        streaks.append({
            "trap_id": trap_id,
            "start": streak_start,
            "end": streak_end,
            "is_ongoing": is_ongoing,
        })
    return streaks

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

        
    

