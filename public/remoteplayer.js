var createRemoteGhostPlayer = function(data) {
  return {
    conId:data.conId,
  	id:"ghost"+data.id,
  	group:"ghosts",  	
  	tileset:data.tileset,
  	status: 'chasing',
  	time: 0,

  	initialize: function() {
  		toys.topview.initialize(this,{
  			colh:gbox.getTiles(this.tileset).tileh, // That is like capman...
  			colw:gbox.getTiles(this.tileset).tilew,
  			staticspeed:2,
  			nodiagonals:true,
  			noreset:true,
  			frames: {
          still:{ speed:2, frames:[0] },
          hit:{speed:1,frames:[0,1,0,1]},
          standup:{ speed:1, frames:[0] },
          standdown:{ speed:1, frames:[1] },
          standleft:{ speed:1, frames:[2] },
          standright:{ speed:1, frames:[2] },
          movingup:{speed:1,frames:[0] },
          movingdown:{speed:1,frames:[1] },
          movingleft:{speed:1,frames:[2] },
          movingright:{speed:1,frames:[2] }
   		  },
  			// Set start point for the ghost
				x:data.x,
				y:data.y  			
  		});
  	},

  	first: function() { 
  	  // Ensure we are showing the current correct frame out of 10 possible
  		this.counter = (this.counter+1) % 10;
  		 // If capman is still alive and the game is not "hold" (level changing fadein/fadeouts etc.) and the "bullet timer" is not stopping the game.
  		if(!maingame.gameIsHold() && !maingame.bullettimer) {	

    		// The nuber of ticks the ghost i in danger
    		if(this.status == 'running' && this.time > 0) {
    		  this.time--;
    		  if(this.time > 50) {
    		    this.tileset = 'ghostscared'
    		  } else {
    		    this.tileset = Math.floor(this.time/4)%2 == 0 ? "ghostscared" : "playerghost";
    		  }
    		} else if(this.status == 'running') {
    	    this.tileset = 'playerghost'
    	    this.status = 'chasing';		  
    		}

        // Return to the house
        if(this.status == 'eaten') {
					toys.topview.setStaticSpeed(this, 4); // We're in a hurry now!
					
					if((this.x == maze.hw - this.hw) && (this.y == maze.hh - 38))
						this.status = "goin";
					else {
						if((this.facing == toys.FACE_UP) || (this.facing == toys.FACE_DOWN)) {
							if(maze.hw - this.hw >= this.x) {
							  toys.topview.controlKeys(this,{pressright: 1});
						  } else if(maze.hw - this.hw < this.x) {
						    toys.topview.controlKeys(this,{pressleft: 1});
					    }
						} else {
							if(maze.hh - 38 > this.y) {
							  toys.topview.controlKeys(this, {pressdown: 1});
						  } else if(maze.hh - 38 < this.y) {
						    toys.topview.controlKeys(this, {pressup: 1});
					    }
						}
					}
					
					toys.topview.applyForces(this);
				} else if(this.status == 'goin') {
					toys.topview.setStaticSpeed(this, 1);
					toys.topview.controlKeys(this, {pressdown: 1});
					toys.topview.applyForces(this);
					toys.topview.tileCollision(this,maze, "map", null, {tolerance:0, approximation:1});

					if(this.toucheddown) {
						this.tileset = this.id;
						toys.topview.setStaticSpeed(this, 2)
						this.time = 75;
						this.status = "chasing";
					}
        } else {
    		  if(remotePlayerPositionUpdates[this.conId] != null && remotePlayerPositionUpdates[this.conId].nextPos != null) {
    		    // Grab the next position
    		    var nextPos = remotePlayerPositionUpdates[this.conId].nextPos;
    		    // Reset position
    		    remotePlayerPositionUpdates[this.conId] = {pos:nextPos, nextPos:null};

    		    // Ensure we start at the same x, y coordinates
    		    var obj = gbox.getObject('ghosts', this.id);
    		    obj.x = nextPos.x;
    		    obj.y = nextPos.y;
    		    obj.accx = nextPos.accx;
    		    obj.accy = nextPos.accy;
    		    obj.xpushing = nextPos.xpushing;
    		    obj.ypushing = nextPos.ypushing;
    		    obj.facing = nextPos.facing;  		    

            // Apply forces and do tileCollision detection
    				toys.topview.applyForces(this);
    				toys.topview.tileCollision(this, maze, "map", null, {tolerance:0,approximation:1});

  					if(this.touchedup) {
  					  this.status = "chasing";
  					}						
    		  }

    			// The side warp. If capman reach one of the left or right side of the maze, is spawn on the other side,in the same direction
    			if((this.x < 0) && (this.facing == toys.FACE_LEFT)) {
    			  this.x = maze.w - this.w;
    			} else if((this.x > (maze.w - this.w)) && (this.facing == toys.FACE_RIGHT)) {
    			  this.x = 0;
    			}

    			// setFrame sets the right frame checking the facing and the defined animations in "initialize"
    			toys.topview.setFrame(this); 

          // Grab the mongoman object
          var mongoman = isMongoman ? gbox.getObject("player", "mongoman") : gbox.getObject("ghosts", "mongoman");
          // Check if we have a collision
          if(isMongoman && mongoman != null && gbox.collides(this, mongoman, 2)) {         
            // If we are chasing him he is dead
            if(this.status == "chasing") {
              // Stop the game for a time
              maingame.bullettimer = 10;
              // kill mongoman
              mongoman.kill();
            } else if(this.status == "running") {
              if(sound) gbox.hitAudio("eatghost");
              // Fire off I'm dead message
        	    client.dispatchCommand({type:'ghostdead', id:this.conId});
              // gbox.hitAudio("eatghost");
  						maingame.bullettimer = 10;
  						toys.generate.sparks.popupText(mongoman,"sparks",null,{font:"small",jump:5,text:'',keep:20});
  						this.tileset = "ghosteaten";
  						this.status = "eaten";
            }
          }        
    		}          
      }
  	},

  	makeeatable:function() {
  	  this.status = 'running';
  	  this.time = 150;
  	},

  	blit:function() {
      gbox.blitTile(gbox.getBufferContext(),{tileset:this.tileset,tile:this.frame,dx:this.x,dy:this.y,fliph:this.fliph,flipv:this.flipv,camera:this.camera,alpha:1});
  	},

  	// And now, a custom method. This one will kill the player and will be called by ghosts, when colliding with capman.
  	kill:function() {
      if(sound)gbox.hitAudio("die");
  	  // Set status to eaten
  	  this.status = 'eaten';
  	  // Change tileset
			this.tileset = "ghosteaten";  	    	  
  	}
  };
}

