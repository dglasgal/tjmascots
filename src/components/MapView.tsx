'use client';

import { useEffect, useMemo, useRef } from 'react';
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

  return (
    <MapContainer
      center={[39.5, -98.5]}
      zoom={4}
      className="h-full w-full bg-[var(--cream-dark)]"
      preferCanvas
      scrollWheelZoom
    >
      <TileLayer
        attribution={
          process.env.NEXT_PUBLIC_MAPBOX_TOKEN
            ? '© Mapbox © OpenStreetMap'
            : '© OpenStreetMap contributors © CARTO'
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
    </MapContainer>
  );
}
