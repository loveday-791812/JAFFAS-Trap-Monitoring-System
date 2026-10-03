import network
import time
import urequests
import ujson
import gc
import ntptime
from machine import UART
from machine import RTC
from machine import Pin
from signal import transmitter   

timeout = 0 #timeout variable
APN = "internet" #2 degrees network

#Firebase login info
FIREBASE_URL = "https://trap-watch-default-rtdb.asia-southeast1.firebasedatabase.app/"
FIREBASE_API_KEY = "AIzaSyClXxRuzYNSg54oPuM5V-ONfqqK3vE2TWs"
FIREBASE_EMAIL = "trapwatchesp32@gmail.com"
FIREBASE_PASSWORD = "Esp32Test!2026"

firebase_id_token = "" #will hold token after loggin in to firebase

#4G setup
MODULE_TX_PIN = 26
MODULE_RX_PIN = 27
MODULE_POWERKEY = 4
MODULE_POWER_ON = 12
MODULE_BAUD = 115200

##data UART setup
uart = UART(2, 9600)
uart.init(9600, rx=21, tx=22, bits=8, parity=None, stop=1)

MESSAGE_LENGTH = 8
received_bytes = bytearray(MESSAGE_LENGTH)
byte_index = 0
packet_too_long = False

##MP version of powerOnModule function
#4G connection fucntion
def power_on_module():
    power_on = Pin(MODULE_POWER_ON, Pin.OUT) 
    power_on.value(1) 

    powerkey = Pin(MODULE_POWERKEY, Pin.OUT)
    powerkey.value(0)
    time.sleep(0.1)
    powerkey.value(1)
    time.sleep(1) 
    powerkey.value(0)

#4G Module UART setup
power_on_module()
time.sleep(3)
module_uart = UART(1, MODULE_BAUD)
module_uart.init(MODULE_BAUD, rx=MODULE_RX_PIN, tx=MODULE_TX_PIN, bits=8, parity=None, stop=1)

##MP version of sendAT function
def send_AT(command, expected = 'ok', wait_time = 10):
    while module_uart.any():
        module_uart.read()

    module_uart.write(command.encode() + b'\r\n')
    reply = b''
    start = time.time()

    while time.time() - start < wait_time:
        if module_uart.any():
            reply = reply + module_uart.read()
            if expected.encode() in reply or b'ERROR' in reply:
                break
            time.sleep(0.5)

    print('AT>', command) #shows what was sent
    print(reply) #shows what came back
    return expected.encode() in reply

##MP version of wait for module to register
def wait_for_network(max_seconds=60):
    start = time.time()
    while time.time() - start <  max_seconds:
        if send_AT('AT+CGREG?', '0,1', 2) or send_AT('AT+CGREG?', '0,5', 2):
            print('Network Registered')
            return True
        time.sleep(2)
    print("Network registration timed out")
    return False

##MP version of connectMobileData
def connect_mobile_data():
    if not wait_for_network():
        return False

    send_AT('AT+NETCLOSE', '+NETCLOSE: 0', 10)
    send_AT('AT+CGDCONT=1,"IP","' + APN + '"')
    if not send_AT('AT+NETOPEN', '+NETOPEN: 0', 75):
        print('Mobile connection failed')
        return False

    send_AT('AT+IPADDR')
    print('Mobile data connected')
    return True

send_AT('AT') #basic check, should end with OK
send_AT('AT+CPIN?', 'READY') #SIM check
send_AT('AT+CSQ') #signal strength
connect_mobile_data() #joins the network and opens mobile data



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
else:
    print('Time Out') #if timeout goes to 0

