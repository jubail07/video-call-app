const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: true }))
app.use(express.static('static'))

const userRoute = require('./routes/user')
const socketController = require('./controller/socket')

app.use('/', userRoute)

socketController(io)

const port = process.env.PORT || 4000

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
})