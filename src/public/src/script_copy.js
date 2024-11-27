//https://leaflet-extras.github.io/leaflet-providers/preview/

// --------------------------------------------------------------- //
// --------------- Layer links and attribution ------------------- //
// --------------------------------------------------------------- //

const osmLink = '<a href="http://openstreetmap.org">OpenStreetMap</a>';
const cartoDB = '<a href="http://cartodb.com/attributions">CartoDB</a>';
// const stamenToner = <a href="http://maps.stamen.com">StamenToner</a>

const osmUrl = "http://tile.openstreetmap.org/{z}/{x}/{y}.png";
const osmAttrib = `&copy; ${osmLink} Contributors`;

const landUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png";
const cartoAttrib = `&copy; ${osmLink} Contributors & ${cartoDB}`;


const osmMap = L.tileLayer(osmUrl, { attribution: osmAttrib });
const landMap = L.tileLayer(landUrl, { attribution: cartoAttrib });


// ---------------------------------------------------- //
// ------------------- Map config --------------------- //
// ---------------------------------------------------- //
// config map
let config = {
    // See siin määrab ära default mapi
    layers: [osmMap],
    minZoom: 5,
    maxZoom: 18,
};

// magnification with which the map will start
const zoom = 8;
// coordinates
const lat = 58.636856;
const lng = 25.334473;

// calling map
const map = L.map("map", config).setView([lat, lng], zoom);
// Scale: imperial (miles) is set to false, only the metric scale is implemented
L.control.scale({imperial: false, maxWidth: 100}).addTo(map);

// osm layer
osmMap.addTo(map);

let baseLayers = {
    "Klassika": osmMap,
    "Dark mode": landMap,
};

L.control.layers(baseLayers).addTo(map);

// ------------------------------------------------------ //
// ---------------------- Sidebar ----------------------- //
// ------------------------------------------------------ //
// sidebar

const menuItems = document.querySelectorAll(".menu-item");
const buttonClose = document.querySelector(".close-button");
menuItems.forEach((item) => {
    item.addEventListener("click", (e) => {
        const target = e.target;

        if (
            target.classList.contains("active-item") ||
            !document.querySelector(".active-sidebar")
        ) {
            document.body.classList.toggle("active-sidebar");
        }

        // show content
        showContent(target.dataset.item);
        // add active class to menu item
        addRemoveActiveItem(target, "active-item");
    });
});

// close sidebar when click on close button
buttonClose.addEventListener("click", () => {
    closeSidebar();
});

// remove active class from menu item and content
function addRemoveActiveItem(target, className) {
    const element = document.querySelector(`.${className}`);
    target.classList.add(className);
    if (!element) return;
    element.classList.remove(className);
}

// show specific content
function showContent(dataContent) {
    const idItem = document.querySelector(`#${dataContent}`);
    addRemoveActiveItem(idItem, "active-content");
}

// --------------------------------------------------
// close when click esc
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeSidebar();
    }
});

// close sidebar when click outside
document.addEventListener("click", (e) => {
    if (!e.target.closest(".sidebar")) {
        closeSidebar();
    }
});

// --------------------------------------------------
// close sidebar

function closeSidebar() {
    document.body.classList.remove("active-sidebar");
    const element = document.querySelector(".active-item");
    const activeContent = document.querySelector(".active-content");
    if (!element) return;
    element.classList.remove("active-item");
    activeContent.classList.remove("active-content");
}

// ------------------------------------------------------------ //
// ------------------ Marker/Cluster config ------------------- //
// ------------------------------------------------------------ //

// L.MarkerClusterGroup extends L.FeatureGroup
// by clustering the markers contained within
let markers = L.markerClusterGroup({
    spiderfyOnMaxZoom: true, // Disable spiderfying behavior
    showCoverageOnHover: false, // Disable cluster spiderfier polygon

});

// Create a custom divIcon with a small circle
function createCustomDivIcon() {
    return L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="circle-icon"></div>',
        iconSize: [12, 12],
    });
}


// ---------------------------------------------------- //
// --------------- Back to home button ---------------- //
// ---------------------------------------------------- //
const htmlTemplate = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M32 18.451L16 6.031 0 18.451v-5.064L16 .967l16 12.42zM28 18v12h-8v-8h-8v8H4V18l12-9z" /></svg>';
// const htmlTemplate = 'img/search_icon.png'

// create custom button
const customControl = L.Control.extend({
    // button position
    options: {
        position: "topleft",
    },

    // method
    onAdd: function (map) {
        console.log(map.getCenter());
        // create button
        const btn = L.DomUtil.create("button");
        btn.title = "tagasi algusesse";
        btn.innerHTML = htmlTemplate;
        btn.className += "leaflet-bar back-to-home hidden";

        return btn;
    },
});

