import { useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { MAX_LABEL_BYTES } from '../lib/ElegooSpool';

const fields = ['Brand', 'Filament', 'Color'] as const;
type Field = typeof fields[number];
type FieldChoice = Field | 'None';
const separators = [
  { value: '', label: 'None' },
  { value: ' ', label: 'Space' },
  { value: '-', label: 'Hyphen (-)' },
  { value: ' | ', label: 'Pipe (|)' },
  { value: ' / ', label: 'Slash (/)' },
  { value: '_', label: 'Underscore (_)' },
] as const;
type Separator = typeof separators[number]['value'];
type LabelFormat = [FieldChoice, Separator, FieldChoice, Separator, FieldChoice];

const storageKey = 'spool-label-format';
const defaultFormat: LabelFormat = ['Brand', '-', 'Filament', ' | ', 'Color'];
const example = { Brand: 'Elegoo', Filament: 'PLA+', Color: 'Red' };

export function formatSpoolLabel(format: LabelFormat, values: Record<Field, string>) {
  const [first, separator1, second, separator2, third] = format;
  let label = first === 'None' ? '' : values[first];
  if (second !== 'None') label += (label ? separator1 : '') + values[second];
  if (third !== 'None') label += (label ? separator2 : '') + values[third];
  return label;
}

export function readLabelFormat(): LabelFormat {
  try {
    const format = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    const selected = Array.isArray(format) ? [format[0], format[2], format[4]].filter(field => field !== 'None') : [];
    if (Array.isArray(format) && format.length === 5
      && selected.every(field => fields.includes(field))
      && new Set(selected).size === selected.length
      && [format[1], format[3]].every(separator => separators.some(option => option.value === separator))) {
      return format as LabelFormat;
    }
  } catch {
    // A blocked or invalid preference falls back to the original format.
  }
  return defaultFormat;
}

export function SpoolLabelSettings({ format, onChange }: {
  format: LabelFormat;
  onChange: (format: LabelFormat) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(format);
  const [notice, setNotice] = useState('');
  const preview = formatSpoolLabel(draft, example);
  const selectClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm';

  const changeField = (index: 0 | 2 | 4, field: FieldChoice) => {
    const next: LabelFormat = [...draft];
    const other = ([0, 2, 4] as const).find(position => next[position] === field);
    if (field !== 'None' && other !== undefined) next[other] = next[index];
    next[index] = field;
    setDraft(next);
  };

  const save = () => {
    onChange(draft);
    setNotice('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      setNotice('Format applied for this page. This browser could not remember it.');
    }
    dialog.current?.close();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Spool naming settings"
        aria-haspopup="dialog"
        title="Spool naming settings"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-elegoo-orange"
        onClick={() => {
          setDraft(format);
          dialog.current?.showModal();
        }}
      >
        <Settings size={16} aria-hidden="true" />
      </button>
      {notice && <span role="status" className="text-xs text-amber-800">{notice}</span>}
      <dialog
        ref={dialog}
        aria-labelledby="spool-naming-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-5 text-gray-800 shadow-xl backdrop:bg-black/40"
      >
        <h2 id="spool-naming-title" className="text-base font-bold">Spool naming</h2>
        <p className="mt-1 text-xs text-gray-600">Used when you pick a color from the Filament Catalog. Choose None to omit a field. Selecting a field already in use swaps its position.</p>
        <form className="mt-4 space-y-4" onSubmit={event => {
          event.preventDefault();
          save();
        }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([0, 1, 2, 3, 4] as const).map(index => (
              index === 1 || index === 3 ? (
                <label key={index} className="text-xs">
                  Separator {index === 1 ? 1 : 2}
                  <select className={selectClass} value={draft[index]} onChange={event => {
                    const choice = separators.find(option => option.value === event.target.value);
                    if (!choice) return;
                    const next: LabelFormat = [...draft];
                    next[index] = choice.value;
                    setDraft(next);
                  }}>
                    {separators.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              ) : (
                <label key={index} className="text-xs">
                  Field {index / 2 + 1}
                  <select className={selectClass} value={draft[index]} onChange={event => changeField(index, event.target.value as FieldChoice)}>
                    <option>None</option>
                    {fields.map(field => <option key={field}>{field}</option>)}
                  </select>
                </label>
              )
            ))}
          </div>
          <div className="rounded-md bg-gray-100 p-3 text-xs">
            <p className="text-gray-600">Example · {new TextEncoder().encode(preview).length}/{MAX_LABEL_BYTES} UTF-8 bytes</p>
            <output aria-label="Example spool label" className="mt-1 block break-words font-mono">{preview || 'No automatic label. Enter one manually.'}</output>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" onClick={() => setDraft(defaultFormat)} className="rounded px-2 py-2 text-xs text-gray-700 hover:bg-gray-100">Restore default</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => dialog.current?.close()} className="rounded px-3 py-2 text-xs text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="submit" className="rounded bg-elegoo-blue px-3 py-2 text-xs font-semibold text-white">Save format</button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
