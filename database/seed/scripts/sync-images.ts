import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import cloudinary from '../../../backend/src/config/cloudinary';

interface RawImageEntry {
  hotelKey: string;
  hotelName: string;
  group: 'exterior' | 'lobby' | 'pool' | 'restaurant' | 'room';
  fileTitle: string;
  isCover?: boolean;
}

const HOTEL_IMAGES: RawImageEntry[] = [
  // H01 - Continental Saigon
  { hotelKey: 'H01', hotelName: 'Khách sạn Continental Sài Gòn', group: 'exterior', fileTitle: 'File:Hotel Continental Saigon.jpg', isCover: true },
  { hotelKey: 'H01', hotelName: 'Khách sạn Continental Sài Gòn', group: 'exterior', fileTitle: 'File:Hotel Continental Saigon 2011.jpg' },

  // H02 - Grand Hotel Saigon
  { hotelKey: 'H02', hotelName: 'Khách sạn Grand Sài Gòn', group: 'exterior', fileTitle: 'File:Grand Hotel, Saigon, 2023 (01).jpg', isCover: true },
  { hotelKey: 'H02', hotelName: 'Khách sạn Grand Sài Gòn', group: 'exterior', fileTitle: 'File:Grand Hotel, Saigon, 2023 (02).jpg' },

  // H03 - Majestic Saigon
  { hotelKey: 'H03', hotelName: 'Khách sạn Majestic Sài Gòn', group: 'exterior', fileTitle: 'File:Hotel Majestic, Ciudad Ho Chi Minh, Vietnam, 2013-08-14, DD 01.JPG', isCover: true },
  { hotelKey: 'H03', hotelName: 'Khách sạn Majestic Sài Gòn', group: 'lobby', fileTitle: 'File:Majestic Hotel Saigon loby2.JPG' },
  { hotelKey: 'H03', hotelName: 'Khách sạn Majestic Sài Gòn', group: 'restaurant', fileTitle: 'File:Majestic Hotel Saigon roof bar.JPG' },

  // H04 - Rex Hotel Saigon
  { hotelKey: 'H04', hotelName: 'Khách sạn Rex Sài Gòn', group: 'exterior', fileTitle: 'File:Rex Hotel Saigon (53853863403).jpg', isCover: true },
  { hotelKey: 'H04', hotelName: 'Khách sạn Rex Sài Gòn', group: 'exterior', fileTitle: 'File:Rex Hotel - 53299019507.jpg' },

  // H05 - Caravelle Saigon
  { hotelKey: 'H05', hotelName: 'Khách sạn Caravelle Sài Gòn', group: 'exterior', fileTitle: 'File:Caravelle Hotel Saigon 2013.jpg', isCover: true },
  { hotelKey: 'H05', hotelName: 'Khách sạn Caravelle Sài Gòn', group: 'exterior', fileTitle: 'File:Caravelle Hotel Saigon 2013-02.jpg' },

  // H06 - Sofitel Legend Metropole Hanoi
  { hotelKey: 'H06', hotelName: 'Khách sạn Sofitel Legend Metropole Hà Nội', group: 'exterior', fileTitle: 'File:Hotel Metropole Hanoi 0418.JPG', isCover: true },
  { hotelKey: 'H06', hotelName: 'Khách sạn Sofitel Legend Metropole Hà Nội', group: 'exterior', fileTitle: 'File:Sofitel Legend Metropole Hanoi, Oct 2014.jpg' },

  // H07 - InterContinental Westlake
  { hotelKey: 'H07', hotelName: 'Khách sạn InterContinental Hà Nội Westlake', group: 'exterior', fileTitle: 'File:InterContinental Hanoi Westlake Hotel 3.jpg', isCover: true },
  { hotelKey: 'H07', hotelName: 'Khách sạn InterContinental Hà Nội Westlake', group: 'exterior', fileTitle: 'File:Deja vu hotel, Tay Ho in 2014.jpg' },

  // H08 - Sheraton Hanoi Hotel
  { hotelKey: 'H08', hotelName: 'Khách sạn Sheraton Hà Nội', group: 'exterior', fileTitle: 'File:Sheraton Hanoi Hotel.jpg', isCover: true },
  { hotelKey: 'H08', hotelName: 'Khách sạn Sheraton Hà Nội', group: 'exterior', fileTitle: 'File:Pan Pacific Hanoi.jpg' },

  // H09 - Mövenpick Hotel Hanoi
  { hotelKey: 'H09', hotelName: 'Khách sạn Mövenpick Hà Nội', group: 'exterior', fileTitle: 'File:Khách sạn Movenpick, Hà Nội 001.JPG', isCover: true },

  // H10 - L'Heritage Hotel Hanoi
  { hotelKey: 'H10', hotelName: 'Khách sạn L\'Heritage Hà Nội', group: 'exterior', fileTitle: 'File:L\'Heritage Hanoi Hotel, 39-41 Hàng Gà, Hà Nội 001.JPG', isCover: true },

  // H11 - InterContinental Danang Sun Peninsula Resort
  { hotelKey: 'H11', hotelName: 'InterContinental Danang Sun Peninsula Resort', group: 'exterior', fileTitle: 'File:Danang Sun Peninsula Resort - Da Nang, Vietnam - DSC02308.JPG', isCover: true },
  { hotelKey: 'H11', hotelName: 'InterContinental Danang Sun Peninsula Resort', group: 'pool', fileTitle: 'File:InterContinental-Danang-Sun-Peninsula-Resort-2026-05-03-1.jpg' },

  // H12 - Hyatt Regency Danang
  { hotelKey: 'H12', hotelName: 'Hyatt Regency Danang Resort & Spa', group: 'pool', fileTitle: 'File:Hyatt Regency Danang, Beach View, March 2014.jpg', isCover: true },

  // H13 - Pullman Danang Beach Resort
  { hotelKey: 'H13', hotelName: 'Pullman Danang Beach Resort', group: 'exterior', fileTitle: 'File:Pullman Danang Beach Resort - Da Nang, Vietnam - DSC02282.JPG', isCover: true },
  { hotelKey: 'H13', hotelName: 'Pullman Danang Beach Resort', group: 'pool', fileTitle: 'File:Pullman Danang Beach Resort - Da Nang, Vietnam - DSC02270.JPG' },

  // H14 - The Nalod Da Nang
  { hotelKey: 'H14', hotelName: 'Khách sạn NALOD Đà Nẵng', group: 'exterior', fileTitle: 'File:Khách sạn NALOD Đà Nẵng.jpeg', isCover: true },

  // H15 - Hilton Da Nang
  { hotelKey: 'H15', hotelName: 'Khách sạn Hilton Đà Nẵng', group: 'exterior', fileTitle: 'File:Hilton Đà Nẵng 1.jpeg', isCover: true },
  { hotelKey: 'H15', hotelName: 'Khách sạn Hilton Đà Nẵng', group: 'exterior', fileTitle: 'File:Hilton Đà Nẵng 2.jpeg' },

  // H16 - Dalat Palace Heritage Hotel
  { hotelKey: 'H16', hotelName: 'Dalat Palace Heritage Hotel', group: 'exterior', fileTitle: 'File:Khach san Dalat Palace - Huy Phuong 2.jpg', isCover: true },
  { hotelKey: 'H16', hotelName: 'Dalat Palace Heritage Hotel', group: 'exterior', fileTitle: 'File:Dalat Palace Hotel 12.JPG' },

  // H17 - Vietsovpetro Hotel Da Lat
  { hotelKey: 'H17', hotelName: 'Khách sạn Vietsovpetro Đà Lạt', group: 'exterior', fileTitle: 'File:Vietsovpetro Hotel, Da Lat.JPG', isCover: true },

  // H18 - Cam Do Hotel Da Lat
  { hotelKey: 'H18', hotelName: 'Khách sạn Cẩm Đô Đà Lạt', group: 'exterior', fileTitle: 'File:Cam Do Hotel 01.jpg', isCover: true },

  // H19 - Empress Hotel Da Lat
  { hotelKey: 'H19', hotelName: 'Khách sạn Empress Đà Lạt', group: 'exterior', fileTitle: 'File:Empress Hotel, Da Lat 1.JPG', isCover: true },
  { hotelKey: 'H19', hotelName: 'Khách sạn Empress Đà Lạt', group: 'exterior', fileTitle: 'File:Empress Hotel, Da Lat 2.jpg' },

  // H20 - Dalat Trade Union Hotel
  { hotelKey: 'H20', hotelName: 'Khách sạn Du lịch Công Đoàn Đà Lạt', group: 'exterior', fileTitle: 'File:Nha nghi cong doan Da Lat.jpg', isCover: true },

  // H21 - Sheraton Nha Trang
  { hotelKey: 'H21', hotelName: 'Khách sạn Sheraton Nha Trang', group: 'exterior', fileTitle: 'File:Sheraton Nha Trang.jpg', isCover: true },
  { hotelKey: 'H21', hotelName: 'Khách sạn Sheraton Nha Trang', group: 'exterior', fileTitle: 'File:SHERATON HOTEL NHA TRANG AND OBSERVATION TOWER AND RESTAURANT VIETNAM JAN 2012 (7056833841).jpg' },

  // H22 - Novotel Nha Trang
  { hotelKey: 'H22', hotelName: 'Khách sạn Novotel Nha Trang', group: 'exterior', fileTitle: 'File:Novotel Nha Trang.jpg', isCover: true },
  { hotelKey: 'H22', hotelName: 'Khách sạn Novotel Nha Trang', group: 'exterior', fileTitle: 'File:Novotel Nha Trang.png' },

  // H23 - Nha Trang Lodge
  { hotelKey: 'H23', hotelName: 'Khách sạn Nha Trang Lodge', group: 'exterior', fileTitle: 'File:NHA TRANG LODGE HOTEL NHA TRANG VIETNAM JAN 2012 (7034605797).jpg', isCover: true },

  // H24 - Hon Tam Resort
  { hotelKey: 'H24', hotelName: 'Hòn Tằm Resort Nha Trang', group: 'exterior', fileTitle: 'File:Hon Tam Resort - Nha Trang.jpg', isCover: true },
  { hotelKey: 'H24', hotelName: 'Hòn Tằm Resort Nha Trang', group: 'pool', fileTitle: 'File:Hòn Tằm beach, Nha Trang, Khánh Hoà.jpg' },

  // H25 - The Anam Cam Ranh
  { hotelKey: 'H25', hotelName: 'The Anam Resort Cam Ranh', group: 'exterior', fileTitle: 'File:TheAnam.jpg', isCover: true },

  // H26 - JW Marriott Phu Quoc
  { hotelKey: 'H26', hotelName: 'JW Marriott Phu Quoc Emerald Bay Resort & Spa', group: 'exterior', fileTitle: 'File:Jw-marriott-phu-quoc-bai-kem.jpg', isCover: true },
  { hotelKey: 'H26', hotelName: 'JW Marriott Phu Quoc Emerald Bay Resort & Spa', group: 'pool', fileTitle: 'File:JW Marriott Shell Pool Phu Quoc.jpg' },
  { hotelKey: 'H26', hotelName: 'JW Marriott Phu Quoc Emerald Bay Resort & Spa', group: 'restaurant', fileTitle: 'File:Nha-hang-pink-pearl.jpg' },

  // H27 - Premier Village Phu Quoc
  { hotelKey: 'H27', hotelName: 'Premier Village Phu Quoc Resort', group: 'exterior', fileTitle: 'File:Premier-village-phu-quoc-resort5-hon-thom.jpg', isCover: true },
  { hotelKey: 'H27', hotelName: 'Premier Village Phu Quoc Resort', group: 'exterior', fileTitle: 'File:Premier-village.jpg' },

  // H28 - La Veranda Phu Quoc
  { hotelKey: 'H28', hotelName: 'La Veranda Resort Phú Quốc - MGallery', group: 'exterior', fileTitle: 'File:La Veranda.JPG', isCover: true },

  // H29 - Saigon Phu Quoc Resort & Spa
  { hotelKey: 'H29', hotelName: 'Khách sạn Sài Gòn Phú Quốc Resort & Spa', group: 'exterior', fileTitle: 'File:Phu Quoc beach Saigon Phu Quoc Resort and Spa.jpg', isCover: true },
  { hotelKey: 'H29', hotelName: 'Khách sạn Sài Gòn Phú Quốc Resort & Spa', group: 'pool', fileTitle: 'File:1 Phu Quoc beach Saigon Phu Quoc Resort and Spa.jpg' },

  // H30 - Nhat Lan Resort Phu Quoc
  { hotelKey: 'H30', hotelName: 'Nhật Lan Resort Phú Quốc', group: 'exterior', fileTitle: 'File:Nhật lan resort, Dương tơ, Khu 3, Cửa lắp, Phú quốc, Việt nam - panoramio.jpg', isCover: true },
  { hotelKey: 'H30', hotelName: 'Nhật Lan Resort Phú Quốc', group: 'exterior', fileTitle: 'File:Resort Nhat lan, Dương tơ, Cửa Lắp, Phú quốc, Vietnam - panoramio.jpg' },
];

