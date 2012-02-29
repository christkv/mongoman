// Game state variables
var maingame = null;
var maze = null;
var client = null;

// Load the  game box
gbox.onLoad(function () {
  // Prepare the connection
  client = new GameCommunication('game');
  // Start the client
  client.connect(function() {
    var message = BSON.serialize({hello:"world"}, true, true, false);
    console.log("------------------------------------------------------- :: " + message.length)
    console.log(message)
    
    // Dispatch a message
    client.dispatchCommand(message.asArrayBuffer());  
  
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
    gbox.addTiles({id:"capman",image:"cels",tileh:12,tilew:12,tilerow:10,gapx:0,gapy:0});
    gbox.addTiles({id:"ghost1",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:0,gapy:12});
    gbox.addTiles({id:"ghost2",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36,gapy:12});
    gbox.addTiles({id:"ghost3",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36*2,gapy:12});
    gbox.addTiles({id:"ghost4",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36*3,gapy:12});
    gbox.addTiles({id:"ghostscared",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36*4,gapy:12});
    gbox.addTiles({id:"ghosteaten",image:"cels",tileh:12,tilew:12,tilerow:3,gapx:36*5,gapy:12});
    gbox.addTiles({id:"bonus",image:"cels",tileh:12,tilew:12,tilerow:8,gapx:0,gapy:24});
    gbox.addTiles({id:"maze",image:"cels",tileh:4,tilew:4,tilerow:10,gapx:0,gapy:36});

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
  });  
}, false);

