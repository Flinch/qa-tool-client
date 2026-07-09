// Downscales + re-encodes an image client-side before it rides along in a
// JSON payload (no object storage configured — see server/db/migrate.js).
export function compressImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('Could not read image'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024

// Shared validate-and-compress step for an <input type="file"> change event.
// Returns a compressed data URL, or throws with a message suitable for a toast.
export async function handleImageFile(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large (max 15MB)')
  return compressImage(file)
}
