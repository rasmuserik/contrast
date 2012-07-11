// # Tsar Tnoc
/*global async:true setTimeout:true document:true Image:true */
(function(){"use strict";
var syncFnFactory; 
var imageSources, groundImg, contrastImg, goalImg, charImg, rockImg;
var world;
var Tile;
var Unit;
var mainCharacter;
var drawView;
var initView;

// ## Util
(function(){
    // ### Synchronisation utility, example:
    //
    //      var waitFor = syncFnFactory(fn);
    //      someAsyncFunction(..., waitFor());
    //      someOtherAsyncFunction(..., waitFor());
    //      someAsyncFunction(..., waitFor());
    //
    // then `fn` will be called when all of the async functions has finished.
    syncFnFactory = function(callback) {
        var count = 0;
        return function() {
            ++count;
            return function() {
                --count;
                async.nextTick(function() {
                    if(count === 0) {
                        callback();
                    }
                    callback = undefined;
                });
            };
        };
    };
})();
    
// ## Graphic files and configuration
(function() {
    // tile files
    groundImg = './figures/grass.png';
    contrastImg = './figures/contrast.png';
    goalImg = './figures/blueyellow.png';
    charImg = './figures/char.png';
    rockImg = './figures/rock.png';
    imageSources = [rockImg, groundImg, contrastImg, goalImg, charImg];
    
    // ### Random dummy world
    world = {};

    var worldcache = {};
    world.getZ = function(xpos,ypos) {
        var x = Math.floor(xpos);
        var y = Math.floor(ypos);
        var z = 
            world.get(x, y).getZ() * (1-xpos+x) * (1-ypos+y) +
            world.get(x+1, y).getZ() * (xpos-x) * (1-ypos+y) +
            world.get(x, y+1).getZ() * (1-xpos+x) * (ypos-y) +
            world.get(x+1, y+1).getZ() * (xpos-x) * (ypos-y) ;
        return z;
    };
    world.get = function(x, y) {
        var pos = Math.round(x) + ',' + Math.round(y);
        if(!worldcache[pos]) {
            var tile = Object.create(Tile);
            tile.surface = [];
            tile.units = {};
            tile.z = Math.random();
            tile.surface.push(rockImg);
            worldcache[pos] = tile;
        }
        return worldcache[pos];
    };
})();
    
// ## Tile
(function(){
    Tile = {};
    Tile.getSurfaceImages = function() { return this.surface; };
    Tile.getZ = function() { return this.z; };
})();
    
// ## Unit
(function(){
    //
    // Game unit, - player moving item ...
    //
    // Functions:
    // - getX()
    // - getY()
    // - getZ()
    // - getImages()
    
    var nextUnitSerialNumber = 1;
    
    var unitPrototype = {};
    
    unitPrototype.moveTo = function(x,y) {
        this.x = x;
        this.y = y;
        world.get(x,y).units[this.id] = this;
    };
    unitPrototype.getX = function() { return this.x; };
    unitPrototype.getY = function() { return this.y; };
    unitPrototype.getZ = function() { return this.z; };
    unitPrototype.getImages = function() { return this.images; };
    unitPrototype.z = 0;
    
    Unit = function(images, x, y) {
        var unit = Object.create(unitPrototype);
        unit.id = nextUnitSerialNumber++;
        unit.images = images;
        unit.moveTo(x,y);
        return unit;
    };
})();
    
// ### Main character
(function(){
    mainCharacter = new Unit([charImg], 0, 0);
    
    var charSpeed = 600;
    var jumpHeight = 1;
    mainCharacter.move = function(dx,dy) {
        if(this.moving) {
            return;
        }
        var prevx = this.x;
        var prevy = this.y;
        var x = prevx + dx;
        var y = prevy + dy;
        if(!world.get(x,y).passable) {
            return;
        }
        var oiSound = document.createElement('audio'); 
        oiSound.setAttribute('src', 'audio/oi.wav'); 
        oiSound.play();
        var that = this;
        var startMove = Date.now();
        this.moving = true;
    
        setTimeout(function() {
            that.moveTo(x, y);
            that.z = 0;
            that.moving = false;
            if(world.get(x,y).surface[1] === contrastImg) {
                world.get(x,y).surface.pop();
            }
    
        }, charSpeed);
    
        function updatePos() {
            if(!that.moving) { return; }
            var t = (Date.now() - startMove)/charSpeed;
            var currentx = prevx + t * dx;
            var currenty = prevy + t * dy;
            var z = -4*((t-0.5)*(t-0.5)-0.25)*jumpHeight;
            that.z = z;
            that.moveTo(currentx,currenty);
        }
        this.getX = function() { updatePos(); return this.x; };
        this.getY = function() { updatePos(); return this.y; };
        this.getZ = function() { updatePos(); return this.z; };
    };
})();
    
    
// ## Minimap
(function(){
    function updateMiniMap() {
        var minimap = document.getElementById('minimap');
        var ctx = minimap.getContext('2d');
        var x, y;
        var x0 = Math.round(mainCharacter.getX()); 
        var y0 = Math.round(mainCharacter.getY());
        for(y = -17; y <= 17; ++y) {
            for(x = -17; x <= 17; ++x) {
                var tile = world.get(x0+x, y0+y);
                if(x === 0 && y === 0) {
                    ctx.fillStyle = "rgba(255,0,0,0.03)";
                } else if(tile.item) {
                    ctx.fillStyle = 'rgba(0,255,255,0.03)';
                } else if(!tile.passable) {
                    ctx.fillStyle = 'rgba(0,0,0,0.03)';
                } else {
                    ctx.fillStyle = "rgba(255,255,255,0.03)";
                }
                ctx.fillRect(99 + 6*x, 99+6*y, 5, 5);
            }
        }
        setTimeout(updateMiniMap, 100);
    }
    updateMiniMap();
})();
    
// ## View
// view of 6x6 view
(function(){    
    // ### Initialisation
    var canvas;
    var ctx;
    // tile dimensions, (depth is z-height mapped to y-axis)
    var tileWidth = 100;
    var tileYOffset = 90;
    var tileHeight = 80;
    var tileDepth = 40;
    var viewWidth;
    var viewHeight;

    
    // ### Utility for loading/drawing images
    
    // hashmap of loaded images
    var images = {};
    
    // load an image into the hashmap
    function loadImage(filename, callback) {
        images[filename] = new Image();
        images[filename].onload = callback;
        images[filename].src = filename;
    }
    
    function drawImage(filename, x, y) {
        ctx.drawImage(images[filename], x, y);
    }
    
    initView = function(callback) {
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d');
        var syncFn = syncFnFactory(callback);
        async.forEach(imageSources, loadImage, syncFn());
        viewWidth = canvas.width;
        viewHeight = canvas.height;
    };
    
    // ### Actually draw the view
    drawView = function(xpos, ypos) {
        var x0World, x0, y0World, y0, x, y;
    
        function toScreenX(xpos,ypos) {
            return (xpos - x0World) * tileWidth +x0;
        }
    
        function toScreenY(xpos,ypos,z) {
            z = z || 0;
            z = z + world.getZ(xpos, ypos);
            return (ypos-y0World) * tileHeight +y0 - z*tileDepth - tileYOffset;
        }
    
        function drawTile(x,y) {
            var i;
            var tile = world.get(x,y);
            var surface = tile.getSurfaceImages();
            for(i = 0; i < surface.length; ++i) {
                drawImage(surface[i], toScreenX(x,y), toScreenY(x,y));
            }
        }
    
        function drawTileUnits(x,y) {
            var tile = world.get(x,y);
            var units = Object.keys(tile.units).map(function(name){ return tile.units[name]; });
            units.sort(function(a,b) { return a.y - b.y; });
            units.forEach(function(unit) {
                var ux = unit.getX(), uy = unit.getY(), uz = unit.getZ();
                var images = unit.getImages();
                var screenX = toScreenX(ux, uy, uz);
                var screenY = toScreenY(ux, uy, uz);
                for(var i = 0; i < images.length; ++i) {
                    drawImage(images[i], screenX, screenY);
                }
                if(Math.round(ux) !== x || Math.round(uy) !== y) {
                    delete tile.units[unit.id];
                } 
            });
        }
    
        ctx.fillRect(0,0,1000,1000);
    
        x0 = Math.round((Math.round(xpos) - xpos - 0.5) * tileWidth);
        y0 = Math.round((Math.round(ypos) - ypos - 0.5) * tileHeight + world.getZ(xpos,ypos)*tileDepth);
        x0World = Math.round(xpos) - 3;
        y0World = Math.round(ypos) - 3;
        var yi = Math.round(ypos);
        var xi = Math.round(xpos);
        var xWorld, yWorld;
    
    
        for(y = yi-4; y < yi+5; ++y) {
            for(x = xi - 3; x < xi + 4; ++x) {
                drawTile(x, y);
            }
            for(x = xi - 3; x < xi + 4; ++x) {
                drawTileUnits(x, y);
            }
        }
    };
})();
    
    
// ## Controller
(function(){
    document.body.onkeydown = function(ev) {
        //console.log(ev.keyCode);
        var keyCode = ev.keyCode;
        if(keyCode===37) { // key left
            mainCharacter.move(-1,0);
        } else if(keyCode===39) { // key right
            mainCharacter.move(1,0);
        } else if(keyCode===38) { // key up
            mainCharacter.move(0,-1);
        } else if(keyCode===40) { // key down
            mainCharacter.move(0,1);
        }
    };
    
    // ### Main
    initView(function(){});
    var x=0, y=0, t0=Date.now();
    function drawLoop() {
        drawView(mainCharacter.getX(), mainCharacter.getY());
        //drawView(0,0);
        setTimeout(drawLoop, 30);
    }
    drawLoop();
})();
    
    
// ## Generate maze
(function(){
    function makeMaze() {
        var next = [{x:0,y:0}];
        var i;
        var tile;
        for(i=0;i<1000;++i) {
            var curpos = (1 - Math.random() * Math.random() * Math.random() * Math.random()) * next.length % next.length |0;
            var current = next[curpos];
            var x = current.x;
            var y = current.y;
            next[curpos] = next.pop();
            tile = world.get(current.x, current.y);
            if(!tile.visited) {
                var freespace = 0;
                freespace += world.get(x+1,y).passable?0:1;
                freespace += world.get(x-1,y).passable?0:1;
                freespace += world.get(x,y-1).passable?0:1;
                freespace += world.get(x,y+1).passable?0:1;
                if(freespace > 2 || (Math.random() < 0.6)) {
                    tile.z = Math.random() < 0.05?0.5: 0;
                    tile.passable = true;
                    tile.surface.pop();
                    tile.surface.push(groundImg);
                    next.push({x:x,y:y+1});
                    next.push({x:x,y:y-1});
                    next.push({x:x-1,y:y});
                    next.push({x:x+1,y:y});
                    if(Math.random() < 0.1) {
                        tile.surface.push(contrastImg);
                    }
                }
                tile.visited = true;
            }
        }
        tile.passable = true;
        tile.surface = [groundImg, goalImg];
        tile.item = true;
    }
    makeMaze();
})();
    
// # EOF
})();
