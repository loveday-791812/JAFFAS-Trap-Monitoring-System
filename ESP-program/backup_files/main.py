import network
import time
import socket
import tls
import urequests
import ujson
import gc
import os #for testing purposes, creating random hex values
from machine import UART

timeout = 0 #timeout variable

#Firebase login info
FIREBASE_URL = "https://test-a1ebe-default-rtdb.asia-southeast1.firebasedatabase.app"
FIREBASE_API_KEY = "AIzaSyB9IxN0UE0thEFSu5RpelDWnWbmeFFhyV0"
FIREBASE_EMAIL = "esp32-device@test.com"
FIREBASE_PASSWORD = "Esp32Test!2026"

firebase_id_token = "" #will hold token after loggin in to firebase

#UART settings
UART_RX_PIN = "20"
UART_TX_PIN = "21"
UART_BAUD = "9600"

#for event_ID
event_ID_counter = 0

##MP version of WiFi.h
#Wifi connection fucntion
nic = network.WLAN(network.WLAN.IF_STA) #Creates station interface object
nic.active(False) #deactivtes interface
time.sleep(0.5) #wait 5 mili seconds
nic.active(True) #activtes interface, ^whole process restarts wifi
nic.connect('B_DECO', 'JJEXXRRE') #connect to router

#If wifi not connecting
if not nic.isconnected():
    print('Connecting to Wifi...')
    while (not nic.isconnected() and timeout < 5): #Leaves while loop if timeout more than 5 or wifi connects
        print(5 - timeout)
        timeout = timeout + 1
        time.sleep(1)
#If/when wifi connects
if(nic.isconnected()):
    ip = nic.ifconfig()[0]
    print(f'Connected to {ip}')
    ##MP version of HTTPClient.h
    req = urequests.get('https://www.example.com') #sends request to inputted URL
    print(req.status_code) #prints status code. 200 = success code
    print(req.text) #prints response in text formatting
else:
    print('Time Out') #if timeout goes to 0

##MP version of WiFiClientSecure.h
#addr = socket.getaddrinfo('example.com', 443) [0] [-1] #connects to URL (host, port, af=0, type=0, proto=0, flags=0, /)
#s = socket.socket(socket.AF_INET, socket.SOCK_STREAM) #creates normal TCP socket
#s.connect(addr) #tcp connect first
#ctx = tls.SSLContext(tls.PROTOCOL_TLS_CLIENT) #current version of MP doesnt have wrap_socket, need to make SSL first
#ctx.verify_mode = tls.CERT_NONE

#secure_s = ctx.wrap_socket(s, server_hostname="example.com") #puts socket in TCP encryption
#secure_s.send(b'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n')
#data = secure_s.recv(1000)
#secure_s.close()

##UART setup
uart = UART(1, 9600)
uart.init(9600, rx=20, tx=21, bits=8, parity=None, stop=1)

MESSAGE_LENGTH = 8

received_bytes = bytearray(MESSAGE_LENGTH)
byte_index = 0
packet_too_long = False

##Convert Byte to hex
data = os.urandom(8) #byte data, will need to change to receive from receiver
hex = ' '.join(f'{b:02x}' for b in data) #converts to hex, with spaces
print(hex)  #prints hex


##Firebase sign in
def firebase_sign_in():
    global firebase_id_token

    auth_url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FIREBASE_API_KEY
    auth_payload = {"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True}

    gc.collect()
    auth_response = urequests.post(auth_url, data=ujson.dumps(auth_payload), headers={'Content-Type': 'application/json'})
    auth_result = ujson.loads(auth_response.text)
    auth_response.close()
    return auth_result

##Firebase send
def send_to_firebase(hex_data):
    global firebase_id_token, event_ID_counter

    event_ID = f"EVENT_ +{event_ID_counter}" #HERE WHEN YOU STOPPED, MIGHT HAVE TO TAKE A STEP BACK
    event_ID_counter += 1

    #hard coded data for test
    event_data = {event_ID: {"transmitter_ID": hex_data, "timestamp": "10"}}

    if not nic.isconnected():
        print('WiFi disconnected; attempting to reconnect')
        nic.connect('Wokwi-GUEST', '')

    if firebase_id_token == "":
        auth_result = firebase_sign_in()
        if "idToken" not in auth_result:
            print("Login failed:", auth_result)
        firebase_id_token = auth_result["idToken"]
        print("Login Successful")
    
    URL = FIREBASE_URL + "/Events.json?auth=" + firebase_id_token

    gc.collect()
    response = urequests.post(URL, data=ujson.dumps(event_data), headers={"Content-Type": "application/json"})

    if response.status_code == 200:
        print("Data added successfully!", response.text)
    elif response.status_code == 401:
        firebase_id_token = ""
        print("Auth expired, will re-sign-in next packet")
    else:
        print("Data failed to merge:", response.status_code)

    response.close()

##Loop to keep script going
def loop():
    global byte_index, packet_too_long
    while True:
        while uart.any():
            incoming_byte = uart.read(1)[0]

            if incoming_byte == 0x0D:
                if not packet_too_long and byte_index > 0:
                    hex_data = ' '.join(f'{b:02x}' for b in received_bytes[:byte_index])
                    print('Received:', hex_data)
                    send_to_firebase(hex_data)
                else:
                    print('Ignored empty or oversized packet')
                
                byte_index = 0
                packet_too_long = False
                continue
            
            if incoming_byte == 0x0A:
                continue

            if incoming_byte == 0x00:
                continue

            if byte_index < MESSAGE_LENGTH:
                received_bytes[byte_index] = incoming_byte;
                byte_index += 1
            else:
                packet_too_long = True

print('Works')

loop()