const ROOM_IMAGES: Array<{ roomKey: string; fileTitle: string; isCover?: boolean }> = [
  // 10 distinct room templates sourced from Wikimedia Commons
  { roomKey: 'room-tpl-01', fileTitle: 'File:Caravelle Saigon - Signature Studio Room.jpg', isCover: true },
  { roomKey: 'room-tpl-02', fileTitle: 'File:203-sala.jpg', isCover: true },
  { roomKey: 'room-tpl-03', fileTitle: 'File:402-sala.jpg', isCover: true },
  { roomKey: 'room-tpl-04', fileTitle: 'File:Family suite.jpg', isCover: true },
  { roomKey: 'room-tpl-05', fileTitle: 'File:Executive Room Shakti Hotel City Jakarta.jpg', isCover: true },
  { roomKey: 'room-tpl-06', fileTitle: 'File:Coop Hotel, Sofia ( 1070739).jpg', isCover: true },
  { roomKey: 'room-tpl-07', fileTitle: 'File:2-osobowy comfort Hotel Bartis.jpg', isCover: true },
  { roomKey: 'room-tpl-08', fileTitle: 'File:CrownePlaza Interior Melbourne.jpg', isCover: true },
  { roomKey: 'room-tpl-09', fileTitle: 'File:EXECUTIVE ROOM - Teraskita Hotel Makassar.jpg', isCover: true },
  { roomKey: 'room-tpl-10', fileTitle: 'File:Deluxe Suite bedroom.jpg', isCover: true },
  { roomKey: 'room-tpl-11', fileTitle: 'File:Executive Suite bedroom.jpg', isCover: true },
  { roomKey: 'room-tpl-12', fileTitle: 'File:DL2A Four Seasons Bora Bora 6.jpg', isCover: true },
];

