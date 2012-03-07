// Game state variables
var maingame = null;
var maze = null;
var client = null;
var currentGhosts = {};
var newObjects = [];
var remotePlayerPositionUpdates = {};
var remotePlayersInformationById = {};
var sound = true;

// User states
var isMongoman = false;
// The user moved
var updateObject = null;
// The board changed
var boardUpdateObjects = [];

// Load the  game box
gbox.onLoad(function () {  
  help.akihabaraInit({ 
     title: "Bombaman", 
     splash: {footnotes: ["Music 'Only Heroes Win at Skee Ball' by Greenleo","Contact him: greenleo.bandcamp.com"] }
  }); 

  // Load the logo, do at the start so it will be there first for the title screen
  gbox.addImage("logo","resources/capman/logo.png");
  // Load the sprite sheet
  gbox.addImage("cels","resources/capman/cels.png");
  // Load the font set
  gbox.addImage("font","resources/capman/font.png");

  // Font are mapped over an image, setting the first letter, the letter size, the length of all rows of letters and a horizontal/vertical gap.
  gbox.addFont({id: "small", image: "font", firstletter: " ", tileh: 8, tilew: 8, tilerow: 255, gapx: 0, gapy: 0});

  // Cut up all the sprites
  gbox.addTiles({id:"mongoman",image:"cels",tileh:12,tilew:12,tilerow:10,gapx:0,gapy:0});
  gbox.addTiles({id:"ghost1",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:0,gapy:12});
  gbox.addTiles({id:"ghost2",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36,gapy:12});
  gbox.addTiles({id:"ghost3",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36*2,gapy:12});
  gbox.addTiles({id:"ghost4",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36*3,gapy:12});
  gbox.addTiles({id:"ghostscared",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36*4,gapy:12});
  gbox.addTiles({id:"ghosteaten",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36*5,gapy:12});
  gbox.addTiles({id:"bonus",image:"cels",tileh:12,tilew:12,tilerow:8,gapx:0,gapy:24});
  gbox.addTiles({id:"maze",image:"cels",tileh:4,tilew:4,tilerow:10,gapx:0,gapy:36});
  
  // Player
  gbox.addTiles({id:"playerghost",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:0,gapy:12});

  // Now let's load some audio samples...
  var audioserver = "resources/audio/"; 
  gbox.addAudio("eat", [audioserver+"eat.mp3",audioserver+"eat.ogg"],{channel:"sfx"}); 
  gbox.addAudio("eatghost", [audioserver+"laser.mp3",audioserver+"laser.ogg"],{channel:"sfx"});
  gbox.addAudio("powerpill", [audioserver+"powerup3.mp3",audioserver+"powerup3.ogg"],{channel:"sfx"});
  gbox.addAudio("die", [audioserver+"die.mp3",audioserver+"die.ogg"],{channel:"sfx"});
  gbox.addAudio("bonus", [audioserver+"coin.mp3",audioserver+"coin.ogg"],{channel:"sfx"});
  gbox.addAudio("default-menu-option", [audioserver+"select.mp3",audioserver+"select.ogg"],{channel:"sfx"});
  gbox.addAudio("default-menu-confirm", [audioserver+"start.mp3",audioserver+"start.ogg"],{channel:"sfx"});
  gbox.addAudio("ingame", [audioserver+"capman-ingame.mp3",audioserver+"capman-ingame.ogg"],{channel:"bgmusic",loop:true});

  // The loadAll function loads all the resources and triggers the main game loop
  gbox.loadAll(go);  

  // Start the game
  gbox.go();      
}, false);