// adding new button to map control
map.addControl(new customControl());

// on drag end
map.on("moveend", getCenterOfMap);

const buttonBackToHome = document.querySelector(".back-to-home");

function getCenterOfMap() {
    buttonBackToHome.classList.remove("hidden");

    buttonBackToHome.addEventListener("click", () => {
        map.flyTo([lat, lng], zoom);
    });

    map.on("moveend", () => {
        const { lat: latCenter, lng: lngCenter } = map.getCenter();

        const latC = latCenter.toFixed(3) * 1;
        const lngC = lngCenter.toFixed(3) * 1;

        const defaultCoordinate = [+lat.toFixed(3), +lng.toFixed(3)];

        const centerCoordinate = [latC, lngC];

        if (compareToArrays(centerCoordinate, defaultCoordinate)) {
            buttonBackToHome.classList.add("hidden");
        }
    });
}

const compareToArrays = (a, b) => JSON.stringify(a) === JSON.stringify(b);


// ---------------------------------------------------- //
// ---------------------- MiniMap --------------------- //
// ---------------------------------------------------- //
// MiniMap
const osm2 = new L.TileLayer(osmUrl, { minZoom: 0, maxZoom: 13});
const miniMap = new L.Control.MiniMap(osm2, { toggleDisplay: true }).addTo(map);

// ---------------------------------------------------- //
// ---------------------- Searchbox --------------------- //
// ---------------------------------------------------- //

// Searchbox
let searchbox = L.control.searchbox({
    position: 'topright',
    expand: 'left'
}).addTo(map);


// Add search functionality
searchbox.onInput("keyup", function (e) {
    // fetchAndLoadMarkers({ name: searchbox.getValue() });
    // this should fetch the possible options for this input
    if (e.keyCode === 13 || e.keyCode === 27) {
        setTimeout(() => {
            searchbox.hide();
            searchbox.clear();
        }, 300);
    }
});

searchbox.onButton("click", function () {
    fetchAndLoadMarkers({ name: searchbox.getValue() });
    setTimeout(() => {
        searchbox.hide();
        searchbox.clear();
    }, 300);
});


// ---------------- everything above is application configs/visuals and shit ----------------- //
// ---------------- everything below is about getting markers to the map ----------------- //


// Fetch and load markers with optional filters
function fetchAndLoadMarkers(filters = {}) {
    // Construct the query string from the filters
    const queryString = Object.entries(filters)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
    const endpoint = `http://127.0.0.1:3001/person/markers${queryString ? `?${queryString}` : ''}`;

    // Fetch marker data from the backend API
    fetch(endpoint)
        .then(response => response.json())
        .then(markerData => {
            // Clear existing markers
            markers.clearLayers();

            // Iterate over the marker data and create markers
            markerData.forEach(data => {
                const { xCoordinate, yCoordinate, title, description } = data;

                // Create a marker with the custom divIcon
                const marker = L.marker(new L.LatLng(xCoordinate, yCoordinate), {
                    icon: createCustomDivIcon(),
                    title: title,
                });

                // Create the popup content
                const popupContent = document.createElement('div');
                const titleElement = document.createElement('h3');
                titleElement.textContent = title;
                popupContent.appendChild(titleElement);
                const bodyElement = document.createElement('div');
                bodyElement.innerHTML = description;
                popupContent.appendChild(bodyElement);

                // Bind the popup to the marker and set the content
                marker.bindPopup(popupContent);

                // Add a click event listener to zoom the map
                marker.on("click", clickZoom);

                // Add the marker to the marker cluster group
                markers.addLayer(marker);
            });

            // Add the marker cluster group to the map after all markers are loaded
            map.addLayer(markers);
        })
        .catch(error => {
            console.error('Error fetching marker data:', error);
        });
}

// Handle map zoom on marker click
function clickZoom(e) {
    const marker = e.target;

    if (!marker.__parent) {
        map.setView(marker.getLatLng(), map.getMaxZoom() + 3);
    }
}

// Call fetchAndLoadMarkers with no filters when the page loads
window.addEventListener('load', () => fetchAndLoadMarkers());

// Handle category dropdown selection
document.addEventListener('DOMContentLoaded', () => {
    const categoryDropdown = document.getElementById('categoryDropdown');
    if (!categoryDropdown) return;

    // Fetch categories and populate dropdown
    fetch('/category')
        .then(response => response.json())
        .then(categories => {
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                categoryDropdown.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching categories:', error));

    // Fetch markers by selected category
    categoryDropdown.addEventListener('change', (event) => {
        const selectedCategory = event.target.value;
        fetchAndLoadMarkers({ category: selectedCategory });
    });
});

