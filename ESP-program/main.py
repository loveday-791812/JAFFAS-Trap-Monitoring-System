import time
import ujson
import gc
from machine import UART
from machine import Pin
from signal import transmitter
from trap_dictionary import trap_ids   

##TEST ONLY: simulated packet timer, delete later
TEST_INTERVAL_MS = 45 * 60 * 1000 #sends signal every 45 minutes
last_test_at = time.ticks_ms() #time the last simulated packet was sent, starts as now

APN = "internet" #2 degrees network
last_reply = b'' #holds the most recent reply from the module

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
uart.init(9600, rx=21, tx=22, bits=8, parity=None, stop=1, rxbuf=2048)

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
power_on_module() #calls above function
time.sleep(3) #lets module time to start
module_uart = UART(1, MODULE_BAUD)
module_uart.init(MODULE_BAUD, rx=MODULE_RX_PIN, tx=MODULE_TX_PIN, bits=8, parity=None, stop=1, rxbuf=4096)

#Listens to module until expected text arrives
def read_until(expected='OK', wait_time=10):
    global last_reply
    reply = b'' #collects expected text
    start = time.time() #takes the time when start of wait

    while time.time() - start < wait_time: #listens until time limit is reached
        if module_uart.any(): #checks if module sent anything
            reply = reply + module_uart.read() #adds new bytes onto reply
            if expected.encode() in reply or b'ERROR' in reply: #stops early if got what was wantefd or error happens
                break
        time.sleep(0.1) #waits 
    last_reply = reply #saves reply for later
    print(reply) #shows what came back
    return expected.encode() in reply #if its expected text then it'll be True

##MP version of sendAT function
#will send AT command to module and wait for reply
def send_AT(command, expected = 'OK', wait_time = 10):
    while module_uart.any(): #wipes old bytes
        module_uart.read() #reads and throws them away
    print('AT>', command) #shows what was sent
    
    data = command.encode() + b'\r\n' #the whole command as bytes
    for i in range(0, len(data), 64): #sends 64 bytes at a time, in case the module cannot keep up with one big burst
        module_uart.write(data[i:i + 64]) #sends one piece :p
        time.sleep(0.02) #waits 20 ms so the module can keep up
    return read_until(expected, wait_time) #listens for answer, gives bool response

##MP version of wait for module to register
def wait_for_network(max_seconds=60):
    start = time.time() #notes starting time
    while time.time() - start <  max_seconds: #tries until time runs out
        if send_AT('AT+CGREG?', '0,1', 2) or send_AT('AT+CGREG?', '0,5', 2): #0,1 = registered, 0,5 = registered while roaming
            print('Network Registered') #success
            return True 
        time.sleep(2) #waits
    print("Network registration timed out") #failed
    return False

##MP version of connectMobileData
def connect_mobile_data():
    if not wait_for_network(): #if didnt join
        return False

    send_AT('AT+NETCLOSE', '+NETCLOSE: 0', 10) #shuts old connection down
    send_AT('AT+CGDCONT=1,"IP","' + APN + '"') #sends preferrred APN to module
    if not send_AT('AT+NETOPEN', '+NETOPEN: 0', 75): #opens mobile data, 75 seconds max time to connect
        print('Mobile connection failed') #connection didnt connect
        return False

    send_AT('AT+IPADDR') #asks for IP, shows its online

    send_AT('AT+CSSLCFG="enableSNI",0,1')#enables SNI, may not  be  required
    send_AT('AT+CSSLCFG="sslversion",0,4')#HTTPS version for slot 0, "

    send_AT('AT+CNTP="pool.ntp.org",0') #sets the time server, 0 = UTC
    send_AT('AT+CNTP', '+CNTP: 0', 20) #syncs the module clock, +CNTP: 0 means success on this module

    print('Mobile data connected') #connected
    return True

##Clean up module reply
#module will send the reply in chunks, so this keeps only the real data (not labels)
def clean_http_read(data):
    text = b'' #holds data, not labels
    pos = 0 #position the reply is at
    while True: #keeps going until end label
        pos = data.find(b'+HTTPREAD: ', pos)
        if pos == -1: #no more labels
            break
        line_end = data.find(b'\r\n', pos) #checks for end label line
        size = int(data[pos + 11:line_end].decode()) #number after label is size of chunk
        if size == 0: #reads +HTTPREAD, 0 = the end
            break
        text = text + data[line_end + 2:line_end + 2 + size] #takes that many bytes after lebel
        pos = line_end + 2 + size #moves past this chunk
    return text.decode() #converts bytes to text

##timestamp
def get_timestamp():
    send_AT('AT+CCLK?') #reply looks like +CCLK: "26/09/17,11:00:00+00"
    stamp = last_reply.split(b'+CCLK: "')[1][:17].decode() #takes first 17 characters
    return '20' + stamp [0:2] + '-' + stamp [3:5] + '-' + stamp [6:8] + 'T' + stamp[9:17] #rearranges to 2026-09-17T11:00:00