// Start game function
var go = function() {
  // gbox.setGroups(["background","player","ghosts","bonus","sparks","gamecycle"]);
  gbox.setGroups(["background", "player", "ghosts", "sparks", "gamecycle"]);
  
  // Set up the main loop object
  maingame = gamecycle.createMaingame("gamecycle","gamecycle");
  maingame.bullettimer = 0;
  
  // Set method called each time we change the level
  maingame.changeLevel = function(level) {            
    // Let's add the player
    if(isMongoman) {
      gbox.addObject(createPlayerMongoman());
    } else {
      gbox.addObject(createPlayerGhost());
    }    

  	// For all ghosts set's the to chasing status
  	var keys = Object.keys(currentGhosts);
  	for(var i = 0; i < keys.length; i++) {
  	  currentGhosts[keys[i]].status = 'chasing';
  	  currentGhosts[keys[i]].tileset = currentGhosts[keys[i]].id;
  	}

  	// Set player ghost to chasing if it exists
  	var playerGhost = gbox.getObject("player", "playerghost");
  	if(playerGhost) {
  	  playerGhost.status = 'chasing';
  	  playerGhost.tileset = playerGhost.id;
  	}

    // Create a maze object based on the tilemap, mapping function
    // and the function that determines if a tile is solid or not
    maze = help.finalizeTilemap({
      tileset: "maze",
      map: help.asciiArtToMap(tilemap, tilemapTranslation),
      tileIsSolid: isTileSolid
    });
    
    // Create a canvas using the calculated size of the maze
		gbox.createCanvas("mazecanvas", {w:maze.w,h:maze.h});
		// Render the tilemap to the canvas
		gbox.blitTilemap(gbox.getCanvasContext("mazecanvas"), maze);

    // Set up the pill count
    this.pillscount = 0;
    for (var y=0;y<maze.map.length;y++) // Let's iterate all the rows...
     for (var x=0;x<maze.map[y].length;x++) // ... and all the colums
       if(maze.map[y][x] > 7) this.pillscount++; // If the row/column contains a "pill" tile (8 for plain pill, 9 for powerpill), let's
    
    debugpillcount = this.pillscount;
    
    this.newLife();
  }
  
  maingame.gameIsOver = function() {
    // Reset game
    this.changeLevel();
    // Return game over
    return true;
  }
  
  maingame.newLife = function() {
  	maingame.bullettimer=0  	  	
  	// Spawn the main character
  	if(isMongoman) {
  	  var object = gbox.getObject("player","mongoman");
  		toys.topview.spawn(object,{x:maze.hw-6,y:maze.hh+50,accx:0,accy:0,xpushing:false,ypushing:false});
  	} else {
  	  var object = gbox.getObject("player","playerghost");
  		toys.topview.spawn(object,{x:maze.hw-8,y:maze.hh-20,accx:0,accy:0,xpushing:false,ypushing:false});
  	}  	
  }
  
  // This method is triggered once pr game
  maingame.initializeGame = function() {        
    // console.log("--------------------------------------------------------- initializeGame");
    // Set up the HUD used to signal all the different values visable to the user
    //     maingame.hud.setWidget("label", {widget:"label", font:"small", value:"1UP", dx:240, dy:10, clear:true});
    // maingame.hud.setWidget("score",{widget:"label",font:"small",value:0,dx:240,dy:25,clear:true});
    // maingame.hud.setWidget("label",{widget:"label",font:"small",value:"HI",dx:240,dy:40,clear:true});
    // maingame.hud.setWidget("hiscore",{widget:"label",font:"small",value:0,dx:240,dy:55,clear:true});
    // maingame.hud.setWidget("lives",{widget:"symbols",minvalue:0,value:3-maingame.difficulty,maxshown:3,tileset:"capman",tiles:[5],dx:240,dy:70,gapx:16,gapy:0});
    // maingame.hud.setWidget("bonus",{widget:"stack",rightalign:true,tileset:"bonus",dx:gbox.getScreenW()-5,dy:gbox.getScreenH()-34,gapx:12,gapy:0,maxshown:8,value:[]});
    // maingame.hud.setWidget("stage",{widget:"label",font:"small",value:"",dx:0,dw:gbox.getScreenW()-5,dy:gbox.getScreenH()-13,halign:gbox.ALIGN_RIGHT,clear:true});   
    // maingame.hud.setValue("hiscore","value",gbox.dataLoad("capman-hiscore"));
    
    //
    // When the web socket connects
    //
    var onMessageCallback = function(message) {
      // JSON message
      if(message['state'] == 'initialize') {
        isMongoman = message['isMongoman'];
        // Let's add the object that will draw the maze
        gbox.addObject(drawMaze);
      } else if(message['state'] == 'dead') {
        // Fetch the active mongoman
        var mongoman = isMongoman ? gbox.getObject("player", "mongoman") : gbox.getObject("ghosts", "mongoman");
        if(mongoman) {
          // Stop the game for a time
          maingame.bullettimer = 10;
          // Kill the character
          mongoman.kill();          
        }   
        
        // Destroy groups
        gbox.clearGroup("ghosts");
        gbox.clearGroup("player");
        gbox.purgeGarbage();        
        // Initialize all state
        currentGhosts = {};
        newObjects = [];
        remotePlayerPositionUpdates = {};
        remotePlayersInformationById = {};
        isMongoman = false;
        updateObject = null;
        boardUpdateObjects = []; 
      } else if(message['state'] == 'ghostdead') {
        if(sound) gbox.hitAudio("eatghost");
        // Check if it's a remote ghost and if it is kill it
        if(currentGhosts[message['id']] != null) {
          currentGhosts[message['id']].kill();
          return;
        }
        
        // Not in the ghosts list, then it's us
        var playerGhost = gbox.getObject("player", "playerghost");
        if(playerGhost) {
          playerGhost.kill();
        }
      } else if(message['state'] == "mongowin") {
    		// Destroy groups
    		gbox.clearGroup("ghosts");
    		gbox.clearGroup("player");
      	gbox.purgeGarbage();    		
        // Initialize all state
        currentGhosts = {};
        newObjects = [];
        remotePlayerPositionUpdates = {};
        remotePlayersInformationById = {};
        isMongoman = false;
        updateObject = null;
        boardUpdateObjects = []; 
        // Change level       
        if(!isMongoman) maingame.gotoLevel(maingame.level+1);
        // Close client
        if(client) client.close();        
        // Create client instance
        client = new GameCommunication(document.URL, 'game', onMessageCallback);    
        // Start the client
        client.connect(function() {
          // Dispatch a message asking to intialize the connection
          client.dispatchCommand({type:'initialize'});    
        });                  
      } else if(message['b'] != null) {
        // Check if we have a ghost for this user and add one if there is none
        if(currentGhosts[message.id] == null) {
          newObjects.push(message);
        }      
        // Add to list of character updates
        boardUpdateObjects.push(message);
      }
    }

    // Initialize all state
    currentGhosts = {};
    newObjects = [];
    remotePlayerPositionUpdates = {};
    remotePlayersInformationById = {};
    isMongoman = false;
    updateObject = null;
    boardUpdateObjects = [];        

    // If client is still connected close it
    if(client) {
      client.close();
    }

    // Create client instance
    client = new GameCommunication(document.URL, 'game', onMessageCallback);    
    // Start the client
    client.connect(function() {
      // Dispatch a message asking to intialize the connection
      client.dispatchCommand({type:'initialize'});    
    });          
  }
  
	maingame.gameMenu = function(reset) {
    return true;
	}
  
  maingame.gameEvents = function() {
    // If no more pills let's start a new level
    if(maingame.pillscount == 0) {
    // if(maingame.pillscount < debugpillcount - 5) {
	 	  // Go to new level
			maingame.gotoLevel(maingame.level + 1);			
	 	  // Fire ended game message
	 	  client.dispatchCommand({type:'mongowin'})
    }
    
    // If we are counting down the time
    if(this.bullettimer > 0) this.bullettimer--;
    // If the user changed course send an update to the server
    if(updateObject != null) {
      // Serialize the update state and send to server
      var data = BSON.serialize({'$set': {'pos': updateObject}}, false, true, false)
      // Send object
      client.dispatchCommand(data.buffer);
    }
    
    // 
    // We have new remote players, add them to the rendering pipeline
    //
    while(newObjects.length > 0) {
      // Remove the ghost
      var object = newObjects.pop();
      // Check if it's a ghost or a pacman
      if(currentGhosts[object.id] == null && object.id > 0 && object.role == 'g' && object.pos.x != 0 && object.pos.y != 0) {
        // Create a new ghost id
        var id = Object.keys(currentGhosts).length + 1;
        // Add remote ghost object
        var remotePlayer = createRemoteGhostPlayer({conId:object.id, id:id, x: object.pos.x, y: object.pos.y, tileset:"ghost"+id});
        remotePlayerPositionUpdates[object.id] = {pos:null, nextPos:object.pos};
        gbox.addObject(remotePlayer);        
        // Update the ghost
        currentGhosts[object.id] = remotePlayer;
      } else if(currentGhosts[object.id] == null && object.id > 0 && object.role == 'm' && object.pos.x != 0 && object.pos.y != 0) {
        // Add remote mongoman
        var remotePlayer = createRemoteMongoManPlayer({conId:object.id, x: object.pos.x, y: object.pos.y});
        remotePlayerPositionUpdates[object.id] = {pos:null, nextPos:object.pos};
        gbox.addObject(remotePlayer);
        // Update the ghost
        currentGhosts[object.id] = remotePlayer;
      }
    }
    
    //
    //  Update any objects with new positions
    //
    if(boardUpdateObjects.length > 0) {
      // Add a reference
      var reference = boardUpdateObjects;
      // Null out update as done 
      boardUpdateObjects = [];

      // Process all the board updates
      for(var i = 0; i < reference.length; i++) {
        var update = reference[i];
        // It's a remote player, update position
        if(remotePlayerPositionUpdates[update.id] != null) {
          // remotePlayerPositionUpdates[update.id].nextPos = update.pos;
          var remotePlayer = remotePlayerPositionUpdates[update.id];
          if(remotePlayer['pos'] == null) {
            remotePlayerPositionUpdates[update.id] = {pos:null, nextPos:update.pos};
          } else {
            remotePlayer.nextPos = update.pos;
          }
        } else {
          remotePlayerPositionUpdates[update.id] = {pos:null, nextPos:update.pos};
        }
      }
    }    
  }

  // Show the intro screen
	maingame.gameTitleIntroAnimation = function(reset) { 
		if(reset) { 
			toys.resetToy(this,"rising"); 
		} else { 
		  // Clear the screen
			gbox.blitFade(gbox.getBufferContext(),{alpha:1});
			// Show the logos
			toys.logos.linear(this,"rising",{image:"logo",x:gbox.getScreenHW()-gbox.getImage("logo").hwidth,y:20,sx:gbox.getScreenHW()-gbox.getImage("logo").hwidth,sy:gbox.getScreenH(),speed:1,audioreach:"eatghost"});
		}
	};  
}

