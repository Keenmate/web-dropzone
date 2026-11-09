# Examples — `@keenmate/web-dropzone`

Worked patterns beyond the README's quick start. The API is in [usage.md](./usage.md); the live,
runnable versions are the example pages in the repository (`examples-*.html`, `npm run dev`).

## Upload with progress, cancel and retry

`uploadFileCallback` turns the dropzone into an upload queue: added files run through a worker pool
(`concurrency`), `setProgress` drives the row bars, and `signal` aborts on cancel. A rejection marks
the file `error` (retryable); `retryPolicy` retries automatically with backoff.

```html
<web-dropzone id="docs" display-mode="detailed" concurrency="2" max-file-size="20MB"></web-dropzone>

<script type="module">
  import '@keenmate/web-dropzone';

  const dropzone = document.getElementById('docs');

  dropzone.uploadFileCallback = ({ file, signal, setProgress }) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress((e.loaded / e.total) * 100);
      xhr.onload = () => (xhr.status < 300
        ? resolve({ metadata: { serverId: xhr.responseText } })
        : reject(new Error(`HTTP ${xhr.status}`)));
      xhr.onerror = () => reject(new Error('Network error'));
      signal.addEventListener('abort', () => { xhr.abort(); reject(signal.reason); });
      const body = new FormData();
      body.append('file', file);
      xhr.send(body);
    });

  dropzone.retryPolicy = { attempts: 3, delayMs: 1000, backoff: 2 };

  // Server-side cleanup when an uploaded file is removed
  dropzone.addEventListener('file-delete', ({ detail }) => {
    const id = detail.file.metadata?.serverId;
    if (id) fetch(`/api/upload/${id}`, { method: 'DELETE' });
  });
</script>
```

## Decoupled picker, list, progress and indicator

A headless store (no display attributes) with satellites placed wherever the layout needs them — the
picker in a form, the list in a side panel, a progress strip, and a floating status chip whose drawer
shows the whole queue.

```html
<web-dropzone id="uploads" name="files" max-file-count="20"></web-dropzone>

<form class="editor">
  <input name="title">
  <web-dropzone-picker for="uploads" selector-appearance="button"></web-dropzone-picker>
</form>

<aside>
  <web-dropzone-list for="uploads" list-appearance="detailed"></web-dropzone-list>
  <web-dropzone-progress for="uploads"></web-dropzone-progress>
</aside>

<web-dropzone-indicator for="uploads" position="right"></web-dropzone-indicator>
```

## Two pickers, one queue, different upload targets

Per-picker routing: each picker stamps its own `uploadFileCallback` / `uploadMetadata` on the files it
adds, while one list and one indicator show the shared queue.

```html
<web-dropzone id="cloud" name="files"></web-dropzone>
<web-dropzone-picker id="pub"  for="cloud" selector-appearance="button" labels='{"selectFiles": "Add public files"}'></web-dropzone-picker>
<web-dropzone-picker id="priv" for="cloud" selector-appearance="button" labels='{"selectFiles": "Add private files"}'></web-dropzone-picker>
<web-dropzone-list for="cloud" list-appearance="rolling"></web-dropzone-list>
<web-dropzone-indicator for="cloud"></web-dropzone-indicator>

<script type="module">
  import '@keenmate/web-dropzone';
  const upload = (bucket) => async ({ file, signal, setProgress }) => {
    await fetch(`/api/${bucket}`, { method: 'POST', body: file, signal });
    setProgress(100);
  };
  document.getElementById('pub').uploadFileCallback = upload('public');
  document.getElementById('priv').uploadFileCallback = upload('private');
</script>
```

## Form field with validation and a confirm gate

The dropzone submits real `File` entries with its form, enforces `min-file-count` through the native
constraint API, and can ask before a batch is added or removed.

