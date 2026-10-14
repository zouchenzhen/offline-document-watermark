# Privacy and security boundaries

[中文（默认）](PRIVACY.md) · **English**

Files are parsed and rendered in browser memory. The application has no upload endpoint, telemetry, advertising, remote fonts or external CDN. PDF.js, its worker, CMaps, fonts and decoding resources are bundled in the released HTML. The Content Security Policy sets `connect-src 'none'` to prohibit network connections. The app uses neither IndexedDB nor a Service Worker. Optional settings memory uses localStorage, so the app does write selected settings to persistent browser storage.

## Settings storage and session materials

“Remember settings on this browser” is enabled by default. It stores the watermark text and supported parameters locally and retains up to 10 distinct recent configurations. Edits are saved after about 450 milliseconds. You can restore a configuration, turn remembering off or clear saved configurations. Your text may contain a recipient, purpose or date. This storage is not encrypted; people, extensions or software with access to the browser's data may be able to read it.

Version 0.5 adds Chinese and English interface controls. A fresh installation always starts in Chinese, regardless of the browser or system language. Your explicit language choice is included in the existing settings whitelist and storage key. With remembering enabled, it can be restored on the next visit or from configuration history. Turning remembering off or clearing configurations makes the language choice session-only; a new page starts in Chinese again. Changing the interface language does not rewrite your watermark text, filenames, trace IDs or verification content, and does not change the local-processing or network boundaries.

Saved configurations do not contain imported materials, material filenames, trace IDs, temporary export page ranges, verification results or trace records. Import and verification filenames are displayed only during the current page session. You must download exported files and trace records yourself. After a reload, materials must be selected again.

Closing the page does not delete saved watermark text. Turning remembering off clears the text and history and leaves only the schema version and `enabled:false` in the existing configuration key. A reload keeps remembering disabled. Clearing materials and clearing settings are separate actions. Different browsers, websites and local `file:` URLs may have different storage scopes. Private browsing, browser policies, unavailable storage or a full disk can prevent settings from being saved or restored.

## Online and offline use

- The online GitHub Pages version requests a static webpage when first opened. Hosting providers may log the IP address, User-Agent and normal access information. Local file processing does not mean visiting a website leaves no logs.
- Selected materials are processed inside the current browser page; they are not uploaded to GitHub.
- For sensitive files, download a fixed HTML release, verify its SHA-256 checksum and use it while disconnected. Disable unnecessary browser extensions and save to a local folder that does not synchronize to cloud storage. Close the tool page before reconnecting. Clear remembered settings separately if you do not want the watermark text to remain.
- You can review the fixed-version source, including with AI assistance. AI review cannot guarantee that the tool is free of vulnerabilities or that the browser, computer or recipient is safe.

## Exported content

Original EXIF data, PDF attachments, forms, links, unwatermarked source objects and OCR layers are not copied into the output. PDF export always produces an image-only PDF containing a composited JPEG image of each selected page. New visible watermarks, hidden IDs and metadata are applied according to their independent switches in the same export; no second conversion step is needed.

When metadata is enabled, the current purpose text, trace ID, time and output parameters are written to the file. Metadata is not encrypted; recipients can read or remove it. Trace records are JSON files that you explicitly download. The app does not automatically identify recipients or upload or persist these records.

The optional time prefix is enabled by default. At export, the local clock supplies a UTC timestamp to the nearest second, giving an ID in the format `YYYYMMDDTHHmmssZ-16HEX`. The full ID is embedded in pixels when hidden marking is enabled, added to metadata when metadata is enabled, and used in the filename and trace record. The time-prefix switch does not force either marking option on. `Z` means UTC; China Standard Time is UTC plus eight hours. Turning the prefix off uses the older 16HEX ID. Older files and OWM2 pixel markers remain readable. The computer's clock can be changed, so this is not a trusted timestamp or digital signature.

“Add a new visible watermark” is enabled by default. Turning it off preserves the existing page appearance without adding new visible text. An optional purpose note is included only when metadata is enabled, and hidden marking has its own switch. PDF output rasterizes the page together with existing text and watermarks. PNG/JPEG export saves the current page. The tool does not authenticate existing watermarks. Older `add`/`flatten` configuration and record values remain compatible; they do not represent a two-step export workflow. Downloading the offline tool saves fixed application code and public examples, not the current materials, watermark text or verification results.

## Hidden IDs do not guarantee protection against redistribution

The experimental DCT pixel marker is an aid to identifying copies. Its format is public and has no secret key; it can be forged or deliberately removed. Cropping, resizing, screenshots and strong compression may destroy it. Neither metadata nor hidden IDs are digital signatures, and neither independently identifies a person who distributed a file or establishes a forensic conclusion.

Using a different ID for each copy and keeping your own “ID–recipient” records can help determine which copy has appeared. That mapping is not identity verification, and does not prove that the recipient was the person who redistributed it.

Turning hidden marking off stops adding a new marker. It does not erase markers already present in the input image or PDF. Re-rendering removes source metadata, but that does not prove that existing pixel markers have been removed.

Clearing materials or closing the page does not prove that the operating system securely erased memory. The tool cannot control browser extensions, malware, screenshots, cloud synchronization or recipients.

## Leaving the page

After editing text, parameters, random IDs or export page ranges, or selecting materials or a verification file, the app requests a native browser `beforeunload` confirmation for reloads, closing or navigation.

Opening the file picker or importing a file is not page navigation or a server upload, so that action itself does not trigger a leaving-page prompt. With remembering enabled, pending supported settings are written locally when leaving is requested. Trace IDs, temporary page ranges, materials and trace records are not included; selected files must be chosen again after a reload.

The browser decides whether a prompt is shown and supplies its wording, normally requiring prior interaction with the page. Mobile background termination, crashes and some closing actions may not trigger it. The prompt cannot confirm that a download was successfully written to disk, and cannot replace saving exported files and trace records yourself.

## Program limitations

Encrypted PDFs are not supported. Complex fonts, unusual scan encodings, large pages or damaged files may fail to import or render incompletely. Check the exported file before sending it. Limits on decoded image dimensions cannot entirely prevent peak memory use during decoding.

PDF output does not preserve digital signatures or editable structures. The tool does not claim compliance with forensic, identity-document review or electronic-signature standards.