//
// Draws the maze for the game
// 
var drawMaze = {
	id:"bg",
	group:"background",
	
	// This action is executed the first time the object is called, so...
	initialize:function() { 
	   // We place the camera a bit down, since the full maze doesn't fit the screen.
		gbox.setCameraY(2, {w: maze.w, h: maze.h});
	},
	
	blit:function() { 
	  // Clear the entire screen
		gbox.blitFade(gbox.getBufferContext(),{alpha: 1}); 
		gbox.blit(gbox.getBufferContext(), gbox.getCanvas("mazecanvas"),
		  {dx: 0,dy: 0,dw: gbox.getCanvas("mazecanvas").width, dh:gbox.getCanvas("mazecanvas").height, sourcecamera:true});
	}
}

// ----------------------------------------------------------------------------
//
// Map functions
//
// ----------------------------------------------------------------------------
var isTileSolid = function(obj, t) {
	return (t!==null)&&
			((t<6)||  
			((t==6)&&(obj.status!="chasing")&&(obj.status!="goin")));  
}

// The tilemap used for the game
var tilemap = [
  "||T----------------------------------------------------TxxT----------------------------------------------------T||",
  "||||                                                  ||xx||                                                  ||||",
  "||||   .   .   .   .   .   .   .   .   .   .   .   .  ||xx||   .   .   .   .   .   .   .   .   .   .   .   .  ||||",
  "||||                                                  ||xx||                                                  ||||",
  "||||   .  T------------T   .  T----------------T   .  ||xx||   .  T----------------T   .  T------------T   .  ||||",
  "||||      ||xxxxxxxxxx||      ||xxxxxxxxxxxxxx||      ||xx||      ||xxxxxxxxxxxxxx||      ||xxxxxxxxxx||      ||||",
  "||||   o  ||xxxxxxxxxx||   .  ||xxxxxxxxxxxxxx||   .  ||xx||   .  ||xxxxxxxxxxxxxx||   .  ||xxxxxxxxxx||   o  ||||",   
  "||||      ||xxxxxxxxxx||      ||xxxxxxxxxxxxxx||      ||xx||      ||xxxxxxxxxxxxxx||      ||xxxxxxxxxx||      ||||",
  "||||   .  L------------J   .  L----------------J   .  L----J   .  L----------------J   .  L------------J   .  ||||",
  "||||                                                                                                          ||||",
  "||||   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  ||||",
  "||||                                                                                                          ||||",
  "||||   .  T------------T   .  T----T   .  T----------------------------T   .  T----T   .  T------------T   .  ||||",
  "||||      ||xxxxxxxxxx||      ||xx||      ||xxxxxxxxxxxxxxxxxxxxxxxxxx||      ||xx||      ||xxxxxxxxxx||      ||||",
  "||||   .  L------------J   .  ||xx||   .  L------------TxxT------------J   .  ||xx||   .  L------------J   .  ||||",
  "||||                          ||xx||                  ||xx||                  ||xx||                          ||||",
  "||||   .   .   .   .   .   .  ||xx||   .   .   .   .  ||xx||   .   .   .   .  ||xx||   .   .   .   .   .   .  ||||",
  "||||                          ||xx||                  ||xx||                  ||xx||                          ||||",
  "||L--------------------T   .  ||xxL------------T      ||xx||      T------------Jxx||   .  T--------------------J||",
  "L--------------------T||      ||xxxxxxxxxxxxxx||      ||xx||      ||xxxxxxxxxxxxxx||      ||T--------------------J",
  "                    ||||   .  ||xxT------------J      L----J      L------------Txx||   .  ||||                    ",
  "                    ||||      ||xx||                                          ||xx||      ||||                    ",
  "                    ||||   .  ||xx||                                          ||xx||   .  ||||                    ",
  "                    ||||      ||xx||                                          ||xx||      ||||                    ",
  "                    ||||   .  ||xx||      T---------~~~~~~~~~~---------T      ||xx||   .  ||||                    ",
  "---------------------J||      ||xx||      ||                          ||      ||xx||      ||L---------------------",
  "-----------------------J   .  L----J      ||                          ||      L----J   .  L-----------------------",
  "                                          ||                          ||                                          ",
  "                           .              ||                          ||               .                          ",
  "                                          ||                          ||                                          ",
  "-----------------------T   .  T----T      ||                          ||      T----T   .  T-----------------------",
  "---------------------T||      ||xx||      ||                          ||      ||xx||      ||T---------------------",
  "                    ||||   .  ||xx||      L----------------------------J      ||xx||   .  ||||                    ",
  "                    ||||      ||xx||                                          ||xx||      ||||                    ",
  "                    ||||   .  ||xx||                                          ||xx||   .  ||||                    ",
  "                    ||||      ||xx||                                          ||xx||      ||||                    ",
  "                    ||||   .  ||xx||      T----------------------------T      ||xx||   .  ||||                    ",
  "T--------------------J||      ||xx||      ||xxxxxxxxxxxxxxxxxxxxxxxxxx||      ||xx||      ||L--------------------T",
  "||T--------------------J   .  L----J      L------------TxxT------------J      L----J   .  L--------------------T||",
  "||||                                                  ||xx||                                                  ||||",
  "||||   .   .   .   .   .   .   .   .   .   .   .   .  ||xx||   .   .   .   .   .   .   .   .   .   .   .   .  ||||",
  "||||                                                  ||xx||                                                  ||||",
  "||||   .  T------------T   .  T----------------T   .  ||xx||   .  T----------------T   .  T------------T   .  ||||",
  "||||      ||xxxxxxxxxx||      ||xxxxxxxxxxxxxx||      ||xx||      ||xxxxxxxxxxxxxx||      ||xxxxxxxxxx||      ||||",
  "||||   .  L--------Txx||   .  L----------------J   .  L----J   .  L----------------J   .  ||xxT--------J   .  ||||",
  "||||              ||xx||                                                                  ||xx||              ||||",
  "||||   o   .   .  ||xx||   .                                                           .  ||xx||   .   .   o  ||||",
  "||||              ||xx||                                                                  ||xx||              ||||",
  "||L--------T   .  ||xx||   .  T----T   .  T----------------------------T   .  T----T   .  ||xx||   .  T--------J||",
  "||xxxxxxxx||      ||xx||      ||xx||      ||xxxxxxxxxxxxxxxxxxxxxxxxxx||      ||xx||      ||xx||      ||xxxxxxxx||",
  "||T--------J   .  L----J   .  ||xx||   .  L------------TxxT------------J   .  ||xx||   .  L----J   .  L--------T||",
  "||||                          ||xx||                  ||xx||                  ||xx||                          ||||",
  "||||   .   .   .   .   .   .  ||xx||   .   .   .   .  ||xx||   .   .   .   .  ||xx||   .   .   .   .   .   .  ||||",
  "||||                          ||xx||                  ||xx||                  ||xx||                          ||||",
  "||||   .  T--------------------JxxL------------T   .  ||xx||   .  T------------JxxL--------------------T   .  ||||",
  "||||      ||xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx||      ||xx||      ||xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx||      ||||",
  "||||   .  L------------------------------------J   .  ||xx||   .  L------------------------------------J   .  ||||",
  "||||                                                  ||xx||                                                  ||||",
  "||||   .   .   .   .   .   .   .   .   .   .   .   .  ||xx||   .   .   .   .   .   .   .   .   .   .   .   .  ||||",
  "||||                                                  ||xx||                                                  ||||",
  "||L----------------------------------------------------JxxL----------------------------------------------------J||",
]

// The tilemap translation array
var tilemapTranslation = [[null,"  "],[0,"||"],[1,"--"],[2,"L-"],[3,"-J"],[4,"T-"],[5,"-T"],[6,"~~"],[7,"xx"],[8," ."],[9," o"]];

