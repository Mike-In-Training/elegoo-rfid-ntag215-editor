import { Github } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-elegoo-blue text-white shadow-lg">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Elegoo RFID Tag Editor</h1>
            <p className="text-[11px] sm:text-xs text-blue-200">
              NTAG215 NFC spool tags - v2.2
            </p>
          </div>
          <a
            href="https://github.com/Mike-In-Training/elegoo-rfid-ntag215-editor"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View this project on GitHub"
            title="View this project on GitHub"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-blue-200 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Github className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}

