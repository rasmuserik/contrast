var express = require('express');
var app = express.createServer();

app.use(express.static(__dirname));
app.listen(process.env.PORT || 8080);
