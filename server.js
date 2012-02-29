var WebSocketServer = require('websocket').server;
// Setup of ports etc
var port = 3000;
// Create an express server instance
var express = require('express');
var app = express.createServer();
var mongo = require('mongodb');

// BSON decoder
var BSON = mongo.BSONPure.BSON;

// console.dir(BSON)

// Set up the configuration for the express server
app.configure(function() {
  app.use(express.static(__dirname + "/public"));
  app.set('views', __dirname);
  app.set('view engine', 'ejs');
});

// Provide the bootstrap file
app.get('/', function(req, res) {
  res.render('index', { layout: false });
});

// Start on port 8000
app.listen(port, function(err) {
  console.log("= server listening on :: " + port);
});

// Keeps all the live connections
var connections = [];

// Websocket server
var wsServer = new WebSocketServer({
    httpServer: app,    
    // Firefox 7 alpha has a bug that drops the
    // connection on large fragmented messages
    fragmentOutgoingMessages: false
});

wsServer.on('request', function(request) {
  // Accept the connection
  var connection = request.accept('game', request.origin);
  // Save the connection
  connections.push(connection);
  
  console.log(connection.remoteAddress + " connected - Protocol Version " + connection.websocketVersion);
  
  // Handle closed connections
  connection.on('close', function() {
    console.log(connection.remoteAddress + " disconnected");      
    var index = connections.indexOf(connection);
    // remove the connection from the pool
    if(index !== -1) {
      connections.splice(index, 1);
    }
  });
  
  // Handle incoming messages
  connection.on('message', function(message) {
    console.log("-------------------------------------------------- received message")
    console.dir(message)
    
    var buffer = new Buffer(message.binaryData);
    var object = BSON.deserialize(buffer);
    
    console.log("-------------------------------------------------- object")
    console.dir(object)    
    
    // rebroadcast command to all clients
    connections.forEach(function(destination) {
        destination.sendUTF(message.binaryData);
    });    
  });  
});