##Firebase sign in
def firebase_sign_in():
    global firebase_id_token #calls in from above, else firebase_id_token would be treated as a new variable
    auth_url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FIREBASE_API_KEY
    auth_payload = {"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True} #login credentials as a dicionary
    gc.collect() #garbage collector, removes unused objects. lowers running our of ram chance
    auth_response = urequests.post(auth_url, data=ujson.dumps(auth_payload), headers={'Content-Type': 'application/json'}) #sends a post request to url, converts the auth_payload into JSON string, tells firebase its sending JSON
    auth_result = ujson.loads(auth_response.text) #receives back raw text from firebase and cinverts back to dictionary
    auth_response.close() #closes network connection to avoid network failures
    return auth_result #sends received dictionary to the caller of the function, should contain "idToken" and "refreshToken", if fialed contains error

##send to Firebase 
#send to firebase function
def send_to_firebase(hex_data): #hex_data is parameter, placeholder for value that gets inserted when function called
    global firebase_id_token # calls from above, ensures not seens as new variable below

    #ensures wifi is connected
    if not nic.isconnected(): #ensures wifi is connected
        print('WiFi disconnected; attempting to reconnect')
        nic.connect('your-wifi-name-here', 'wifi-password-here')

    #checks if the id token is empty
    if firebase_id_token == "": 
        auth_result = firebase_sign_in() #calls firebase sing in fucntion, receives token dictionary
        if "idToken" not in auth_result: #checks login was successful
            print("Login failed:", auth_result) #prints why login failed if failed
            return #stops next line from crashing the program as token not present
        firebase_id_token = auth_result["idToken"] #Puts token into the global variable, letting future attempts skip signing in again, might be security risk
        print("Login Successful")

    #timestamp
    ntptime.settime() #syncs to local time
    now = time.localtime() #assigns local time to object
    print("{:02d}/{:02d}/{:04d} {:02d}:{:02d}:{:02d}".format(now[2], now[1], now[0], now[3], now[4], now[5])) #prints the time in formatted way with 0 infront of each digit
    timestamp = "{:02d}/{:02d}/{:04d} {:02d}:{:02d}:{:02d}".format(now[2], now[1], now[0], now[3], now[4], now[5]) #assigns time to timestamp

    #building event
    event_data = {"transmitter_ID": hex_data, "timestamp": timestamp}
    url = FIREBASE_URL + "/Events.json?auth=" + firebase_id_token #puts together location in database where the data will go
    
    #sending event
    gc.collect() #garbage collecting, clears any unused object to save memory
    response = urequests.post(url, data=ujson.dumps(event_data), headers={"Content-Type": "application/json"}) #sends post request that adds new item database, post auto creates new key (which isnt ideal but we will work around)

    #checking if post request worked
    if response.status_code == 200: #if status code is 200, successfully sent
        print("Data added successfully!", response.text) #shows what was sent
    elif response.status_code == 401: #means request lacks authentication meaning token expired
        firebase_id_token = "" #sets token back to nothing, making program sign in again
        print("Auth expired, will re-sign-in next packet")
    else:
        print("Data failed to merge:", response.status_code) #other failure, sends reason

    response.close() #closes network connection to avoid failure


def loop(): #defines loop function
    global byte_index, packet_too_long #calls from above to avoid new variables
    while True: #starts the infinite loop, keeps checking for new bytes
        while uart.any(): #second loop, returns unread bytes
            incoming_byte = uart.read(1)[0] #reads the next byte in line, returns the byte as an object, [0] is inserted to get teh real value
            #detect end of packet
            if incoming_byte == 0x0D: #0x0D is the carriage return character used as a terminator. for example 12 11 0D: 12 = packet data, 11 = packet data, 0D = end of packet. after 0x0D, stops collecting bytes
                if not packet_too_long and byte_index > 0: #only runs if packet is 8 bytes or lower AND byte is not empty
                    hex_data = ' '.join(f'{b:02x}' for b in received_bytes[:byte_index]) # converts into string. 0x12 > 12 and adds spaces between bytes
                    print('Received:', hex_data) #prints hex string. packet is put into hex_data
                    send_to_firebase(hex_data) #sends hex to firebase by calling send to firebase function
                else:
                    print('Ignored empty or oversized packet') #if packet is empty or more than 8 bytes
                    #resetting for next packet
                byte_index = 0 #makes it ready to read the next byte in line again
                packet_too_long = False #lets new packet be allowed
                continue #goes back to start, skips below

            if incoming_byte == 0x0A: #skips 0x0A (line feed, comes after 0x0D)
                continue #skips to next byte

            if incoming_byte == 0x00: #skips 0x00 (padding), can cause issue if a real 0x00 byte is received
                continue #skips to next byte

            if byte_index < MESSAGE_LENGTH: #if the packet has room to store another byte, one will be added
                received_bytes[byte_index] = incoming_byte
                byte_index += 1 #increases to the next avaible byte spot
            else:
                packet_too_long = True #if buffer is full before 0x0D appears, then it flags as too long


##TEMPORARY test packet, remove once real transmitter wired up
time.sleep(1)
uart.write(transmitter())

loop()