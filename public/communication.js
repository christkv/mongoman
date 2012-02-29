// Handles all our communication
var GameCommunication = function() {
  // Set up the object handling all the communication
  // with the backend server
  // this.messageHandler = {
  //   initCommands: this.initCommands.bind(this)    
  // };
}

// Handle the setup of the connection
GameCommunication.prototype.connect = function(callback) {
  var url = "ws://" + document.URL.substr(7).split('/')[0];
  // Create a websocket either using the Mozilla web socket or the
  // standard one
  var wsCtor = window['MozWebSocket'] ? MozWebSocket : WebSocket;  
  this.socket = new wsCtor(url, 'game');
  this.socket.binaryType = 'blob';

  // Bind the handlers
  this.socket.onopen = callback;
  this.socket.onerror = callback;
  this.socket.onmessage = this.handleWebsocketMessage.bind(this);
  this.socket.onclose = this.handleWebsocketClose.bind(this);
  
  // Contains all the incoming messages
  // We only access messages during the rendering phase of the game
  this.messages = [];
}

// Dispatch a command
GameCommunication.prototype.dispatchCommand = function(command) {
  console.log("=============== command :: " + (command instanceof ArrayBuffer))
  
  if(command instanceof ArrayBuffer) {
    console.log("---------------------------------------- ArrayBuffer")
    
    this.socket.send(command);
  } else if(typeof command == 'object') {
    console.log("---------------------------------------- Object")

    this.socket.send(JSON.stringify(command));
  }
}

// Open the connection
GameCommunication.prototype.handleWebsocketOpen = function() {
  console.log("==================================== socket opened")    
}

// Handle the web socket messages
GameCommunication.prototype.handleWebsocketMessage = function(message) {
  // Let's add the message to the incoming message array
  // this.messages.push(message);
  console.log("==================================== received message")  
  console.dir(message)
}

// Close the connection
GameCommunication.prototype.handleWebsocketClose = function() {
  console.log("==================================== socket closed")  
}





