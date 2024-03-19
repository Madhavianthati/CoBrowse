const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/agent.html');
});

app.get('/generate', (req, res) => {
  const sessionId = uuidv4();
  res.send(sessionId);
});

let agentHasControl = false;

io.on('connection', (socket) => {
  let currentStream = null;

  socket.on('screen', (dataURL) => {
    // Broadcast the screen data to all connected clients except the current one
    if (agentHasControl) {
      socket.broadcast.emit('screen', dataURL);
    }
  });

  socket.on('controlRequest', () => {
    // Emit a control request event to all clients except the current one
    socket.broadcast.emit('controlRequest');
  });

  socket.on('controlAccepted', () => {
    agentHasControl = true;
    // Emit a control accepted event to all clients except the current one
    socket.broadcast.emit('controlAccepted');
  });

  socket.on('generateLink', () => {
    const sessionId = uuidv4();
    socket.emit('linkGenerated', sessionId);
  });

  socket.on('startStream', () => {
    if (!currentStream) {
      navigator.mediaDevices.getDisplayMedia({ video: true })
        .then(stream => {
          currentStream = stream;
          socket.emit('streamStarted');
          stream.getTracks().forEach(track => {
            track.onended = () => {
              currentStream = null;
              socket.emit('streamEnded');
            };
            socket.emit('addStreamTrack', track);
          });
        })
        .catch(error => {
          console.error('Error accessing screen:', error);
        });
    }
  });

  socket.on('stopStream', () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
  });

  socket.on('disconnect', () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
  });
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
