# Storage and tag layout notes

[Back to the README](../README.md)

## NTAG215 test build

### My Spools

My Spools saves independent profiles in IndexedDB in the current browser,
for the current site origin (scheme, hostname, and port). It is available
with or without Web NFC. Load a profile, then use the normal Write Tag action
or Mobile export to NFC Tools; no original sticker is required.
It starts collapsed; tap its heading to open. Search covers the full library,
with five results per page and Previous/Next controls. The **?** button shows help
on tap, keyboard activation, or mouse hover.

Selecting a Filament Color Catalog swatch suggests an editable spool label
in the format `Brand-Filament | Color`, such as `Elegoo-PLA+ | Red`.
Suggestions stay visible in full. Overlong drafts show a byte count and must
be shortened to 33 UTF-8 bytes before saving, writing, or exporting. Empty
labels also require entry. The same label is the name shown in My Spools;
there is no separate library-name input. The X button clears and focuses the
label. Carbon presets continue to change only the color.

- Choose catalog settings or enter them manually, then **Save Spool**.
  The saved name exactly matches the tag label. The same rule is checked when
  restoring backups; there are no separate names or automatic migrations.
- **Load** restores the saved label, material, subtype, color, temperatures,
  and other editor bytes. Changes remain in the editor until **Update Saved
  Spool** is confirmed or **Save as New** is used. Library actions do not
  write or erase NFC tags. Profiles have IDs independent of tag UIDs.
- **Duplicate** creates a separate saved copy with the same label. **Delete** removes a saved
  profile after confirmation, keeping the current editor and tag unchanged.
  **Reset** clears the editor's association with the loaded profile and
  restores default editor settings without deleting the library.
- **Back Up Library** downloads a versioned JSON file. **Restore Library**
  merges a backup: unchanged matching IDs are skipped, changed matching IDs
  become separate entries, and existing entries are never overwritten.
  Invalid backups are rejected before any entries are written.

There is no automatic account sync or server database. Local PC-IP hosting,
GitHub Pages, another browser, or another device each has separate storage;
use backup/restore to transfer. Site updates on the same origin retain the
library. Clearing browser site data can delete it, and private browsing may
discard it when closed. The app requests persistent storage after a save
when supported; backups remain necessary even if that request is granted.
Storage errors are reported without disabling normal editing or exports.
The saved library and backup files are not uploaded to GitHub by the app.

For the browser integration check, run the development server and open
`/tests/spoolLibrary.browser.html`. It exercises real IndexedDB plus UI
save/load/update/copy/delete/reset, backup roundtrips, and conflict handling.
It uses isolated test databases, separate from My Spools. A PASS/FAIL report
appears below the editor. Phone NFC and NFC Tools writes require hardware
verification separately.

SpoolmanDB search loads the public catalog on demand from
https://donkie.github.io/SpoolmanDB/filaments.json. This is the public filament
catalog, independent of any personal Spoolman inventory. Catalog selections
prefill editable settings and a suggested label, which must fit within
33 UTF-8 bytes before saving or writing.

The 180-byte export is a compact legacy editor template, not a full NTAG215
memory dump. Direct Web NFC uses the alignment observed on the tested NTAG215.
Erase Tag zeros the label and Canvas payload in that NDEF record; the tag
remains writable.

### Tag layout and erase verification

Keep running locally with Node 22 through mise:

```powershell
mise exec -- npm run dev -- --host 0.0.0.0
```

Normal Chrome writes retain the manual layout selection and the existing
binary record. Mobile export and backward readback are unchanged. Erase now
requests the longer existing zero payload regardless of the selector:

| Observed layout | TLV start | Payload start | Normal payload | Old erase zero range | New erase zero range |
| --- | --- | --- | --- | --- | --- |
| Fresh / Chrome-only | `0x10` | `0x15` | 139 bytes | `0x15–0x9F` | `0x15–0x9F` |
| NFC Tools-prepared | `0x15` | `0x1A` | 134 bytes | `0x1A–0x9F` | `0x1A–0xA4` |

Ranges are inclusive and conditional on Android keeping the observed payload
start. The requested erase payload is 139 zero bytes; TLV/NDEF framing is not
zeroed. The prepared layout therefore clears five additional user bytes,
`0xA0–0xA4` (pages `0x28` and part of `0x29`). These are NTAG215 user memory,
not configuration pages. The app does not issue raw page writes, lock the tag,
or request changes to UID, capability container, password, or configuration.
The browser controls formatting and physical writes; dumps must establish
their actual extent. This is not a full user-memory wipe or a TLV offset reset.

[Web NFC](https://w3c.github.io/web-nfc/) exposes NDEF messages and a serial
number when available, with no raw page access or physical NDEF offset control.
Payload size alone cannot establish alignment. A reliable normalization step
has not been established. A future UID preference could remember a layout
explicitly verified on Canvas, with a manual override; unfamiliar tags must
remain unclassified. Guaranteed raw placement would require a suitable native
NFC path. Adding a general-reader text record changes framing and alignment,
so Chrome label interoperability remains a separate, untested experiment.

Use `Elegoo Matte PLA | Bone White` as the exact test label and record the
chosen material, subtype, and RGB value. Save full raw dumps using the same
dump method before and after every operation below. Do not initialize or
format a tag between dumps, since that would confound the offset comparison.

| Sticker | Starting operation | Erase and expected result | Rewrite and expected result |
| --- | --- | --- | --- |
| Fresh | Dump untouched tag; select Fresh; Write Tag; dump and confirm label in editor plus material/color on Canvas | Erase Tag with either selector setting; dump; editor reports blank and Canvas no longer identifies spool | Keep Fresh selected; write same settings; dump; exact label in editor and original material/color on Canvas |
| Chrome-only | Dump previously working sticker; read and confirm label plus Canvas material/color | Erase Tag with Prepared selected to check selector independence; dump; editor reports blank and Canvas no longer identifies spool | Select Fresh; write same settings; dump; exact label in editor and original material/color on Canvas |
| NFC Tools-prepared | Dump working Mobile-export sticker; confirm plain-text label in NFC Tools and material/color on Canvas | Erase Tag with Fresh selected; dump; no old label in NFC Tools, editor reports blank, Canvas no longer identifies spool | Select Prepared; Chrome-write same settings; dump; exact label in editor and original material/color on Canvas |

For a previously blank fresh tag, the initial write establishes the spool
that erase must remove. If a starting operation already fails, preserve that
dump before continuing. App readback proves record content, not Canvas alignment.
After the prepared sticker is rewritten by Chrome, a general NFC reader is
not expected to display a plain-text label; the record remains binary.

For any failure, provide the before-write, after-write, after-erase, and
after-rewrite dumps that exist, along with the selected layout and Canvas
result. Compare bytes `0x10–0xAF` (pages `0x04–0x2B`): locate the NDEF TLV,
label bytes, terminator, and `36 EE EE EE` header. In particular inspect page
`0x10` and possible shifted header starts `0x3B` / `0x45`, plus bytes
`0xA0–0xA4` for the extended erase. Full dumps also reveal unexpected writes
outside this window. A changed payload start would show why an erase might
appear successful in the editor while a subsequent write fails on Canvas.



