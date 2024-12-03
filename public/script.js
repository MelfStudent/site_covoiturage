const socket = io();

let currentUsername = '';
let currentNumber = ''; // Identifiant de l'utilisateur actuel
let map;
let markers = {}; // Stocke les marqueurs associés aux utilisateurs

function login() {
    const number = parseInt(document.getElementById('number').value);

    if (number >= 1 && number <= 30 || number == 42) {
        currentNumber = number; // Stocker l'identifiant utilisateur
        socket.emit('login', { number });
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('mapContainer').style.display = 'block';
        initMap();
    } else {
        Swal.fire({
            position: 'top-end',
            icon: 'error',
            title: 'Veuillez entrer un numéro entre 1 et 30.',
            showConfirmButton: false,
            timer: 1500
        });
    }
}

function setUsername() {
    const name = document.getElementById('name').value.trim();
    const firstname = document.getElementById('firstname').value.trim();
    if (name && firstname) {
        currentUsername = name + " " + firstname;
        Swal.fire('Nom défini : ' + currentUsername);
        document.getElementById('map').style.filter = "none";
    } else {
        Swal.fire({
            position: 'top-end',
            icon: 'error',
            title: 'Veuillez entrer un nom & prénom valide.',
            showConfirmButton: false,
            timer: 1500
        });
    }
}

function backToLogin() {
    // Réinitialiser la carte et les marqueurs
    if (map) {
        map.remove();
        map = null;
    }
    markers = {};
    currentUsername = '';
    currentNumber = '';

    // Cacher la carte et afficher le formulaire de connexion
    document.getElementById('mapContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'block';

    // Réinitialiser les champs du formulaire
    document.getElementById('number').value = '';
    document.getElementById('name').value = '';
    document.getElementById('firstname').value = '';
    document.getElementById('map').style.filter = "blur(10px)";

    // Déconnecter le socket
    socket.disconnect();

    // Reconnecter le socket pour une nouvelle session
    socket.connect();
}

function initMap() {
    map = L.map('map').setView([43.60769064029943, 2.242072295211075], 13); // Centré sur Castres

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function (e) {
        if (currentUsername) {
            // Vérifier et supprimer l'ancien marqueur de l'utilisateur
            if (markers[currentNumber] && currentNumber != 42) {
                map.removeLayer(markers[currentNumber]);
                delete markers[currentNumber];
            }

            // Ajouter un nouveau marqueur
            const marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
            marker.bindTooltip(currentUsername, { permanent: true, direction: 'top' });

            // Enregistrer le nouveau marqueur dans la liste
            markers[currentNumber] = marker;

            // Envoyer le ping au serveur
            socket.emit('placePing', { lat: e.latlng.lat, lng: e.latlng.lng, username: currentUsername });
        } else {
            Swal.fire({
                position: 'top-end',
                icon: 'error',
                title: 'Veuillez définir votre nom et prénom avant de placer un ping.',
                showConfirmButton: false,
                timer: 1500
            });
        }
    });
}

socket.on('allPings', (pings) => {
    pings.forEach(addPingToMap);
    if (currentNumber == 42) {
        // Si l'utilisateur est l'administrateur, afficher le bouton pour générer le fichier
        const generateButton = document.createElement('button');
        generateButton.classList.add('btn', 'btn-danger', 'w-100', 'mt-4'); // Ajout d'une marge pour espacer le bouton
        generateButton.textContent = "Générer le fichier des distances";
        generateButton.onclick = generateDistanceFile;
        document.getElementById('mapContainer').appendChild(generateButton);
    }
});

socket.on('newPing', addPingToMap);

function addPingToMap(ping) {
    if (markers[ping.number]) {
        // Supprimer l'ancien marqueur si présent
        map.removeLayer(markers[ping.number]);
    }

    // Ajouter un nouveau marqueur pour ce ping
    const marker = L.marker([ping.lat, ping.lng]).addTo(map);
    marker.bindTooltip(ping.username || "Anonyme", { permanent: true, direction: 'top' });

    // Ajouter un événement de clic pour supprimer le ping
    marker.on('click', function() {
        Swal.fire({
            title: "Voulez-vous vraiment supprimer ce ping ?",
            text: "Vous ne pourrez pas revenir en arrière!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Oui, supprimé!"
          }).then((result) => {
            if (result.isConfirmed) {
                map.removeLayer(marker);

            // Envoyer une demande au serveur pour supprimer ce ping
            socket.emit('removePing', ping.id);
              Swal.fire({
                position: 'top-end',
                title: "Supprimé!",
                text: "Votre ping a été supprimé.",
                icon: "success"
              });
            }
          });
    });

    // Stocker le nouveau marqueur dans la liste
    markers[ping.number] = marker;
}

function generateDistanceFile() {
    socket.emit('generateDistanceFile');
}

// Téléchargement du fichier
socket.on('downloadFile', (fileName) => {
    const link = document.createElement('a');
    link.href = `/distances.csv`;  // Le fichier sera disponible à cette URL
    link.download = fileName;
    link.click();
});

socket.on('pingRemoved', (pingId) => {
    // Supprimer le marqueur de la carte si ce ping a été supprimé
    for (const [number, marker] of Object.entries(markers)) {
        if (marker._latlng && marker._latlng.lat === pingId) {
            map.removeLayer(marker);
            delete markers[number];
            break;
        }
    }
});
