// Create an express server instance
var express = require('express'),
  mongo = require('mongodb'),
  crypto = require('crypto'),
  BSON = mongo.BSONPure.BSON,
  Db = mongo.Db,
  Server = mongo.Server,
  ObjectID = mongo.ObjectID,
  async = require('async'),
  format = require('util').format,
  cluster = require('cluster'),
  WebSocketServer = require('websocket').server,
  connectUtils = require('connect').utils;
  
// Setup for the connection id
var connectionIdCounter = 0;
// Setup of ports etc
var port = process.env['APP_PORT'] ? process.env['APP_PORT'] : 3000;
// Environment parameters for db
var dbHost = process.env['DB_HOST'] ? process.env['DB_HOST'] : 'localhost';
var dbPort = process.env['DB_PORT'] ? process.env['DB_PORT'] : 27017;
var dbUser = process.env['DB_USER'] ? process.env['DB_USER'] : 'admin';
var dbPassword = process.env['DB_PASSWORD'] ? process.env['DB_PASSWORD'] : 'admin';

if(cluster.isMaster) {
  console.log("--------------------------------------------------- start application with")
  console.log("app port = " + port)
  console.log("db host = " + dbHost)
  console.log("db port = " + dbPort)
  console.log("db user = " + dbUser)  
}
// Set up server for mongo
var db = new Db('game', new Server(dbHost, dbPort));
var numCPUs = require('os').cpus().length;
var numCPUs = 2;
var gameCollection = null;
var boardCollection = null;

// Contains the game state variables
var state = {
  // Connection information
  connections : {},
  // Collections
  gameCollection: null,
  boardCollection: null,

  // Connections by board id
  connectionsByBoardId: {},
  boardIdByConnections: {},
  // Game states
  gameStatesByBoardId: {}
}

// Create a server instance
var app = express.createServer();
// Set up the configuration for the express server
app.configure(function() {
  app.use(express.static(__dirname + "/public"));
  app.set('views', __dirname);
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: "mongoman rules" }));  
});

// Provide the bootstrap file
app.post('/game', function(req, res) {
  // Unpack params
  var name = req.param('name');
  // Hash password
  var sha1password = crypto.createHash('sha1').update(req.param('password')).digest('hex');

  //
  // Need to do manual session handling as websocket does not correctly work with
  // Express cookie pipeline
  //
  // Parse the cookie
  var cookie = connectUtils.parseCookie(req.headers['cookie']);
  // Grab the session id
  var sessionId = cookie['connect.sid'];
  // Fetch the player collection
  var players = db.collection('players');
  // Check if the player name is taken
  players.findOne({name:name, password:sha1password}, function(err, doc) {
    if(!doc) {      
      // Insert the player in the players collection, including stats about the gameplay
      players.insert({name:name, 
        password:sha1password, 
        score:0,
        numberofgames:0,
        stats: {
          mongoman: {
            deaths: 0,
            wins:0
          },       
             
          ghost: {
            deaths: 0,
            wins:0,
            eaten:0
          }
        }
      });
    }    
    
    // Update session relationship between id and player
    state.sessionsCollection.update({id:sessionId}, {$set:{name:name, id:sessionId, b:new ObjectID()}}, {upsert:true});
    // Redirect to the game
    res.redirect('/start')
  })
});

app.get('/start', function(req, res) {
  // Render the game
  res.render('index', { layout: false });  
});

app.get('/delete', function(req, res) {
  // Remove all boards from play
  state.boardCollection.update({number_of_players: {$lt:100}}, {$set:{number_of_players:100}}, {multi:true});            
  // Render the index again
  res.render('index', { layout: false });
})

app.get('/highscore', function(req, res) {
  // Fetch the users sorted by score
  state.playersCollection.find({}).sort({score:-1}).limit(20).toArray(function(err, players) {
    players = players == null ? [] : players;
    // Render highscore table
    res.render('highscore', { layout: false, players:players});
  });
});

//
//  Handles user name setup
//
app.get('/', function(req, res) {
  // Render the first screen
  res.render('signin', { layout: false })
})

