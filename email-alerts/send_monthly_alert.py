import resend

resend.api_key = ""RESEND_API_KEY""
RECIPIENT_EMAIL = "jiteeshdeo@gmail.com"

DATE_RANGE = "24/08 - 31/08"
TRAPS_TRIGGERED = 6

html = f"""
<html>
<head>
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0; padding:0; background:#1a1a1a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a; padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
        style="background:#000; border:2px solid #fff; border-radius:24px; overflow:hidden;">

        <tr><td style="padding:20px 24px 12px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td width="50"><img src="cid:logo" width="42" height="42" style="border-radius:50%;"></td>
            <td style="font-family:Arial,sans-serif; font-size:20px; color:#fff; padding-left:10px;">
            TrapWatch
            </td>
            <td align="right" style="font-family:Arial,sans-serif; font-size:15px; color:#fff; white-space:nowrap;">
            Monthly Report {DATE_RANGE}
            </td>
        </tr>
        </table>
    </td></tr>

    <tr><td style="padding:0 24px;"><hr style="border:none; border-top:1px solid #fff;"/>
    </td></tr>

    <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" background="cid:background" style ="background-image:url('cid:background'); background-size:cover;">
        <tr><td style="padding:24px;">

            <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:8px 0 16px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0"
                        style="border:1px solid #fff; border-radius:14px; background:rgba(0,0,0,0.55);">
                    <tr><td align="center" style="padding:30px 8px; font-family:Arial,sans-serif; color:#fff;">
                        <div style="font-size:48px; font-weight:bold;">{TRAPS_TRIGGERED}</div>
                        <div style="font-size:16px; font-weight:bold; margin-top:6px;">Traps Triggered</div>
                    </td></tr>
                </table>
            </td></tr>
        </table>


        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr><td align="center" style="padding:10px 0;">
                    <table align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr><td>
                        <a href="#" style="display:inline-block; font-family:Arial,sans-serif; font-size:14px;
                                    color:#ffffff; text-decoration:underline; background:rgba(0,0,0,0.55);
                                    border:1px solid #ffffff; border-radius:20px; padding:8px 18px;">
                                    View TrapWatch.com
                                </a>
                            </td></tr>
                        </table>
                    </td></tr>
                    <tr><td align="center" style="padding:4px 0 14px 0;">
                        <table align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr><td>
                        <a href="#" style="display:inline-block; font-family:Arial,sans-serif; font-size:14px;
                                    color:#ffffff; text-decoration:underline; background:rgba(0,0,0,0.55);
                                     border:1px solid #ffffff; border-radius:20px; padding:8px 18px;">
                                    Trap.NZ
                                </a>
                            </td></tr>
                        </table>
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

with open("assets/trapwatch_logo.png", "rb") as f:
    logo_bytes = list(f.read())

with open("assets/background.jpg", "rb") as f:
    bg_bytes = list(f.read())

resend.Emails.send({
    "from": "onboarding@resend.dev",
    "to" : [RECIPIENT_EMAIL],
    "subject": f"Trapwatch Monthly Report: {DATE_RANGE}",
    "html": html,
    "attachments": [
        {"filename": "trapwatch_logo.png", "content": logo_bytes, "content_id": "logo"},
        {"filename": "background.jpg", "content": bg_bytes, "content_id": "background"},
    ],
})

print("Monthly alert sent")
        
