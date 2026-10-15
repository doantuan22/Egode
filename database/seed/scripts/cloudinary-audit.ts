import cloudinary from '../../../backend/src/config/cloudinary';
import { env } from '../../../backend/src/config/env';

async function main() {
  console.log('Auditing Cloudinary account...');
  console.log(`Cloud Name: ${env.CLOUDINARY_CLOUD_NAME}`);

  try {
    // 1. Check root folders
    const rootFolders = await cloudinary.api.root_folders();
    console.log('Root folders:', JSON.stringify(rootFolders.folders, null, 2));

    // 2. Search resources with prefix 'hotel-booking'
    let nextCursor: string | undefined = undefined;
    const allAssets: any[] = [];
    do {
      const res: any = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'hotel-booking',
        max_results: 500,
        next_cursor: nextCursor,
      });
      allAssets.push(...res.resources);
      nextCursor = res.next_cursor;
    } while (nextCursor);

    console.log(`Found ${allAssets.length} assets with prefix 'hotel-booking'.`);
    const byFolder: Record<string, number> = {};
    for (const a of allAssets) {
      const folder = a.public_id.split('/').slice(0, -1).join('/');
      byFolder[folder] = (byFolder[folder] || 0) + 1;
    }
    console.log('Asset counts by folder:', byFolder);

    // Sample 5 assets
    console.log('Sample assets:', allAssets.slice(0, 5).map(a => ({ public_id: a.public_id, secure_url: a.secure_url, bytes: a.bytes })));

    // Check if there are assets OUTSIDE hotel-booking
    const nonProjectAssets: any[] = [];
    const allRootRes: any = await cloudinary.api.resources({
      type: 'upload',
      max_results: 100,
    });
    for (const a of allRootRes.resources) {
      if (!a.public_id.startsWith('hotel-booking/')) {
        nonProjectAssets.push(a.public_id);
      }
    }
    console.log(`Non-project assets detected in sample (if any): ${nonProjectAssets.length}`, nonProjectAssets);
  } catch (err) {
    console.error('Audit failed:', err);
  }
}

main();
