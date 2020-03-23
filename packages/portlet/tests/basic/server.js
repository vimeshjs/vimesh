'use strict';

const express = require('express')
const ExpressHandlebars  = require('../../express-handlebars')

var app = express()

app.engine('handlebars', new ExpressHandlebars().engine)
app.set('view engine', 'handlebars')

app.get('/', function (req, res) {
    res.render('home')
})

app.listen(3000, function () {
    console.log('express-handlebars example server listening on: 3000')
})
