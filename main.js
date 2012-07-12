// # Tsar Tnoc
/*global async:true setTimeout:true document:true Image:true */
(function(){"use strict";
var syncFnFactory; 
var imageSources, groundImg, contrastImg, goalImg, charImg, rockImg, enemyImg;
var world;
var Tile;
var Unit;
var mainCharacter;
var drawView;
var initView;
var doAction;
var level, contrastsTotal, contrastsTaken, lives;
var makeMaze;

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
    enemyImg = './figures/evil.png';
    rockImg = './figures/rock.png';
    imageSources = [rockImg, groundImg, contrastImg, goalImg, charImg, enemyImg];
    
    // ### Random dummy world
    world = {};

    var worldcache = {};
    world.clear = function() {
        worldcache = {};
    }
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
            tile.images = [];
            tile.units = {};
            tile.z = Math.random();
            tile.images.push(rockImg);
            worldcache[pos] = tile;
        }
        return worldcache[pos];
    };
})();
    
// ## Tile
(function(){
    Tile = {};
    Tile.getImages = function() { return this.images; };
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
            if(world.get(x,y).images[1] === contrastImg) {
                contrastsTaken++;
                if(contrastsTaken === contrastsTotal) {
                    nextLevel();
                }
                updateStatus();
                world.get(x,y).item = false;
                world.get(x,y).images.pop();
            }
            doAction();
    
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
    
// ## Status bar
var updateStatus = function() {
    document.getElementById('status').innerHTML =
        'Contrasts: <sup>' + contrastsTaken +
        '</sup>/<sub>' + contrastsTotal + '</sub><br/>' +
        'Lives left: ' + lives + '<br/>' +
        'Level: ' + level;
};

    
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
                    ctx.fillStyle = "rgba(255,0,0,1)";
                } else if(tile.item) {
                    ctx.fillStyle = 'rgba(0,255,255,1)';
                } else if(!tile.passable) {
                    ctx.fillStyle = 'rgba(0,0,0,1)';
                } else {
                    ctx.fillStyle = "rgba(255,255,255,1)";
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
            var images = tile.getImages();
            for(i = 0; i < images.length; ++i) {
                drawImage(images[i], toScreenX(x,y), toScreenY(x,y));
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
    
    var currentAction;
    doAction = function() {
        if(currentAction === 'down') {
            mainCharacter.move(0,1);
        } else if(currentAction === 'up') {
            mainCharacter.move(0,-1);
        } else if(currentAction === 'left') {
            mainCharacter.move(-1,0);
        } else if(currentAction === 'right') {
            mainCharacter.move(1,0);
        }
    }

    var buttonelem = document.getElementById('buttons');
    buttonelem.onmouseout = function() { currentAction = undefined; };
    buttonelem.onmouseup = function() { currentAction = undefined; };
    buttonelem.ontouchend = function() { currentAction = undefined; };
    buttonelem.ontouchstart = function(ev) { 
        ev = ev || window.event;
        var x = (ev.clientX || ev.touches[0].clientX) - 600;
        var y = (ev.clientY || ev.touches[0].clientY) - 280;
        if(x+y < 200) {
            if(x<y) {
                currentAction = 'left';
            } else {
                currentAction = 'up';
            }
        } else {
            if(x<y) {
                currentAction = 'down';
            } else {
                currentAction = 'right';
            }
        }
        doAction();
        ev.preventDefault && ev.preventDefault();
        ev.stopPropagation && ev.stopPropagation();
        ev.cancelBubble = true;
        ev.returnValue = false;
        return false;
    };
    buttonelem.onmousedown = buttonelem.ontouchstart;
    /* buttonelem.onmousemove = function(ev) {
        if(currentAction) {
            return buttonelem.ontouchstart(ev);
        }
    }
    buttonelem.ontouchmove = buttonelem.ontouchstart; */

    
    document.body.onkeydown = function(ev) {
        //console.log(ev.keyCode);
        var keyCode = ev.keyCode;
        if(keyCode===37) { currentAction = 'left'; }
        if(keyCode===38) { currentAction = 'up'; }
        if(keyCode===39) { currentAction = 'right'; }
        if(keyCode===40) { currentAction = 'down'; }
        doAction();
    };
    document.body.onkeyup = function(ev) {
        currentAction = undefined;
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
function restartGame() {
    level = -1;
    lives = 3;
    world.clear();
    mainCharacter.moveTo(0,0);
    nextLevel();
}

function nextLevel() {
    ++level;
    makeMaze();
}

    
    
// ## Generate maze
(function(){
    var next = [{x:0,y:0}];
    makeMaze = function() {
        contrastsTotal = contrastsTaken = 0;
        var i;
        var tile;
        for(i=0;i<30;++i) {
            var curpos = (1 - Math.random() * Math.random() * Math.random()) * next.length % next.length |0;
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
                if(freespace > 2 || (Math.random() < 0.8)) {
                    tile.z = Math.random() < 0.05?0.5: 0;
                    tile.passable = true;
                    tile.images.pop();
                    tile.images.push(groundImg);
                    next.push({x:x,y:y+1});
                    next.push({x:x,y:y-1});
                    next.push({x:x-1,y:y});
                    next.push({x:x+1,y:y});
                    if(Math.random() < level * 0.01) {
                        new Unit([enemyImg], x,y);
                    }
                    if(Math.random() < 0.2) {
                        tile.images.push(contrastImg);
                        tile.item = true;
                        contrastsTotal++;
                    }
                }
                tile.visited = true;
            }
        }
        if(contrastsTotal === 0) {
            makeMaze();
        }
        updateStatus();
    }
})();

// ## Generate heightmap
(function(){
    // ## Diamond-square algorithm
    function diamondSquare(size, rnd) {
        var step, x, y, sizeMask, result;
        // Sanitise parameters
        if(size & (size-1) !== 0) {
            throw {error: 'size parameter must be a power of two'};
        }
        if(typeof rnd !== 'function') {
            rnd = function(scale) {
                return (Math.random()-0.5) * scale;
            };
        }
    
        // The array which will contain the fractal.
        // Initialisation of the first parameter is the base height of the fractal.
        result = [0];
    
        // Precalculated mask for module when out of boundaries.
        sizeMask = size - 1;
    
        // Shorthand function for getting a xy-element of the result array.
        function get(x,y) {
            return result[(x&sizeMask)+(y&sizeMask)*size];
        }
    
        for(step = size; step > 0; step >>= 1) {
            var prevStepMask = (step<<1) - 1;
            // Square part of the algorithm
            for(x = 0; x < size; x += step) {
                for(y = 0; y < size; y += step) {
                    if((y&prevStepMask) && (x&prevStepMask)) {
                        result[x+y*size] = (
                                get(x-step, y-step) +
                                get(x+step, y+step) +
                                get(x+step,y-step) +
                                get(x-step,y+step))/4 + rnd(step);
                    }
                }
            }
            // Diamond part of the algorithm
            for(x = 0; x < size; x += step) {
                for(y = 0; y < size; y += step) {
                    if( (!(y&prevStepMask) && (x&prevStepMask)) ||
                        (!(x&prevStepMask) && (y&prevStepMask))) {
                        result[x+y*size] = (
                                get(x-step, y) +
                                get(x+step, y) +
                                get(x,y-step) +
                                get(x,y+step))/4 + rnd(step);
                    }
                }
            }
        }
        return result;
    }
    function makeHeightWorld(size) {
        var heights = diamondSquare(size);
        for(var x = 0; x < size; ++x) {
            for(var y = 0; y < size; ++y) {
                var tile = world.get(x-size/2,y-size/2);
                tile.z = Math.round(heights[x+y*size])/2;
                tile.images=[groundImg];
                tile.passable=true;
            }
        }
    }
    //makeHeightWorld(256);
})();

restartGame();
    
// # EOF
})();
