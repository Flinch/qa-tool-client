const ALLOWED_EXTENSIONS = ['txt', 'md', 'pdf', 'docx']

// Keeps the base64 payload comfortably under the server's 8mb JSON body
// limit (base64 inflates size by ~33%).
const MAX_DOC_BYTES = 5 * 1024 * 1024

// Reads a requirements doc client-side and base64-encodes it, same pattern
// as handleImageFile in imageUpload.js — no object storage configured for
// this app, so the file rides along in the JSON request body.
export function readDocumentFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      reject(new Error('Please choose a .txt, .md, .pdf, or .docx file'))
      return
    }
    if (file.size > MAX_DOC_BYTES) {
      reject(new Error('File is too large (max 5MB)'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve({ filename: file.name, mimetype: file.type, data: base64 })
    }
    reader.readAsDataURL(file)
  })
}
