(() => {
  if (!window.FoodWise) {
    console.error('FoodWise utilities not loaded');
    return;
  }
  
  // Wait a bit if google.maps isn't ready yet
  if (typeof google === 'undefined' || !google.maps) {
    console.error('Google Maps API not loaded. Please check your API key.');
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.innerHTML = 
        '<div class="p-5 text-center bg-light"><p class="text-danger">Error: Google Maps API failed to load.</p><p class="small text-muted">Please check your API key and ensure "Maps JavaScript API" is enabled in Google Cloud Console.</p></div>';
    }
    return;
  }

  let map;
  let markers = [];
  let ngoMarkers = [];
  let platformMarkers = [];
  let infoWindow = new google.maps.InfoWindow();

  // Default center (New Delhi, India)
  const defaultCenter = { lat: 28.6139, lng: 77.2090 };
  const defaultZoom = 10;

  // Initialize map
  function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    map = new google.maps.Map(mapElement, {
      center: defaultCenter,
      zoom: defaultZoom,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    loadLocations();
    setupEventListeners();
  }

  // Load locations from API
  async function loadLocations() {
    try {
      const data = await window.FoodWise.api('/api/locations');
      updateLocationList(data);
      addMarkers(data);
    } catch (error) {
      window.FoodWise.handleError(error, 'Unable to load locations');
      document.getElementById('locationList').innerHTML = '<p class="text-danger small">Failed to load locations.</p>';
    }
  }

  // Add markers to map
  function addMarkers(data) {
    clearMarkers();

    // NGO markers (green)
    data.ngos.forEach((ngo) => {
      if (ngo.latitude && ngo.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: parseFloat(ngo.latitude), lng: parseFloat(ngo.longitude) },
          map: map,
          title: ngo.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#198754',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          label: {
            text: 'N',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 'bold'
          }
        });

        const content = `
          <div class="p-2">
            <h6 class="fw-bold text-success mb-1">${ngo.name}</h6>
            ${ngo.address ? `<p class="small mb-1"><i class="bi bi-geo-alt"></i> ${ngo.address}</p>` : ''}
            <div class="mt-2">
              <span class="badge bg-success">NGO</span>
            </div>
          </div>
        `;

        marker.addListener('click', () => {
          infoWindow.setContent(content);
          infoWindow.open(map, marker);
        });

        ngoMarkers.push(marker);
        markers.push(marker);
      }
    });

    // Food Platform markers (blue)
    data.platforms.forEach((platform) => {
      if (platform.latitude && platform.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: parseFloat(platform.latitude), lng: parseFloat(platform.longitude) },
          map: map,
          title: platform.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#0d6efd',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          label: {
            text: 'F',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 'bold'
          }
        });

        const content = `
          <div class="p-2">
            <h6 class="fw-bold text-primary mb-1">${platform.name}</h6>
            ${platform.address ? `<p class="small mb-1"><i class="bi bi-geo-alt"></i> ${platform.address}</p>` : ''}
            ${platform.contact ? `<p class="small mb-1"><i class="bi bi-envelope"></i> ${platform.contact}</p>` : ''}
            ${platform.description ? `<p class="small mb-2">${platform.description}</p>` : ''}
            <div class="mt-2">
              <span class="badge bg-primary">Food Platform</span>
            </div>
          </div>
        `;

        marker.addListener('click', () => {
          infoWindow.setContent(content);
          infoWindow.open(map, marker);
        });

        platformMarkers.push(marker);
        markers.push(marker);
      }
    });

    updateMarkerVisibility();
  }

  // Update location list sidebar
  function updateLocationList(data) {
    const listElement = document.getElementById('locationList');
    if (!listElement) return;

    let html = '';

    if (data.ngos.length > 0) {
      html += '<div class="mb-3"><strong class="text-success small">NGOs:</strong>';
      data.ngos.forEach((ngo) => {
        html += `
          <div class="mt-2 p-2 border-start border-success border-3 small" data-type="ngo" data-id="${ngo.id}">
            <strong>${ngo.name}</strong><br>
            <span class="text-muted">${ngo.address || 'No address'}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    if (data.platforms.length > 0) {
      html += '<div><strong class="text-primary small">Food Platforms:</strong>';
      data.platforms.forEach((platform) => {
        html += `
          <div class="mt-2 p-2 border-start border-primary border-3 small" data-type="platform" data-id="${platform.id}">
            <strong>${platform.name}</strong><br>
            <span class="text-muted">${platform.address || 'No address'}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    if (!html) {
      html = '<p class="text-muted small">No locations found.</p>';
    }

    listElement.innerHTML = html;
  }

  // Clear all markers
  function clearMarkers() {
    markers.forEach((marker) => marker.setMap(null));
    markers = [];
    ngoMarkers = [];
    platformMarkers = [];
  }

  // Update marker visibility based on filters
  function updateMarkerVisibility() {
    const showNGOs = document.getElementById('filterNGOs')?.checked ?? true;
    const showPlatforms = document.getElementById('filterPlatforms')?.checked ?? true;

    ngoMarkers.forEach((marker) => {
      marker.setMap(showNGOs ? map : null);
    });

    platformMarkers.forEach((marker) => {
      marker.setMap(showPlatforms ? map : null);
    });
  }

  // Fit bounds to show all markers
  function fitBounds() {
    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    markers.forEach((marker) => {
      if (marker.getMap()) {
        bounds.extend(marker.getPosition());
        hasMarkers = true;
      }
    });

    if (hasMarkers) {
      map.fitBounds(bounds);
      // Add padding and ensure minimum zoom
      const listener = google.maps.event.addListener(map, 'bounds_changed', () => {
        if (map.getZoom() > 15) map.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    } else {
      map.setCenter(defaultCenter);
      map.setZoom(defaultZoom);
    }
  }

  // Get user's current location
  function locateUser() {
    if (!navigator.geolocation) {
      window.FoodWise.notify('Geolocation is not supported by your browser', 'warning');
      return;
    }

    window.FoodWise.notify('Getting your location...', 'info');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // Add user location marker
        const userMarker = new google.maps.Marker({
          position: userLocation,
          map: map,
          title: 'Your Location',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ffc107',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          animation: google.maps.Animation.DROP
        });

        map.setCenter(userLocation);
        map.setZoom(13);
        window.FoodWise.notify('Location found!', 'success');
      },
      (error) => {
        console.error('Geolocation error:', error);
        window.FoodWise.notify('Unable to get your location', 'danger');
      }
    );
  }

  // Setup event listeners
  function setupEventListeners() {
    const filterNGOs = document.getElementById('filterNGOs');
    const filterPlatforms = document.getElementById('filterPlatforms');
    const locateBtn = document.getElementById('locateMe');
    const fitBoundsBtn = document.getElementById('fitBounds');

    filterNGOs?.addEventListener('change', updateMarkerVisibility);
    filterPlatforms?.addEventListener('change', updateMarkerVisibility);
    locateBtn?.addEventListener('click', locateUser);
    fitBoundsBtn?.addEventListener('click', fitBounds);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }
})();

