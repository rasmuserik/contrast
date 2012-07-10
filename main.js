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

// tile files
var ground = [
    "./planetcute/ground/Stone Block.png",
    "./planetcute/ground/Plain Block.png",
    "./planetcute/ground/Wall Block Tall.png",
    "./planetcute/ground/Stone Block Tall.png",
    "./planetcute/ground/Brown Block.png",
    "./planetcute/ground/Wall Block.png",
    "./planetcute/ground/Dirt Block.png",
    "./planetcute/ground/Wood Block.png",
    "./planetcute/ground/Grass Block.png",
    "./planetcute/ground/Water Block.png"];

var misc = [
    "./planetcute/misc/Window Tall.png",
    "./planetcute/misc/Roof South.png",
    "./planetcute/misc/Door Tall Closed.png",
    "./planetcute/misc/SpeechBubble.png",
    "./planetcute/misc/Roof North.png",
    "./planetcute/misc/Roof West.png",
    "./planetcute/misc/Door Tall Open.png",
    "./planetcute/misc/Roof South East.png",
    "./planetcute/misc/Roof North East.png",
    "./planetcute/misc/Roof East.png",
    "./planetcute/misc/Chest Lid.png",
    "./planetcute/misc/Roof South West.png",
    "./planetcute/misc/Roof North West.png"];

var items = [
    "./planetcute/thing/Heart.png",
    "./planetcute/thing/Rock.png",
    "./planetcute/thing/Gem Orange.png",
    "./planetcute/thing/Star.png",
    "./planetcute/thing/Tree Ugly.png",
    "./planetcute/thing/Gem Blue.png",
    "./planetcute/thing/Tree Tall.png",
    "./planetcute/thing/Chest Closed.png",
    "./planetcute/thing/Tree Short.png",
    "./planetcute/thing/Selector.png",
    "./planetcute/thing/Chest Open.png",
    "./planetcute/thing/Key.png",
    "./planetcute/thing/Gem Green.png",
    "./planetcute/char/Character Boy.png",
    "./planetcute/char/Character Cat Girl.png",
    "./planetcute/char/Character Pink Girl.png",
    "./planetcute/char/Enemy Bug.png",
    "./planetcute/char/Character Horn Girl.png",
    "./planetcute/char/Character Princess Girl.png"];

// ### Random dummy world

var world = {};
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
    var pos = x + ',' + y;
    if(!worldcache[pos]) {
        var tile = Object.create(Tile);
        tile.surface = [];
        tile.z = Math.random();
        tile.surface.push(ground[Math.abs(x*y|0) % ground.length]);
        if(Math.random() < 0.2) {
            tile.surface.push(items[items.length * Math.random() | 0]);
        }
        worldcache[pos] = tile;
    }
    return worldcache[pos];
}

// ## Tile
var Tile = {};
Tile.getSurfaceImages = function() { return this.surface; };
Tile.getZ = function() { return this.z; };

// ## View
// view of 6x6 view

// ### Tile info
// tile dimensions, (depth is z-height mapped to y-axis)
var tileWidth = 100;
var tileYOffset = 90;
var tileHeight = 80;
var tileDepth = 40;
var viewWidth;
var viewHeight;


// ### Initialisation
var canvas;
var ctx;
function initView(callback) {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    var syncFn = syncFnFactory(callback);
    async.forEach(ground.concat(misc, items), loadImage, syncFn());
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

// ### Draw a single tile and all objects on it

function drawTile(tile, x0, y0) {
    var y = y0 - tile.getZ() * tileDepth | 0;
    var x = x0;
    var surface = tile.getSurfaceImages();
    for(var i = 0; i < surface.length; ++i) {
        drawImage(surface[i], x, y - tileYOffset);
    }
}

// ### Actually draw the view

function drawView(xpos, ypos) {
    ctx.fillRect(0,0,1000,1000);

    var x0World = Math.round(xpos) - 3;
    var y0World = Math.round(ypos) - 3;
    var xWorld, yWorld;

    x0 = Math.round((Math.round(xpos) - xpos - .5) * tileWidth);
    y0 = Math.round((Math.round(ypos) - ypos - .5) * tileHeight + world.getZ(xpos,ypos)*tileDepth);
    for(dxWorld = 0; dxWorld<7; ++dxWorld) {
        for(dyWorld = -1; dyWorld<8; ++dyWorld) {
            xWorld = x0World + dxWorld;
            yWorld = y0World + dyWorld;
            drawTile(world.get(xWorld,yWorld), x0 + dxWorld*tileWidth, y0 + dyWorld*tileHeight);
        }
    }

    ctx.fillRect(viewWidth/2-3, viewHeight/2-3, 6, 6);
}


// ## Controller

// ### Generate Random Map
// ### Main

initView(function(){});
    var x=0, y=0, t0=Date.now();
function main() {
    t0 = Date.now();
    x += 0.02;
    y += 0;
    drawView(x, y);
    //console.log('rendertime: ', Date.now()-t0);
//    console.log(x,y);
    setTimeout(main, 1000/30);
};
setTimeout(main, 100);

// # EOF
})();
