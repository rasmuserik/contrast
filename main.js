// # Tsar Tnoc
(function(){
// ## Util

// Synchronisation utility, example:
//
//      var waitFor = syncFnFactory(fn);
//      someAsyncFunction(..., waitFor());
//      someOtherAsyncFunction(..., waitFor());
//      someAsyncFunction(..., waitFor());
//
// then `fn` will be called when all of the async functions has finished.
function syncFnFactory(callback) {
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
    }
}

// ## Graphic files and configuration

/*
'figures/blueyellow.png',
figures/char.png
figures/rock.png
*/
// tile files
var ground = [
    "./figures/grass.png",
    ];

var contrast = 'figures/contrast.png';
var items = [
    contrast,
    'figures/blueyellow.png',
    './figures/rock.png'];
var chars = [
    './figures/char.png'];

// ### Random dummy world

world = {};
worldcache = {};
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
        //tile.surface.push(ground[Math.abs(Math.random() * Math.random() * x*y|0) % ground.length]);
        //tile.surface.push("./planetcute/thing/Rock.png");
        tile.surface.push('./figures/rock.png');
        worldcache[pos] = tile;
    }
    return worldcache[pos];
}

// ## Tile
var Tile = {};
Tile.getSurfaceImages = function() { return this.surface; };
Tile.getZ = function() { return this.z; };

// ## Unit

var nextUnitSerialNumber = 1;

var unitPrototype = {};

unitPrototype.moveTo = function(x,y) {
    this.x = x;
    this.y = y;
    world.get(x,y).units[this.id] = this;
}
unitPrototype.getX = function() { return this.x; };
unitPrototype.getY = function() { return this.y; };
unitPrototype.getZ = function() { return this.z; };
unitPrototype.z = 0;

function Unit(img, x, y) {
    var unit = Object.create(unitPrototype);
    unit.id = nextUnitSerialNumber++;
    unit.img = img;
    unit.moveTo(x,y);
    return unit;
}

Unit('figures/blueyellow.png', 0, 0);

// ### Main character
var mainCharacter = Unit("./figures/char.png", 0, 0);

charSpeed = 600;
jumpHeight = 1;
mainCharacter.move = function(dx,dy) {
    if(this.moving) {
        return;
    }
    var prevx = this.x
    var prevy = this.y
    var x = prevx + dx;
    var y = prevy + dy;
    if(!world.get(x,y).passable) {
        return;
    }
    oiSound = document.createElement('audio'); 
    oiSound.setAttribute('src', 'audio/oi.wav'); 
    oiSound.play();
    var that = this;
    var startMove = Date.now();
    this.moving = true;

    setTimeout(function() {
        that.moveTo(x, y);
        that.z = 0;
        that.moving = false;
        if(world.get(x,y).surface[1] === contrast) {
            world.get(x,y).surface.pop();
        }

    }, charSpeed);

    function updatePos() {
        if(!that.moving) { return; };
        var t = (Date.now() - startMove)/charSpeed;
        var currentx = prevx + t * dx;
        var currenty = prevy + t * dy;
        var z = -4*((t-0.5)*(t-0.5)-.25)*jumpHeight;
        that.z = z;
        that.moveTo(currentx,currenty);
    }
    this.getX = function() { updatePos(); return this.x; }
    this.getY = function() { updatePos(); return this.y; }
    this.getZ = function() { updatePos(); zzz.push('t'+this.z); return this.z; }
}


// ## Sound Effects

// ## View
// view of 6x6 view


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
function initView(callback) {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    var syncFn = syncFnFactory(callback);
    async.forEach(ground.concat(items, chars), loadImage, syncFn());
    viewWidth = canvas.width;
    viewHeight = canvas.height;
}


// ### Utility for loading/drawing images

// hashmap of loaded images
images = {};

// load an image into the hashmap
function loadImage(filename, callback) {
    images[filename] = new Image();
    images[filename].onload = callback;
    images[filename].src = filename;
}

function drawImage(filename, x, y) {
    ctx.drawImage(images[filename], x, y);
}

// ### Actually draw the view
zzz = [];

function drawView(xpos, ypos) {

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
            drawImage(unit.img, toScreenX(ux, uy, uz), toScreenY(ux, uy, uz));
            if(Math.round(ux) !== x || Math.round(uy) !== y) {
                delete tile.units[unit.id];
            } 
        });
    }

    ctx.fillRect(0,0,1000,1000);

    var x0 = Math.round((Math.round(xpos) - xpos - .5) * tileWidth);
    var y0 = Math.round((Math.round(ypos) - ypos - .5) * tileHeight + world.getZ(xpos,ypos)*tileDepth);
    var x0World = Math.round(xpos) - 3;
    var y0World = Math.round(ypos) - 3;
    var yi = Math.round(ypos);
    var xi = Math.round(xpos);
    var xWorld, yWorld;


    for(var y = yi-4; y < yi+5; ++y) {
        for(var x = xi - 3; x < xi + 4; ++x) {
            drawTile(x, y);
        }
        for(var x = xi - 3; x < xi + 4; ++x) {
            drawTileUnits(x, y);
        }
    }
}


// ## Controller

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
}

// ### Generate Random Map
// ### Main

initView(function(){});
var x=0, y=0, t0=Date.now();
function drawLoop() {
    drawView(mainCharacter.getX(), mainCharacter.getY());
    //drawView(0,0);
    setTimeout(drawLoop, 30);
}
drawLoop();



// ## Generate maze
function makeMaze() {
    var next = [{x:0,y:0}];
    var i;
    for(i=0;i<1000;++i) {
        var curpos = (1 - Math.random() * Math.random() * Math.random() * Math.random()) * next.length % next.length |0;
        var current = next[curpos];
        var x = current.x;
        var y = current.y;
        next[curpos] = next.pop();
        var tile = world.get(current.x, current.y);
        if(!tile.visited) {
            var freespace = 0;
            freespace += world.get(x+1,y).passable?0:1
            freespace += world.get(x-1,y).passable?0:1
            freespace += world.get(x,y-1).passable?0:1
            freespace += world.get(x,y+1).passable?0:1
            if(freespace > 2 || (Math.random() < 0.5)) {
                ctx.fillRect(250+x, 250+y,1,1);
                tile.z = Math.random() < .05?.5: 0;
                tile.passable = true;
                tile.surface.pop();
                tile.surface.push('./figures/grass.png');
                next.push({x:x+1,y:y});
                next.push({x:x-1,y:y});
                next.push({x:x,y:y+1});
                next.push({x:x,y:y-1});
                if(Math.random() < .3) {
                    tile.surface.push(contrast);
                }
            }
            tile.visited = true;
        }
    }
}
makeMaze();

// # EOF
})();
