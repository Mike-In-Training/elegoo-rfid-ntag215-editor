# Elegoo NTAG215 Filament Editor

Create reusable Elegoo filament stickers, pick colors from filament catalogs, and keep a browser library of your spools.

**Edit → save your spool → write with Web NFC or export to NFC Tools.**

Planned app address (available after deployment): [Open the editor](https://mike-in-training.github.io/elegoo-rfid-ntag215-editor/)

- **Spool configuration:** catalog presets, editable RGB/hex colors and spool labels.
- **My Spools:** save, search, edit and back up configurations without needing the original tag.
- **Two NFC routes:** write directly in a compatible Web NFC browser, or use **Export Tools** with [NFC Tools](https://www.wakdev.com/en/apps/nfc-tools-android.html) as a companion on supported phones.

Your library stays in this browser. **Save Spool is explicit**; writing a tag does not save it. Back up before changing browser, device or website address.

<details>
<summary>Guides and technical details</summary>

- [Using the editor and NFC Tools](./docs/user-guide.md)
- [Local setup and GitHub Pages hosting](./docs/development.md)
- [Storage, NTAG215 layouts and erase behavior](./docs/tag-layout.md)

Web NFC and companion-app features depend on the phone and browser. The Hex Editor displays the editor buffer, not a full tag dump.

</details>

## Contributors and transparency

- **[Savion](https://github.com/Savion)** — original [Elegoo RFID editor](https://github.com/Savion/elegoo-rfid-editor), whose development also credits Claude.
- **[Michael / Mike-In-Training](https://github.com/Mike-In-Training)** — this fork's direction, workflow design and physical tag/printer testing.
- **OpenAI Codex** — AI-assisted implementation, debugging, documentation and automated checks developed collaboratively with Michael. Physical NFC and printer behavior was checked by Michael; automated checks do not replace that hardware testing.

This project uses React, TypeScript, Tailwind CSS, Lucide, Vite and vite-plugin-pwa. NFC Tools is a separate companion app by wakdev.

[MIT licensed](./LICENSE), retaining the original copyright notice.
