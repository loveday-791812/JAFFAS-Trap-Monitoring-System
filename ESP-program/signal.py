#generates bytes not hex
import os

def transmitter():
    data = os.urandom(8)        
    return data + b'\x0d' 








#previous, that only generated hex
##import os

##def transmitter():
     ##data = os.urandom(8) #byte data, will need to change to receive from receiver
     ##hex_signal = ' '.join(f'{b:02x}' for b in data) #converts to hex, with spaces
     #print(hex_signal)  #prints hex

     ##return hex_signal