##MP version of sendOnce function
#sends JSON to web address over HTTPS, gets reply as text
def send_once(url, body):
    body_bytes = body.encode() #turns text to bytes
    response_text = '' #will hold answer
    send_AT('AT+HTTPTERM','OK',3) #closes old sessions first
    ok = send_AT('AT+HTTPINIT') and send_AT('AT+HTTPPARA="SSLCFG",0') and send_AT('AT+HTTPPARA="URL","' + url + '"') and send_AT('AT+HTTPPARA="CONTENT","application/json"') #each step must work
    ok = ok and send_AT('AT+HTTPDATA=' + str(len(body_bytes)) + ',10000', 'DOWNLOAD', 5) #shows how many bytes are coming
    if ok: #sends body if module saiD DOWNLOAD
        module_uart.write(body_bytes) #sends body
        ok = read_until('OK',10) #module says OK once it has received
    if ok: #sends request if module has body
        ok = send_AT('AT+HTTPACTION=1', '+HTTPACTION: 1,200', 60) #1 = POST, waits for 200
    if ok: #reads answer if request passed
        time.sleep(0.5)
        action_reply = last_reply #copies current reply
        if module_uart.any(): #looks for any more bytes still being sent
            action_reply = action_reply + module_uart.read() #adds those new bytes
        length = int(action_reply.split(b'+HTTPACTION: 1,200,')[1].split(b'\r')[0].decode()) #number after 200 = how many bytes are waiting
        send_AT('AT+HTTPREAD=0,' +  str(length), '+HTTPREAD: 0', 10) #asks module to send whole number
        response_text = clean_http_read(last_reply) #removes labels, just text
    send_AT('AT+HTTPTERM') #ends session, comes after reading
    print('HTTP worked, Body sent module' if ok else 'HTTP failed, Body failed') #shows result
    return response_text #gives answer back


##Firebase sign in
def firebase_sign_in():
    global firebase_id_token #calls in from above, else firebase_id_token would be treated as a new variable
    auth_url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FIREBASE_API_KEY
    auth_payload = {"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True} #login credentials as a dicionary
    gc.collect() #garbage collector, removes unused objects. lowers running our of ram chance
    ### auth_response = urequests.post(auth_url, data=ujson.dumps(auth_payload), headers={'Content-Type': 'application/json'}) #sends a post request to url, converts the auth_payload into JSON string, tells firebase its sending JSON
    auth_text = send_once(auth_url, ujson.dumps(auth_payload)) #4G change: sends the login through the module instead of urequests, gets the answer back as text
    auth_result = ujson.loads(auth_text) if auth_text != '' else {} #4G change: reads the text from send_once, empty dictionary if it failed
    ### auth_response.close() #closes network connection to avoid network failures
    return auth_result #sends received dictionary to the caller of the function, should contain "idToken" and "refreshToken", if fialed contains error

##send to Firebase 
#send to firebase function
def send_to_firebase(hex_data): #hex_data is parameter, placeholder for value that gets inserted when function called
    #timestamp
    timestamp = get_timestamp() #asks the module for the time and turns it into dd/mm/yyyy hh:mm:ss
    print(timestamp) #shows the timestamp in the terminal

    #building event
    trap_id = trap_ids.get(hex_data.upper(), "unknown")
    event_data = {"transmitter_ID": hex_data, "timestamp": timestamp, "trap_ID": trap_id} #the two fields the database rules ask for, as a dictionary
    url = FIREBASE_URL + "Events.json" #short address, no token needed because the rules now allow adding events without login

    #sending event
    gc.collect() #garbage collecting, clears any unused object to save memory
    response_text = send_once(url, ujson.dumps(event_data)) #sends the event through the module, ujson.dumps turns the dictionary into a JSON string

    #checking if post request worked
    if response_text != "": #send_once returns text from Firebase when it worked, empty text when it failed
        print("Data added successfully!", response_text) #shows Firebase's reply, which should look like {"name":"-O..."}
    else:
        print("Data failed to merge") #nothing came back, so the send failed

def loop(): #defines loop function
    global byte_index, packet_too_long, last_test_at #calls from above to avoid new variables
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

            if byte_index < MESSAGE_LENGTH: #if the packet has room to store another byte, one will be added
                received_bytes[byte_index] = incoming_byte
                byte_index += 1 #increases to the next avaible byte spot
            else:
                packet_too_long = True #if buffer is full before 0x0D appears, then it flags as too long
        ##TEST ONLY: simulated packet, delete this block later
        if time.ticks_diff(time.ticks_ms(), last_test_at) >= TEST_INTERVAL_MS and byte_index == 0: #true when 30 seconds have passed and no real packet is half received
            last_test_at = time.ticks_ms() #restarts the timer
            test_bytes = transmitter()[:-1] #gets 9 bytes from signal.py and drops the last one, the 0x0D terminator
            hex_data = ' '.join(f'{b:02x}' for b in test_bytes) #turns the 8 bytes into text like "a3 07 f1 5c 22 9e 40 b8"
            print('Simulated:', hex_data) #shows what is being sent
            send_to_firebase(hex_data) #sends it to Firebase like a real packet

#runs at startup
send_AT('AT') #basic check, should end with OK
send_AT('AT+CPIN?', 'READY') #SIM check
send_AT('AT+CSQ') #signal strength
connect_mobile_data() #connects to mobile data before the loop starts

##TEMPORARY test packet, remove once real transmitter wired up
time.sleep(1)
uart.write(transmitter()) #needs a jumper wire between pin 22 and pin 21 to loop back

loop()