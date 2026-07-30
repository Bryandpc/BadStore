import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import Busboy from 'busboy'
import crypto from 'crypto'
import path from 'path'

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.R2_BUCKET || 'tcg'
const R2_PUBLIC = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

export const config = { api: { bodyParser: false } }

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const bb = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } })
  const chunks = []
  let mime = 'application/octet-stream'
  let ext = ''

  bb.on('file', (_field, stream, info) => {
    mime = info.mimeType
    ext = path.extname(info.filename).toLowerCase() || '.jpg'
    stream.on('data', d => chunks.push(d))
    stream.on('error', () => res.status(500).json({ error: 'Stream error' }))
  })

  bb.on('finish', async () => {
    if (chunks.length === 0) return res.status(400).json({ error: 'Nenhum arquivo recebido' })
    const buffer = Buffer.concat(chunks)
    const filename = `${crypto.randomUUID()}${ext}`
    const key = `custom-orders/${filename}`

    try {
      await client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mime,
      }))
      const url = R2_PUBLIC ? `${R2_PUBLIC}/${key}` : null
      if (!url) return res.status(500).json({ error: 'R2_PUBLIC_URL não configurado' })
      res.json({ url })
    } catch (e) {
      console.error('[upload-reference]', e)
      res.status(500).json({ error: 'Falha no upload' })
    }
  })

  bb.on('error', () => res.status(500).json({ error: 'Parse error' }))
  req.pipe(bb)
}
