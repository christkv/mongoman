//
// Draws the player object if he is mongoman
// 
var createPlayerMongoman = function() {
  return {
  	id:"mongoman",
  	group:"player",
  	tileset:"mongoman",
  	killed:false,
  	scorecombo:1,
  	time:-1,	  
		
  	initialize: function() {
      // Sets up the objects, properties on our 2D map
  		toys.topview.initialize(this,{
  			colh:gbox.getTiles(this.tileset).tileh, 
  			colw:gbox.getTiles(this.tileset).tilew,
  			staticspeed:4, 
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
  			toys.topview.tileCollision(this, maze, "map", null, {tolerance: 0, approximation: 1});

    		// The nuber of ticks the ghost i in danger
    		if(this.time > 0) {
    		  this.time--;
    		} else if(this.time == 0) {
          // Fire eat a powerpill message
    	    client.dispatchCommand({type:'powerpill', value:false});
    		  this.time = -1;
    		}
  						
  			// If we have a collision
  			if(this.touchedup || this.toucheddown || this.touchedleft || this.touchedright) {  			  
  				help.copyModel(this, olddata); 
  				toys.topview.applyForces(this); 
  				toys.topview.tileCollision(this, maze, "map", null, {tolerance:0,approximation:1});

          // Build the object and send it to the server serialized
          updateObject = {x:this.x, y:this.y, accx:this.accx, accy:this.accy,
            xpushing:this.xpushing, ypushing:this.ypushing, facing:this.facing};
  			} else {
          if(olddata.x != this.x || olddata.y != this.y 
            || olddata.accx != this.accx || olddata.accy != this.accy
            || olddata.xpushing != this.xpushing || olddata.ypushing != this.ypushing
            || olddata.facing != this.facing) {

            // Build the object and send it to the server serialized
            updateObject = {x:this.x, y:this.y, accx:this.accx, accy:this.accy,
              xpushing:this.xpushing, ypushing:this.ypushing, facing:this.facing};
          } else {
            updateObject = null;
          }          
  			}
			
  			// The side warp. If capman reach one of the left or right side of the maze, is spawn on the other side,in the same direction
  			if ((this.x<0) && (this.facing == toys.FACE_LEFT)) {
  			  this.x = maze.w - this.w;
  			} else if ((this.x > (maze.w - this.w)) && (this.facing == toys.FACE_RIGHT)) {
  			  this.x = 0;
  			}
			
  			// setFrame sets the right frame checking the facing and the defined animations in "initialize"
  			toys.topview.setFrame(this); 
			
        // Grab the current tile in the map object
        var inmouth = help.getTileInMap(this.x + this.hw, this.y + this.hh, maze, 0);
  			
        // Handle pills
        if(inmouth>7) {
          if(inmouth == 9) {
            this.scorecombo = 1;
            if(sound) SoundJS.play("powerpill");
            if(gbox.getObject("ghosts","ghost1")) gbox.getObject("ghosts","ghost1").makeeatable();
            if(gbox.getObject("ghosts","ghost2")) gbox.getObject("ghosts","ghost2").makeeatable();
            if(gbox.getObject("ghosts","ghost3")) gbox.getObject("ghosts","ghost3").makeeatable();
            if(gbox.getObject("ghosts","ghost4")) gbox.getObject("ghosts","ghost4").makeeatable();
            if(gbox.getObject("player", "playerghost")) gbox.getObject("player","playerghost").makeeatable();
            
            // Fire eat a powerpill message
      	    client.dispatchCommand({type:'powerpill', value:true});
      	    // Set count down time
      	    this.time = 150;
          } else {
            if(sound) SoundJS.play("eat");
						maingame.hud.addValue("score","value",10); 
					}

          var mouthx = help.xPixelToTileX(maze,this.x + this.hw);
          var mouthy = help.yPixelToTileY(maze,this.y + this.hh);
          help.setTileInMap(gbox.getCanvasContext("mazecanvas"), maze, mouthx, mouthy, null);
          maingame.pillscount--;
        }
  		}
  	},
	
  	blit:function() {
  		if (!this.killed) {
  		  gbox.blitTile(gbox.getBufferContext(), {tileset:this.tileset, tile:this.frame, dx:this.x, dy:this.y, fliph:this.fliph, flipv:this.flipv, camera:this.camera, alpha:1});
  		}
  	},
	
  	// And now, a custom method. This one will kill the player and will be called by ghosts, when colliding with capman.
  	kill:function() {
  	  if(!this.killed) {
        // // Fire off I'm dead message
        // client.dispatchCommand({type:'dead', score:maingame.hud.getNumberValue("score","value")});
  	    // Animate death
    		this.killed = true; 
    		if(sound) SoundJS.play("die"); 
    		maingame.playerDied({wait:50}); 
    		toys.generate.sparks.simple(this,"sparks",null,{tileset:this.tileset,frames:{speed:4,frames:[6,5,7,8,9,9,9,9]}});	      		
  	  }
  	}
  }
}
