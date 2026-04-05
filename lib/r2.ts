// Server-side R2 utility using Cloudflare's S3-compatible API.
// Only import this from Server Components, Server Actions, or Route Handlers.

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function createClient(): S3Client {
  const accountId       = process.env.CLOUDFLARE_R2_ACCOUNT_ID
  const accessKeyId     = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing Cloudflare R2 environment variables.\n' +
      'Set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and ' +
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY in .env.local'
    )
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function getBucket(): string {
  const name = process.env.CLOUDFLARE_R2_BUCKET_NAME
  if (!name) throw new Error('Missing CLOUDFLARE_R2_BUCKET_NAME environment variable.')
  return name
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  await createClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}

export async function deleteFromR2(key: string): Promise<void> {
  await createClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
  )
}

export async function getR2SignedUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = createClient()
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: expiresInSeconds }
  )
}
