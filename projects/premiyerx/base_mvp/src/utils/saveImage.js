/**
 * Save an image to the user's device. Mobile-first: Web Share API → blob download.
 */
async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

async function urlToBlob(url) {
  if (url.startsWith('data:')) return dataUrlToBlob(url)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not fetch image')
  return res.blob()
}

function buildFilename(topicLabel = 'linkedin') {
  const slug = String(topicLabel)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const date = new Date().toISOString().slice(0, 10)
  return `linkedin-${slug || 'infographic'}-${date}.png`
}

/**
 * @returns {{ ok: boolean, method?: 'share'|'download', error?: string, filename?: string }}
 */
export async function saveImageToDevice(imageUrl, { topicLabel = '', filename } = {}) {
  if (!imageUrl) {
    return { ok: false, error: 'No image to save.' }
  }

  const name = filename || buildFilename(topicLabel)

  try {
    const blob = await urlToBlob(imageUrl)
    const file = new File([blob], name, { type: blob.type || 'image/png' })

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'LinkedIn infographic',
            text: 'Save this image to your Photos or Files app.',
          })
          return { ok: true, method: 'share', filename: name }
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          return { ok: false, error: 'Save cancelled.' }
        }
        // fall through to download
      }
    }

    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = name
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)

    return { ok: true, method: 'download', filename: name }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Could not save image.',
    }
  }
}

export function saveSuccessMessage(result) {
  if (!result.ok) return result.error || 'Could not save image.'
  if (result.method === 'share') {
    return 'Share sheet opened — tap Save Image or Save to Photos.'
  }
  return `Saved as ${result.filename} — check Downloads or your Files app.`
}
