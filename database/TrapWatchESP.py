import firebase_admin
import json
from firebase_admin import credentials
from firebase_admin import db
from pathlib import Path

script_location = Path(__file__).resolve().parent
pkey_location = script_location / "trap-watch-firebase-adminsdk-fbsvc-f9b08f048c.json"
cred = credentials.Certificate(str(pkey_location))

default_app = firebase_admin.initialize_app(cred, {
    "databaseURL": "https://trap-watch-default-rtdb.asia-southeast1.firebasedatabase.app"
})


ref = db.reference("/")

json_location = script_location / "TrapWatchDB.json"
import json
with open(str(json_location), "r") as f:
    file_contents = json.load(f)
ref.set(file_contents)
