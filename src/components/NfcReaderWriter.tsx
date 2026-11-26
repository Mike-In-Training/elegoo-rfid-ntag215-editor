import { useState, useCallback, useRef, useEffect } from 'react';
import { Nfc } from 'lucide-react';
import { ElegooSpool, MAX_LABEL_BYTES } from '../lib/ElegooSpool';

interface NfcReaderWriterProps {
  spool: ElegooSpool;
  onTagRead: (data: Uint8Array) => void;
  onStatusUpdate: (message: string) => void;
  disabledReason?: string;
}

type NfcState = 'idle' | 'scanning-read' | 'scanning-write' | 'scanning-erase' | 'success' | 'error';

/**
 * Check if Web NFC is available (Chrome on Android only).
 * Returns false on desktop, iOS, and non-Chrome browsers.
 */
export function isWebNfcSupported(): boolean {
  return 'NDEFReader' in window;
}

// Observed NDEF TLV starts: 0x10 (fresh) or 0x15 (NFC Tools-prepared).
// TLV + short unknown-record framing puts payloads at 0x15 or 0x1A.
const CANVAS_START = 0x40;
const CANVAS_END = 0xA0;
const NTAG215_PADDING = CANVAS_START - 0x1A;
const FRESH_PADDING = CANVAS_START - 0x15;
const LABEL_MARKER = [0x53, 0x50, 0x01]; // Spool label, version 1

