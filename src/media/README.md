# Lazy media tools

Construct `LocalMediaTools` with a writable `dataDirectory`; in the Electron main
process this should be `app.getPath('userData')`, not the installation directory.
Construction does not touch disk or download dependencies. The first
`ensureToolDependencies()`, `runFFmpeg()`, `trim()` or `concat()` request installs
the executable under `<dataDirectory>/.plugins/ffmpeg/`. Later calls validate and
reuse it. No FFmpeg binary or Python environment is bundled with the application.

Windows x64 uses the pinned gzip binary from
[ffmpeg-static b6.1.1](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1)
and its published SHA-256 for the uncompressed executable. Deployments on other
platforms must supply an HTTPS artifact and its expected digest. Binary updates
must update the URL and trusted digest together. The upstream distribution's
licenses and source/build information apply to downloaded FFmpeg binaries.

Downloads have a timeout and compressed/decompressed size limits. A temporary file
is hashed and probed with `-version` before publication. An empty directory lock
serializes installations across processes; failure removes staging/lock files.
A process crash can leave `.install-lock`: subsequent callers fail at the install
deadline rather than waiting forever. Remove that empty lock only after confirming
no installation process is running. Cancellation of a waiter does not cancel the
process holding the lock.

`trim()` re-encodes for accurate cut intervals. `concat()` uses stream copy and
requires matching codecs/stream layouts. Both refuse to overwrite outputs and
reject an output path equal to an input. Failed FFmpeg jobs may leave partial media
outputs; they never delete user inputs. Generic `runFFmpeg()` is for trusted backend
callers that need additional audio/video filters, including 360-degree processing.

No Python-dependent operation is currently implemented, so no Python download or
script execution is triggered.

Run the real download and audio round-trip test explicitly:

```powershell
$env:SYNAPSE_MEDIA_SMOKE = '1'
node --test tests/unit/media.test.ts
```

The test installs in an isolated test directory, generates a tone, trims it,
concatenates two clips, verifies the result's duration and removes its fixtures.
