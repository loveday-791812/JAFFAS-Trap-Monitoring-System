## What is on the ESP
main.py = where the program lives
trap_dictionary.py = where the trap IDs live
login_info.py = where the ESP's login information for Firebase lives
test_signal.py = might be on there, fine to delete

## To add/edit/remove any files on the ESP
#Install mpremote
1. Open powershell
2. Run: python -m pip install mpremote
3. Check it worked: python -m mpremote --help

If "python" is not found, try "py -m pip install mpremote" (Windows) or "python3" (Mac/Linux)

#Find COM port
python -m mpremote connect list

#Upload files to ESP32
Make sure the directory in powershell is where the files are located
COM# will be whatever COM port it uses, replace with a number

python -m mpremote connect COM# fs cp main.py :main.py
python -m mpremote connect COM# fs cp trap_dictionary.py :trap_dictionary.py
python -m mpremote connect COM# fs cp login_info.py :login_info.py

after the : is what the name on the board will be

#Remove files from ESP32
python -m mpremote connect COM# fs rm :filename.py

#Check files on ESP32
python -m mpremote connect COM# fs ls

#Read contents of file on the board
python -m mpremote connect COM# fs cat :trap_dictionary.py

#Copy file from board to connected PC
python -m mpremote connect COM# fs cp :trap_dictionary.py trap_dictionary_from_board.py


##Update trap dictionary
Open your file and match what is there. It should look like this:
trap_ids = {
    "08 DB 40 00 88 02 32 01": "17579861",
    "94 91 42 00 88 02 32 01": "17583320/17583321",
}

Steps:
1. Add or change the transmitter in the database first. The last_seen update is only allowed when the transmitter already exists there
2. Open trap_dictionary.py in a text editor
3. Add a line in the same format. Rules:
- The hex code is UPPERCASE letters and numbers, 8 bytes, a space between each byte.
- Both sides are in quotes, with a colon between them, and a comma at the end of the line.
- The trap ID may only use letters, numbers, space, / _ and - and be at most 32 characters. The database refuses anything else (for example "#" or brackets), and then the whole event is rejected. For two traps on one transmitter use "17583320/17583321".
4. Save the file.
5. Upload it: python -m mpremote connect COM# fs cp trap_dictionary.py :trap_dictionary.py
6. Press RESET on the board.
7. Check it. Trigger the transmitter and look for "Data added successfully!". Then check the new event has the right trap_ID in the database or dashboard.


##Watch what the board is printing
1. Run: python -m mpremote connect COM# repl
2. Press RESET on the board

##Common errors
"failed to access COM7" = Using the wrong port, board is not plugged in, or another program is using it (close other programs like VS Code or Arduino)
"No module named mpremote" = Run the mpremote install again
"Login failed" = ESP account info was changed in the database, will need to be updated in login_info.py
"Ignored oversized packet" = more than 8 bytes arrives at the same time, usually two signals.
"Event saved with trap_ID unknown" = The hex code is not in trap_dictionary.py. You will need to add it.
Timestamps look 12 or 13 hours off = They are UTC (time zone 0), not New Zealand time. This is intended. The dashboard should handle it.







