"use client";

import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

type Props = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
};

function PickerEvents({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function BranchLocationPicker({ latitude, longitude, radiusMeters, onChange }: Props) {
  const hasPoint = latitude != null && longitude != null;
  const center: [number, number] = hasPoint ? [latitude!, longitude!] : [24.8607, 67.0011];

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">Tap or click the map to set branch location.</p>
      <div className="overflow-hidden rounded-xl border border-border">
        <MapContainer center={center} zoom={hasPoint ? 16 : 12} className="h-48 w-full min-h-[12rem] sm:h-64">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PickerEvents onChange={onChange} />
          {hasPoint && (
            <Circle
              center={[latitude!, longitude!]}
              radius={radiusMeters}
              pathOptions={{ color: "#d97706", fillColor: "#f59e0b", fillOpacity: 0.2 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

