# FINAL RELEASE AUDIT

Ngày: 2026-10-05 (cập nhật sau khi sửa NEW-1) · Nhánh: `tuntun` · DB: SQL Server `HotelBooking_DB0_Test`
Phạm vi: vòng hardening cuối theo thứ tự **2 test guest-count → 3 lỗi lint → rà soát báo cáo → cấu hình triển khai cookie/CORS (trước là #17) → E2E trình duyệt → kiểm toán phát hành**, rồi sửa lỗi mới **NEW-1** do E2E phát hiện. Chi tiết từng bug nằm ở `docs/FIX_VERIFICATION_REPORT.md`; tài liệu này là kết luận phát hành.

## Phán quyết

### READY WITH KNOWN LIMITATIONS

- **Không còn lỗi sản phẩm chưa xử lý.** NEW-1 đã **RESOLVED** (mục 12).
- Cookie/CORS/SameSite (trước đây ghi là bug #17) được **phân loại lại thành Deployment Configuration**, không tính là lỗi sản phẩm tồn đọng: phần mã đã xong và có test; việc còn lại là người triển khai điền một biến môi trường khi đã có topology/domain thật (mục 4). Không cần xử lý thêm cho đến lúc đó.
- Mọi tiêu chí đạt: backend **744/744**, frontend **460/460**, lint/typecheck/build exit 0, browser E2E **32/32**, SQL invariants đạt, **Schema changes: NONE**.
- Phán quyết là "READY WITH KNOWN LIMITATIONS" (không phải "READY") vì các giới hạn đã biết ở mục 11 (L1–L9) vẫn còn và được công bố — đáng chú ý là SMTP/Cloudinary/VNPAY thật chưa được thử và 5 tài khoản test còn cần dọn (L7).

---

## 1. Guest-count tests — PASS
Hai test `HomePage › guest count` và `HotelListPage › guest count` từng được coi là baseline. Audit lại sau #18: **UI đúng, kỳ vọng của test sai** (thẻ trang chủ có 2 liên kết cùng đích; chip kết quả lặp lại "2 khách" của ô tìm kiếm). Test được viết lại **chặt hơn** (mọi liên kết đều mang `guests=2`; nút "Số khách … 2 khách" và đúng 2 lần xuất hiện), không xóa, không nới lỏng, không đổi UI. Business rule đối chiếu: `guests >= 1`, mặc định 2, đi theo URL, backend ép sức chứa (#18). Chi tiết: báo cáo, mục "Hardening 1".

## 2. Frontend lint cleanup — PASS
Ba lỗi `<main>` (LoginPage, HotelDetailPage, HotelListPage) là **lỗi thật**: các trang này nằm trong `<Outlet />` của `MainLayout`, đã có `<main id="main-content">`; trang thêm `<main>` thứ hai tạo hai landmark chính lồng nhau. Sửa: `<main>` → `<div>`, giữ nguyên class (bố cục không đổi; không có CSS nhắm vào `main`). Không `eslint-disable`, không đổi luật. `eslint .` exit 0.

## 3. Rà soát toàn bộ `FIX_VERIFICATION_REPORT.md` — hoàn tất
Đọc từ đầu đến cuối và đối chiếu với code, số test theo từng file (`vitest --reporter=json`), SQL. Đã sửa:
- Số liệu hồi quy cũ (51/623, 56/716, 66/415, 67/444, "2 FAIL", "3 lỗi lint") được đánh dấu là số liệu tại thời điểm đó hoặc thay bằng số liệu hiện hành.
- Số test theo bug khớp với từng file (refund-lifecycle 20, bookings-zero-total 10, auth-live-state 11, accounts-admin-guard 12, hold-consistency 7, owner-inventory-guard 11, public-reviews 16, error-contract 17, timezone-rules 14, hotel-times.contract 50, star-rating-filter 10, guests-capacity 15, occupancy 12, change-password-session 6; frontend HotelDetailPage 36, PartnerApplyPage 7, ProfilePage 11, apiClient 14).
- #11: danh sách mã lỗi thêm `CAPACITY_EXCEEDED` (từ #18); câu "luồng refresh không đổi" được giới hạn vào bug đó.
- #14: ghi rõ quan hệ với #5 (tỷ lệ lấp đầy chỉ tính `Đã xác nhận`/`Hoàn tất`; bộ đếm trạng thái vẫn đếm `Chờ thanh toán` trong thời hạn giữ chỗ).
- #18/#19/#13/#8 (NgayYeuCau): không phát hiện mô tả sai so với code.
- Mục E2E (từng ghi "chưa chạy") thay bằng kết quả thật; Schema, Ghi chú, Kết luận được viết lại; không còn câu "còn 2 test fail / 3 lỗi lint". Sau khi sửa NEW-1 báo cáo được cập nhật tiếp (test count, E2E 32/32, phán quyết).

## 4. Deployment Configuration — Cookie / CORS / SameSite (trước đây: bug #17)
**Đã phân loại lại: đây là cấu hình triển khai, không phải lỗi sản phẩm chưa giải quyết.** Không tính vào danh sách lỗi tồn đọng và không cần xử lý cho đến khi có topology/domain production thật.
- **Audit:** cookie `HttpOnly`, `Path=/api/auth`, `SameSite=Lax` cố định; CORS origin chính xác + credentials; frontend `credentials: 'include'`; thiếu proxy dev.
- **Topology production:** *không* chứng minh được từ repo. Tài liệu chỉ nêu frontend dự kiến trên Cloudflare Pages; không có domain/host API; `https://api.example.com/api` trong `.env.example` chỉ là ví dụ giữ chỗ. Không bịa domain.
- **Phần mã/cấu hình đã xong (kiểm chứng được):** `REFRESH_COOKIE_SAMESITE` (`lax`/`strict`/`none`; `none` ⇒ `Secure`); production **phải đặt** nếu không backend từ chối khởi động (nên không thể quên); từ chối `CORS_ORIGIN`/`FRONTEND_URL` có ký tự đại diện (mọi môi trường) và HTTP thường (production); `refresh`/`logout` từ chối `Origin` lạ bằng 403 trước khi đụng cookie; proxy dev Vite; thông báo rõ khi API trả HTML; hướng dẫn theo hai topology trong README.
- **Test:** 28 test backend (`cookie-topology.test.ts`): login, refresh, access token hết hạn, logout + xóa cookie, khóa tài khoản, đổi vai trò, đổi mật khẩu, request không xác thực, CORS, kiểm tra env production; 2 test frontend; các luồng chính có E2E trình duyệt.
- **Việc của người triển khai (khi có domain thật):** đặt `REFRESH_COOKIE_SAMESITE` (`lax` nếu cùng site/cùng reverse proxy; `none` nếu khác site, kèm `CORS_ORIGIN` là origin https chính xác của SPA và `VITE_API_BASE_URL`), rồi chạy một lượt đăng nhập → tải lại trang → đổi mật khẩu → đăng xuất trên môi trường thật. `SameSite=None` giữa hai domain thật chưa thể thử vì chưa có domain.

## 5. Browser E2E — 32 PASS / 0 FAIL
**Hạ tầng (`e2e/`, Playwright 1.63 + Chrome):** frontend = bản build production (`vite preview`, cổng 5174); backend = tiến trình thật (cổng 5100, `NODE_ENV=test`); DB = SQL Server test; một fixture server (trong gói backend, dùng factory của test backend) tạo dữ liệu có kiểm soát, đọc lại hàng DB để xác minh, và dọn sạch. Dữ liệu E2E không phụ thuộc dữ liệu demo. Cái duy nhất được thay thế: (a) trang thanh toán VNPAY được thay **trong trình duyệt** bằng câu trả lời ký HMAC-SHA512 thật gửi vào `/api/payments/vnpay-return` — backend tự xác minh chữ ký/số tiền/mã giao dịch; (b) API hoàn tiền VNPAY thay bằng stand-in cục bộ có thể chuyển "đồng ý/từ chối".

| Nhóm | Luồng đã chạy qua UI thật |
|---|---|
| Khách hàng | tìm kiếm từ trang chủ (điểm đến, ngày, số khách) → lọc "Từ 4 sao trở lên" → chi tiết khách sạn → số khách ≠ sức chứa (1 phòng chặn, 2 phòng đủ) → báo giá → mã khuyến mãi gõ chưa áp dụng (#15) → áp dụng → tạo đặt phòng → thanh toán giả lập → kết quả → lịch sử → hủy đặt phòng → hoàn tiền đúng như bản xem trước |
| Khách | xem phòng/giá, bị yêu cầu đăng nhập khi đặt |
| Tài khoản/phiên | đăng ký (kể cả **không tick điều khoản thì không đăng ký được, lỗi hiện ngay tại checkbox** — NEW-1), đăng nhập đúng/sai, tải lại trang (khôi phục phiên bằng cookie), cập nhật hồ sơ, đổi mật khẩu (đúng/sai mật khẩu hiện tại, phiên còn, mật khẩu cũ chết), access token hết hạn → refresh im lặng → request thành công, đăng xuất xóa cookie, tài khoản bị khóa, origin lạ không xoay được cookie |
| Zero-price | khuyến mãi 100% → xác nhận ngay, **không có dòng thanh toán**, cổng không bị gọi |
| Thanh toán | thẻ bị từ chối rồi thanh toán lại thành công (đúng 1 payment thành công, 0 pending) |
| Hoàn tiền | cổng từ chối → đơn vẫn "Đã hủy", refund "Thất bại" → thử lại → **cùng một dòng refund** sang "Thành công", `NgayYeuCau` không đổi, thử lại lần nữa không gọi cổng |
| Tranh chấp | hai khách bấm "Tạo đặt phòng" cho **phòng cuối cùng** cùng lúc → đúng 1 booking, người kia nhận lỗi; giữ chỗ 15 phút: sau khi quá hạn phòng bán lại được và đơn cũ bị hủy |
| Đối tác/Owner | đăng ký đối tác → nộp hồ sơ (checkbox xác nhận bắt buộc, #16) → admin duyệt → tạo khách sạn "Chờ duyệt" (không công khai) → admin duyệt → công khai → thêm loại phòng → đặt quỹ phòng/giá → khách đặt 2/3 phòng → **không giảm quỹ dưới số đã đặt**; hồ sơ bị từ chối hiện lý do và nộp lại được; owner sửa giờ "HH:mm" |
| Admin | duyệt/từ chối khách sạn (từ chối không còn đường quay lại), đình chỉ/kích hoạt lại, sửa giờ 02:30/11:15 → owner và trang công khai thấy cùng "HH:mm", khóa/mở khóa khách hàng, **bảo vệ admin cuối** (không tự khóa/xóa — UI ẩn nút, server trả 400; với hai admin, khóa người kia thì còn đúng 1 admin hoạt động), analytics (doanh thu trên giao diện = API; thêm một booking đã thanh toán tăng đúng số tiền) |
| Review/công khai | khách viết review sau lưu trú hoàn tất → "Chờ duyệt" không công khai → admin hiển thị/ẩn → công khai chỉ thấy review "Hiển thị"; trung bình/số lượng đúng (chi tiết và kết quả tìm kiếm) |
| Ngày/giờ | trình duyệt ở múi giờ Honolulu và Kiritimati (ở mọi giờ trong ngày có ít nhất một múi giờ lệch ngày so với Việt Nam): lịch bắt đầu từ ngày hôm nay **giờ Việt Nam**, check-in hôm nay đặt được, hôm qua bị 400, thời điểm nhận/trả phòng đúng (14:00 VN = 07:00Z); khuyến mãi biên ngày (bắt đầu = kết thúc = hôm nay dùng được; hết hạn hôm qua / bắt đầu ngày mai bị từ chối) |

**Các lượt chạy và phân loại lỗi** (không chạy lại đến khi xanh):
- Phát triển từng spec: các lỗi là *lỗi test/selector* (radio ý định đăng ký, nút đăng xuất trùng tên, dialog hủy là inline, cookie jar dùng chung khiến phiên owner bị thay bằng khách) — đã sửa trong test.
- Lượt đầy đủ 1 (trước khi sửa NEW-1): 3 lỗi — 2 **lỗi test** (khẳng định smoke cũ; bộ đếm gọi cổng hoàn tiền dùng chung giữa spec) đã sửa; 1 **lỗi sản phẩm NEW-1**. Lượt 2 và 3: giống hệt nhau, 31 PASS / 1 FAIL (NEW-1).
- **Sau khi sửa NEW-1:** lượt A có 1 lỗi ở test review/kiểm duyệt (đã PASS ở các lượt trước). Phân loại: **lỗi test (race), không phải lỗi sản phẩm** — sau khi bấm "Ẩn đánh giá", test chờ `getByText('Ẩn').first()`, chuỗi này khớp ngay với nhãn của chính nút nên khẳng định đi qua trước khi request kiểm duyệt xong và test đọc DB quá sớm (còn "Chờ duyệt"). Sửa: chờ đúng phản hồi của request kiểm duyệt và dùng `expect.poll` trên DB; **không** chạy lại cho tới khi xanh. Sau sửa: lượt B và C đều **32/32 PASS**, số dòng DB trước/sau giống hệt nhau. Không có test bị skip, không có environment failure.
- **Lỗi hạ tầng test phát hiện và sửa:** dọn dẹp E2E để lại 5 tài khoản quản trị test. Nguyên nhân *nhiều khả năng* là xóa tài khoản admin trước các hồ sơ đối tác mà họ duyệt (ràng buộc FK; `deleteTestAccount` nuốt lỗi) — chưa quan sát trực tiếp thông báo lỗi vì lệnh xóa thủ công bị từ chối. Đã đổi thứ tự (xóa hồ sơ đối tác liên quan trước) và thêm bước **kiểm chứng không còn sót**; sau sửa không còn tài khoản nào bị bỏ lại (số dòng 6 bảng chính trước/sau một lượt E2E đầy đủ giống hệt nhau: 12/1/8/26/88/46).
- Đột biến chứng minh test có giá trị: dùng ngày theo múi giờ trình duyệt thay vì Việt Nam → test múi giờ FAIL; bỏ kiểm tra `Origin` / ép `SameSite=Lax` → 6 test cookie FAIL; vô hiệu hóa luật điều khoản → 4 test đăng ký FAIL.

## 6. Backend final regression — PASS
`eslint .` exit 0 · `tsc --noEmit` exit 0 · `npm run build` exit 0 · `vitest run --no-file-parallelism` trên SQL Server thật: **57 file, 744 test: 744 PASS, 0 FAIL, 0 skip**. Concurrency/race (11 file, 142 test: concurrency đặt phòng, hold-consistency, booking-expiry, bookings-cancel, bookings-zero-total, owner-inventory-guard, owner-bookings-sweep, accounts-admin-guard, payments, refund-lifecycle): **chạy 3 lần liên tiếp, 142/142 mỗi lần**. (Sửa NEW-1 chỉ đụng frontend nên không đổi số liệu backend.)

## 7. Frontend final regression — PASS
`eslint .` exit 0 · `tsc -b --noEmit` exit 0 · `npm run build` exit 0 · `vitest run`: **67 file, 460 test, 460 PASS, 0 FAIL** (+14 test của NEW-1: 8 ở schema, 6 ở trang đăng ký) · browser E2E: **32/32**.

## 8. SQL invariants — PASS
sqlcmd trên `HotelBooking_DB0_Test` sau backend 744 test + các lượt E2E đầy đủ (mọi dòng "expect 0" đều ra 0): không bán vượt quỹ phòng · không đơn `Chờ thanh toán` quá 15 phút còn sót · không booking có hơn 1 payment thành công · không payment `Chờ xử lý` trùng · không payment có hơn 1 refund · refund không vượt payment · refund thành công luôn có `NgayHoanTien`, refund thất bại/chờ không có · `NgayHoanTien ≥ NgayYeuCau` · không refund trên booking chưa hủy · không refund `Chờ xử lý` kẹt · booking 0đ không có payment/refund/chờ thanh toán · không booking `Hoàn tất` sớm · `HangSao` trong 1..5 · khách sạn chờ duyệt/từ chối không mang dấu vết duyệt · review chỉ có 4 trạng thái hợp lệ · còn **8** quản trị viên hoạt động (≥ 1) · không còn dữ liệu `e2e_`/`E2E…` (kiểm lại sau các lượt E2E cuối: tài khoản `e2e_` = 0, số dòng không đổi).

## 9. Security / config audit
| Hạng mục | Kết quả |
|---|---|
| Auth middleware | đọc DB mỗi request: tài khoản khóa/xóa → 401; vai trò lấy từ DB, bỏ qua `role` trong token (test #6) |
| Cookie refresh | `HttpOnly`, `Path=/api/auth`, `Secure` ở production hoặc `SameSite=None`, đặt/xóa cùng thuộc tính; E2E: `document.cookie` không đọc được |
| CORS | origin chính xác + credentials; không `*`; wildcard bị từ chối khi khởi động; production bắt buộc HTTPS |
| Refresh / logout | 403 với `Origin` lạ; refresh bị từ chối xóa cookie chết; đổi mật khẩu làm các refresh cũ chết |
| Secrets | `.env`/`.env.*` bị gitignore (chỉ `.env.example` được commit); quét secret trong file được theo dõi: không phát hiện giá trị thật; production từ chối placeholder, thiếu secret, DB không `encrypt=true`, endpoint VNPAY sandbox |
| `VITE_` | frontend chỉ đọc `VITE_API_BASE_URL` (không secret) |
| Log | log truy cập chỉ có method/route/status/thời lượng (không body, header, query); không có `console.*` in mật khẩu/token/secret; lỗi 5xx trả chung "Internal server error" (không stack) |
| Header | HSTS (production), `nosniff`, `X-Frame-Options: DENY`, CSP chặt, `Referrer-Policy: no-referrer` |
| Rate limit | login/refresh/đăng ký/quên-đặt lại-đổi mật khẩu/callback thanh toán (bộ nhớ trong tiến trình — xem L3) |
| Quan sát (mức thấp) | lỗi Prisma không lường trước được ghi bằng `console.error(err)`; mật khẩu được băm trước khi vào Prisma, nhưng nên rà khi triển khai log tập trung |

## 10. Schema verification — Schema changes: NONE
`git status` không có thay đổi nào trong `backend/prisma/`, migration hay SQL (kiểm lại sau khi sửa NEW-1); không thêm bảng/cột/FK; ERD không đổi. Trường `DongYDieuKhoan` của NEW-1 chỉ tồn tại trong form frontend, không gửi lên API và không có cột. `REFRESH_COOKIE_SAMESITE` là biến môi trường. Gói `e2e/` là thư mục mới độc lập (devDependency `@playwright/test` chỉ nằm trong `e2e/package.json`).

## 11. Known limitations (không che giấu)
- **L1.** HOAN_TIEN không có mốc thời gian của "lần thử", nên một refund `Chờ xử lý` do tiến trình chết giữa hai bước không tự giải phóng (retry luôn 409; cần can thiệp tay). Cần thay đổi schema → Change Gate (đã ghi ở #8, chưa thực hiện).
- **L2.** Đăng xuất là stateless (không có bảng token): refresh token đã bị lộ vẫn hợp lệ về mặt mật mã tới 7 ngày; giảm nhẹ bằng việc đổi mật khẩu/khóa tài khoản/đổi vai trò vô hiệu hóa chúng và bằng cookie `HttpOnly`.
- **L3.** Rate limiter nằm trong bộ nhớ của tiến trình: nhiều instance thì hạn mức nhân lên (M9 đã ghi); cần kho dùng chung trước khi scale ngang.
- **L4.** E2E chạy backend với `NODE_ENV=test` (tắt rate limiter, log truy cập, SMTP thật); trang thanh toán VNPAY và API hoàn tiền VNPAY được thay như mô tả ở mục 5; SMTP, Cloudinary, VNPAY thật **chưa được thử** (phải do người có thông tin xác thực làm lúc triển khai).
- **L5.** Nhánh 409 "admin cuối" không thể chạm tới qua UI (người thao tác luôn là admin hoạt động và không thể tự thao tác); được bảo vệ bởi 12 test tích hợp backend, gồm tranh chấp đồng thời; E2E kiểm tự bảo vệ và kịch bản hai admin.
- **L6.** E2E chưa được nối vào CI (`.github/workflows/ci.yml` chỉ chạy backend và frontend); nên thêm job riêng có SQL Server.
- **L7.** DB test còn 5 tài khoản quản trị `testuser_…` (mật khẩu test đã biết) do các lượt E2E đầu để lại trước khi sửa dọn dẹp (cùng 5 tài khoản `testuser_…` cũ từ các lượt test backend trước). Một lệnh xóa trực tiếp bị từ chối nên **không xóa**; cần người có quyền dọn trước khi dùng DB này chung với người khác.
- **L8.** Trang chủ: thẻ khách sạn có hai liên kết cùng tên và cùng đích (ảnh, mũi tên) — nhỏ, về trợ năng.
- **L9.** Không có job nền (lazy-expire) nên đơn giữ chỗ quá hạn chỉ bị hủy khi có truy vấn chạm tới; kết quả đọc vẫn đúng (đã kiểm).
- **Cấu hình triển khai (không phải giới hạn của mã):** chọn `REFRESH_COOKIE_SAMESITE` khi có domain production — mục 4.

## 12. Release blockers
**Không còn.**
- **NEW-1 — RESOLVED.** Checkbox điều khoản ở trang đăng ký trước đây chỉ có `required` của HTML trong form `noValidate` (không có tác dụng) nên đăng ký vẫn thành công khi không tick (cùng loại lỗi với #16; đã quét mọi form `noValidate`, đây là trường hợp duy nhất). *Severity:* Medium-Low. *Root cause:* checkbox không nối react-hook-form/schema. *Sửa:* `DongYDieuKhoan` thêm vào `registerSchema` (`z.boolean().refine(v => v)`, thông điệp "Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật"), checkbox nối `register('DongYDieuKhoan')` với giá trị mặc định `false`, bỏ `required`, lỗi hiện ngay dưới checkbox (`aria-invalid`/`aria-describedby`), trường này **không** được gửi lên API (payload đăng ký giữ nguyên), không đổi DB, không đổi giao diện ngoài dòng lỗi; mọi luật cũ giữ nguyên. *Test:* schema (chỉ `true` được chấp nhận; `false`/thiếu/`null`/chuỗi/số bị từ chối; các luật email, mật khẩu, xác nhận mật khẩu vẫn chặn khi đã đồng ý); trang đăng ký (không bắt buộc bằng HTML; chưa tick → không gọi API và có thông điệp đúng tại checkbox; tick → submit và payload không có cờ; tick lại sau khi bị chặn → xóa lỗi và đi tiếp; xác nhận mật khẩu sai vẫn báo; chưa tick cộng email sai → báo cả hai); đột biến vô hiệu hóa luật → 4 test FAIL; E2E "registration needs the terms box ticked" PASS (không tạo tài khoản, lỗi hiện đúng chỗ) và các luồng đăng ký/đối tác khác vẫn PASS.
- Cookie/CORS/SameSite: không phải blocker — xem mục 4 (Deployment Configuration).

## 13. Final verdict
**READY WITH KNOWN LIMITATIONS.** Backend 744/744, frontend 460/460, browser E2E 32/32, lint/typecheck/build sạch, SQL invariants đạt, Schema changes: NONE, không còn lỗi sản phẩm tồn đọng. Các giới hạn L1–L9 và một mục cấu hình triển khai (cookie/CORS khi có domain thật) được công bố ở trên.

*Lệnh để tái kiểm tra:* backend `npm run lint && npm run typecheck && npm run build && npm test`; frontend `npx eslint . && npx tsc -b --noEmit && npm run build && npx vitest run`; E2E `cd e2e && npm install && npx playwright test` (cần Chrome, SQL Server test và `backend/.env` trỏ vào DB test; fixture server và hai server ứng dụng được Playwright tự khởi động).