//
// Start up the server, using async to manage the flow of calls
//
if(cluster.isMaster) {
  // Do the basic setup for the main process
  // Setting up the db and tables
  async.series([
      function(callback) { db.open(function(err, db) {
        if(err) {
          console.dir(err);
          throw err;
        }
        
        // if localhost add user
        if(dbHost.toLowerCase() == 'localhost' || dbHost.toLowerCase() == '127.0.0.1') {
          db.admin().addUser(dbUser, dbPassword, function(err, result) {
            db.admin().authenticate(dbUser, dbPassword, callback);
          })
        } else {
          db.admin().authenticate(dbUser, dbPassword, callback);          
        }
      }); },
      function(callback) { db.dropCollection('game', function() { callback(null, null); }); },
      function(callback) { db.dropCollection('board', function() { callback(null, null); }); },
      function(callback) { db.dropCollection('sessions', function() { callback(null, null); }); },
      function(callback) { db.createCollection('game', {capped:true, size:100000, safe:true}, callback); },    
      function(callback) { db.createCollection('board', {capped:true, size:100000, safe:true}, callback); },    
      function(callback) { db.createCollection('sessions', {capped:true, size:100000, safe:true}, callback); },    
      function(callback) { db.ensureIndex('board', {number_of_players:1}, callback); },    
      function(callback) { db.ensureIndex('game', {'id':1}, callback); },    
      function(callback) { db.ensureIndex('game', {'b':1}, callback); },          
    ], function(err, result) {
      if(err) throw err;
      // Assign the collections
      state.gameCollection = result[3];
      state.boardCollection = result[4];
      state.sessionsCollection = result[5];
  });

  // Fork workers (one pr. cpu), the web workers handle the websockets
  for (var i = 0; i < numCPUs; i++) {
    var worker = cluster.fork();
    worker.on('message', function(msg) {
      if(msg != null && msg['cmd'] == 'online') {
        console.log("============================================= worker online");
        console.dir(msg);
      }
    });    
  }  
  
  // If the worker thread dies just print it to the console and for a new one
  cluster.on('death', function(worker) {
    console.log('worker ' + worker.pid + ' died');
    cluster.fork();
  });
} else {
  // For each slave process let's start up a websocket server instance
  db.open(function(err, db) {
    db.admin().authenticate(dbUser, dbPassword, function(err, result) {
      if(err) {
        console.dir(err);
        throw err;
      }
      if(!result) throw new Error("failed to authenticate with user = " + user);
      
      app.listen(port, function(err) {
        if(err) throw err;

        // Assign the collections
        state.gameCollection = db.collection('game');
        state.boardCollection = db.collection('board');
        state.sessionsCollection = db.collection('sessions');
        state.playersCollection = db.collection('players');

        // Websocket server
        var wsServer = new WebSocketServer({
          httpServer: app,    
          // Firefox 7 alpha has a bug that drops the
          // connection on large fragmented messages
          fragmentOutgoingMessages: false
        });  

        // A new connection from a player
        wsServer.on('request', function(request) {
          // Accept the connection
          var connection = request.accept('game', request.origin);
          // Add a connection counter id
          connection.connectionId = parseInt(format("%s%s", process.pid, connectionIdCounter++));
          // Save the connection to the current state
          state.connections[connection.connectionId] = connection;

          // Handle closed connections
          connection.on('close', function() {      
            cleanUpConnection(state, this);    
          });

          // Handle incoming messages
          connection.on('message', function(message) {
            // All basic communication messages are handled as JSON objects
            // That includes the request for status of the board.
            var self = this;
            // Handle game status messages
            if(message.type == 'utf8') {      
              // Decode the json message and take the appropriate action
              var messageObject = JSON.parse(message.utf8Data);
              // Parse the cookie
              var cookie = connectUtils.parseCookie(request.httpRequest.headers['cookie']);
              // Grab the session id
              var sessionId = cookie['connect.sid'];
              // If initializing the game
              if(messageObject['type'] == 'initialize') {    
                // Grab the username based on the session id and initialize the board
                state.sessionsCollection.findOne({id:sessionId}, function(err, session) {
                  if(err) throw err;
                  session = typeof session == 'undefined' || session == null ? {} : session;
                  initializeBoard(state, session, self);                      
                })
              } else if(messageObject['type'] == 'dead') {
                updateMongomanDeathStats(state, self, messageObject, sessionId);
                // Kill the board so we can start again
                killBoard(state, self);
              } else if(messageObject['type'] == 'mongowin') {
                // Update mongoman win stats
                updateMongomanWinStats(state, self, messageObject, sessionId);
                // Signal mongoman won
                mongomanWon(state, self);
                // Kill the board so we can start again
                killBoard(state, self);
              } else if(messageObject['type'] == 'ghostdead') {
                // Update player stats
                updateGhostDeadStats(state, self, sessionId);
                // Signal ghost is dead
                ghostDead(state, self, messageObject);
              } else if(messageObject['type'] == 'powerpill') {
                var value = messageObject['value'];
                // Retrieve the board by id from cache
                var boardId = state.boardIdByConnections[self.connectionId];                
                // Retrieve the game stats for the board
                var gameState = state.gameStatesByBoardId[boardId];
                if(gameState == null) {
                  state.gameStatesByBoardId[boardId] = {};
                  gameState = state.gameStatesByBoardId[boardId];
                }                 

                // If we have game stats update them
                if(gameState) {
                  gameState[self.connectionId]['powerpill'] = value;
                }

                var keys = Object.keys(gameState);
                // validate if we have a collision
                for(var i = 0; i < keys.length; i++) {
                  var key = keys[i];
                  
                  // Set all ghosts to alive
                  if(value == false && !gameState[key].mongoman) {
                    gameState[key]['dead'] = false;
                  }
                  
                  // If it's not the originator set the powerpill in play
                  if(key != self.connectionId) {
                    state.connections[key].sendUTF(JSON.stringify({state:'powerpill', value:value}));
                  }
                }                  
              } else if(messageObject['type'] == 'movement') {
                // Unpack object
                var position = messageObject['object'];
                var mongoman = messageObject['mongoman'];

                // Retrieve the board by id from cache
                var boardId = state.boardIdByConnections[self.connectionId];                
                // Get the connectionid list
                var connectionIds = state.connectionsByBoardId[boardId];
                // Retrieve the game stats for the board
                var gameState = state.gameStatesByBoardId[boardId];
                if(gameState == null) {
                  state.gameStatesByBoardId[boardId] = {};
                  gameState = state.gameStatesByBoardId[boardId];
                } 
                
                // Fire the move command to all boards to animate the ghosts
                for(var i = 0; i < connectionIds.length; i++) {
                  // Fire off message to all the other players
                  if(self.connectionId != connectionIds[i]) {
                    var role = mongoman ? "m" : "g";
                    // Mongoman or ghost
                    state.connections[connectionIds[i]].sendUTF(JSON.stringify({
                        id: self.connectionId, b: boardId,
                        role: role, state: 'n',
                        pos: {
                          x: position.x, y: position.y,
                          accx: position.accx, accy: position.accy,
                          facing: position.facing,
                          xpushing: position.xpushing, ypushing: position.ypushing
                        }
                      }));
                  }
                }
                       
                // If we have game stats update them
                if(gameState) {
                  if(gameState[self.connectionId] == null) {
                    gameState[self.connectionId] = {mongoman: mongoman, pos: position, dead: false, powerpill:false};
                  } else{
                    gameState[self.connectionId] = {mongoman: mongoman, pos: position, dead: gameState[self.connectionId]["dead"], powerpill:gameState[self.connectionId]["powerpill"]};
                  }
                }
                
                // Don't respond if the game is over
                if(gameState[self.connectionId].dead) return;
                // Fetch the power pill state for this connection
                var powerpill = gameState[self.connectionId].powerpill;
                // Iterate over all the users
                var keys = Object.keys(gameState);
                // validate if we have a collision
                for(var i = 0; i < keys.length; i++) {
                  var key = keys[i];
                  
                  if(key != self.connectionId) {
                    // Get the position
                    var _player = gameState[key];
                    var _powerpill = _player.powerpill;
                    var _mongoman = _player.mongoman;
                    var _position = _player.pos;
                    // If we have collision and either the current player or the other player is a ghost
                    if(_position.x < (position.x + 5) && _position.x > (position.x - 5) &&
                      _position.y < (position.y + 5) && _position.y > (position.y - 5) &&
                      (mongoman == true || _mongoman == true)) {                        
                      // Check if we have a powerpill situation and kill ghost if we do
                      if(_powerpill == true || powerpill == true) {
                        // Object to set dead
                        var _setDeadObject = !_mongoman ? _player : gameState[self.connectionId];
                        
                        // Return if this user is dead
                        if(_setDeadObject['dead']) return;
                        // Set player dead
                        _setDeadObject['dead'] = true;

                        // What id to send
                        var _connectionId = !_mongoman ? key : self.connectionId;

                        // Message all players that we are dead
                        for(var j = 0; j < connectionIds.length; j++) {
                          state.connections[connectionIds[j]].sendUTF(JSON.stringify({state:'ghostdead', id:_connectionId}));
                        }
                        
                        // return;
                      } else {                          
                        // Set all items to dead
                        for(var j = 0; j < keys.length; j++) {
                          gameState[keys[j]].dead = true;
                        }   

                        // Set current connection dead
                        gameState[self.connectionId].dead = true;
                        // Kill the board
                        killBoard(state, self);
                        // Short cut the method
                        return;                       
                      }
                    }                      
                  }
                }                  
              }
            }
          });  
        });      
      });          
    });    
  })  
}

