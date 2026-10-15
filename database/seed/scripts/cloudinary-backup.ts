import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import cloudinary from '../../../backend/src/config/cloudinary';
import { env } from '../../../backend/src/config/env';

interface AssetDetail {
  public_id: string;
  secure_url: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  created_at: string;
  folder: string;
}

async function backupAssets() {
  console.log(`Auditing and backing up assets under 'hotel-booking' prefix...`);
  console.log(`Cloudinary Cloud Name: ${env.CLOUDINARY_CLOUD_NAME}`);

  let nextCursor: string | undefined = undefined;
  const allAssets: AssetDetail[] = [];

  do {
    const res: any = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'hotel-booking',
      max_results: 500,
      next_cursor: nextCursor,
    });
    for (const r of res.resources) {
      allAssets.push({
        public_id: r.public_id,
        secure_url: r.secure_url,
        format: r.format,
        bytes: r.bytes,
        width: r.width,
        height: r.height,
        created_at: r.created_at,
        folder: r.folder ?? r.public_id.split('/').slice(0, -1).join('/'),
      });
    }
    nextCursor = res.next_cursor;
  } while (nextCursor);

  console.log(`Total 'hotel-booking' assets retrieved: ${allAssets.length}`);

  const backupDir = path.resolve(__dirname, '../sources');
  mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'cloudinary-old-assets-backup.json');
  writeFileSync(backupPath, JSON.stringify(allAssets, null, 2) + '\n', 'utf8');
  console.log(`Backup saved to ${backupPath}`);

  // Summary breakdown
  const byFolder: Record<string, number> = {};
  for (const a of allAssets) {
    byFolder[a.folder] = (byFolder[a.folder] || 0) + 1;
  }
  console.log('Breakdown by folder:', byFolder);
}

backupAssets().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
