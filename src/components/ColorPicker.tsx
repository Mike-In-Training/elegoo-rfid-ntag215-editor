import { useState, useEffect } from 'react';
import { PhotoColorPicker } from './PhotoColorPicker';

interface ColorPickerProps {
  value: { r: number; g: number; b: number };
  onChange: (color: { r: number; g: number; b: number }) => void;
  onStatusUpdate?: (message: string) => void;
}

export function ColorPicker({ value, onChange, onStatusUpdate }: ColorPickerProps) {
  const hexColor = `#${value.r.toString(16).padStart(2, '0')}${value.g.toString(16).padStart(2, '0')}${value.b.toString(16).padStart(2, '0')}`;
  const [hexInput, setHexInput] = useState(hexColor.toUpperCase());
  const [rgbInput, setRgbInput] = useState({ r: String(value.r), g: String(value.g), b: String(value.b) });

  // Update local input when parent value changes (e.g., from color picker)
  useEffect(() => {
    setHexInput(hexColor.toUpperCase());
  }, [hexColor]);

  useEffect(() => {
    setRgbInput({ r: String(value.r), g: String(value.g), b: String(value.b) });
  }, [value.r, value.g, value.b]);

  const handleRgbChange = (channel: 'r' | 'g' | 'b', input: string) => {
    setRgbInput((previous) => ({ ...previous, [channel]: input }));
    const number = Number(input);
    if (/^\d{1,3}$/.test(input) && number <= 255) {
      onChange({ ...value, [channel]: number });
    }
  };

  const handleHexChange = (hex: string) => {
    // Allow user to type freely
    setHexInput(hex.toUpperCase());

    // Only update parent when we have a valid 6-character hex code
    const cleaned = hex.replace('#', '');
    if (cleaned.length === 6 && /^[0-9A-Fa-f]{6}$/.test(cleaned)) {
      const r = parseInt(cleaned.substring(0, 2), 16);
      const g = parseInt(cleaned.substring(2, 4), 16);
      const b = parseInt(cleaned.substring(4, 6), 16);
      onChange({ r, g, b });
    }
  };

  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1">
        Filament Color
      </label>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="color"
          aria-label="Choose filament color"
          value={hexColor}
          onChange={(e) => handleHexChange(e.target.value)}
          className="w-16 h-8 rounded-md cursor-pointer border-2 border-gray-300"
        />
        <input
          type="text"
          aria-label="Hex color"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#FF0000"
          className="flex-1 min-w-[100px] px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-elegoo-orange focus:border-transparent font-mono uppercase"
          maxLength={7}
        />
        <div className="flex gap-2 text-[11px] text-gray-500">
          {(['r', 'g', 'b'] as const).map((channel) => (
            <label key={channel} className="flex items-center gap-1">
              {channel.toUpperCase()}
              <input
                type="number"
                aria-label={`${channel.toUpperCase()} color value`}
                min={0}
                max={255}
                step={1}
                inputMode="numeric"
                value={rgbInput[channel]}
                onChange={(event) => handleRgbChange(channel, event.target.value)}
                onBlur={() => setRgbInput((previous) => ({ ...previous, [channel]: String(value[channel]) }))}
                className="w-16 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-elegoo-orange focus:border-transparent font-mono text-gray-700"
              />
            </label>
          ))}
        </div>
      </div>
      <PhotoColorPicker onChange={onChange} onStatusUpdate={onStatusUpdate} />
    </div>
  );
}



