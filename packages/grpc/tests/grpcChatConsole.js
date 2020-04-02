const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { createGrpcClient } = require('..')
var readline = require("readline");


setupLogger()

let client = createGrpcClient({
    path: __dirname + '/services/chat/chat.proto',
    url: 'localhost:2000',
    promisify : false
})

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let username;

function startChat() {
    let channel = client.join({ user: username })
    channel.on("data", onData);

    rl.on("line", function (text) {
        client.send({ user: username, text: text }, r =>{
            console.log(r)
        })
    });
}

function onData(message) {
    if (message.user == username) return 
    console.log(`${message.user}: ${message.text}`);
}

rl.question("What's ur name? ", answer => {
    username = answer;
    startChat();
});