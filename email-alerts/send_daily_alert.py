import resend
from datetime import datetime

resend.api_key = ""
RECIPIENT_EMAIL = ""

TRAPS = [
    {"trap_id: "17", "location": "Ridge Line, North Block", "time": "2:14pm"},
    {"trap_id: "8", "location": "Creek Line, Lower Paddock", "time": "11:47am"},
]

today = datetime.now()
day_num = today.day
suffix = "th" if 11 <= day_num <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day_num % 10, "th")
date_str = today.strftime("%a") + f" {day_num}{suffix} " + today.strftime("%b")

ids_str = ", ".join([t["trap_id"] for t in TRAPS])

trap_boxes = ""
for t in TRAPS:
    trap_boxes += f"""
    <tr><td style="padding:8px 0;">
        <table width="100%" cellpadding="0" cellspacing="0"
            style="border:1px solid "fff; border-radoius:10px; background:rgba(0,0,0,0.55):">
        <tr><td style="padding:14px 20px: font-family:Arial,sans-serif: color:#fff;">
        <span style="font-size:16px;">Trap {t['trap_id']} {t['location']}</span><br>
        <span style="font-size:12px; color:#cccccc;">Triggered at {t['time']}</span>
        </td></tr>
        </table>
    </td></tr>
    """
html = f"""
<html><body style="margin:0; padding:0; background:#1a1a1a;">
table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a; padding:30px 0;">
<tr><td align="center">
table width="600" cellpadding="0" cellspacing="0"
        style="background:000; border:2px solid #fff; border-radius:24px; overflowhidden;">

    <tr><td style="padding:20px 24px 12px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td width="50"><img src"cid:logo" width="42" hieght"42" height"42" style="border-radius:50%;"></td>
            <td style="dont-family:Arial,sans-serif; font-size:20px; color:#fff; padding-left:10px;">
            TrapWatch&nbsp;&nbsp;span style="color:#e74c3c; font-weight:bold;">! {ids_str} Triggered</span>
            </td>
            <td align="right" style="font-family:Arial,sans-serif; font-size:15px; color:#fff; white-space:nowrap;">
            {date_str}
            </td>
        </tr>
        </table>
    </td></tr>

    <tr><td style="padding:0 24px;"><hr style="border:none; border-tap:1px solid #fff;"/>
    </td></tr>

    <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
        background="cid:background" style="background-image:url('cid:background'); background-size:cover;">
        <tr><td style="padding:24px;">
            <table width="100%" cellpadding="0" cellspacing="0">{trap_boxes}</table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
             <tr>td align="center" style="padding:10px 0; font-family:Arial,sans-serif; font-size:14px;">
             <a href="#" style="color:#7ab8f5;">View more on TrapWatch.com</a>
                </td></tr>
            </td></tr>
            <tr><td align="center" style="padding:4px 0 10pc 0; font-family:Arial,sans-serif; font-size:14px;">
            <a href="#" style="color:#7ab8f5;">Trap.NZ</a>
            </td></tr>
        </table>
        </td></tr>
    </table>
    </td></tr>

</table>
</td></tr>
</table>
</body></html>
"""

with open("trapwatch_logo.png", "rb") as f:
    logo_bytes = list(f.read())
with open("trapwatch_background.png", "rb") as f:
    bg_bytes = list(f.read())

resend.Emails.send({
    "from": "onbaording@resend.dev",
    "to": [RECIPIENT_EMAIL],
    "subject": f"TrapWatch: Trap(s) {ids_str} Triggered",
    "html": html,
    "attachments": [
        {"filename" : "trapwatch_logo.png", "content": logo_bytes, "content_id": "logo"},
        {"filename" : "trapwatch_background.png", "content": bg_bytes, "content_id": "background"},
    ],
})

print("Daily alert email sent successfully.")
    

