import network
import time
import socket
import tls
import urequests
import ujson
import gc
from machine import UART

timeout = 0 #timeout variable

#Firebase login info
FIREBASE_URL = "https://test-a1ebe-default-rtdb.asia-southeast1.firebasedatabase.app"
FIREBASE_API_KEY = "AIzaSyB9IxN0UE0thEFSu5RpelDWnWbmeFFhyV0"
FIREBASE_EMAIL = "esp32-device@test.com"
FIREBASE_PASSWORD = "Esp32Test!2026"

firebase_id_token = "" #will hold token after loggin in to firebase

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
addr = socket.getaddrinfo('example.com', 443) [0] [-1] #connects to URL (host, port, af=0, type=0, proto=0, flags=0, /)
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM) #creates normal TCP socket
s.connect(addr) #tcp connect first
ctx = tls.SSLContext(tls.PROTOCOL_TLS_CLIENT) #current version of MP doesnt have wrap_socket, need to make SSL first
ctx.verify_mode = tls.CERT_NONE

secure_s = ctx.wrap_socket(s, server_hostname="example.com") #puts socket in TCP encryption
secure_s.send(b'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n')
data = secure_s.recv(1000)
secure_s.close()

##UART settings
uart = UART(1, 9600)
uart.init(9600, rx=20, tx=21, bits=8, parity=None, stop=1)

MESSAGE_LENGTH = 8

data_uart = UART(1) #creates second serial connection?
received_bytes = bytearray(MESSAGE_LENGTH)
byte_index = 0
packet_too_long = False

##Convert Byte to hex
data = bytes([0x12, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11]) #byte data, will need to change to receive from receiver
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

#hard coded data for test
event_data = {"AB_TEST1": {"transmitter_ID": "15 11 11 11 11 11 11 11", "timestamp": "12"}}

auth_result = firebase_sign_in() #checks if login works

#check if login works
if "idToken" not in auth_result:
    print("Login failed:", auth_result)
else:
    id_token = auth_result["idToken"]
    refresh_token = auth_result["refreshToken"]
    print("Login Successful")
    URL = FIREBASE_URL + "/Events.json?auth=" + id_token

    gc.collect()
    response = urequests.patch(URL, data=ujson.dumps(event_data), headers={"Content-Type": "application/json"})

    if response.status_code == 200:
        print("Data added successfully!")
    else:
        print("Data failed to merge:", response.status_code)

#response.close()

print('Works')