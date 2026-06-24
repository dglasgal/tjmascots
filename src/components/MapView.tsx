'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { Mascot, Store } from '@/lib/types';

interface MapViewProps {
  mascots: Mascot[];
  stores: Store[];
  onMascotClick: (m: Mascot) => void;
  onStoreClick: (s: Store) => void;
  flyTo: { lat: number; lng: number; zoom?: number } | null;
}

function MapFlyer({ target }: { target: MapViewProps['flyTo'] }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom ?? 13, { duration: 0.9 });
  }, [target, map]);
  return null;
}

function mascotIcon(m: Mascot) {
  const cls = m.has_photo ? '' : 'no-photo';
  return L.divIcon({
    className: '',
    html: `<div class="mascot-pin ${cls}" title="${escapeAttr((m.name || m.animal) + ' — ' + m.store)}">${m.emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
}

function unknownIcon(s: Store) {
  return L.divIcon({
    className: '',
    html: `<div class="unknown-pin" title="TJ's ${escapeAttr(s.city)}, ${s.state}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function escapeAttr(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function mapTileUrl() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (token) {
    const style = process.env.NEXT_PUBLIC_MAPBOX_STYLE || 'mapbox/light-v11';
    return `https://api.mapbox.com/styles/v1/${style}/tiles/{z}/{x}/{y}@2x?access_token=${token}`;
  }
  return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
}

/**
 * Clustered markers layer — adds both mascot and unknown-store markers
 * into a single leaflet.markercluster group. Cluster bubbles are styled
 * to reflect the dominant pin type (mostly mascots = red, mostly
 * unknowns = soft accent, mixed = split). Stops clustering at city
 * zoom (>= 11) so individual pins always show when you zoom in.
 *
 * We do this imperatively (vs declarative <Marker>) because
 * leaflet.markercluster is a vanilla-Leaflet plugin and pre-dates
 * react-leaflet's component model. It's still cleaner than wrapping
 * a fragile third-party React adapter.
 */
function ClusteredMarkers({
  mascots,
  unknownStores,
  onMascotClick,
  onStoreClick,
}: {
  mascots: Mascot[];
  unknownStores: Store[];
  onMascotClick: (m: Mascot) => void;
  onStoreClick: (s: Store) => void;
}) {
  const map = useMap();
  // Track click handlers in a ref so we don't have to rebuild the whole
  // cluster group every time the parent re-renders with new closures.
  const handlersRef = useRef({ onMascotClick, onStoreClick });
  handlersRef.current = { onMascotClick, onStoreClick };

  useEffect(() => {
    // The plugin attaches L.markerClusterGroup at runtime; the type
    // declarations cover it but we need to assert through `unknown` to
    // satisfy the strict overload checker.
    const ClusterCtor = (L as unknown as {
      markerClusterGroup: (opts?: L.MarkerClusterGroupOptions) => L.MarkerClusterGroup;
    }).markerClusterGroup;

    const cluster = ClusterCtor({
      maxClusterRadius: 55,
      // Once you're zoomed past city level (11), show every pin individually
      // so dense neighborhoods are still browsable.
      disableClusteringAtZoom: 11,
      // When several pins share the *exact* same coordinates (e.g. Frank
      // and Steve at Hoboken #611), spider them out radially on click.
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (c) => {
        // Decide the cluster's flavor based on what's inside.
        let mascotCount = 0;
        let unknownCount = 0;
        for (const m of c.getAllChildMarkers()) {
          if ((m.options as { _kind?: string })._kind === 'mascot') mascotCount++;
          else unknownCount++;
        }
        const total = mascotCount + unknownCount;
        const flavor =
          mascotCount === 0
            ? 'mostly-unknown'
            : unknownCount === 0
              ? 'mostly-mascots'
              : mascotCount >= unknownCount * 2
                ? 'mostly-mascots'
                : unknownCount >= mascotCount * 2
                  ? 'mostly-unknown'
                  : 'mixed';
        const size =
          total < 10 ? 'size-small' : total < 50 ? 'size-medium' : total < 200 ? 'size-large' : 'size-xlarge';
        return L.divIcon({
          className: '',
          html: `<div class="tj-cluster ${flavor} ${size}">${total}</div>`,
          iconSize: [44, 44],
        });
      },
    });

    // Mascot markers — louder pins, higher z-index.
    for (const m of mascots) {
      const marker = L.marker([m.lat, m.lng], {
        icon: mascotIcon(m),
        zIndexOffset: 500,
        // Stash the kind on the options so the cluster icon factory can
        // read it without a lookup back into our React arrays.
        ...({ _kind: 'mascot' } as L.MarkerOptions),
      });
      marker.on('click', () => handlersRef.current.onMascotClick(m));
      cluster.addLayer(marker);
    }

    // Unknown-store markers — small, quieter pins.
    for (const s of unknownStores) {
      const marker = L.marker([s.lat, s.lng], {
        icon: unknownIcon(s),
        zIndexOffset: 0,
        ...({ _kind: 'unknown' } as L.MarkerOptions),
      });
      marker.on('click', () => handlersRef.current.onStoreClick(s));
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, mascots, unknownStores]);

  return null;
}

/**
 * UserLocationLayer — renders the blue "you are here" dot when the
 * geolocation lookup succeeds, and flies the map to that location at
 * neighborhood-level zoom (14). The dot persists across navigation so
 * the user can pan around and still see where they started.
 */
function UserLocationLayer({
  location,
}: {
  location: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    // Tear down any previous "you are here" marker before placing a new one
    // (e.g. user taps the button again from a different spot).
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (!location) return;

    const icon = L.divIcon({
      className: '',
      html: '<div class="user-location-pin"><div class="user-location-dot"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const marker = L.marker([location.lat, location.lng], {
      icon,
      // Sit above mascot pins (which use zIndexOffset 500) so the user dot
      // is never hidden in dense clusters.
      zIndexOffset: 1500,
      interactive: false,
      keyboard: false,
    });
    marker.addTo(map);
    markerRef.current = marker;

    map.flyTo([location.lat, location.lng], 14, { duration: 1.2 });

    return () => {
      marker.remove();
      if (markerRef.current === marker) markerRef.current = null;
    };
  }, [location, map]);

  return null;
}

export default function MapView({
  mascots,
  stores,
  onMascotClick,
  onStoreClick,
  flyTo,
}: MapViewProps) {
  const mascotStoreNums = useMemo(
    () => new Set(mascots.map((m) => m.store_number).filter(Boolean)),
    [mascots],
  );
  const unknownStores = useMemo(
    () => stores.filter((s) => !mascotStoreNums.has(s.store_number)),
    [stores, mascotStoreNums],
  );

  // Geolocation state — kept here (not in a child) so the button can read
  // "locating" / "error" and update its label, while UserLocationLayer
  // consumes only the successful coords.
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const handleLocate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocError("Your browser doesn't support location lookup.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        if (err.code === 1) {
          setLocError('Location permission denied. Enable it in your browser settings to use this.');
        } else if (err.code === 3) {
          setLocError('Location lookup timed out. Try again?');
        } else {
          setLocError("Couldn't find your location. Try again?");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  };

  // Auto-dismiss the error toast after 5 seconds so it doesn't linger.
  useEffect(() => {
    if (!locError) return;
    const t = setTimeout(() => setLocError(null), 5000);
    return () => clearTimeout(t);
  }, [locError]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[39.5, -98.5]}
        zoom={4}
        className="h-full w-full bg-[var(--cream-dark)]"
        preferCanvas
        scrollWheelZoom
      >
        <TileLayer
          attribution={
            (process.env.NEXT_PUBLIC_MAPBOX_TOKEN
              ? '© Mapbox © OpenStreetMap'
              : '© OpenStreetMap contributors © CARTO') +
            ' · <a href="/complaints">Complaints</a>'
          }
          url={mapTileUrl()}
          subdomains={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? [] : ['a', 'b', 'c', 'd']}
          maxZoom={19}
          tileSize={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? 512 : 256}
          zoomOffset={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? -1 : 0}
        />
        <MapFlyer target={flyTo} />
        <ClusteredMarkers
          mascots={mascots}
          unknownStores={unknownStores}
          onMascotClick={onMascotClick}
          onStoreClick={onStoreClick}
        />
        <UserLocationLayer location={userLoc} />
      </MapContainer>

      {/* Find-me button.
            Mobile: bottom-right, thumb reach. Compact label "Near me".
            Desktop (sm+): top-center, larger and bolder so it's the first
            thing you see on the map. z-[1000] sits above Leaflet's panes
            without fighting popups (z 700). */}
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        aria-label="Find mascots near me"
        className="find-me-btn absolute bottom-5 right-3 z-[1000] flex items-center gap-2 rounded-full bg-[var(--tj-red)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 ring-2 ring-white/70 transition hover:brightness-110 active:scale-95 disabled:opacity-70 sm:bottom-auto sm:right-auto sm:left-1/2 sm:top-5 sm:-translate-x-1/2 sm:gap-3 sm:px-7 sm:py-4 sm:text-base sm:font-bold sm:shadow-xl sm:ring-4"
      >
        {locating ? (
          <>
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white sm:h-5 sm:w-5"
              aria-hidden="true"
            />
            Finding you…
          </>
        ) : (
          <>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
            </svg>
            <span className="hidden sm:inline">Find mascots near me</span>
            <span className="sm:hidden">Near me</span>
          </>
        )}
      </button>

      {locError && (
        <div
          role="status"
          className="absolute bottom-20 left-1/2 z-[1000] -translate-x-1/2 rounded-lg bg-black/85 px-4 py-2 text-center text-sm text-white shadow-lg sm:bottom-auto sm:top-24"
        >
          {locError}
        </div>
      )}
    </div>
  );
}
