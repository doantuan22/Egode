interface DecodedAccessToken {
  sub: string;
  role: string;
  exp: number;
}

/** Giải mã payload JWT không kiểm tra chữ ký, chỉ dùng cho giao diện */
export function decodeAccessToken(token: string): DecodedAccessToken | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    // Giải mã lại chuỗi byte thành UTF-8 trước khi parse
    const binary = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const utf8Json = decodeURIComponent(
      Array.from(binary, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
    return JSON.parse(utf8Json) as DecodedAccessToken;
  } catch {
    return null;
  }
}
