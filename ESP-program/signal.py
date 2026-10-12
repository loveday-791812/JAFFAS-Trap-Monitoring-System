#generates bytes not hex
import os
from trap_dictionary import trap_ids

def transmitter():
    hex_keys = list(trap_ids.keys())
    pick = hex_keys[os.urandom(1)[0] % len(hex_keys)]
    data = bytes(int(part, 16) for part in pick.split(" "))
    return data + b'\r'

