import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
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

async function runDryRun() {
  const backupPath = path.resolve(__dirname, '../sources/cloudinary-old-assets-backup.json');
  const assets: AssetDetail[] = JSON.parse(readFileSync(backupPath, 'utf8'));

  const allowedPrefixes = [
    'hotel-booking/hotels/',
    'hotel-booking/room-types/',
    'hotel-booking/reviews/',
  ];

  const approvedForDeletion: string[] = [];
  const rejectedOutsideScope: string[] = [];

  for (const a of assets) {
    if (allowedPrefixes.some((p) => a.public_id.startsWith(p))) {
      approvedForDeletion.push(a.public_id);
    } else {
      rejectedOutsideScope.push(a.public_id);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    totalAssetsUnderHotelBooking: assets.length,
    allowedPrefixes,
    approvedCount: approvedForDeletion.length,
    rejectedCount: rejectedOutsideScope.length,
    rejectedAssets: rejectedOutsideScope,
    otherAppFoldersPreserved: ['lms', 'oneshop', 'samples'],
    summaryByFolder: {
      'hotel-booking/hotels': assets.filter((a) => a.public_id.startsWith('hotel-booking/hotels/')).length,
      'hotel-booking/room-types': assets.filter((a) => a.public_id.startsWith('hotel-booking/room-types/')).length,
      'hotel-booking/reviews': assets.filter((a) => a.public_id.startsWith('hotel-booking/reviews/')).length,
    },
    samplePublicIdsToDelete: approvedForDeletion.slice(0, 10),
    safetyStatus: rejectedOutsideScope.length === 0 ? 'SAFE_FOR_CONFIRMATION' : 'UNSAFE_HAS_UNEXPECTED_ASSETS',
  };

  const reportPath = path.resolve(__dirname, '../sources/cloudinary-dry-run-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log('=== CLOUDINARY CLEANUP DRY-RUN REPORT ===');
  console.log(`Cloud Name: ${report.cloudName}`);
  console.log(`Total Project Assets Found: ${report.totalAssetsUnderHotelBooking}`);
  console.log(`Approved For Deletion: ${report.approvedCount}`);
  console.log(`Summary By Folder:`, report.summaryByFolder);
  console.log(`Other Application Folders (PROTECTED):`, report.otherAppFoldersPreserved);
  console.log(`Safety Status: ${report.safetyStatus}`);
  console.log(`Report written to ${reportPath}`);
}

runDryRun().catch((err) => {
  console.error('Dry-run failed:', err);
  process.exit(1);
});
