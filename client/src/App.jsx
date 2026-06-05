import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';

function MapUpdater({ userPosition, isNavigating }) {
  const map = useMap();
  useEffect(() => {
    if (isNavigating && userPosition) {
      map.flyTo(userPosition, 16, { animate: true });
    }
  }, [userPosition, isNavigating, map]);
  return null;
}
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet's default marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// A simple SVG arrow pointing up
const navIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23007bff" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpolygon points="12 2 19 21 12 17 5 21 12 2"%3E%3C/polygon%3E%3C/svg%3E',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const API_URL = 'http://localhost:5000/api/pitstops/predict';

const LOCATION_ALIASES = {
  "vjw": "Vijayawada, Andhra Pradesh, India",
  "hyd": "Hyderabad, Telangana, India",
  "vskp": "Visakhapatnam, Andhra Pradesh, India",
  "blr": "Bengaluru, Karnataka, India",
  "del": "Delhi, India",
  "bom": "Mumbai, Maharashtra, India",
  "nyc": "New York City, USA",
  "lax": "Los Angeles, USA",
  "lon": "London, UK"
};

const BENTO_ITEMS = [
  { key: 'food',   emoji: '🍔', label: 'Food',   sub: 'Restaurants & cafes',   className: 'bento-food' },
  { key: 'fuel',   emoji: '⛽', label: 'Fuel',   sub: 'Gas & charging',        className: 'bento-fuel' },
  { key: 'rest',   emoji: '☕', label: 'Rest',   sub: 'Breaks & rest stops',   className: 'bento-rest' },
  { key: 'scenic', emoji: '📸', label: 'Scenic', sub: 'Views & photo spots',   className: 'bento-scenic' },
];

const PREF_EMOJI = { food: '🍔', fuel: '⛽', rest: '☕', scenic: '📸' };
const PREF_ICON_CLASS = { food: 'food-icon', fuel: 'fuel-icon', rest: 'rest-icon', scenic: 'scenic-icon' };

const dropdownStyle = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  backgroundColor: '#fff',
  borderRadius: '8px',
  boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
  zIndex: 1000,
  maxHeight: '200px',
  overflowY: 'auto',
  marginTop: '8px',
  border: '1px solid #f0f0f0'
};

const dropdownItemStyle = {
  padding: '12px 16px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: '#333',
  borderBottom: '1px solid #f9f9f9',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  transition: 'background-color 0.2s'
};

