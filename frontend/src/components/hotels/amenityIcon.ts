/** Chọn biểu tượng cho tiện nghi theo tên */
const AMENITY_ICONS: Array<[RegExp, string]> = [
  [/wi-?fi|internet/, 'wifi-high'],
  [/ho boi|be boi|boi/, 'swimming-pool'],
  [/bai bien|bien/, 'tree-palm'],
  [/do xe|dau xe|gara|parking/, 'car'],
  [/bua sang|an sang|ca phe|cafe/, 'coffee'],
  [/thu cung|(^| )pet( |$)/, 'paw-print'],
  [/dieu hoa|may lanh|lanh/, 'snowflake'],
  [/san bay|dua don|xe dua/, 'airplane-tilt'],
  [/bon tam|bathtub/, 'bathtub'],
  [/gym|the hinh|phong tap|fitness/, 'barbell'],
  [/nha hang|restaurant|am thuc/, 'fork-knife'],
  [/spa|massage|xong hoi/, 'flower-lotus'],
  [/le tan|24\/7|24h/, 'bell-simple'],
  [/tivi|tv|truyen hinh/, 'television'],
  [/(^| )bar( |$)|quay bar|ruou/, 'wine'],
  [/thang may/, 'elevator'],
  [/giat|la ui|(^| )ui do/, 'washing-machine'],
  [/may say|say toc/, 'hair-dryer'],
  [/bep/, 'cooking-pot'],
  [/ban cong|view|tam nhin/, 'sun-horizon'],
  [/tre em|em be|tre con/, 'baby'],
  [/an ninh|bao ve|ket an toan/, 'shield-check'],
  [/xe lan|khuyet tat|nguoi khuyet/, 'wheelchair'],
];

const stripAccents = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

export function amenityIconName(amenity: { TenTienNghi: string }): string {
  const name = stripAccents(amenity.TenTienNghi);
  return AMENITY_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? 'sparkle';
}
