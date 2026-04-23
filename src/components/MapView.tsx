'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
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

      {unknownStores.map((s) => (
        <Marker
          key={`store-${s.store_number}`}
          position={[s.lat, s.lng]}
          icon={unknownIcon(s)}
          zIndexOffset={0}
          eventHandlers={{ click: () => onStoreClick(s) }}
        >
          <Popup>
            <div className="text-sm font-extrabold text-[var(--tj-red)]">
              TJ&apos;s {s.city}
            </div>
            <div className="text-xs font-semibold text-[var(--ink-soft)]">
              {s.street}
              <br />
              Mascot unknown — tap to submit
            </div>
          </Popup>
        </Marker>
      ))}

      {mascots.map((m) => (
        <Marker
          key={`mascot-${m.id}`}
          position={[m.lat, m.lng]}
          icon={mascotIcon(m)}
          zIndexOffset={500}
          eventHandlers={{ click: () => onMascotClick(m) }}
        >
          <Popup>
            <div className="font-display text-base font-extrabold text-[var(--tj-red)]">
              {m.name || m.animal}
            </div>
            <div className="text-xs font-semibold text-[var(--ink-soft)]">
              {m.store}
              {m.state ? `, ${m.state}` : ''}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
