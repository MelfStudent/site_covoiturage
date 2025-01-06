const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const { getDistance } = require('geolib'); 

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const pings = new Map();
const ADMIN_NUMBER = 42; // Nombre x pour l'administrateur

io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté');

    socket.on('login', ({ number }) => {
        socket.number = number;

        if (number === ADMIN_NUMBER) {
            socket.emit('allPings', Array.from(pings.values()));
        } else {
            const userPings = Array.from(pings.values()).filter(ping => ping.number === number);
            socket.emit('allPings', userPings);
        }
    });

    socket.on('removePing', (pingId) => {
      for (const [id, ping] of pings) {
          if (ping.id === pingId) {
              pings.delete(id);
              break;
          }
      }

      io.sockets.emit('pingRemoved', pingId);
    });

    socket.on('placePing', ({ lat, lng, username }) => {
        for (const [id, ping] of pings) {
            if (ping.number === socket.number) {
                pings.delete(id);
                break;
            }
        }

        const ping = {
            id: Date.now(),
            number: socket.number,
            username: username || "Anonyme",
            lat,
            lng
        };
        pings.set(ping.id, ping);

        io.sockets.sockets.forEach(connectedSocket => {
            if (connectedSocket.number === ADMIN_NUMBER || connectedSocket.number === socket.number) {
                connectedSocket.emit('newPing', ping);
            }
        });
    });

    socket.on('generateDistanceFile', () => {
      if (socket.number === ADMIN_NUMBER) {
          const pingsArray = Array.from(pings.values());
          const distances = [];
  
          pingsArray.forEach((ping1, index1) => {
              pingsArray.forEach((ping2, index2) => {
                  if (index1 < index2) {
                      const distance = getDistance(
                          { latitude: ping1.lat, longitude: ping1.lng },
                          { latitude: ping2.lat, longitude: ping2.lng }
                      );
                      distances.push({
                          from: ping1.username || "Anonyme",
                          to: ping2.username || "Anonyme",
                          distance
                      });
                  }
              });
          });
  
          distances.sort((a, b) => a.distance - b.distance);
  
          const fileName = 'distances.txt';
          const filePath = path.join(__dirname, fileName);
  
          let fileContent = 'Distances entre les utilisateurs :\n\n';
          distances.forEach(d => {
              fileContent += `De ${d.from} à ${d.to} : ${d.distance} mètres\n`;
          });
  
          fs.writeFileSync(filePath, fileContent);
  
          socket.emit('downloadFile', fileName);
      }
  });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});
