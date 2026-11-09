# Examples — `@keenmate/web-dropzone-core`

Building your own renderer on the headless store. The API is in [usage.md](./usage.md).

## A minimal vanilla renderer

The engine owns the file state, validation and the upload queue; the renderer owns the DOM. Feed it from
a file input and a drop target, render from `files-change` (coalesced to one event per frame).

```html
<div id="uploader">
  <input type="file" multiple>
  <div class="drop">Drop files here</div>
  <ul class="files"></ul>
</div>

<script type="module">
  import { DropzoneEngine, formatFileSize, escapeHtml } from '@keenmate/web-dropzone-core';

  const host = document.getElementById('uploader');
  const engine = new DropzoneEngine(host, {
    accept: 'image/*,.pdf',
    maxFileSize: 10 * 1024 * 1024,
    maxFileCount: 5,
    uploadFileCallback: async ({ file, signal, setProgress }) => {
      await fetch('/api/upload', { method: 'POST', body: file, signal });
      setProgress(100);
    },
  });

  host.querySelector('input').addEventListener('change', (e) => engine.addFiles(e.target.files));
  const drop = host.querySelector('.drop');
  drop.addEventListener('dragover', (e) => e.preventDefault());
  drop.addEventListener('drop', (e) => { e.preventDefault(); engine.addFiles(e.dataTransfer.files); });

  const list = host.querySelector('.files');
  host.addEventListener('files-change', ({ detail }) => {
    list.innerHTML = detail.files.map((f) => `
      <li data-id="${f.id}">
        ${escapeHtml(f.name)} · ${formatFileSize(f.size)} · ${f.status} ${Math.round(f.progress)}%
        <button data-act="remove">Remove</button>
      </li>`).join('');
  });
  list.addEventListener('click', (e) => {
    const id = e.target.closest('li')?.dataset.id;
    if (id && e.target.dataset.act === 'remove') engine.removeFile(id);
  });

  host.addEventListener('file-reject', ({ detail }) => {
    for (const { file, validation } of detail.rejectedFiles) console.warn(file.name, validation.error);
  });
</script>
```

File names are user data — escape them when you build HTML (`escapeHtml`), or set `textContent`.

## A React hook

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { DropzoneEngine } from '@keenmate/web-dropzone-core';

export function useDropzone(config) {
  const hostRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [engine, setEngine] = useState(null);

  useEffect(() => {
    const host = hostRef.current;
    const instance = new DropzoneEngine(host, config);
    const onChange = (e) => setFiles(e.detail.files);
    host.addEventListener('files-change', onChange);
    setEngine(instance);
    return () => {
      host.removeEventListener('files-change', onChange);
      instance.destroy();
    };
  }, []);

  useEffect(() => { engine?.updateConfig(config); }, [engine, config]);

  return { hostRef, files, controller: engine?.controller ?? null };
}
```

```jsx
function Uploader() {
  const config = useMemo(() => ({ maxFileCount: 3, uploadFileCallback: upload }), []);
  const { hostRef, files, controller } = useDropzone(config);
  return (
    <div ref={hostRef}>
      <input type="file" multiple onChange={(e) => controller?.addFiles(e.target.files)} />
      {files.map((f) => (
        <div key={f.id}>
          {f.name} — {f.status}
          {f.status === 'uploading' && <button onClick={() => controller.pauseFile(f.id)}>Pause</button>}
          {f.status === 'paused' && <button onClick={() => controller.resumeFile(f.id)}>Resume</button>}
          {f.status === 'error' && <button onClick={() => controller.retryFile(f.id)}>Retry</button>}
        </div>
      ))}
    </div>
  );
}
```

## An indicator-style status line

The status-surface types describe the aggregate a compact "N uploading" UI needs; compute it from
`getOverallProgress()` on every `files-change`.

```js
host.addEventListener('files-change', ({ detail }) => {
  const progress = detail.controller.getOverallProgress();
  status.textContent = progress.hasActivity
    ? `${progress.uploadingCount} uploading · ${progress.percent}%`
    : `${progress.completedCount} done`;
});
```

## Using the rendered element's store

`<web-dropzone>` (from `@keenmate/web-dropzone`) is the same store with a renderer on top. A custom
satellite written in any framework depends only on its `controller` and its events:

```js
const store = document.getElementById('uploads');   // <web-dropzone id="uploads">
await store.whenReady();
const controller = store.controller;                 // DropzoneController
store.addEventListener('files-change', ({ detail }) => render(detail.files));
controller.addFiles(myFiles);
```
