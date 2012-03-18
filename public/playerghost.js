//
// Draws the player object if he is a ghost
// 
var createPlayerGhost = function() {
  return {
  	id:"playerghost",
  	group:"player",
  	tileset:"playerghost",
  	status: 'chasing',
  	killed:false,
  	scorecombo:1,
  	time: 0,
		
  	initialize: function() {
  		toys.topview.initialize(this,{
  			colh:gbox.getTiles(this.tileset).tileh, // That is like capman...
  			colw:gbox.getTiles(this.tileset).tilew,
  			staticspeed:4,
  			nodiagonals:true,
  			noreset:true,
  			frames:{
  				still:{ speed:2, frames:[0] },
  				hit:{speed:1,frames:[0,1,0,1]},
  				standup:{ speed:1, frames:[0] },
  				standdown:{ speed:1, frames:[1] },
  				standleft:{ speed:1, frames:[2] },
  				standright:{ speed:1, frames:[2] },
  				movingup:{speed:3,frames:[0] },
  				movingdown:{speed:3,frames:[1] },
  				movingleft:{speed:3,frames:[2] },
  				movingright:{speed:3,frames:[2] }
  			}
  		});
  	},
		
  	first: function() { 
  	  // Ensure we are showing the current correct frame out of 10 possible
  		this.counter = (this.counter+1) % 10;				
  		// If capman is still alive and the game is not "hold" (level changing fadein/fadeouts etc.) and the "bullet timer" is not stopping the game.
  		if(!maingame.gameIsHold() && !maingame.bullettimer) {		
  		  // Check the status of the mongoman and make it viewable if it's close
  		  var mongoman = gbox.getObject("ghosts", "mongoman");
  		  if(mongoman) {
  		    var leftBorder = this.x - (this.colw * 2);
  		    var rightBorder = this.x + (this.colw * 2);
  		    var topBorder = this.y - (this.colh* 2);
  		    var bottomBorder = this.y + (this.colh* 2);
  		    
          if(mongoman.x >= leftBorder &&
            mongoman.x <= rightBorder &&
            mongoman.y >= topBorder &&
            mongoman.y <= bottomBorder) {
              mongoman.render = true;
  		    } else {
  		      mongoman.render = false;
  		    }
  		  }
  		  
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
							if(maze.hw - this.hw > this.x) {
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
						toys.topview.setStaticSpeed(this, 4)
						this.time = 75;
						this.status = "chasing";
					}
        } else {
    			// First of all, let's move.
    			// A little trick: capman cannot change direction, if hits a wall, so we backup capman's status here. Will restored if capman hits the wall.
    			var olddata = help.createModel(this,["x","y","accx","accy","xpushing","ypushing","facing"]);
    			// Set up the control keys for the player
    			toys.topview.controlKeys(this,{left:"left",right:"right",up:"up",down:"down"});
    			// Apply forces to the model
    			toys.topview.applyForces(this);

    			// Handle collisions with the map, accuracy and tolerance controls how precise the collision detection is			
    			toys.topview.tileCollision(this, maze, "map", null, {tolerance:0,approximation:1});
			
    			// Dont't transmit collisions
    			var collision = false;
    			// If we have a collision
    			if(this.status == 'chasing' && this.touchedup) {
    			  this.status="chasing";
    			} else if(this.touchedup||this.toucheddown||this.touchedleft||this.touchedright) {
    				help.copyModel(this, olddata); 
    				toys.topview.applyForces(this); 
    				toys.topview.tileCollision(this, maze, "map", null, {tolerance:0,approximation:1});
    				collision = true;
    			}

    			// The side warp. If capman reach one of the left or right side of the maze, is spawn on the other side,in the same direction
    			if((this.x < 0) && (this.facing == toys.FACE_LEFT)) {
    			  this.x = maze.w - this.w;
    			} else if((this.x > (maze.w - this.w)) && (this.facing == toys.FACE_RIGHT)) {
    			  this.x = 0;
    			}
			
    			// setFrame sets the right frame checking the facing and the defined animations in "initialize"
    			toys.topview.setFrame(this); 

          if(!collision && olddata.x != this.x || olddata.y != this.y 
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
  		}
  	},
	
  	makeeatable:function() {
  	  this.status = 'running';
  	  this.time = 150;
  	},	
	
  	blit:function() {
  	  // Render the ghost
      gbox.blitTile(gbox.getBufferContext(),{tileset:this.tileset,tile:this.frame,dx:this.x,dy:this.y,fliph:this.fliph,flipv:this.flipv,camera:this.camera,alpha:1});
  	  // Fetch the render canvas
      var drawingCanvas =  gbox.getCanvas("mazecanvas");
  		// If we are a ghost only show the area around the ghost
      if(gbox.getBufferContext()) {
        // Initaliase a 2-dimensional drawing context
        var context = gbox.getBufferContext();                
        context.strokeStyle = "#000000";
        context.fillStyle = "#000000";
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(drawingCanvas.width, 0);
        context.lineTo(drawingCanvas.width, drawingCanvas.height);
        context.lineTo(0, drawingCanvas.height);
        context.arc(this.x, this.y, 50, 0, Math.PI*2, true);      
        context.lineTo(0, drawingCanvas.height);
        context.lineTo(0, 0);
        context.closePath();
        context.fill();
      }            
  	},
	
  	// And now, a custom method. This one will kill the player and will be called by ghosts, when colliding with capman.
  	kill:function() {
      if(sound) SoundJS.play("die");
  	  // Set status to eaten
  	  this.status = 'eaten';
  	  // Change tileset
			this.tileset = "ghosteaten";  	  
  	}
	}
}
