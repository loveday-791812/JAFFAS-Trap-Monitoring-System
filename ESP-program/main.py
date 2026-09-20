import network
import time
import socket
import tls
import urequests
from machine import UART

timeout = 0 #timeout variable

##MP version of WiFi.h
#Wifi connection fucntion
nic = network.WLAN(network.WALN.IF_STA) #Creates station interface object
nic.active(False) #deactivtes interface
time.sleep(0.5) #wait 5 mili seconds
nic.active(True) #activtes interface, ^whole process restarts wifi
nic.connect('B_DECO', 'JJEXXRRE') #connect to router
ip = nic.ifconfig()[0]

#If wifi not connecting
if not nic.isconnected():
    print('Connecting to Wifi...')
    while (not wifi.isconnected() and timeout < 5): #Leaves while loop if timeout more than 5 or wifi connects
        print(5 - timeout)
        timeout = timeout + 1
        time.sleep(1)
#If/when wifi connects
if(wifi.isconnected()):
    print(f'Connected to {ip}')
    ##MP version of HTTPClient.h
    req = urequests.get('https://www.example.com') #sends request to inputted URL
    print(req.status.code) #prints status code. 200 = success code
    print(req.text) #prints response in text formatting
else:
    print('Time Out') #if timeout goes to 0

##MP version of WiFiClientSecure.h
addr = socket.getaddrinfro('example.com', 80) [0] [-1] #connects to URL (host, port, af=0, type=0, proto=0, flags=0, /)
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM) #creates normal TCP socket
secure_s = tls.warp_socket(s, server_hostname="example.com") #puts socket in TCP encryption
secure_s.connect(addr) #securely connects to URL
secure_s.send(b'GET / GTTP/1.1\r\nHost: example.com\r\n\r\n')
data = s.recv(1000)
secure_s.close()

##UART settings
uart = UART(1, 9600)
uart.init(9600, rx=20, tx=21, bits=8, parity=None, stop=1)

MESSAGE_LENGTH = 8

data_uart = UART(1) #creates second serial connection?
received_bytes = bytearray(MESSAGE_LENGTH)
byte_index = 0
packet_too_long = False