/**
 * Updates statistics for when mongoman dies
 **/
var updateMongomanDeathStats = function(_state, connection, messageObject, sessionId) {
  // Grab the board
  _state.boardCollection.findOne({'players':connection.connectionId}, function(err, board) {
    if(board) {
      // Let's update the score for the mongoman player
      _state.sessionsCollection.findOne({id:sessionId}, function(err, session) {
        if(session) {
          _state.playersCollection.update({name:session.name},
            {$inc: {'score': messageObject.score, 'stats.mongoman.deaths':1, 'numberofgames': 1}});
        }
      });

      // Fetch all the sessions playing minus the mongoman one, and update ghost
      // wins by 1
      _state.sessionsCollection.find({b:board._id, id: {$ne: sessionId}}).toArray(function(err, items) {
        if(items) {
          for(var i = 0; i < items.length; i++) {
            _state.playersCollection.update({name:items[i].name}, {$inc: {'stats.ghost.wins':1, 'numberofgames': 1}});
          }
        }
      })
    }
  });  
}

/**
 * Updates statistics for when a ghost is eaten
 **/
var updateGhostDeadStats = function(_state, connection, sessionId) {
  // Grab the board
  _state.boardCollection.findOne({'players':connection.connectionId}, function(err, board) {
    if(board) {
      // Fetch all the sessions playing minus the mongoman one, and update ghost
      // wins by 1
      _state.sessionsCollection.find({b:board._id, id: {$ne: sessionId}}).toArray(function(err, items) {
        if(items) {
          for(var i = 0; i < items.length; i++) {
            _state.playersCollection.update({name:items[i].name}, {$inc: {'stats.ghost.eaten':1}});
          }
        }
      })
    }
  });  
}

