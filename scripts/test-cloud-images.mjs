// Real browser encoder + IndexedDB + sync transport regression tests.
// Optional arguments: paths to existing images (read-only measurements).
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined })
const page = await browser.newPage()
const report = []
try {
  await page.goto(server.resolvedUrls.local[0])
  for (const file of [null, ...process.argv.slice(2)]) {
    const input = file ? await readFile(file) : null
    const result = await page.evaluate(async ({ data, name }) => {
      const { normalizeArtworkImage, createCloudDisplayImage } = await import('/src/utils/imageNormalize.js')
      let source
      if (data) {
        source = new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))])
      } else {
        // Deterministic artwork with color gradients, fine lines and lettering.
        const canvas = new OffscreenCanvas(3600, 2700), ctx = canvas.getContext('2d')
        const gradient = ctx.createLinearGradient(0, 0, 3600, 2700)
        gradient.addColorStop(0, '#efbb78'); gradient.addColorStop(.5, '#35497a'); gradient.addColorStop(1, '#e8dec3')
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 3600, 2700)
        for (let i = 0; i < 300; i++) {
          ctx.strokeStyle = `hsl(${i * 17 % 360} 50% 50%)`; ctx.lineWidth = i % 4 + 1
          ctx.beginPath(); ctx.arc((i * 257) % 3600, (i * 197) % 2700, 20 + i % 190, 0, Math.PI * 2); ctx.stroke()
        }
        ctx.font = '100px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('Piecelogue · pencil & paint', 120, 220)
        source = await canvas.convertToBlob({ type: 'image/png' })
      }
      const local = await normalizeArtworkImage(source)
      const display = await createCloudDisplayImage(source)
      const jpegFallback = await createCloudDisplayImage(source, {
        canvasToBlob: (canvas, type, quality) => canvas.convertToBlob({ type: type === 'image/webp' ? 'image/png' : type, quality }),
      })
      const srcBitmap = await createImageBitmap(source), displayBitmap = await createImageBitmap(display.blob)
      const pixels = bitmap => {
        const c = new OffscreenCanvas(display.width, display.height), ctx = c.getContext('2d')
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
        ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, 0, 0, c.width, c.height)
        return ctx.getImageData(0, 0, c.width, c.height).data
      }
      const a = pixels(srcBitmap), b = pixels(displayBitmap)
      let squaredError = 0
      for (let i = 0; i < a.length; i += 4) for (let ch = 0; ch < 3; ch++) squaredError += (a[i + ch] - b[i + ch]) ** 2
      const psnr = 10 * Math.log10(255 ** 2 / (squaredError / (a.length / 4 * 3)))
      // Mean 8x8 luminance SSIM, aligned to the same displayed pixel size.
      let ssim = 0, blocks = 0
      for (let y = 0; y + 8 <= display.height; y += 8) for (let x = 0; x + 8 <= display.width; x += 8) {
        let sa = 0, sb = 0, aa = 0, bb = 0, ab = 0
        for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) {
          const i = ((y + dy) * display.width + x + dx) * 4
          const va = .299 * a[i] + .587 * a[i + 1] + .114 * a[i + 2]
          const vb = .299 * b[i] + .587 * b[i + 1] + .114 * b[i + 2]
          sa += va; sb += vb; aa += va * va; bb += vb * vb; ab += va * vb
        }
        const ma = sa / 64, mb = sb / 64
        ssim += ((2 * ma * mb + 6.5025) * (2 * (ab / 64 - ma * mb) + 58.5225)) /
          ((ma * ma + mb * mb + 6.5025) * (aa / 64 - ma * ma + bb / 64 - mb * mb + 58.5225))
        blocks++
      }
      srcBitmap.close(); displayBitmap.close()
      const toUrl = blob => new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob) })
      return {
        name, inputBytes: source.size, previousLocalBytes: local.original.size, thumbnailBytes: local.thumbnail.size,
        displayBytes: display.blob.size, fallbackBytes: jpegFallback.blob.size,
        width: display.width, height: display.height, mimeType: display.blob.type,
        psnr, ssim: ssim / blocks,
        sourceUrl: await toUrl(source), displayUrl: await toUrl(display.blob),
      }
    }, { data: input?.toString('base64'), name: file ? basename(file) : 'generated-artwork' })
    assert.ok(result.width <= 2048 && result.height <= 2048)
    assert.ok(result.displayBytes < 1024 * 1024, `${result.name}: display target`)
    assert.ok(result.fallbackBytes <= 2 * 1024 * 1024, `${result.name}: JPEG fallback limit`)
    assert.ok(result.psnr > 30, `${result.name}: PSNR ${result.psnr}`)
    assert.ok(result.ssim > .97, `${result.name}: SSIM ${result.ssim}`)
    if (result.inputBytes > 1_000_000) assert.ok(result.displayBytes < result.inputBytes * .5)
    if (process.env.CLOUD_IMAGE_REPORT_DIR) {
      const directory = resolve(process.env.CLOUD_IMAGE_REPORT_DIR)
      await mkdir(directory, { recursive: true })
      await page.evaluate(({ sourceUrl, displayUrl, name }) => {
        document.body.innerHTML = ''
        document.body.style.cssText = 'margin:0;background:#eee;font:18px sans-serif'
        const title = document.createElement('p'); title.textContent = `${name}: existing image (left), cloud display (right)`; document.body.append(title)
        const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px'; document.body.append(row)
        for (const url of [sourceUrl, displayUrl]) { const img = new Image(); img.src = url; img.style.cssText = 'width:49%;object-fit:contain;align-self:start'; row.append(img) }
      }, result)
      await page.setViewportSize({ width: 1600, height: 1100 })
      await page.waitForFunction(() => [...document.images].every(img => img.complete))
      await page.screenshot({ path: `${directory}/${result.name}-comparison.png`, fullPage: true })
      await writeFile(`${directory}/${result.name}-display.webp`, Buffer.from(result.displayUrl.split(',')[1], 'base64'))
    }
    const { sourceUrl, displayUrl, ...stats } = result
    report.push(stats)
  }

  // Exercise real import/save, forced upload, automatic queue, restore, backup,
  // retry and cache eviction. All API requests below are intercepted locally.
  const integration = await page.evaluate(async () => {
    const { db } = await import('/src/db/database.js')
    const { createArtwork } = await import('/src/db/artworkService.js')
    const { saveLibraryToCloud } = await import('/src/utils/cloudSave.js')
    const { restoreLibraryFromCloud } = await import('/src/utils/cloudRestore.js')
    const { buildLocalBackup, importLocalBackup } = await import('/src/utils/localBackup.js')
    const { startSyncProcessor, stopSyncProcessor } = await import('/src/sync/processor.js')
    const { setActiveSyncUserId } = await import('/src/sync/activeUser.js')
    const { enqueueArtworkImageSync, enqueueArtworkSync } = await import('/src/sync/enqueue.js')
    const { resolveCloudImageForSync } = await import('/src/db/cloudDisplayService.js')
    const { hashBytes } = await import('/src/sync/imageHash.js')
    const check = (ok, message) => { if (!ok) throw Error(message) }
    await db.open()
    await Promise.all(db.tables.map(t => t.clear()))
    const canvas = new OffscreenCanvas(3200, 2400), ctx = canvas.getContext('2d')
    ctx.fillStyle = '#396784'; ctx.fillRect(0, 0, 3200, 2400)
    ctx.fillStyle = '#fff'; ctx.font = '120px serif'; ctx.fillText('Cloud display quality', 100, 300)
    const source = await canvas.convertToBlob({ type: 'image/png' })
    const artwork = await createArtwork({ title: 'Round trip' }, source)
    const raw = await db.artworkImages.get(`${artwork.id}:source`)
    check(await hashBytes(raw.data) === await hashBytes(await source.arrayBuffer()), 'true original preserved')
    const objects = new Map(), requests = []
    let metadata = []
    const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
    const realFetch = window.fetch
    window.fetch = async (path, options = {}) => {
      if (!String(path).startsWith('/api/')) return realFetch(path, options)
      requests.push({ path, method: options.method || 'GET' })
      if (path === '/api/auth/me') return json({ authenticated: true, user: { id: 'test-user' } })
      if (path === '/api/cloud/status') return json({ status: {} })
      if (String(path).startsWith('/api/cloud/library')) return json({ library: { folders: [], artworks: metadata } })
      if (path === '/api/cloud/artworks') {
        metadata = JSON.parse(options.body).artworks.map(a => ({ ...a, revision: 1, hasOriginal: true, hasThumbnail: true }))
        return json({ results: metadata.map(a => ({ id: a.id, revision: 1 })) })
      }
      if (String(path).match(/\/(original|thumbnail)$/)) {
        if (options.method === 'PUT') { objects.set(path, new Blob([options.body], { type: options.headers['Content-Type'] })); return json({ ok: true }) }
        return new Response(objects.get(path))
      }
      throw Error(`Unexpected request: ${path}`)
    }
    try {
      await saveLibraryToCloud({ userId: 'test-user' })
      const uploaded = objects.get(`/api/cloud/artworks/${artwork.id}/original`)
      check(uploaded.type === 'image/webp', 'force-save uploads WebP display')
      const uploadHash = await hashBytes(await uploaded.arrayBuffer())
      check((await db.syncImageHashes.toArray())[0].originalHash === uploadHash, 'force-save records cloud byte hash')
      const countUploads = () => requests.filter(r => r.method === 'PUT' && r.path.endsWith('/original')).length
      const startCount = countUploads()
      setActiveSyncUserId('test-user')
      await enqueueArtworkImageSync(artwork.id)
      const stop = startSyncProcessor('test-user')
      for (let i = 0; i < 200 && await db.syncQueue.count(); i++) await new Promise(r => setTimeout(r, 20))
      stop(); stopSyncProcessor()
      check(await db.syncQueue.count() === 0, 'background queue completes')
      check(countUploads() === startCount, 'background does not re-upload after force-save')
      await db.artworks.clear(); await db.artworkImages.clear(); await db.syncImageHashes.clear()
      const restored = await restoreLibraryFromCloud({ userId: 'test-user' })
      check(restored.failedImageCount === 0, 'cloud restore succeeds')
      check(await hashBytes((await db.artworkImages.get(`${artwork.id}:original`)).data) === uploadHash, 'restored bytes identical')
      await db.artworkImages.delete(`${artwork.id}:display`)
      const noEncode = async () => { throw Error('cloud bytes were re-encoded') }
      const resolved = await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: noEncode })
      check(await hashBytes(resolved.bytes) === uploadHash, 'evicted cache still avoids encoding')
      const backup = await buildLocalBackup()
      await db.artworks.clear(); await db.artworkImages.clear()
      await importLocalBackup(backup)
      check(await hashBytes((await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: noEncode })).bytes) === uploadHash, 'backup preserves provenance')
      await saveLibraryToCloud({ userId: 'test-user' })
      check(await hashBytes(await objects.get(`/api/cloud/artworks/${artwork.id}/original`).arrayBuffer()) === uploadHash, 'restored force-save uploads same bytes')
      const second = await createArtwork({ title: 'Automatic upload' }, source)
      await enqueueArtworkSync(second.id)
      const stopSecond = startSyncProcessor('test-user')
      for (let i = 0; i < 200 && await db.syncQueue.count(); i++) await new Promise(r => setTimeout(r, 20))
      stopSecond(); stopSyncProcessor()
      check(await db.syncQueue.count() === 0, 'new artwork background queue completes')
      const autoImage = objects.get(`/api/cloud/artworks/${second.id}/original`)
      check(autoImage?.type === 'image/webp', 'automatic sync uploads display WebP')
      const bitmap = await createImageBitmap(autoImage)
      check(Math.max(bitmap.width, bitmap.height) === 2048, 'automatic display stays sharp at 2048px')
      bitmap.close()
      return { passed: true, displayBytes: uploaded.size, checks: 15 }
    } finally { window.fetch = realFetch; stopSyncProcessor(); setActiveSyncUserId(null) }
  })
  console.log(JSON.stringify({ samples: report, integration }, null, 2))
  if (process.env.CLOUD_IMAGE_REPORT_DIR) await writeFile(resolve(process.env.CLOUD_IMAGE_REPORT_DIR, 'measurements.json'), JSON.stringify({ samples: report, integration }, null, 2))
} finally {
  await browser.close()
  await server.close()
}
