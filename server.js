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
  state.boardCollection.update({number_of_players: {$lt:100}}, {$set:{number_of_players:100}}, {multi:true});            
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
          players: [
              { id:11111111111, role:'m', pos:{x:1000, y:1000, accx:1000, accy:10000, facing:0000, xpushing:1, ypushing:1}},
              { id:22222222222, role:'m', pos:{x:1000, y:1000, accx:1000, accy:10000, facing:0000, xpushing:1, ypushing:1}},
              { id:33333333333, role:'m', pos:{x:1000, y:1000, accx:1000, accy:10000, facing:0000, xpushing:1, ypushing:1}},
              { id:44444444444, role:'m', pos:{x:1000, y:1000, accx:1000, accy:10000, facing:0000, xpushing:1, ypushing:1}},
              { id:55555555555, role:'m', pos:{x:1000, y:1000, accx:1000, accy:10000, facing:0000, xpushing:1, ypushing:1}},
            ],
        }, {safe:true}, callback);
    },    
    function(callback) {
      db.collection('board').remove({}, callback);
    },        
    function(callback) {
      db.ensureIndex('board', {number_of_players:1}, callback);
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
    console.log("= server listening on :: " + port);
});

// Websocket server
var wsServer = new WebSocketServer({
  httpServer: app,    
  // Firefox 7 alpha has a bug that drops the
  // connection on large fragmented messages
  fragmentOutgoingMessages: false
});

// Initialize a board
var initializeBoard = function(_state, connection) {
  // Locate any boards with open spaces and add ourselves to it
  // using findAndModify to ensure we are the only one changing the board
  _state.boardCollection.findAndModify({number_of_players: {$lt:5}, 'players.id': 0}, [], {
        $inc: {number_of_players: 1},
        $set:{'players.$.id':connection.connectionId}
      }, {new:true, upsert:false}, function(err, board) {
    console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
    console.dir(err)
    console.dir(board)
        
    // If we have no board let's create one
    if(board == null) {
      console.log("========================================= new board")
      // Create a new game board
      var newBoard = {
          number_of_players: 1,
          players: [{id:connection.connectionId, role:'m', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}},
                {id:0, role:'g', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}},
                {id:0, role:'g', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}},
                {id:0, role:'g', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}},
                {id:0, role:'g', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}}
            ],
        }
      // Save the board to the db, don't care about safe at this point as we don't need it yet
      _state.boardCollection.insert(newBoard);
      // Signal the gamer we are mongoman
      connection.sendUTF(JSON.stringify({state:'initialize', isMongoman:true}));
    } else {
      console.log("========================================= existing board")
      // There is a board, we are a ghost, message the user that we are ready and also send the state of the board
      connection.sendUTF(JSON.stringify({state:'initialize', isMongoman:false}));
      // Send the raw query (YES)
      _state.boardCollection.findOne({_id:board._id}, {raw:true}, function(err, result) {
        if(!err) {
          console.log("========================================= found board ")
          console.dir(result)
          connection.sendBytes(result);          
        }
      });
    }
  })
}

var cleanUpConnection = function(_state, connection) {
  console.log("======================================================== connection closed")
  // Check if we have a connection
  if(_state.connections[connection.connectionId]) {
    delete _state.connections[connection.connectionId];
  }
  
  // // Remove the board if mongoman went away
  // _state.boardCollection.findOne({'players.id':connection.connectionId}, function(err, result) {
  //   if(result) {
  //     for(var i = 0; i < result.players.length; i++) {
  //       if(result.players[i].role == 'm') {
  //         // For debug clean the server up so we get a fresh start
  //         _state.boardCollection.update({number_of_players: {$lt:100}}, {$set:{number_of_players:100}}, {multi:true});          
  //         break;
  //       }
  //     }
  //   }
  // })  
}

wsServer.on('request', function(request) {
  // Accept the connection
  var connection = request.accept('game', request.origin);
  // Add a connection counter id
  connection.connectionId = parseInt(format("%s%s", process.pid, connectionIdCounter++));
  // Save the connection to the current state
  state.connections[connection.connectionId] = connection;
  
  console.log(connection.remoteAddress + " connected - Protocol Version " + connection.websocketVersion);
  
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
      // console.log("++++++++++++++++++++++++++++++++++++++++++++++ 0")
      // console.log(messageObject)
      
      // If initializing the game
      if(messageObject['type'] == 'initialize') {    
        initializeBoard(state, self);    
      }
    } else if(message.type == 'binary') {
      // console.log("-------------------------------- update player :: " + self.connectionId)

      // Binary message update are used to handle positional moves for faster serialization performance
      state.boardCollection.update({'players.id':self.connectionId}, message.binaryData);
      // Grab the current state of the board to find the connections to send to etc
      state.boardCollection.findOne({'players.id':self.connectionId}, {raw:true}, function(err, rawDoc) {
        // Deserialize the board
        var doc = BSON.deserialize(rawDoc);
        // Signal all available connections
        for(var i = 0; i < doc.players.length; i++) {
          var player = doc.players[i];          
          // If it's not the originating player, send the updated board
          if(player.id != self.connectionId && state.connections[player.id] != null) {
            state.connections[player.id].sendBytes(rawDoc);
          }
        }        
      });
    }
  });  
});