export function NfcReaderWriter({ spool, onTagRead, onStatusUpdate, disabledReason }: NfcReaderWriterProps) {
  const [state, setState] = useState<NfcState>('idle');
  const [message, setMessage] = useState('');
  const [freshLayout, setFreshLayout] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const cancelOperation = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState('idle');
    setMessage('');
    onStatusUpdate('NFC operation cancelled');
  }, [onStatusUpdate]);

  useEffect(() => {
    if (disabledReason && state === 'scanning-write') cancelOperation();
  }, [disabledReason, state, cancelOperation]);

  const writeTag = useCallback(async (erase: boolean) => {
    if (abortControllerRef.current) return;
    if (!erase && disabledReason) return;
    if (!('NDEFReader' in window)) {
      setMessage('Web NFC not supported on this device');
      setState('error');
      return;
    }

    try {
      setState(erase ? 'scanning-erase' : 'scanning-write');
      setMessage(erase ? 'Hold your phone near the tag you want to erase...' : 'Hold your phone near the NFC tag...');
      onStatusUpdate(erase ? 'NFC: Waiting for tag to erase...' : 'NFC: Waiting for tag to write...');

      const ndef = new NDEFReader();
      abortControllerRef.current = new AbortController();

      // Erase uses the longer existing payload for either observed layout:
      // 139 zero bytes at 0x15..0x9F or 0x1A..0xA4 (inclusive).
      // This covers both labels and Canvas 0x40..0x9F without selecting a
      // layout. Physical placement still needs dump verification; this
      // neither wipes all user memory nor requests a TLV offset reset.
      const padding = erase || freshLayout ? FRESH_PADDING : NTAG215_PADDING;
      const fullPayload = new Uint8Array(padding + CANVAS_END - CANVAS_START);
      // A short empty NDEF record could leave the old Canvas bytes intact.
      // Write zeros across the same region as a normal spool write.
      if (!erase) {
        const label = new TextEncoder().encode(spool.label);
        fullPayload.set(LABEL_MARKER);
        fullPayload[LABEL_MARKER.length] = label.length;
        fullPayload.set(label, LABEL_MARKER.length + 1);
        fullPayload.set(spool.getRawData().subarray(CANVAS_START, CANVAS_END), padding);
      }

      await ndef.write(
        {
          records: [
            {
              recordType: 'unknown',
              data: fullPayload,
            },
          ],
        },
        { overwrite: true, signal: abortControllerRef.current.signal },
      );

      setState('success');
      setMessage(erase ? 'Erase write completed. Check Canvas, then rewrite to verify reuse.' : 'Tag written successfully!');
      onStatusUpdate(erase ? 'NFC: 139-byte erase write completed; Canvas check required' : 'NFC: Tag written successfully');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setState('idle');
        setMessage('');
        return;
      }
      console.error('NFC write error:', error);
      setState('error');
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessage(`${erase ? 'Erase' : 'Write'} failed: ${errMsg}`);
      onStatusUpdate(`NFC write error: ${errMsg}`);
    } finally {
      abortControllerRef.current = null;
    }
  }, [spool, onStatusUpdate, freshLayout, disabledReason]);

  const handleRead = useCallback(async () => {
    if (!('NDEFReader' in window)) {
      setMessage('Web NFC not supported on this device');
      setState('error');
      return;
    }

    try {
      setState('scanning-read');
      setMessage('Hold your phone near the NFC tag...');
      onStatusUpdate('NFC: Waiting for tag to read...');

      const ndef = new NDEFReader();
      abortControllerRef.current = new AbortController();

      const readPromise = new Promise<Uint8Array>((resolve, reject) => {
        const onReading = (event: NDEFReadingEvent) => {
          ndef.removeEventListener('reading', onReading);
          ndef.removeEventListener('readingerror', onError);

          try {
            const tagData = parseNdefToSpoolData(event);
            resolve(tagData);
          } catch (err) {
            reject(err);
          }
        };

        const onError = () => {
          ndef.removeEventListener('reading', onReading);
          ndef.removeEventListener('readingerror', onError);
          reject(new Error('Error reading NFC tag'));
        };

        ndef.addEventListener('reading', onReading);
        ndef.addEventListener('readingerror', onError);

        // Also handle abort
        abortControllerRef.current?.signal.addEventListener('abort', () => {
          ndef.removeEventListener('reading', onReading);
          ndef.removeEventListener('readingerror', onError);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      await ndef.scan({ signal: abortControllerRef.current.signal });
      const tagData = await readPromise;

      onTagRead(tagData);
      setState('success');
      setMessage('Tag read successfully!');
      onStatusUpdate(`NFC: Tag read (${tagData.length} bytes)`);

      setTimeout(() => {
        setState('idle');
        setMessage('');
      }, 3000);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setState('idle');
        setMessage('');
        return;
      }
      console.error('NFC read error:', error);
      setState('error');
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessage(`Read failed: ${errMsg}`);
      onStatusUpdate(`NFC read error: ${errMsg}`);
    } finally {
      abortControllerRef.current = null;
    }
  }, [onTagRead, onStatusUpdate]);

  const isScanning = state === 'scanning-read' || state === 'scanning-write' || state === 'scanning-erase';

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
        <Nfc size={16} className="text-emerald-600" />
        NFC Tag Reader / Writer
      </h2>

      <label className="mb-2 block text-xs font-medium">
        Tag layout for writing
        <select className="mt-1 block w-full rounded border p-2" disabled={isScanning}
          value={freshLayout ? 'fresh' : 'prepared'}
          onChange={(event) => setFreshLayout(event.target.value === 'fresh')}>
          <option value="fresh">Fresh or only written in Site</option>
          <option value="prepared">NFC Tools Prepared</option>
        </select>
      </label>

      <p className="mb-2 text-xs text-gray-600">
        Erase covers both observed layouts; verify on Canvas before reuse. NFC Tools Format can completely clear.
      </p>

      <div className="grid sm:grid-cols-2 gap-2">
        <button
          onClick={isScanning ? cancelOperation : handleRead}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md font-medium transition-colors ${
            state === 'scanning-read'
              ? 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          <Nfc size={14} />
          {state === 'scanning-read' ? 'Cancel Read' : 'Read Tag'}
        </button>

        <button
          onClick={() => isScanning ? cancelOperation() : void writeTag(false)}
          disabled={Boolean(disabledReason) && !isScanning}
          title={disabledReason}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            state === 'scanning-write'
              ? 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          <Nfc size={14} />
          {state === 'scanning-write' ? 'Cancel Write' : 'Write Tag'}
        </button>
      </div>

      <button
        type="button"
        disabled={isScanning && state !== 'scanning-erase'}
        onClick={() => {
          if (state === 'scanning-erase') {
            cancelOperation();
          } else if (window.confirm('Erase the spool data and label from the next tag you scan?')) {
            void writeTag(true);
          }
        }}
        className="mt-2 w-full rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {state === 'scanning-erase' ? 'Cancel Erase' : 'Erase Tag'}
      </button>

      {/* Status message */}
      {message && (
        <div
          className={`mt-2 px-3 py-2 rounded-md text-xs font-medium ${
            state === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : state === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          {message}
        </div>
      )}

      <p className="mt-2 text-[11px] text-amber-500">
        ⚠ Web NFC may not be compatible with all phones. Use Export Tools above with a compatible NFC app, such as NFC Tools.
      </p>
    </div>
  );
}

// Restore the Canvas bytes and label into the editor's raw export layout.
function parseNdefToSpoolData(event: NDEFReadingEvent): Uint8Array {
  const canvasLength = CANVAS_END - CANVAS_START;
  for (const record of event.message.records) {
    if (record.recordType !== 'unknown' || !record.data) continue;
    const payload = new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength);
    const padding = payload.length - canvasLength;
    if ((padding === NTAG215_PADDING || padding === FRESH_PADDING) && payload.every((byte) => byte === 0)) {
      throw new Error('Tag is blank. Use Write Tag to assign a spool.');
    }
    if ((padding !== NTAG215_PADDING && padding !== FRESH_PADDING) ||
        payload[padding] !== 0x36) continue;

    const spool = new ElegooSpool();
    const data = spool.getRawData();
    data.set(payload.subarray(padding), CANVAS_START);

    if (LABEL_MARKER.every((byte, index) => payload[index] === byte)) {
      const size = payload[LABEL_MARKER.length];
      const start = LABEL_MARKER.length + 1;
      if (size <= MAX_LABEL_BYTES) {
        spool.label = new TextDecoder().decode(payload.subarray(start, start + size));
      }
    } else if (padding === FRESH_PADDING) {
      data.set(payload.subarray(0, padding), 0x15);
      const label = spool.label;
      if (label) spool.label = label;
    }
    return data;
  }

  // No compatible record found
  throw new Error(
    'Could not read spool data from this tag. ' +
      'Web NFC can only read tags written by this app. ' +
      'Use a dedicated NFC app to read original Elegoo tags.',
  );
}