// Start game function
var go = function() {
  // console.log("--------------------------------------------------------- go");
  // Set up the groups involved in the game, this is the different parts of the 
  // game that requires attention during the game loop, the order defines the drawing order of the groups
  // background object will be draw first
  // gbox.setGroups(["background","player","ghosts","bonus","sparks","gamecycle"]);
  gbox.setGroups(["background", "player", "gamecycle"]);
  
  // Set up the main loop object
  maingame = gamecycle.createMaingame("gamecycle","gamecycle");
  
  // Set method called each time we change the level
  maingame.changeLevel = function(level) {    
    console.log("--------------------------------------------------------- changeLevel");

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

    //     // Set up the pill count
    // this.pillscount = 0;
    // for (var y=0;y<maze.map.length;y++) // Let's iterate all the rows...
    //  for (var x=0;x<maze.map[y].length;x++) // ... and all the colums
    //    if (maze.map[y][x]>7) this.pillscount++; // If the row/column contains a "pill" tile (8 for plain pill, 9 for powerpill), let's
    
    this.newLife();
  }
  
  maingame.newLife = function() {
  	gbox.purgeGarbage(); // the gbox module have a garbage collector that runs sometime. Let's call this manually, for optimization (and better reinitialization)
		toys.topview.spawn(gbox.getObject("player","capman"),{x:maze.hw-6,y:maze.hh+50,accx:0,accy:0,xpushing:false,ypushing:false}); // Our "capman" object into the "player" group spawns in the middle of the maze every time it spawns.
    // maingame.addGhost({id:1,x:maze.hw-12,y:maze.hh-20}); // Ghost are added here
    // maingame.addGhost({id:2,x:maze.hw-24,y:maze.hh-17});
    // maingame.addGhost({id:3,x:maze.hw+4,y:maze.hh-20});
    // maingame.addGhost({id:4,x:maze.hw+14,y:maze.hh-17});

    // if (this.bonustimer) this.bonustimer=300;
    // gbox.playAudio("ingame");
    
  }
  
  // This method is triggered once pr game
  maingame.initializeGame = function() {    
    // console.log("--------------------------------------------------------- initializeGame");
    // Set up the HUD used to signal all the different values visable to the user
    maingame.hud.setWidget("label", {widget:"label", font:"small", value:"1UP", dx:240, dy:10, clear:true});
		maingame.hud.setWidget("score",{widget:"label",font:"small",value:0,dx:240,dy:25,clear:true});
		maingame.hud.setWidget("label",{widget:"label",font:"small",value:"HI",dx:240,dy:40,clear:true});
		maingame.hud.setWidget("hiscore",{widget:"label",font:"small",value:0,dx:240,dy:55,clear:true});
		maingame.hud.setWidget("lives",{widget:"symbols",minvalue:0,value:3-maingame.difficulty,maxshown:3,tileset:"capman",tiles:[5],dx:240,dy:70,gapx:16,gapy:0});
		maingame.hud.setWidget("bonus",{widget:"stack",rightalign:true,tileset:"bonus",dx:gbox.getScreenW()-5,dy:gbox.getScreenH()-34,gapx:12,gapy:0,maxshown:8,value:[]});
		maingame.hud.setWidget("stage",{widget:"label",font:"small",value:"",dx:0,dw:gbox.getScreenW()-5,dy:gbox.getScreenH()-13,halign:gbox.ALIGN_RIGHT,clear:true});		
		maingame.hud.setValue("hiscore","value",gbox.dataLoad("capman-hiscore"));
		
    // Let's add the object that will draw the maze
    gbox.addObject(drawMaze);
    // Let's add the player
    gbox.addObject(player);
  }
  
	maingame.gameMenu = function(reset) {
    return true;
	}
  
  maingame.gameEvents = function() {
    // console.log("--------------------------------------------------------- gameEvents");    
  }

  // Show the intro screen
	maingame.gameTitleIntroAnimation = function(reset) { 
    // console.log("--------------------------------------------------------- gameTitleIntroAnimation");

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
// Draws the player
// 
var player = {
	id:"capman",
	group:"player",
	tileset:"capman",
	killed:false,
	scorecombo:1,
		
	initialize: function() {
    // Sets up the objects, properties on our 2D map
		toys.topview.initialize(this,{
			colh:gbox.getTiles(this.tileset).tileh, 
			colw:gbox.getTiles(this.tileset).tilew,
			staticspeed:2, 
			nodiagonals:true, 
			noreset:true, 
			frames:{ 
				still:{ speed:2, frames:[0] },
				hit:{speed:1,frames:[0,1,0,1]},
				standup:{ speed:1, frames:[0] },
				standdown:{ speed:1, frames:[0] },
				standleft:{ speed:1, frames:[0] },
				standright:{ speed:1, frames:[0] },
				movingup:{speed:3,frames:[0,2,1,2] },
				movingdown:{speed:3,frames:[0,4,3,4] },
				movingleft:{speed:3,frames:[0,6,5,6] },
				movingright:{speed:3,frames:[0,6,5,6] }
			}
		});
	},
		
	first: function() { 
	  // Ensure we are showing the current correct frame out of 10 possible
		this.counter = (this.counter+1) % 10;
		
		 // If capman is still alive and the game is not "hold" (level changing fadein/fadeouts etc.) and the "bullet timer" is not stopping the game.
		if(!this.killed && !maingame.gameIsHold() && !maingame.bullettimer) {
		
			// First of all, let's move.
			// A little trick: capman cannot change direction, if hits a wall, so we backup capman's status here. Will restored if capman hits the wall.
			var olddata = help.createModel(this,["x","y","accx","accy","xpushing","ypushing","facing"]);
			// Set up the control keys for the player
			toys.topview.controlKeys(this,{left:"left",right:"right",up:"up",down:"down"});
			// Apply forces to the model
			toys.topview.applyForces(this);

			// Handle collisions with the map, accuracy and tolerance controls how precise the collision detection is			
			toys.topview.tileCollision(this, maze, "map", null, {tolerance:0,approximation:1});
			
			// If we have a collision
			if(this.touchedup||this.toucheddown||this.touchedleft||this.touchedright) {
				help.copyModel(this,olddata); 
				toys.topview.applyForces(this); 
				toys.topview.tileCollision(this, maze, "map", null, {tolerance:0,approximation:1});
			}
			
			// The side warp. If capman reach one of the left or right side of the maze, is spawn on the other side,in the same direction
			if ((this.x<0)&&(this.facing==toys.FACE_LEFT)) {
			  this.x = maze.w - this.w;
			} else if ((this.x>(maze.w-this.w)) && (this.facing == toys.FACE_RIGHT)) {
			  this.x = 0;
			}
			
			// setFrame sets the right frame checking the facing and the defined animations in "initialize"
			toys.topview.setFrame(this); 
			
      // // Grab the current tile in the map object
      // var inmouth = help.getTileInMap(this.x+this.hw,this.y+this.hh, maze, 0); // I'll explain this the next line.
      // 
      // // Handle pills
      // if (inmouth>7) { // If capman is eating a pill (8 for normal pill, 9 for power pill)
      //  if (inmouth == 9) { // If is a powerpill
      //    gbox.hitAudio("powerpill"); // Play the powerpill sound. hitAudio plays an audio from start and is useful for sound effects. playAudio does nothing if the audio was already playing, so is useful for music playback.
      //    this.scorecombo=1; // Reset the combo counter.
      //    gbox.getObject("ghosts","ghost1").makeeatable(); // Make the ghosts vulnerable.
      //    gbox.getObject("ghosts","ghost2").makeeatable();
      //    gbox.getObject("ghosts","ghost3").makeeatable();
      //    gbox.getObject("ghosts","ghost4").makeeatable();
      //  } else
      //    gbox.hitAudio("eat"); // If is a classic pill, play the classic "gabogabo" sound!
      //  var mouthx=help.xPixelToTileX(maze,this.x+this.hw); // Let's get the pill coordinate in the maze...
      //  var mouthy=help.yPixelToTileY(maze,this.y+this.hh);
      //  help.setTileInMap(gbox.getCanvasContext("mazecanvas"),maze,mouthx,mouthy,null); // ... and set a null tile over that.
      //  maingame.hud.addValue("score","value",10); // Player earns 10 points. "hud" items also stores their values and can be used to store the real score.
      //  maingame.pillscount--; // Let's decrease the number of pills into the maze.
      // }
		}
	},
	
	blit:function() {
		if (!this.killed) {
		  gbox.blitTile(gbox.getBufferContext(), {tileset:this.tileset, tile:this.frame, dx:this.x, dy:this.y, fliph:this.fliph, flipv:this.flipv, camera:this.camera, alpha:1});
		}
	},
	
	// And now, a custom method. This one will kill the player and will be called by ghosts, when colliding with capman.
	kill:function() {
    // if (!this.killed) { // If we're alive...
    //  this.killed=true; // First of all, capman is killed. As you've seen, that makes capman invisible and on hold.
    //  gbox.hitAudio("die"); // Play the die sound
    //  maingame.hud.addValue("lives","value",-1); // Then decrease the lives count.
    //  maingame.playerDied({wait:50}); // Telling the main game cycle that the player died. The arguments sets a short delay after the last fadeout, for making visible the dead animation
    //  toys.generate.sparks.simple(this,"sparks",null,{tileset:this.tileset,frames:{speed:4,frames:[6,5,7,8,9,9,9,9]}});
    //  // And here comes a common trick: the player is still where was killed and a "spark" (i.e. unuseful animation) starts in the same place.
    //  // This method allows many nice tricks, since avoid destruction/recreation of the player object, allow a respawn the player in the place it was killed very easily (switching
    //  // the killed attribute. The "spark.simple" method spawns a spark in the same position of the object in the first argument.
    // }
	}
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
			((t==6)&&(obj.status!="goout")&&(obj.status!="goin")));  
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

