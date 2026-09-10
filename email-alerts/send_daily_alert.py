import resend
from datetime import datetime
import os

resend.api_key = "RESEND_API_KEY"
RECIPIENT_EMAIL = "jiteeshdeo@gmail.com"

TRAPS = [
    {"trap_id": "17", "location": "Ridge Line, North Block", "time": "2:14pm"},
    {"trap_id": "8", "location": "Creek Line, Lower Paddock", "time": "11:47am"},
]

today = datetime.now()
day_num = today.day
suffix = "th" if 11 <= day_num <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day_num % 10, "th")
date_str = today.strftime("%a") + f" {day_num}{suffix} " + today.strftime("%b")

ids_str = ", ".join([t["trap_id"] for t in TRAPS])

trap_boxes = ""
for t in TRAPS:
    trap_boxes += f"""
    <tr>
        <td class="trap-card" style="padding:0 0 12px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="border:1px solid #ffffff; border-radius:10px; background:rgba(0,0,0,.60);">
            <tr>
                <td style="padding:14px 16px; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
                    <div style="font-size:16px; font-weight:bold; line-height:1.3;">
                        Trap {t['trap_id']} - {t['location']}
                    </div>
                    <div style="font-size:13px; color:#cccccc; margin-top:4px;">
                        Triggered at {t['time']}
                    </div>
                </td>
            </tr>
        </table>
    </td>
</tr>       
"""
    
html = f"""
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
                        TrapWatch&nbsp;&nbsp;<span style="color:#e74c3c; font-weight:bold;">! {ids_str} Triggered</span>
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
                {trap_boxes}
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

with open("assets/trapwatch_logo.png", "rb") as f:
    logo_bytes = list(f.read())
with open("assets/background.jpg", "rb") as f:
    bg_bytes = list(f.read())

resend.Emails.send({
    "from": "onboarding@resend.dev",
    "to": [RECIPIENT_EMAIL],
    "subject": f"TrapWatch: Trap(s) {ids_str} Triggered",
    "html": html,
    "attachments": [
        {"filename" : "trapwatch_logo.png", "content": logo_bytes, "content_id": "logo"},
        {"filename" : "background.jpg", "content": bg_bytes, "content_id": "background"},
    ],
})

print("Daily alert email sent successfully.")
    

