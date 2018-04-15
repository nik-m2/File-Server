import socket
from collections import deque
from threading import Thread

from file_server.util.byte_buffer import ByteBuffer
from file_server.file.file_socket import FileSocket 
from file_server.web.account import Account

from time import time

from .hub import FileHub

# This class represents a multithreaded file server
class FileServer(FileHub):

    # directory: the directory to watch
    # port: the port for the connection
    def __init__(self, directory, port=FileSocket.PORT):

        # Initialize parent class
        super(self.__class__, self).__init__(directory, port)

        # Create a socket to listen for connections
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

        # A list of active connections
        self.connections = []

        # Marks server to shutdown when possible
        self.shutdown = False

        # type: ThreadedHTTPServer (file_server/web/)
        # An instance of the server for the web UI
        self.webserver = None

    # Used to completely kill the server
    def kill(self):

        # Call kill in parent class
        super(self.__class__, self).kill()

        # Shut down webserver
        if self.webserver is not None:
            self.webserver.force_stop()

        # Stop file server listening
        self.shutdown = True
        self.sock.close()

        # Shut down file server connections
        for conn in self.connections:
            conn.shutdown = True

    # Start listening for connections
    # serve: Will start listening for connections on this thread if True
    def start(self, serve=True):
        self.sock.bind((socket.gethostname(), self.port))
        self.sock.listen(5)

        # Listen for connections
        if serve:
            self.serve()

    # Listens for connections indefinitely
    def serve(self):
        print("Waiting for connections on " + str(socket.gethostname()))

        # Keep listening for connections until shutdown
        while not self.shutdown:

            # Wait for an incoming connection
            try:
                clientsocket, address = self.sock.accept()
            except OSError:
                continue

            print("Connection recieved: " + clientsocket.getpeername()[0])

            # Get the session key from the client
            session_length = ByteBuffer(clientsocket.recv(4)).read_int()
            session = ByteBuffer(clientsocket.recv(session_length)).read_string()

            # Try to load an account from the session
            try:
                account = Account.sessions[session]
            except KeyError:
                print("Count not load account")
                clientsocket.send(ByteBuffer(b"0")).bytes()
                continue

            # Send session confirmation
            clientsocket.send(ByteBuffer(b"1").bytes())

            # Create a connection object
            connection = ServerConnection(
                account,
                clientsocket.getpeername()[0],
                clientsocket,
                self
            )

            # Add connection to active connections
            self.connections.append(connection)

            # Start connection processing on a new thread
            connection.start()

    # Used to send a packet to all active clients
    # packet: the packet to send
    def send_packet(self, packet):
        for conn in self.connections:
            conn.queue_packet(packet)

# Represents an active connection to the server
class ServerConnection(Thread):

    # account: the Account object representing the authorized account
    # address: the address for the connection 
    # socket: the socket for the connection
    # server: the server this connection is associated with
    def __init__(self, account, address, socket, server):
        super().__init__()
        self.account = account
        self.address = address
        self.server = server

        # Create a FileSocket from the connection socket
        self.sock = FileSocket(self, socket)

        # The queue for packets ready to be sent
        self.packet_queue = deque()

        # Marks connection for shutdown when possible
        self.shutdown = False

        # Connection info for web UI
        self.connect_time = time()
        self.data_recieved = 0
        self.files_recieved = 0
        self.data_sent = 0
        self.files_sent = 0
        self.transferring = None
        self.transfer_progress = 0

    @property
    def directory(self):
        return self.server.directory

    @property
    def file_event_handler(self):
        return self.server.file_event_handler

    # Wait for packets indefinitely
    def run(self):

        # Keep reading packets until shutdown
        while (not self.shutdown):
            try: 

                # Wait for a packet
                with self.sock.read_packet():

                    # Process packets in the buffer queue
                    self.server.prepare_packets(self)
                
                # Read all available packets from client
                while self.sock.read().read_bool(): # Handle the rest of the packets

                    # Read and handle packet
                    with self.sock.read_packet():
                        pass

                # Let client know if we've got packets to send
                self.sock.send(ByteBuffer.from_bool(not len(self.packet_queue) == 0))

                # Send all queued packets
                while not len(self.packet_queue) == 0:

                    # Send the next packet
                    self.sock.send_packet(self.packet_queue.pop())

                    # Let the client know if we've got another one coming
                    self.sock.send(ByteBuffer.from_bool(not len(self.packet_queue) == 0))

            except ConnectionResetError as e:
                print(e)
                break

        # No longer connected to the client
        print("Connection to client \"{}\" has been lost".format(self.address))

        # Remove this connection from the server's active clients list
        connections = self.server.connections
        for i in range(len(connections)):
            if connections[i] is self:
                del connections[i]

    # Queues a packet to be sent on the connection
    # packet: the Packet to queue
    def queue_packet(self, packet):
        self.packet_queue.append(packet)