/**
 * Updates statistics for when mongoman wins
 **/
var updateMongomanWinStats = function(_state, connection, messageObject, sessionId) {
  // Grab the board
  _state.boardCollection.findOne({'players':connection.connectionId}, function(err, board) {
    if(board) {
      // Let's update the score for the mongoman player
      _state.sessionsCollection.findOne({id:sessionId}, function(err, session) {
        if(session) {
          _state.playersCollection.update({name:session.name},
            {$inc: {'score': messageObject.score, 'stats.mongoman.wins':1, 'numberofgames': 1}});                        
        }
      });

      // Fetch all the sessions playing minus the mongoman one, and update ghost
      // wins by 1
      _state.sessionsCollection.find({b:board._id, id: {$ne: sessionId}}).toArray(function(err, items) {
        if(items) {
          for(var i = 0; i < items.length; i++) {
            _state.playersCollection.update({name:items[i].name}, {$inc: {'stats.ghost.deaths':1, 'numberofgames': 1}});
          }
        }
      })
    }
  });  
}

/**
 * A game was finished, let's remove the board from play by setting the number of users over 100
 * as remove does not carry any meaning in capped collections
 **/
var killBoard = function(_state, connection, removeConnection) {  
  _state.boardCollection.findAndModify({'players':connection.connectionId}, [], {
    $set: {number_of_players: 100}}, {new:true, upsert:false}, function(err, board) {      
      // Invalidate all the game records by setting them to dead
      _state.gameCollection.update({b:board._id}, {$set: {state:'d'}});      
      // Get the board id
      var boardId = _state.boardIdByConnections[connection.connectionId];
      // Get the connectionid list
      var connectionIds = _state.connectionsByBoardId[boardId];
      // Delete board to connection mapping
      delete _state.connectionsByBoardId[boardId];
      // Delete all mappings connections - board
      for(var j = 0; j < connectionIds.length; j++) {
        delete _state.boardIdByConnections[connectionIds[j]];
      }
      
      // Message all players that we are dead
      if(board != null) {
        for(var i = 0; i < board.players.length; i++) {
          // Send we are dead as well as intialize
          _state.connections[board.players[i]].sendUTF(JSON.stringify({state:'dead'}));
        }
      }  
      
      // Check if we have a connection
      if(removeConnection && _state.connections[connection.connectionId]) {
        delete _state.connections[connection.connectionId];
      }                
  });
}

