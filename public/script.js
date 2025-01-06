const socket = io();

let firstname = '';
let currentNumber = '';
let map;
let markers = {};

function login() {
    const number = parseInt(document.getElementById('number').value);

    if (number >= 1 && number <= 30 || number == 42) {
        currentNumber = number;
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
    firstname = document.getElementById('firstname').value.trim();
    if (firstname) {
        Swal.fire('Prénom défini : ' + firstname);
        document.getElementById('map').style.filter = "none";
    } else {
        Swal.fire({
            position: 'top-end',
            icon: 'error',
            title: 'Veuillez entrer un prénom valide.',
            showConfirmButton: false,
            timer: 1500
        });
    }
}

function backToLogin() {
    if (map) {
        map.remove();
        map = null;
    }
    markers = {};
    firstname = '';
    currentNumber = '';

    document.getElementById('mapContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'block';

    document.getElementById('number').value = '';
    document.getElementById('firstname').value = '';
    document.getElementById('map').style.filter = "blur(10px)";

    socket.disconnect();

    socket.connect();
}

function initMap() {
    map = L.map('map').setView([43.60769064029943, 2.242072295211075], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function (e) {
        if (firstname) {
            if (markers[currentNumber] && currentNumber != 42) {
                map.removeLayer(markers[currentNumber]);
                delete markers[currentNumber];
            }

            const marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
            marker.bindTooltip(firstname, { permanent: true, direction: 'top' });

            markers[currentNumber] = marker;

            socket.emit('placePing', { lat: e.latlng.lat, lng: e.latlng.lng, username: firstname });
        } else {
            Swal.fire({
                position: 'top-end',
                icon: 'error',
                title: 'Veuillez définir votre prénom avant de placer un ping.',
                showConfirmButton: false,
                timer: 1500
            });
        }
    });
}

socket.on('allPings', (pings) => {
    pings.forEach(addPingToMap);
});

socket.on('newPing', addPingToMap);

function addPingToMap(ping) {
    if (markers[ping.number]) {
        map.removeLayer(markers[ping.number]);
    }

    const marker = L.marker([ping.lat, ping.lng]).addTo(map);
    marker.bindTooltip(ping.username || "Anonyme", { permanent: true, direction: 'top' });

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

    markers[ping.number] = marker;
}

function generateDistanceFile() {
    socket.emit('generateDistanceFile');
}

socket.on('downloadFile', (fileName) => {
    const link = document.createElement('a');
    link.href = `/distances.csv`;
    link.download = fileName;
    link.click();
});

socket.on('pingRemoved', (pingId) => {
    for (const [number, marker] of Object.entries(markers)) {
        if (marker._latlng && marker._latlng.lat === pingId) {
            map.removeLayer(marker);
            delete markers[number];
            break;
        }
    }
});
