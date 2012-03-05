var WebSocketServer = require('websocket').server;
// Setup of ports etc
var port = 3000;
var connectionIdCounter = 0;
// Create an express server instance
var express = require('express'),
  mongo = require('mongodb'),
  BSON = mongo.BSONPure.BSON,
  app = express.createServer(),
  Db = mongo.Db,
  Server = mongo.Server,
  ObjectID = mongo.ObjectID,
  async = require('async'),
  format = require('util').format;

// Set up server for mongo
var db = new Db('game', new Server('127.0.0.1', 27017));
var gameCollection = null;
var boardCollection = null;

// Contains the game state variables
var state = {
  // Connection information
  connections : {},
  // Collections
  gameCollection: null,
  boardCollection: null
}

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

app.get('/delete', function(req, res) {
  // Remove all boards from play
  state.boardCollection.update({number_of_players: {$lt:100}}, {$set:{number_of_players:100}}, {multi:true});            
  // Render the index again
  res.render('index', { layout: false });
})

//
// Start up the server, using async to manage the flow of calls
//
async.series([
    function(callback) {
      db.open(callback);
    },
    function(callback) {
      db.dropCollection('game', function() { callback(null, null); });
    },
    function(callback) {
      db.dropCollection('board', function() { callback(null, null); });
    },
    function(callback) {
      db.createCollection('game', {capped:true, size:100000, safe:true}, callback);
    },    
    function(callback) {
      db.createCollection('board', {capped:true, size:100000, safe:true}, callback);
    },    
    function(callback) {
      // Prime the board with a max size doc (need this for capped collection)
      db.collection('board').insert({
          number_of_players: 100,
          players: [222, 444, 555, 666, 777]
        }, {safe:true}, callback);
    }, 
    function(callback) {
      // Prime the current move table
      db.collection('game').insert(
        {id:11111111111, b:new ObjectID(), role:'m', state:'n', pos:{x:1000, y:1000, accx:1000, accy:10000, facing:0000, xpushing:1, ypushing:1}}
      , {safe:true}, callback);
    },  
    function(callback) {
      db.collection('board').remove({}, callback);
    },        
    function(callback) {
      db.ensureIndex('board', {number_of_players:1}, callback);
    },    
    function(callback) {
      db.ensureIndex('game', {'id':1}, callback);
    },    
    function(callback) {
      db.ensureIndex('game', {'b':1}, callback);
    },    
    function(callback) {
      app.listen(port, callback);
    },    
  ], function(err, result) {
    if(err) throw err;
    // Assign the collections
    state.gameCollection = result[3];
    state.boardCollection = result[4];
    // Print message to console about server running
    // console.log("= server listening on :: " + port);
});

// Websocket server
var wsServer = new WebSocketServer({
  httpServer: app,    
  // Firefox 7 alpha has a bug that drops the
  // connection on large fragmented messages
  fragmentOutgoingMessages: false
});

// Kill a board
var killBoard = function(_state, connection) {
  console.log("============================================ KILL BOARD")
  _state.boardCollection.findAndModify({'players':connection.connectionId}, [], {
    $set: {number_of_players: 200}}, {new:true, upsert:false}, function(err, board) {      
      // Message all players that we are dead
      if(board != null) {
        for(var i = 0; i < board.players.length; i++) {
          if(board.players[i] != connection.connectionId && _state.connections[board.players[i]] != null) _state.connections[board.players[i]].sendUTF(JSON.stringify({state:'dead'}));
        }
      }      
    });
}

// Initialize a board
var initializeBoard = function(_state, connection) {
  // Locate any boards with open spaces and add ourselves to it
  // using findAndModify to ensure we are the only one changing the board
  _state.boardCollection.findAndModify({number_of_players: {$lt:5}}, [], {
        $inc: {number_of_players: 1}, $push: {players:connection.connectionId}
      }, {new:true, upsert:false}, function(err, board) {        
    // If we have no board let's create one
    if(board == null) {
      // console.log("========================================= new board")
      // Create a new game board
      var newBoard = {
          _id: new ObjectID(),
          number_of_players: 1,
          players: [connection.connectionId, 0, 0, 0, 0]
        }
      // Save the board to the db, don't care about safe at this point as we don't need it yet
      _state.boardCollection.insert(newBoard);
      // Update the player array
      _state.boardCollection.update({_id:newBoard._id}, {$set:{players:[connection.connectionId]}});
      // Prime the board game with the monogman
      _state.gameCollection.insert({id:connection.connectionId, b:newBoard._id, role:'m', state:'n', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}});
      // Signal the gamer we are mongoman
      connection.sendUTF(JSON.stringify({state:'initialize', isMongoman:true}));
    } else {
      // console.log("========================================= existing board")
      // Prime the board game with the ghost
      _state.gameCollection.insert({id:connection.connectionId, b:board._id, role:'g', state:'n', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}});
      // There is a board, we are a ghost, message the user that we are ready and also send the state of the board
      connection.sendUTF(JSON.stringify({state:'initialize', isMongoman:false}));
      // Find all board positions and send
      _state.gameCollection.find({b:board._id}, {raw:true}).toArray(function(err, docs) {
        if(!err) {
          for(var i = 0; i < docs.length; i++) {
            connection.sendBytes(docs[i]);
          }
        }
      });
    }
  })
}

var cleanUpConnection = function(_state, connection) {
  // console.log("======================================================== connection closed")
  // Check if we have a connection
  if(_state.connections[connection.connectionId]) {
    delete _state.connections[connection.connectionId];
  }
}

wsServer.on('request', function(request) {
  // Accept the connection
  var connection = request.accept('game', request.origin);
  // Add a connection counter id
  connection.connectionId = parseInt(format("%s%s", process.pid, connectionIdCounter++));
  // Save the connection to the current state
  state.connections[connection.connectionId] = connection;
  
  console.log(connection.connectionId + " connected - Protocol Version " + connection.websocketVersion);
  
  // Handle closed connections
  connection.on('close', function() {      
    cleanUpConnection(state, this);    
  });
  
  // Handle incoming messages
  connection.on('message', function(message) {
    // All basic communication messages are handled as JSON objects
    // That includes the request for status of the board.
    var self = this;
    // console.log("-------------------------------------------- message")
    // console.dir(message)
    
    // Handle game status messages
    if(message.type == 'utf8') {
      // Decode the json message and take the appropriate action
      var messageObject = JSON.parse(message.utf8Data);
      // If initializing the game
      if(messageObject['type'] == 'initialize') {    
        initializeBoard(state, self);    
      } else if(messageObject['type'] = 'dead') {
        killBoard(state, self);
      }
    } else if(message.type == 'binary') {
      // Binary message update player position
      state.gameCollection.update({'id': self.connectionId}, message.binaryData);
      // Find the board and cache it
      state.boardCollection.findOne({'players': self.connectionId}, function(err, board) {
        // Let's grab the record
        state.gameCollection.findOne({'b':board._id, 'id': self.connectionId}, {raw:true}, function(err, rawDoc) {
          if(rawDoc) {
            // Send the data to all the connections expect the originating connection
            for(var i = 0; i < board.players.length; i++) {
              if(board.players[i] != self.connectionId) {
                if(state.connections[board.players[i]] != null) state.connections[board.players[i]].sendBytes(rawDoc);
              }
            }              
          }            
        });
      });
    }
  });  
});


