/**
 * What the public may learn about who wrote a review: a family-name-first abbreviation, never the full name,
 * e-mail, phone, account id or booking. "Nguyễn Văn An" → "Nguyễn V. A."; a single word → its first letter + "***".
 */
export const maskReviewerName = (hoTen: string | null | undefined): string => {
  const parts = (hoTen ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Khách hàng';
  if (parts.length === 1) return `${Array.from(parts[0])[0]}***`;
  return [parts[0], ...parts.slice(1).map((part) => `${Array.from(part)[0].toUpperCase()}.`)].join(' ');
};
