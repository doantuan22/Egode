import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import cloudinary from '../../../backend/src/config/cloudinary';
import { env } from '../../../backend/src/config/env';

interface AssetDetail {
  public_id: string;
  secure_url: string;
  folder: string;
}

async function cleanupOldAssets() {
  console.log(`Starting Cloudinary cleanup for cloud: ${env.CLOUDINARY_CLOUD_NAME}...`);
  const backupPath = path.resolve(__dirname, '../sources/cloudinary-old-assets-backup.json');
  const assets: AssetDetail[] = JSON.parse(readFileSync(backupPath, 'utf8'));

  const allowedPrefixes = [
    'hotel-booking/hotels/',
    'hotel-booking/room-types/',
    'hotel-booking/reviews/',
  ];

  // Double check all assets match the allowed prefix
  const toDelete = assets.filter((a) =>
    allowedPrefixes.some((p) => a.public_id.startsWith(p))
  );

  if (toDelete.length !== assets.length) {
    throw new Error(
      `Safety guard triggered: ${assets.length - toDelete.length} assets do not match project prefixes!`
    );
  }

  console.log(`Deleting ${toDelete.length} old demo assets in batches of 50...`);

  const deletedList: string[] = [];
  const failedList: Array<{ id: string; error: string }> = [];

  const BATCH_SIZE = 50;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE).map((a) => a.public_id);
    try {
      const res: any = await cloudinary.api.delete_resources(batch, {
        resource_type: 'image',
        type: 'upload',
      });
      for (const [id, status] of Object.entries(res.deleted || {})) {
        if (status === 'deleted') {
          deletedList.push(id);
        } else {
          failedList.push({ id, error: String(status) });
        }
      }
      console.log(`  Processed batch ${i + 1}-${Math.min(i + BATCH_SIZE, toDelete.length)}: ${Object.keys(res.deleted || {}).length} responses.`);
    } catch (err: any) {
      console.error(`  Batch ${i} failed:`, err.message);
      for (const id of batch) failedList.push({ id, error: err.message });
    }
  }

  const logResult = {
    executedAt: new Date().toISOString(),
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    totalTargeted: toDelete.length,
    totalDeleted: deletedList.length,
    totalFailed: failedList.length,
    failedItems: failedList,
  };

  const logPath = path.resolve(__dirname, '../sources/cloudinary-cleanup-log.json');
  writeFileSync(logPath, JSON.stringify(logResult, null, 2) + '\n', 'utf8');

  console.log(`\nCleanup complete! Deleted: ${deletedList.length}, Failed: ${failedList.length}`);
  console.log(`Cleanup log written to ${logPath}`);
}

cleanupOldAssets().catch((err) => {
  console.error('Cleanup execution failed:', err);
  process.exit(1);
});