const USER_AGENT = 'EgodeProductionSeed/1.0 (seed-dataset@egode.vn)';

async function fetchWikimediaMetadata(title: string) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json&titles=${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
  const data: any = await res.json();
  const pages = data.query?.pages || {};
  const firstPid = Object.keys(pages)[0];
  const page = pages[firstPid];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`Imageinfo missing for ${title}`);

  const meta = info.extmetadata || {};
  const downloadUrl = info.thumburl || info.url;
  const author = (meta.Artist?.value || meta.Credit?.value || 'Wikimedia Commons contributor')
    .replace(/<[^>]*>?/gm, '')
    .trim();
  const license = meta.LicenseShortName?.value || meta.License?.value || 'Creative Commons';
  const pageUrl = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`;

  return {
    downloadUrl,
    pageUrl,
    author,
    license,
    width: info.thumbwidth || info.width,
    height: info.thumbheight || info.height,
  };
}

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`Not an image (${type}) from ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${type.split(';')[0]};base64,${buffer.toString('base64')}`;
}

async function main() {
  console.log(`Starting metadata verification & upload for ${HOTEL_IMAGES.length} hotel images + ${ROOM_IMAGES.length} room images...`);

  const manifest: any[] = [];
  const lockedHotelImages: Record<string, string[]> = {};
  const lockedRoomImages: Record<string, string[]> = {};

  // 1. Upload Hotel Images
  let hotelImgIdx = 0;
  for (const item of HOTEL_IMAGES) {
    hotelImgIdx++;
    console.log(`[${hotelImgIdx}/${HOTEL_IMAGES.length}] Processing hotel image: ${item.fileTitle}...`);
    try {
      const meta = await fetchWikimediaMetadata(item.fileTitle);
      const publicId = `${item.hotelKey.toLowerCase()}-img-${String(hotelImgIdx).padStart(2, '0')}`;
      const folder = 'hotel-booking/hotels';

      console.log(`  Uploading to ${folder}/${publicId}...`);
      const dataUri = await toDataUri(meta.downloadUrl);
      const cldRes = await cloudinary.uploader.upload(dataUri, {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [{ width: 1600, crop: 'limit' }],
      });

      const entry = {
        key: `${item.hotelKey}-IMG-${hotelImgIdx}`,
        entityType: 'KHACH_SAN',
        entityKey: item.hotelKey,
        entityName: item.hotelName,
        group: item.group,
        title: item.fileTitle,
        sourceUrl: meta.downloadUrl,
        pageUrl: meta.pageUrl,
        author: meta.author,
        license: meta.license,
        publicId: cldRes.public_id,
        secureUrl: cldRes.secure_url,
        width: cldRes.width,
        height: cldRes.height,
        isCover: item.isCover || false,
        status: 'VERIFIED',
      };
      manifest.push(entry);

      if (!lockedHotelImages[item.hotelKey]) lockedHotelImages[item.hotelKey] = [];
      lockedHotelImages[item.hotelKey].push(cldRes.secure_url);
      console.log(`  -> SUCCESS: ${cldRes.secure_url}`);
    } catch (err: any) {
      console.error(`  -> FAILED: ${item.fileTitle} (${err.message})`);
    }
  }

  // 2. Upload Room Images
  let roomImgIdx = 0;
  for (const item of ROOM_IMAGES) {
    roomImgIdx++;
    console.log(`[${roomImgIdx}/${ROOM_IMAGES.length}] Processing room template image: ${item.fileTitle}...`);
    try {
      const meta = await fetchWikimediaMetadata(item.fileTitle);
      const publicId = `room-template-${String(roomImgIdx).padStart(2, '0')}`;
      const folder = 'hotel-booking/room-types';

      console.log(`  Uploading to ${folder}/${publicId}...`);
      const dataUri = await toDataUri(meta.downloadUrl);
      const cldRes = await cloudinary.uploader.upload(dataUri, {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [{ width: 1600, crop: 'limit' }],
      });

      const entry = {
        key: `ROOM-IMG-${roomImgIdx}`,
        entityType: 'LOAI_PHONG',
        entityKey: item.roomKey,
        entityName: `Room Template ${roomImgIdx}`,
        group: 'room',
        title: item.fileTitle,
        sourceUrl: meta.downloadUrl,
        pageUrl: meta.pageUrl,
        author: meta.author,
        license: meta.license,
        publicId: cldRes.public_id,
        secureUrl: cldRes.secure_url,
        width: cldRes.width,
        height: cldRes.height,
        isCover: item.isCover || false,
        status: 'VERIFIED',
      };
      manifest.push(entry);
      lockedRoomImages[item.roomKey] = [cldRes.secure_url];
      console.log(`  -> SUCCESS: ${cldRes.secure_url}`);
    } catch (err: any) {
      console.error(`  -> FAILED: ${item.fileTitle} (${err.message})`);
    }
  }

  // Save manifests
  const sourcesDir = path.resolve(__dirname, '../sources');
  writeFileSync(path.join(sourcesDir, 'image-source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  writeFileSync(path.join(sourcesDir, 'images.lock.json'), JSON.stringify({ lockedHotelImages, lockedRoomImages, manifest }, null, 2) + '\n', 'utf8');

  console.log(`\nImage synchronization complete!`);
  console.log(`Total images uploaded and locked: ${manifest.length}`);
  console.log(`Saved to sources/image-source-manifest.json and sources/images.lock.json`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
