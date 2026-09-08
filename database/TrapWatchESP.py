import firebase_admin
import json
from firebase_admin import credentials
from firebase_admin import db

cred = credentials.Certificate("trap-watch-firebase-adminsdk-fbsvc-871883791d.json")

default_app = firebase_admin.initialize_app(cred, {
    "databaseURL": "https://trap-watch-default-rtdb.asia-southeast1.firebasedatabase.app"
})


ref = db.reference("/")

import json
with open("TrapWatchDB.json", "r") as f:
    file_contents = json.load(f)
ref.set(file_contents)
