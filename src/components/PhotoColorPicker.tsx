import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { tracePhoto } from '../lib/photoDiagnostics';

type Color = { r: number; g: number; b: number };

export function PhotoColorPicker({ onChange, onStatusUpdate }: { onChange: (color: Color) => void; onStatusUpdate?: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sample, setSample] = useState<{ color: Color; x: number; y: number } | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const request = useRef(0);
  const pressedAction = useRef<'close' | 'apply' | null>(null);
  const report = (message: string) => { tracePhoto(message); onStatusUpdate?.(message); };
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!ready) return;
    // Wait for the photo layout before positioning it after the native picker returns.
    const frame = requestAnimationFrame(() => {
      panel.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  const close = (reason: 'Close button' | 'color applied') => {
    report(`Photo picker closed: ${reason}`);
    pressedAction.current = null;
    request.current++;
    setOpen(false);
    setReady(false);
    setSample(null);
    setError('');
    setLoading(false);
    const node = canvas.current;
    if (node) { node.width = 1; node.height = 1; }
    trigger.current?.focus();
  };

  const loadPhoto = async (file?: File) => {
    if (!file) return;
    const current = ++request.current;
    tracePhoto(`Photo received: ${file.type || 'unknown format'}, ${Math.round(file.size / 1024)} KB`);
    pressedAction.current = null;
    setReady(false);
    setSample(null);
    setError('');
    if (file.size > 35 * 1024 * 1024) {
      setLoading(false);
      setError('Choose a photo smaller than 35 MB.');
      return;
    }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('image'));
        image.src = url;
      });
      if (current !== request.current) return;
      tracePhoto(`Photo decoded: ${image.naturalWidth}x${image.naturalHeight}`);
      const node = canvas.current;
      const context = node?.getContext('2d', { willReadFrequently: true });
      if (!node || !context || !image.naturalWidth) throw new Error('canvas');
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      node.width = Math.max(1, Math.round(image.naturalWidth * scale));
      node.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, node.width, node.height);
      context.drawImage(image, 0, 0, node.width, node.height);
      setReady(true);
      report('Photo ready: tap the image, then Use this color');
    } catch {
      tracePhoto('Photo decode or drawing failed');
      if (current === request.current) setError('This photo could not be opened. Try a JPEG or PNG photo.');
    } finally {
      URL.revokeObjectURL(url);
      if (current === request.current) setLoading(false);
    }
  };

  const pick = (x: number, y: number) => {
    const node = canvas.current;
    const context = node?.getContext('2d');
    if (!ready || !node || !context) return;
    x = Math.max(0, Math.min(node.width - 1, Math.round(x)));
    y = Math.max(0, Math.min(node.height - 1, Math.round(y)));
    // Average a small patch to soften camera noise, clipping at photo edges.
    const left = Math.max(0, x - 3), top = Math.max(0, y - 3);
    const pixels = context.getImageData(left, top, Math.min(node.width, x + 4) - left, Math.min(node.height, y + 4) - top).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < pixels.length; i += 4) { r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; }
    const count = pixels.length / 4;
    setSample({ color: { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) }, x, y });
  };
  const hex = sample ? '#' + [sample.color.r, sample.color.g, sample.color.b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase() : '';
  const actionClass = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-elegoo-orange';

  return (
    <div className="mt-2">
      <button ref={trigger} type="button" aria-expanded={open} aria-controls="photo-color-picker" className={actionClass} onClick={() => { setOpen(true); if (!open) report('Photo picker opened'); panel.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }}>
        <Camera size={16} aria-hidden="true" /> Pick from photo
      </button>
      {open && (
        <section ref={panel} id="photo-color-picker" aria-label="Pick filament color from a photo" className="mt-2 scroll-mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3" style={{ overflowAnchor: 'none' }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-gray-600">Take or choose a photo, then tap the filament to preview its color.</p>
            <button type="button" aria-label="Close photo picker" className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200"
              onPointerDown={() => { pressedAction.current = 'close'; }}
              onPointerCancel={() => { pressedAction.current = null; }}
              onClick={event => {
                // Ignore a delayed native-picker click unless a press began on this button.
                // Zero-detail activation supports keyboard and assistive technology.
                const allowed = event.detail === 0 || pressedAction.current === 'close';
                pressedAction.current = null;
                if (allowed) close('Close button');
              }}><X size={18} /></button>
          </div>
          <div className="my-2 flex flex-wrap gap-2">
            <button type="button" className={actionClass} onClick={() => { tracePhoto('Opening camera'); camera.current?.click(); }}><Camera size={16} aria-hidden="true" /> Take photo</button>
            <button type="button" className={actionClass} onClick={() => { tracePhoto('Opening photo chooser'); files.current?.click(); }}><ImagePlus size={16} aria-hidden="true" /> Choose photo</button>
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="Take a photo for color picking" className="hidden" onChange={event => { void loadPhoto(event.target.files?.[0]); event.target.value = ''; }} />
          <input ref={files} type="file" accept="image/*" aria-label="Choose a photo for color picking" className="hidden" onChange={event => { void loadPhoto(event.target.files?.[0]); event.target.value = ''; }} />
          {loading && <p role="status" className="text-xs text-gray-600">Opening photo…</p>}
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className={ready ? 'relative mx-auto w-fit max-w-full' : 'hidden'}>
            <canvas ref={canvas} tabIndex={ready ? 0 : -1} role="button" aria-label="Photo color sampler. Tap a point, or press Enter then use arrow keys to move the sample." draggable={false} className="block max-h-[40dvh] max-w-full cursor-crosshair select-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-elegoo-orange"
              style={{ touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none' }}
              onContextMenu={event => event.preventDefault()}
              onDragStart={event => event.preventDefault()}
              onPointerDown={event => {
                if (!event.isPrimary || event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.focus({ preventScroll: true });
                const bounds = event.currentTarget.getBoundingClientRect();
                pick((event.clientX - bounds.left) * event.currentTarget.width / bounds.width, (event.clientY - bounds.top) * event.currentTarget.height / bounds.height);
              }}
              onKeyDown={event => {
                const node = event.currentTarget;
                const x = sample?.x ?? node.width / 2, y = sample?.y ?? node.height / 2;
                const moves: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5], Enter: [0, 0], ' ': [0, 0] };
                const move = moves[event.key];
                if (move) { event.preventDefault(); pick(x + move[0], y + move[1]); }
              }} />
            {sample && canvas.current && <span aria-hidden="true" className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ring-2 ring-black" style={{ left: `${(sample.x + 0.5) / canvas.current.width * 100}%`, top: `${(sample.y + 0.5) / canvas.current.height * 100}%` }} />}
          </div>
          {ready && <div className="mt-3 flex flex-wrap items-center gap-2">
            <div role="status" className="flex items-center gap-2 text-xs">
              {sample ? <><span className="h-8 w-8 rounded border border-gray-300" style={{ backgroundColor: hex }} /><span className="font-mono">{hex}<br />RGB {sample.color.r}, {sample.color.g}, {sample.color.b}</span></> : 'Tap the photo to select a color.'}
            </div>
            <button type="button" disabled={!sample} className="ml-auto min-h-[40px] rounded-md bg-elegoo-orange px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              onPointerDown={() => { pressedAction.current = 'apply'; }}
              onPointerCancel={() => { pressedAction.current = null; }}
              onClick={event => {
                const allowed = event.detail === 0 || pressedAction.current === 'apply';
                pressedAction.current = null;
                if (sample && allowed) { onChange(sample.color); close('color applied'); }
              }}>Use this color</button>
          </div>}
          <p className="mt-2 text-[11px] text-gray-500">Photos stay on your device. Lighting affects color; use even light and avoid reflections. You can adjust RGB or hex afterward.</p>
        </section>
      )}
    </div>
  );
}
