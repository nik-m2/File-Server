from file_server.packet.packet import Packet
from file_server.io import ByteBuffer
from file_server.util import delete_file

class FileDeletePacket(Packet):
    name = "FileDeletePacket"
    id = 3
    def __init__(self, hub=None, easy_sock=None, length=0, **kwargs):
        super(self.__class__, self).__init__(hub, easy_sock, length)
        
        if "file_name" in kwargs:
            self.file_name = kwargs["file_name"]

    def size(self):
        return len(self.file_name) + 5;

    def handle_outgoing(self, hub, easy_sock):
        easy_sock.sock.send(ByteBuffer.from_string(self.file_name).bytes())

    def handle_incoming(self):

        buff = ByteBuffer(self.easy_sock.sock.recv(self.length)) if self.length > 0 else None
        file_name = buff.read_string()

        self.hub.file_event_handler.add_ignore(("delete", file_name))

        delete_file(self.hub.directory + file_name)

    def handle_response(self, payload):
        pass

