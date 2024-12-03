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

        // Envoyer tous les pings à l'administrateur
        if (number === ADMIN_NUMBER) {
            socket.emit('allPings', Array.from(pings.values()));
        } else {
            // Envoyer les pings correspondant au numéro de l'utilisateur
            const userPings = Array.from(pings.values()).filter(ping => ping.number === number);
            socket.emit('allPings', userPings);
        }
    });

    socket.on('removePing', (pingId) => {
      // Trouver et supprimer le ping avec l'ID donné
      for (const [id, ping] of pings) {
          if (ping.id === pingId) {
              pings.delete(id); // Supprimer le ping du Map
              break;
          }
      }
  
      // Informer tous les clients du changement (le ping a été supprimé)
      io.sockets.emit('pingRemoved', pingId);
    });

    socket.on('placePing', ({ lat, lng, username }) => {
        // Supprimer l'ancien ping de l'utilisateur
        for (const [id, ping] of pings) {
            if (ping.number === socket.number) {
                pings.delete(id);
                break;
            }
        }

        // Ajouter un nouveau ping
        const ping = {
            id: Date.now(),
            number: socket.number,
            username: username || "Anonyme",
            lat,
            lng
        };
        pings.set(ping.id, ping);

        // Envoyer le ping à tous les utilisateurs concernés
        io.sockets.sockets.forEach(connectedSocket => {
            if (connectedSocket.number === ADMIN_NUMBER || connectedSocket.number === socket.number) {
                connectedSocket.emit('newPing', ping);
            }
        });
    });

    socket.on('generateDistanceFile', () => {
      // Si l'utilisateur est l'administrateur, on génère le fichier de distances
      if (socket.number === ADMIN_NUMBER) {
          const pingsArray = Array.from(pings.values());
          const distances = [];
  
          // Calculer la distance entre chaque utilisateur
          pingsArray.forEach((ping1, index1) => {
              pingsArray.forEach((ping2, index2) => {
                  // Eviter de calculer deux fois la même paire (ping1 à ping2 et ping2 à ping1)
                  if (index1 < index2) { // Cela garantit qu'on ne fait pas de doublons
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
  
          // Trier les distances par ordre croissant
          distances.sort((a, b) => a.distance - b.distance);
  
          // Créer un fichier .txt avec les distances
          const fileName = 'distances.txt';
          const filePath = path.join(__dirname, fileName);
  
          // Construire le contenu du fichier texte
          let fileContent = 'Distances entre les utilisateurs :\n\n';
          distances.forEach(d => {
              fileContent += `De ${d.from} à ${d.to} : ${d.distance} mètres\n`;
          });
  
          // Écrire le contenu dans le fichier .txt
          fs.writeFileSync(filePath, fileContent);
  
          // Envoyer le fichier .txt au client
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
