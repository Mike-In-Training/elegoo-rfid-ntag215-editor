import { SpoolmanCatalog, type CatalogFilament } from './components/SpoolmanCatalog';
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ElegooSpool, MAX_LABEL_BYTES } from './lib/ElegooSpool';
import { getSubtypesForMaterial, fuzzyMatchSubtype } from './lib/materials';
import { FileUpload } from './components/FileUpload';
import { MaterialSelector } from './components/MaterialSelector';
import { SubtypeSelector } from './components/SubtypeSelector';
import { ColorPicker } from './components/ColorPicker';
import { ColorCatalogs, type CatalogColorSelection } from './components/ColorCatalogs';
import { SpoolLibrary } from './components/SpoolLibrary';
import type { SavedSpool } from './lib/spoolLibrary';
import { SpoolLabelSettings, formatSpoolLabel, readLabelFormat } from './components/SpoolLabelSettings';
import { MetadataFields } from './components/MetadataFields';
import { ExportButtons } from './components/ExportButtons';
import { Header } from './components/Header';
import { ActivityLog } from './components/ActivityLog';
import { HexEditor } from './components/HexEditor';
import { NfcReaderWriter, isWebNfcSupported } from './components/NfcReaderWriter';

function App() {
  const [spool, setSpool] = useState<ElegooSpool | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [log, setLog] = useState<string[]>(['Ready - No file loaded']);
  const [showHexEditor, setShowHexEditor] = useState(false);
  const [savedSpoolId, setSavedSpoolId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const [labelFormat, setLabelFormat] = useState(readLabelFormat);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [nfcSupported] = useState(() => isWebNfcSupported());
  const label = labelDraft ?? spool?.label ?? '';
  const labelBytes = new TextEncoder().encode(label).length;
  const labelIssue = labelBytes > MAX_LABEL_BYTES
    ? `Shorten the spool label by ${labelBytes - MAX_LABEL_BYTES} UTF-8 bytes before saving or writing.`
    : !label.trim() ? 'Enter a spool label before saving or writing.' : undefined;

  const applyLabel = (next: ElegooSpool, value: string) => {
    setLabelDraft(value);
    // Overlong text remains a draft. Never serialize a truncated or old label.
    next.label = new TextEncoder().encode(value).length <= MAX_LABEL_BYTES ? value : '';
  };

  const addLog = (message: string) => {
    setLog((prev) => [...prev, message]);
  };

  // Generate default filename based on subtype and color
  const generateDefaultFileName = (spoolData: ElegooSpool): string => {
    const subtype = spoolData.subtype;
    const color = spoolData.color;
    const hexColor = `${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`.toUpperCase();
    return `${subtype}_${hexColor}.bin`;
  };

  // Initialize with empty spool on first load
  useEffect(() => {
    const newSpool = new ElegooSpool();
    setSpool(newSpool);
    addLog('Ready - Choose a catalog or enter spool settings');
  }, []);

  const handleFileLoad = (file: File, data: Uint8Array) => {
    setLabelDraft(null);
    setSavedSpoolId(null);
    const newSpool = new ElegooSpool(data);
    setSpool(newSpool);
    setFileName(file.name.replace('.bin', ''));
    addLog(`Loaded: ${file.name} (${data.length} bytes)`);
  };

  const handleGenerateNew = () => {
    setLabelDraft(null);
    setSavedSpoolId(null);
    const newSpool = new ElegooSpool();
    newSpool.generateNewIdentity();
    setSpool(newSpool);
    setFileName(generateDefaultFileName(newSpool).replace('.bin', ''));
    addLog('Generated new tag with random UID');
  };

  const handleSave = () => {
    if (!spool || labelIssue) return;

    const blob = spool.toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const saveName = fileName ? `${fileName}.bin` : generateDefaultFileName(spool);
    a.download = saveName;
    a.click();
    URL.revokeObjectURL(url);

    addLog(`Saved: ${saveName} (180 bytes)`);
  };

  const handleMaterialChange = (material: string) => {
    if (!spool) return;
    spool.material = material;

    // Set subtype to the base material type (first in the family)
    // This ensures the subtype code matches the new material family
    const subtypes = getSubtypesForMaterial(material);
    if (subtypes.length > 0) {
      spool.subtype = subtypes[0];
    }

    const newSpool = new ElegooSpool(spool.getRawData());
    setSpool(newSpool);
    setFileName(generateDefaultFileName(newSpool).replace('.bin', ''));
  };

  const handleSubtypeChange = (subtype: string) => {
    if (!spool) return;
    spool.subtype = subtype;
    const newSpool = new ElegooSpool(spool.getRawData());
    setSpool(newSpool);
    setFileName(generateDefaultFileName(newSpool).replace('.bin', ''));
  };

  const handleColorChange = (color: { r: number; g: number; b: number }) => {
    if (!spool) return;
    spool.color = color;
    const newSpool = new ElegooSpool(spool.getRawData());
    setSpool(newSpool);
    setFileName(generateDefaultFileName(newSpool).replace('.bin', ''));
  };

  const handleCatalogSelect = ({ manufacturer, material, color }: CatalogColorSelection) => {
    if (!spool) return;
    setSavedSpoolId(null);
    const next = new ElegooSpool(spool.getRawData());

    // Fuzzy-match catalog name to system subtype (handles word order, synonyms, etc.)
    const match = fuzzyMatchSubtype(material);
    if (match) {
      next.material = match.material;
      next.subtype = match.subtype;
    }
    const hex = color.hex.replace(/^#/, '');
    next.color = { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
    applyLabel(next, formatSpoolLabel(labelFormat, { Brand: manufacturer, Filament: material, Color: color.name }));
    setSpool(next);
    setFileName(generateDefaultFileName(next).replace('.bin', ''));
  };

  const handleSpoolmanSelect = (entry: CatalogFilament) => {
    if (!spool) return;
    setSavedSpoolId(null);
    const next = new ElegooSpool(spool.getRawData());
    const material = entry.material.toUpperCase();
    const match = fuzzyMatchSubtype(`${material} ${entry.finish ?? ''}`.trim());
    if (match?.material === material) {
      next.material = match.material;
      next.subtype = match.subtype;
    } else {
      const baseSubtype = getSubtypesForMaterial(material)[0];
      if (baseSubtype) {
        next.material = material;
        next.subtype = baseSubtype;
      } else {
        addLog(`Unsupported Canvas material: ${entry.material}. Select a compatible material manually.`);
      }
    }

    const hex = (entry.color_hex ?? entry.color_hexes?.[0])?.replace(/^#/, '');
    if (hex && /^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) {
      next.color = { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
    }
    if (entry.weight && entry.weight <= 65535) next.weight = entry.weight;
    if (entry.diameter && entry.diameter <= 655.35) next.diameter = entry.diameter;
    const [min, max] = entry.extruder_temp_range ?? [];
    if (Number.isInteger(min) && Number.isInteger(max) && min > 0 && max >= min && max <= 65535) {
      next.minTemp = min;
      next.maxTemp = max;
    }

    applyLabel(next, `${entry.manufacturer} ${entry.name}`);
    setSpool(next);
    setFileName(generateDefaultFileName(next).replace('.bin', ''));
  };

  const handleMetadataChange = (field: string, value: number | string) => {
    if (!spool) return;

    switch (field) {
      case 'weight':
        spool.weight = value as number;
        break;
      case 'diameter':
        spool.diameter = value as number;
        break;
      case 'minTemp':
        spool.minTemp = value as number;
        break;
      case 'maxTemp':
        spool.maxTemp = value as number;
        break;
      case 'productionDate':
        spool.productionDate = value as string;
        break;
      case 'modifier':
        spool.colorModifier = value as string;
        break;
    }

    setSpool(new ElegooSpool(spool.getRawData()));
  };

  const handleNfcTagRead = (data: Uint8Array) => {
    setLabelDraft(null);
    setSavedSpoolId(null);
    const newSpool = new ElegooSpool(data);
    setSpool(newSpool);
    setFileName(generateDefaultFileName(newSpool).replace('.bin', ''));
    addLog(`NFC: Loaded tag data (${data.length} bytes)`);
  };

  const handleSavedSpoolSelect = (profile: SavedSpool) => {
    const next = new ElegooSpool(new Uint8Array(profile.data));
    setLabelDraft(null);
    setSpool(next);
    setSavedSpoolId(profile.id);
    setFileName(generateDefaultFileName(next).replace('.bin', ''));
    addLog(`Loaded saved spool: ${profile.name}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />

      <main className="container mx-auto px-4 py-4 max-w-6xl">
        {/* File and advanced controls, collapsed by default */}
        <details className="bg-white rounded-lg shadow-md p-3 mb-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            File &amp; Advanced Options
          </summary>
          <div className="mt-3">
            <div className="flex flex-wrap gap-2 items-center mb-2">
              <FileUpload onFileLoad={handleFileLoad} />

              <button
                onClick={handleSave}
                disabled={!spool || Boolean(labelIssue)}
                title={labelIssue}
                className="px-3 py-1.5 text-xs bg-elegoo-blue text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save .BIN
              </button>

              <button
                onClick={() => setShowHexEditor(!showHexEditor)}
                className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                {showHexEditor ? 'Hide' : 'Show'} Hex Editor
              </button>
            </div>

            {/* Filename Input */}
            <div className="flex items-center gap-2">
              <label htmlFor="filename" className="text-xs font-medium text-gray-700 whitespace-nowrap">
                Filename:
              </label>
              <input
                id="filename"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={spool ? generateDefaultFileName(spool).replace('.bin', '') : 'spool'}
                className="flex-1 px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-elegoo-orange focus:border-transparent text-xs font-mono"
              />
              <span className="text-xs text-gray-500">.bin</span>
            </div>

          </div>
        </details>

        {/* Spool Configuration */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="mb-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-gray-800">
                Spool Configuration
              </h2>
              <button
                type="button"
                onClick={handleGenerateNew}
                title="Reset spool settings to defaults"
                className="shrink-0 px-3 py-1.5 text-xs bg-elegoo-orange text-white rounded-md hover:bg-orange-600 transition-colors font-medium"
              >
                Reset
              </button>
            </div>
            {spool && (
              <p className="text-xs text-gray-600 mt-0.5">
                Manufacturer Code: <span className="font-medium">{spool.manufacturer}</span>
              </p>
            )}
          </div>

          {spool && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <SpoolLibrary spool={spool} label={label} disabledReason={labelIssue} selectedId={savedSpoolId}
                  onEditLabel={() => labelInputRef.current?.focus()}
                  onSelect={handleSavedSpoolSelect} onSelectionChange={setSavedSpoolId} />
                <SpoolmanCatalog onSelect={handleSpoolmanSelect} />
                <ColorCatalogs
                  value={spool.color}
                  onChange={handleColorChange}
                  onCatalogSelect={handleCatalogSelect}
                />
              </div>

              <div className="md:col-span-2 text-sm font-medium text-gray-700">
                <div className="flex items-center gap-1">
                  <label htmlFor="spool-label">Spool label</label>
                  <SpoolLabelSettings format={labelFormat} onChange={setLabelFormat} />
                </div>
                <div className="relative mt-1">
                  <input
                    id="spool-label"
                    ref={labelInputRef}
                    type="text"
                    aria-label="Spool label"
                    value={label}
                    aria-invalid={labelBytes > MAX_LABEL_BYTES || undefined}
                    aria-describedby="spool-label-hint"
                    onChange={(event) => {
                      const value = event.target.value;
                      const next = new ElegooSpool(spool.getRawData());
                      applyLabel(next, value);
                      setSpool(next);
                    }}
                    placeholder="Elegoo Matte PLA | Bone White"
                    className={`w-full rounded-md border pl-2 pr-10 py-2 ${labelBytes > MAX_LABEL_BYTES ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  <button type="button" aria-label="Clear spool label" title="Clear spool label"
                    disabled={!label}
                    onClick={() => {
                      const next = new ElegooSpool(spool.getRawData());
                      applyLabel(next, '');
                      setSpool(next);
                      labelInputRef.current?.focus();
                    }}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                    <X size={16} />
                  </button>
                </div>
                <span id="spool-label-hint" className={`mt-1 block text-xs ${labelBytes > MAX_LABEL_BYTES ? 'text-red-700' : 'text-gray-500'}`}>
                  {labelBytes}/{MAX_LABEL_BYTES} UTF-8 bytes. {labelIssue ?? 'Used on the tag and in My Spools.'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MaterialSelector
                    value={spool.material}
                    onChange={handleMaterialChange}
                  />
                  <SubtypeSelector
                    material={spool.material}
                    value={spool.subtype}
                    onChange={handleSubtypeChange}
                  />
                </div>
                <ColorPicker value={spool.color} onChange={handleColorChange} onStatusUpdate={addLog} />
              </div>

              <MetadataFields
                weight={spool.weight}
                diameter={spool.diameter}
                minTemp={spool.minTemp}
                maxTemp={spool.maxTemp}
                onChange={handleMetadataChange}
              />
            </div>
          )}
        </div>

        {/* Export Buttons */}
        {spool && (
          <ExportButtons
            spool={spool}
            disabledReason={labelIssue}
            onStatusUpdate={addLog}
            filename={fileName || generateDefaultFileName(spool).replace('.bin', '')}
          />
        )}

        {/* NFC Reader/Writer - only visible on devices with Web NFC (Chrome Android) */}
        {nfcSupported && spool && (
          <NfcReaderWriter
            spool={spool}
            disabledReason={labelIssue}
            onTagRead={handleNfcTagRead}
            onStatusUpdate={addLog}
          />
        )}

        {/* Hex Editor */}
        {showHexEditor && spool && (
          <HexEditor data={spool.getRawData()} />
        )}
      </main>

      <ActivityLog log={log} />
    </div>
  );
}

export default App;

