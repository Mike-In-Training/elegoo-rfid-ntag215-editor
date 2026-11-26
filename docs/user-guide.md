# User guide

[Back to the README](../README.md)

## Use the editor

1. Choose a SpoolmanDB entry, filament catalog color or Carbon preset, or enter the spool settings yourself.
2. Enter a spool label. Catalog choices suggest a label; shorten it if necessary to fit **33 UTF-8 bytes**. The saved library name and tag label are the same.
3. On a browser supporting Web NFC, read or write the tag directly. Use **Fresh or only written in site** for fresh tags and tags formatted in NFC Tools. Use the prepared-tag option when appropriate; see the layout notes below.
4. Otherwise use **Export Tools** with a compatible NFC application. NFC Tools on Android supports the exported advanced NFC commands; available features depend on the phone and application.
5. Choose **Save Spool** explicitly to keep the configuration in **My Spools**. Writing a tag does not save it to the library.

**Reset**, beside Spool Configuration, starts a new spool. **File & Advanced Options** contains binary import/export and the read-only Hex Editor. The Hex Editor displays the editor's data buffer, not a full physical NTAG215 memory dump.

## My Spools and privacy

The library stays in this browser's IndexedDB storage. It is not uploaded or synced. Search covers all saved spools; the list displays five per page.

Use the library's backup/restore controls to transfer spools or keep a copy. Changing from a local PC address to the hosted website creates a separate browser library, so back up before moving. Clearing site data or using private browsing can remove saved spools. Catalog lookups require network access.


## NFC Tools companion workflow

When Web NFC is unavailable, configure the spool here and choose **Export Tools → Mobile**. In NFC Tools on a compatible Android phone, use **Other → Advanced NFC commands** and paste the exported commands into **Data**. NFC Tools performs the physical tag write; My Spools remains available in the browser regardless of the NFC route.

[NFC Tools by wakdev](https://www.wakdev.com/en/apps/nfc-tools-android.html) is a separate companion application, not bundled with this editor. Advanced-command availability depends on the app edition and device; this workflow does not guarantee support on every phone or on iOS.

For tags previously prepared by another tool, the Web NFC layout selector matters. NFC Tools **Format** was verified on the tested NTAG215 to reset its NDEF placement, after which the site's **Fresh or only written in site** option worked. **Erase** and **Format** are different operations. See the [tag layout notes](./tag-layout.md) for the observed behavior.
