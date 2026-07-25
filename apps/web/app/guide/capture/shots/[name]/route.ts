import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getGuideAccess } from '@/lib/guide-access'

/**
 * Serves the capture-guide screenshots to staff only.
 *
 * The images live OUTSIDE `public/` (anything in public/ is served to anyone with
 * the URL, which would leave a staff-gated page's contents readable by strangers),
 * so they are read off disk here behind the same gate as the page itself.
 */

const SHOTS_DIR = path.join(process.cwd(), 'guide-shots', 'capture')

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

// Filenames we are willing to look up at all — no separators, no traversal.
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*\.(png|jpg|jpeg|webp|gif)$/i

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { isStaff } = await getGuideAccess()
  if (!isStaff) return new Response('Not found', { status: 404 })

  const { name } = await params
  if (!SAFE_NAME.test(name)) return new Response('Not found', { status: 404 })

  const filePath = path.join(SHOTS_DIR, name)
  // Belt and braces: never read outside the shots directory.
  if (path.dirname(filePath) !== SHOTS_DIR) return new Response('Not found', { status: 404 })

  try {
    const file = await readFile(filePath)
    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': CONTENT_TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
        // Private: cacheable in the staff member's own browser, never in a shared cache.
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
