const _ = require('lodash')

function notifyChat(message) {
    clients.forEach(client => {
        client.write(message);
    });
}


let clients = []
function join(call, callback) {
    clients.push(call);
    notifyChat({ user: "Server", text: "new user joined ..." });
}
function send(call, callback) {
    notifyChat(call.request);
}

module.exports = {
    join,
    send
}