/**
 * This function creates a new board if there are not available, if there is a board available
 * for this process with less than 5 players add ourselves to it
 **/
var initializeBoard = function(_state, session, connection) {
  console.log("================================================= board")
  console.dir(session)
  
  // Locate any boards with open spaces and add ourselves to it
  // using findAndModify to ensure we are the only one changing the board
  _state.boardCollection.findAndModify({number_of_players: {$lt:5}, pid: process.pid}, [], {
        $inc: {number_of_players: 1}, $push: {players:connection.connectionId}
      }, {new:true, upsert:false}, function(err, board) {        
    // If we have no board let's create one
    if(board == null) {
      // Create a new game board
      var newBoard = {
          _id: new ObjectID(),
          pid: process.pid,
          number_of_players: 1,
          players: [connection.connectionId, 0, 0, 0, 0]
        }
      // Update session with board id
      _state.sessionsCollection.update({id:session.id}, {$set:{b:newBoard._id}});
      // Ensure we cache the relationships between boards and connections
      if(_state.connectionsByBoardId[newBoard._id.id] == null) _state.connectionsByBoardId[newBoard._id.id] = [];
      _state.connectionsByBoardId[newBoard._id.id].push(connection.connectionId);
      _state.boardIdByConnections[connection.connectionId] = newBoard._id.id;
      // Save the board to the db, don't care about safe at this point as we don't need it yet
      _state.boardCollection.insert(newBoard);
      // Update the player array
      _state.boardCollection.update({_id:newBoard._id}, {$set:{players:[connection.connectionId]}});
      // Prime the board game with the monogman
      _state.gameCollection.insert({id:connection.connectionId, b:newBoard._id, role:'m', state:'n', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}});
      // Signal the gamer we are mongoman
      connection.sendUTF(JSON.stringify({state:'initialize', isMongoman:true, name:session['name']}));
    } else {
      // Update session with board id
      _state.sessionsCollection.update({id:session.id}, {$set:{b:board._id}});
      // Ensure we cache the relationships between boards and connections
      if(_state.connectionsByBoardId[board._id.id] == null) _state.connectionsByBoardId[board._id.id] = [];
      _state.connectionsByBoardId[board._id.id].push(connection.connectionId);
      _state.boardIdByConnections[connection.connectionId] = board._id.id;
      // Prime the board game with the ghost
      _state.gameCollection.insert({id:connection.connectionId, b:board._id, role:'g', state:'n', pos:{x:0, y:0, accx:0, accy:0, facing:0, xpushing:0, ypushing:0}});
      // There is a board, we are a ghost, message the user that we are ready and also send the state of the board
      connection.sendUTF(JSON.stringify({state:'initialize', isMongoman:false, name:session['name']}));
      // Find all board positions and send
      _state.gameCollection.find({b:board._id}).toArray(function(err, docs) {
        if(!err) {
          for(var i = 0; i < docs.length; i++) {
            connection.sendUTF(JSON.stringify(docs[i]));
          }
        }
      });
    }
  })
}

/**
 * Remove the connection from our connection cache
 **/
var cleanUpConnection = function(_state, connection) {
  _state.gameCollection.findOne({id:connection.connectionId, role:'m', state:'n'}, function(err, result) {
    // Mongoman quit, signal game over to every ghost and clean up
    if(result) {
      // Kill the board
      killBoard(_state, connection, true);      
    }    
  });  
}

/**
 * A ghost got eaten by mongoman, send the message to all other players
 **/
var ghostDead = function(_state, connection, message) {
  // Find the board the ghost died on
  state.boardCollection.findOne({'players': connection.connectionId}, function(err, board) {
    if(board) {
      // Send the ghost is dead to all other players on the board
      for(var i = 0; i < board.players.length; i++) {
        if(board.players[i] != connection.connectionId) {
          if(_state.connections[board.players[i]] != null) _state.connections[board.players[i]].sendUTF(JSON.stringify({state:'ghostdead', id:message.id}));
        }
      }                    
    }    
  });  
}

/**
 * Mongoman won by eating all the pills, send game over signal to all the other players
 **/
var mongomanWon = function(_state, connection) {
  // Set the board as dead
  _state.boardCollection.findAndModify({'players':connection.connectionId}, [], {
    $set: {number_of_players: 100}}, {new:true, upsert:false}, function(err, board) {
    // Send the ghost is dead to all other players on the board
    for(var i = 0; i < board.players.length; i++) {
      _state.connections[board.players[i]].sendUTF(JSON.stringify({state:'mongowin'}));
    }       
  });      
}