```html
<form id="claim" action="/claims" method="post" enctype="multipart/form-data">
  <input name="subject" required>
  <web-dropzone name="evidence" accept="image/*,.pdf" min-file-count="1" max-file-count="5"
                max-file-size="10MB" display-mode="grid" show-thumbnails></web-dropzone>
  <button>Submit claim</button>
</form>

<script type="module">
  import '@keenmate/web-dropzone';
  const dropzone = document.querySelector('web-dropzone[name="evidence"]');

  dropzone.beforeFilesAddCallback = async ({ files }) =>
    files.some((f) => f.size > 5 * 1024 * 1024) && !confirm('Some files are large. Add them anyway?')
      ? false
      : undefined;

  dropzone.addEventListener('file-reject', ({ detail }) => {
    for (const { file, validation } of detail.rejectedFiles) toast(`${file.name}: ${validation.error}`);
  });
</script>
```

## Compact field with a drag overlay

A one-line summary inside a form; dragging files anywhere over the form shows a full overlay to drop
on, and the summary opens a popover with the list.

```html
<form id="message">
  <textarea name="body"></textarea>
  <web-dropzone display-mode="compact" overlay-target="#message" storage-key="message-attachments"
                labels='{"overlay": "Drop attachments here"}'></web-dropzone>
  <button>Send</button>
</form>
```

`storage-key` remembers the user's popover size (files are never persisted).

## React

React passes attributes as strings and doesn't know custom-element events, so wire the store in an
effect: one `ref`, one listener on `files-change` (coalesced to one update per frame), and render your
own list from `detail.files`.

```jsx
import { useEffect, useRef, useState } from 'react';
import '@keenmate/web-dropzone';

export function Uploader({ upload }) {
  const storeRef = useRef(null);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const store = storeRef.current;
    store.uploadFileCallback = upload;
    const onChange = (e) => setFiles(e.detail.files);
    store.addEventListener('files-change', onChange);
    return () => store.removeEventListener('files-change', onChange);
  }, [upload]);

  return (
    <>
      <web-dropzone ref={storeRef} id="rx-store" render-mode="headless" multiple max-file-count="6" />
      <web-dropzone-picker for="rx-store" />
      <ul>
        {files.map((f) => (
          <li key={f.id}>
            {f.name} — {f.status} {Math.round(f.progress)}%
            {f.status === 'error' && <button onClick={() => storeRef.current.retryFile(f.id)}>Retry</button>}
          </li>
        ))}
      </ul>
    </>
  );
}
```

## Vue

Tell the compiler the tags are custom elements, then use a template `ref` and `onMounted`.

```js
import { createApp, ref, onMounted, onBeforeUnmount } from 'vue';
import '@keenmate/web-dropzone';

const app = createApp({
  setup() {
    const storeRef = ref(null);
    const files = ref([]);
    const onChange = (e) => { files.value = e.detail.files; };
    onMounted(() => storeRef.value.addEventListener('files-change', onChange));
    onBeforeUnmount(() => storeRef.value?.removeEventListener('files-change', onChange));
    return { storeRef, files };
  },
  template: `
    <web-dropzone ref="storeRef" id="vu-store" render-mode="headless" multiple></web-dropzone>
    <web-dropzone-picker for="vu-store" :labels="{ prompt: 'Drop files for Vue' }"></web-dropzone-picker>
    <ul><li v-for="f in files" :key="f.id">{{ f.name }} — {{ f.status }}</li></ul>`,
});
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('web-dropzone');
app.mount('#app');
```

## A themed instance

Design-system tokens for the page, component tokens for one subtree — the satellites the store mounts
inherit them (see [theming.md](./theming.md)).

```css
:root {
  --base-primary-color: #0d9488;
  --base-border-radius-lg: 1.2;
}

.gallery web-dropzone {
  --dz-rem: 9px;
  --dz-dropzone-border: 2px dashed #99f6e4;
  --dz-preview-grid-columns: repeat(auto-fill, minmax(140px, 1fr));
  --dz-preview-status-overlay-bg: rgb(15 23 42 / 0.6);
}
```

```html
<div class="gallery">
  <web-dropzone accept="image/*" list-appearance="grid" grid-layout="natural" grid-status="overlay"></web-dropzone>
</div>
```

## Localised strings

Every UI string is one `labels` input, merged per key over English.

```javascript
dropzone.labels = {
  prompt: 'Přetáhněte soubory sem',
  selectFiles: 'Vybrat soubory',
  removeFile: 'Odebrat {name}',
  statusUploading: 'Nahrávám',
};
```
