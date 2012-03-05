// Handles all our communication
var GameCommunication = function(url, channel, callback) {
  this.url = url;
  this.channel = channel;
  this.callback = callback;
}

// Handle the setup of the connection
GameCommunication.prototype.connect = function(callback) {
  var url = "ws://" + this.url.substr(7).split('/')[0];
  // Create a websocket either using the Mozilla web socket or the
  // standard one
  // var wsCtor = window['MozWebSocket'] ? MozWebSocket : WebSocket;  
  var wsCtor = window.WebSocket;  
  this.socket = new wsCtor(url, this.channel);
  this.socket.binaryType = 'arraybuffer';

  // Bind the handlers
  this.socket.onopen = callback;
  this.socket.onerror = callback;
  this.socket.onmessage = this.handleWebsocketMessage.bind(this);
  this.socket.onclose = this.handleWebsocketClose.bind(this);
  
  // Contains all the incoming messages
  // We only access messages during the rendering phase of the game
  this.messages = [];
}

GameCommunication.prototype.close = function() {
  this.socket.close();
}

// Dispatch a command
GameCommunication.prototype.dispatchCommand = function(command) {
  if(command instanceof ArrayBuffer) {    
    this.socket.send(command);
  } else if(typeof command == 'object') {
    this.socket.send(JSON.stringify(command));
  }
}

// Open the connection
GameCommunication.prototype.handleWebsocketOpen = function() {
  // console.log("==================================== socket opened")    
}

// Handle the web socket messages
GameCommunication.prototype.handleWebsocketMessage = function(message) {
  // Let's add the message to the incoming message array
  // console.log("==================================== received message")
  // console.dir(message)
  // console.log(message.data)
  if(message.data instanceof ArrayBuffer) {
    this.callback(BSON.deserialize(new Uint8Array(message.data)));
  } else {
    this.callback(JSON.parse(message.data));
  }
}

// Close the connection
GameCommunication.prototype.handleWebsocketClose = function() {
  // console.log("==================================== socket closed")  
}