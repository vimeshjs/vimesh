let grpc = require("grpc");
var protoLoader = require("@grpc/proto-loader");

const server = new grpc.Server();
const SERVER_ADDRESS = "0.0.0.0:5001";

// Load protobuf
let proto = grpc.loadPackageDefinition(
    protoLoader.loadSync("services/chat.proto", {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    })
);

let users = [];

// Receive message from client joining
function join(call, callback) {
    console.log('join')
    users.push(call);
    notifyChat({ user: "Server", text: "new user joined ..." });

    call.on('data', function (data) {
        console.log('join.data', data)
    });
    call.on('end', function () {
        console.log('join.end')
        callback(null, {});
    });
}

// Receive message from client
function send(call, callback) {
    notifyChat(call.request);
}

// Send message to all connected clients
function notifyChat(message) {
    users.forEach(user => {
        user.write(message);
    });
}

// Define server with the methods and start it
server.addService(proto.example.Chat.service, { join: join, send: send });

server.bind(SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());

server.start();