export default function App() {
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [startCoords, setStartCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [totalDuration, setTotalDuration] = useState(0);
  
  const [selectedPreference, setSelectedPreference] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [predictionMeta, setPredictionMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [isRouteActive, setIsRouteActive] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);

  const [liveLocation, setLiveLocation] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [watchId, setWatchId] = useState(null); // Stores the GPS connection ID

  // 📍 GET CURRENT LIVE LOCATION
  const useMyLiveLocation = () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support GPS location.");
      return;
    }

    // Temporarily show loading text in your input box
    setStartLocation("Locating you...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // 1. Instantly move the map to your real location
        setLiveLocation([latitude, longitude]); 
        setStartCoords([latitude, longitude]); // Ensure routing engine knows where we are

        // 2. Reverse-Geocode: Turn the GPS coordinates into a real city name
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          
          // Grab the city, town, or neighborhood name
          const locationName = data.address.city || data.address.town || data.address.suburb || data.display_name || "My Current Location";
          
          // Update your Start Location input box state here!
          setStartLocation(locationName); 
          
          alert(`Location found: ${locationName}`);
          
        } catch (error) {
          console.error("Geocoding failed:", error);
          // If internet fails, just use the raw coordinates
          setStartLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      (error) => {
        console.error("GPS Error:", error);
        alert("Could not get your location. Please make sure location permissions are turned on in your browser!");
        setStartLocation("");
      },
      { enableHighAccuracy: true } // Force it to use the actual GPS chip
    );
  };

  // 🌍 TRUE GPS TRACKING (Only moves when you move)
  const startNavigation = () => {
    if (!navigator.geolocation) {
      alert("Your device doesn't support GPS tracking.");
      return;
    }

    setIsNavigating(true);

    // watchPosition locks onto the hardware GPS and ONLY fires when you physically move
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log("Real movement detected:", latitude, longitude);
        setLiveLocation([latitude, longitude]);
      },
      (error) => {
        console.error("GPS Error:", error.message);
        alert("Make sure your browser has location permissions turned on!");
      },
      {
        enableHighAccuracy: true, // Forces the phone to use the actual GPS chip, not just Wi-Fi guessing
        maximumAge: 0,            // Never use old, cached locations
        timeout: 10000            // Give it 10 seconds to find the satellites
      }
    );

    setWatchId(id); // Save the ID so we can turn it off later
  };

  // 🛑 STOP TRACKING
  const stopNavigation = () => {
    setIsNavigating(false);
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId); // Disconnects the GPS to save battery
      setWatchId(null);
    }
  };

  // 📲 SAFESHARE: Send Location via WhatsApp
  const shareLocationWhatsApp = () => {
    // Check if we actually have a location yet
    if (!liveLocation) {
      alert("Please 'Start Navigation' first so we can pinpoint your location!");
      return;
    }

    // 1. Create a Google Maps link using your exact coordinates
    const googleMapsLink = `https://www.google.com/maps?q=${liveLocation[0]},${liveLocation[1]}`;
    
    // 2. Draft the emergency/update message
    const message = `Hey! I'm currently on a highway drive. Here is my exact live location: ${googleMapsLink}`;
    
    // 3. Format it for the WhatsApp API
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    // 4. Open WhatsApp (Works on mobile app AND desktop web!)
    window.open(whatsappUrl, '_blank');
  };

  const getClosestPointIndex = (coords, pos) => {
    if (!pos) return 0;
    let minDist = Infinity;
    let minIndex = 0;
    coords.forEach((c, i) => {
      const d = Math.pow(c[0] - pos[0], 2) + Math.pow(c[1] - pos[1], 2);
      if (d < minDist) {
        minDist = d;
        minIndex = i;
      }
    });
    return minIndex;
  };

  const fetchLocationSuggestions = async (query, setSuggestions) => {
    const cleanInput = query.toLowerCase().trim();
    const aliasMatch = LOCATION_ALIASES[cleanInput];

    if (!aliasMatch && query.length < 3) {
      setSuggestions([]);
      return;
    }

    const searchQuery = aliasMatch ? aliasMatch : query;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      console.error("Nominatim fetch failed", err);
    }
  };

  const handleStartChange = (e) => {
    const val = e.target.value;
    setStartLocation(val);
    setStartCoords(null);
    fetchLocationSuggestions(val, setStartSuggestions);
  };

  const handleDestChange = (e) => {
    const val = e.target.value;
    setDestination(val);
    setDestCoords(null);
    fetchLocationSuggestions(val, setDestSuggestions);
  };

  const selectStart = (suggestion) => {
    setStartLocation(suggestion.display_name);
    setStartCoords([parseFloat(suggestion.lat), parseFloat(suggestion.lon)]);
    setStartSuggestions([]);
  };

  const selectDest = (suggestion) => {
    setDestination(suggestion.display_name);
    setDestCoords([parseFloat(suggestion.lat), parseFloat(suggestion.lon)]);
    setDestSuggestions([]);
  };

  const handleSearchRoute = async (e) => {
    if (e) e.preventDefault();
    if (!startCoords || !destCoords) {
      alert("Please select valid Start and Destination locations from the dropdown suggestions!");
      return;
    }
    
    setIsRouting(true);
    setIsRouteActive(false);
    setRecommendations([]);
    setSelectedPreference(null);
    setPredictionMeta(null);
    setExpandedCardId(null);

    try {
      const startLng = startCoords[1], startLat = startCoords[0];
      const endLng = destCoords[1], endLat = destCoords[0];

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl);
      const data = await res.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setTotalDuration(Math.round(route.duration / 60));
        const rawCoords = route.geometry.coordinates;
        const leafletCoords = rawCoords.map(coord => [coord[1], coord[0]]);
        setRouteCoordinates(leafletCoords);
        setIsRouteActive(true);
      } else {
        alert("Could not calculate route via OSRM.");
      }
    } catch (error) {
      console.error("OSRM fetch failed:", error);
      alert("Failed to fetch route. Please try again.");
    } finally {
      setIsRouting(false);
    }
  };

  const handlePredictiveStop = async (preference, e) => {
    if (e) e.preventDefault();

    if (routeCoordinates.length === 0) {
      alert("Please calculate the route first using 'Plan Route'!");
      return;
    }

    setSelectedPreference(preference);
    setIsLoading(true);
    setRecommendations([]);
    setPredictionMeta(null);
    setExpandedCardId(null);

    console.log("1. FRONTEND: Button clicked:", preference);
    console.log("2. FRONTEND: Sending route coordinates length:", routeCoordinates.length);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeCoordinates: routeCoordinates,
          totalDurationMinutes: totalDuration || 180,
          departureTime: departureTime || '10:00',
          preference: preference
        })
      });

      const data = await response.json();
      console.log("3. FRONTEND: Received backend data:", data);
      
      if (data && data.predictionMeta) {
        setPredictionMeta(data.predictionMeta);
      }
      
      if (data && data.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error("FRONTEND FETCH ERROR:", error);
      alert("Error calculating optimal stop.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      {!isNavigating && (
        <>
          {/* ───── Header ───── */}
          <header className="app-header">
        <div className="brand">
          <div className="brand-icon">📍</div>
          <div className="brand-text">
            <h1>SmartStops</h1>
            <span>Predictive Route Planning</span>
          </div>
        </div>
        <div className="header-badge">
          <div className="dot" />
          OSRM Routing Active
        </div>
      </header>

      {/* ───── Input Bar ───── */}
      <div className="input-bar">
        <div className="input-group" style={{ position: 'relative' }}>
          <label htmlFor="start">Start Location</label>
          <input
            id="start"
            type="text"
            placeholder="e.g. Vijayawada"
            value={startLocation}
            onChange={handleStartChange}
            autoComplete="off"
          />
          <button 
            onClick={useMyLiveLocation}
            style={{
              backgroundColor: '#ff4757', // A nice bold color to stand out
              color: 'white',
              padding: '8px 15px',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem',
              marginTop: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            📍 Use My Current Location
          </button>
          {startSuggestions.length > 0 && (
            <div style={dropdownStyle}>
              {startSuggestions.map((s, i) => (
                <div 
                  key={i} 
                  style={dropdownItemStyle} 
                  onClick={() => selectStart(s)}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#f4f4f4'}
                  onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="input-group" style={{ position: 'relative' }}>
          <label htmlFor="dest">Destination</label>
          <input
            id="dest"
            type="text"
            placeholder="e.g. Hyderabad"
            value={destination}
            onChange={handleDestChange}
            autoComplete="off"
          />
          {destSuggestions.length > 0 && (
            <div style={dropdownStyle}>
              {destSuggestions.map((s, i) => (
                <div 
                  key={i} 
                  style={dropdownItemStyle} 
                  onClick={() => selectDest(s)}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#f4f4f4'}
                  onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="input-group">
          <label htmlFor="time">Departure Time</label>
          <input
            id="time"
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-plan"
            onClick={handleSearchRoute}
            disabled={isRouting}
            style={{ opacity: isRouting ? 0.7 : 1, cursor: isRouting ? 'not-allowed' : 'pointer' }}
          >
            {isRouting ? 'Routing...' : 'Plan Route'}
          </button>
          {isRouteActive && (
            <>
            <button
              onClick={isNavigating ? stopNavigation : startNavigation}
              style={{
                backgroundColor: '#FF385C',
                color: '#fff',
                border: 'none',
                padding: '0 24px',
                borderRadius: '24px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(255, 56, 92, 0.3)',
                animation: 'fadeInUp 0.4s ease-out forwards',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap'
              }}
            >
              {isNavigating ? "🛑 Stop Navigation" : "🧭 Start Navigation"}
            </button>
            <button 
              onClick={shareLocationWhatsApp}
              style={{
                backgroundColor: '#25D366', // Official WhatsApp Green
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginLeft: '10px'
              }}
            >
              💬 Share Location
            </button>
            </>
          )}
        </div>
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        
      </div>
        </>
      )}

      {isNavigating && (
        <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }}>
          <button onClick={stopNavigation} style={{ padding: '12px 24px', backgroundColor: '#FF385C', color: 'white', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            Exit Navigation
          </button>
        </div>
      )}

      {/* ───── Map ───── */}
      <div className="map-container" style={isNavigating ? { height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, zIndex: 500 } : {}}>
        <MapContainer 
          center={[16.98, 79.98]} 
          zoom={7} 
          style={{ width: '100%', height: '100%', zIndex: 0 }}
        >
          <MapUpdater userPosition={liveLocation} isNavigating={isNavigating} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {routeCoordinates.length > 0 && !isNavigating && (
            <Polyline positions={routeCoordinates} color="blue" weight={4} />
          )}
          {routeCoordinates.length > 0 && isNavigating && (
            <>
              <Polyline positions={routeCoordinates.slice(0, getClosestPointIndex(routeCoordinates, liveLocation) + 1)} color="gray" weight={4} />
              <Polyline positions={routeCoordinates.slice(getClosestPointIndex(routeCoordinates, liveLocation))} color="#0066FF" weight={6} />
            </>
          )}
          {/* Only show this marker if navigation has started */}
          {isNavigating && liveLocation && (
            <Marker position={liveLocation} icon={navIcon}>
              <Popup>You are here!</Popup>
            </Marker>
          )}
          {recommendations.map((rec, idx) => (
            <Marker key={idx} position={rec.coordinates} />
          ))}
        </MapContainer>
      </div>

      {!isNavigating && (
        <>
          {/* ───── Bento Grid ───── */}
      <p className="section-heading">What do you need?</p>
      <div className="bento-grid">
        {BENTO_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`bento-card ${item.className}${selectedPreference === item.key ? ' active' : ''}`}
            onClick={(e) => !isLoading && handlePredictiveStop(item.key, e)}
            disabled={isLoading || isRouting}
            style={{ 
              opacity: (isLoading || isRouting) && selectedPreference !== item.key ? 0.6 : 1,
              cursor: (isLoading || isRouting) ? 'not-allowed' : 'pointer',
              border: 'none',
              textAlign: 'left',
              fontFamily: 'inherit',
              color: 'inherit'
            }}
          >
            <span className="bento-emoji">{item.emoji}</span>
            <span className="bento-label">{item.label}</span>
            <span className="bento-sub">{item.sub}</span>
            <span className="bento-corner">{item.emoji}</span>
          </button>
        ))}
      </div>

      {/* ───── Results ───── */}
      <div className="recs-section">
        <p className="section-heading">Recommendations</p>

        {/* Loading state */}
        {isLoading && (
          <div className="loading-bar">
            <div className="loading-dots">
              <div /><div /><div />
            </div>
            <span>Analyzing route and finding best stops…</span>
          </div>
        )}

        {/* Prediction meta strip - BULLETPROOF VERSION */}
        {predictionMeta && !isLoading && (
          <div className="prediction-meta" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
              🤖 {predictionMeta.message || "Optimal pitstops calculated near route midpoint."}
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="meta-chip">
                📊 Stop at <span className="meta-val">&nbsp;{((predictionMeta.percentage || 0.5) * 100).toFixed(0)}%</span>&nbsp;of route
              </div>
              <div className="meta-chip">
                📌 Coordinates&nbsp;
                <span className="meta-val">
                  {predictionMeta.coordinates && predictionMeta.coordinates.length >= 2 
                    ? `${predictionMeta.coordinates[0].toFixed(4)}, ${predictionMeta.coordinates[1].toFixed(4)}` 
                    : "Route Midpoint"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && recommendations.length === 0 && !isRouting && (
          <div className="recs-empty">
            <div className="recs-empty-icon">🔍</div>
            <div className="recs-empty-text">No recommendations yet</div>
            <div className="recs-empty-sub">Plan a route and select a category above to find the perfect pitstop</div>
          </div>
        )}

        {/* Results grid */}
        {!isLoading && recommendations.length > 0 && (
          <div className="recs-grid">
            {recommendations.map((rec, i) => (
              <div 
                className="rec-card" 
                key={i}
                onClick={() => setExpandedCardId(expandedCardId === i ? null : i)}
                style={{ cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column' }}
              >
                <div className="rec-card-accent" />
                <div className="rec-card-header" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={`rec-card-icon ${PREF_ICON_CLASS[selectedPreference] || 'food-icon'}`}>
                      {PREF_EMOJI[selectedPreference] || '📍'}
                    </div>
                    <div className="rec-card-name" style={{ paddingRight: rec.smartScore ? '80px' : '0' }}>
                      {rec.name}
                    </div>
                  </div>
                  {rec.smartScore && (
                    <div style={{
                      position: 'absolute',
                      right: '0',
                      top: '0',
                      background: 'rgba(255, 184, 0, 0.15)',
                      color: '#D49000',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ⭐ {rec.smartScore} Match
                    </div>
                  )}
                </div>
                <div className="rec-card-address">{rec.address}</div>
                <div className="rec-card-footer" style={{ borderBottom: expandedCardId === i ? '1px solid #f0f0f0' : 'none', paddingBottom: expandedCardId === i ? '12px' : '0' }}>
                  <div className="rec-card-distance">
                    📏 {rec.distance}
                  </div>
                  <div className="rec-card-rating" style={{ fontSize: '0.8rem', color: '#888' }}>
                    {expandedCardId === i ? '▲ Less info' : '▼ More info'}
                  </div>
                </div>

                {/* Expanded Details Section */}
                {expandedCardId === i && (
                  <div style={{ 
                    marginTop: '12px', 
                    paddingTop: '4px',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    fontSize: '0.85rem',
                    color: '#555',
                    animation: 'fadeIn 0.3s ease-out'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '1rem' }}>🕒</span>
                      <span><strong>Hours:</strong> {rec.openingHours || 'Hours unavailable'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '1rem' }}>🍽️</span>
                      <span><strong>Type:</strong> {rec.cuisine || 'Local/Mixed'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '1rem' }}>📞</span>
                      <span><strong>Contact:</strong> {rec.phone || 'No phone listed'}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