var createRemoteMongoManPlayer = function(data) {
  return {
    conId:data.conId,
  	id:"mongoman",
  	group:"ghosts",
  	tileset:"mongoman",
  	killed:false,
  	render:false,

  	initialize: function() {
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
  			},
  			// Set start point for the ghost
				x:data.x,
				y:data.y  			
  		});
  	},

  	first: function() { 
  	  // Ensure we are showing the current correct frame out of 10 possible
  		this.counter = (this.counter+1) % 10;
  		 // If capman is still alive and the game is not "hold" (level changing fadein/fadeouts etc.) and the "bullet timer" is not stopping the game.
  		if(!maingame.gameIsHold() && !maingame.bullettimer) {	  		  
  		  
        if(remotePlayerPositionUpdates[this.conId] != null && remotePlayerPositionUpdates[this.conId].nextPos != null) {         
          // Grab the next position
          var nextPos = remotePlayerPositionUpdates[this.conId].nextPos;
          // Reset position
          remotePlayerPositionUpdates[this.conId] = {pos:nextPos, nextPos:null};
          
          // Ensure we start at the same x, y coordinates
          var obj = gbox.getObject('ghosts', "mongoman");          
          obj.x = nextPos.x;
          obj.y = nextPos.y;
          obj.accx = nextPos.accx;
          obj.accy = nextPos.accy;
          obj.xpushing = nextPos.xpushing;
          obj.ypushing = nextPos.ypushing;
          obj.facing = nextPos.facing;         
        
          // Apply forces and do tileCollision detection
          toys.topview.applyForces(this);
          toys.topview.tileCollision(this, maze, "map", null, {tolerance: 0, approximation: 1});
        }
        
        // The side warp. If capman reach one of the left or right side of the maze, is spawn on the other side,in the same direction
        if((this.x < 0) && (this.facing == toys.FACE_LEFT)) {
          this.x = maze.w - this.w;
        } else if((this.x > (maze.w - this.w)) && (this.facing == toys.FACE_RIGHT)) {
          this.x = 0;
        }
        
        // setFrame sets the right frame checking the facing and the defined animations in "initialize"
        toys.topview.setFrame(this); 
        
        // Grab the current tile in the map object
        var inmouth = help.getTileInMap(this.x + this.hw, this.y + this.hh, maze, 0);
        
        // Handle pills
        if(inmouth>7) {
          if(inmouth == 9) {
            if(sound) gbox.hitAudio("powerpill");
            if(gbox.getObject("ghosts","ghost1")) gbox.getObject("ghosts","ghost1").makeeatable();
            if(gbox.getObject("ghosts","ghost2")) gbox.getObject("ghosts","ghost2").makeeatable();
            if(gbox.getObject("ghosts","ghost3")) gbox.getObject("ghosts","ghost3").makeeatable();
            if(gbox.getObject("ghosts","ghost4")) gbox.getObject("ghosts","ghost4").makeeatable();
            if(gbox.getObject("player", "playerghost")) gbox.getObject("player","playerghost").makeeatable();
          } else {
            if(sound) gbox.hitAudio("eat");
          }
          
          var mouthx = help.xPixelToTileX(maze,this.x + this.hw);
          var mouthy = help.yPixelToTileY(maze,this.y + this.hh);
          help.setTileInMap(gbox.getCanvasContext("mazecanvas"), maze, mouthx, mouthy, null);
          maingame.pillscount--;          
        }
  		}
  	},
  	
  	blit:function() {
      // if(this.render) {
        gbox.blitTile(gbox.getBufferContext(),{tileset:this.tileset,tile:this.frame,dx:this.x,dy:this.y,fliph:this.fliph,flipv:this.flipv,camera:this.camera,alpha:1});
      // }
  	},

  	// And now, a custom method. This one will kill the player and will be called by ghosts, when colliding with capman.
  	kill:function() {
      if(!this.killed) {
        this.killed = true; 
        if(sound) gbox.hitAudio("die"); 
        maingame.playerDied({wait:50}); 
        toys.generate.sparks.simple(this,"sparks",null,{tileset:this.tileset,frames:{speed:4,frames:[6,5,7,8,9,9,9,9]}});     
      }
  	}
  };
}
