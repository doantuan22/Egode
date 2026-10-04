# FIX VERIFICATION REPORT

Ngày: 2026-10-04 · Nhánh: `tuntun` · Phạm vi: bug #4 → #1 → #3 → #2 → #8 trong `docs/LOGIC_AUDIT.md`.
Mọi kết quả PASS bên dưới có bằng chứng từ lần chạy thật (SQL Server `HotelBooking_DB0_Test`), không chỉ đọc code.

## Bug #4 — Nhiều payment "Chờ xử lý" cho một booking
**Root cause:** `createVnpayPayment` đọc booking rồi `INSERT` THANH_TOAN ngoài transaction, không khóa gì. Mỗi request (double click, nhiều tab, retry) thêm một bản ghi `Chờ xử lý`.

**Files changed:**
- `backend/src/modules/payments/payments.service.ts` — `createVnpayPayment` chạy trong một transaction.
- `backend/src/modules/payments/payments.repository.ts` — `lockBookingById`, `findSuccessfulPaymentTx`, `findPendingPaymentTx`, `insertPaymentTx`.
- `backend/src/modules/payments/payments.test.ts` — 6 test mới.

**Solution:** khóa hàng DAT_PHONG (`UPDLOCK, HOLDLOCK, ROWLOCK`) trong transaction, đọc lại booking và payment. Booking đã xác nhận/hủy → 400, không tạo gì. Đã có payment `Chờ xử lý` → trả lại chính payment đó (URL dựng lại từ txnRef, số tiền và thời gian đã lưu), không INSERT. Payment trước `Thất bại` → cho tạo lần mới. Các request song song xếp hàng trên khóa nên chỉ có một INSERT. Callback/IPN không đổi (vẫn idempotent).

**Tests:** 2 request đồng thời · 5 request song song (double-click) · tạo khi đã có pending (cùng txnRef/amount) · tạo sau payment failed · booking đã confirmed (không có payment nào) · cùng một payment được IPN hai lần (1 success, 0 pending, 0 refund). Mỗi test khẳng định số pending ≤ 1. Chạy trên code cũ: 4/6 test FAIL; trên code mới: 6/6 PASS.

**Result: PASS**

## Bug #1 — Luồng duyệt khách sạn
**Root cause:** không có endpoint duyệt; `reactivate` chỉ chạy được từ "Đình chỉ" nên khách sạn "Chờ duyệt" kẹt vĩnh viễn; `suspend` nhận mọi trạng thái (Chờ duyệt → Đình chỉ → reactivate = lách duyệt); owner `deactivate` nhận mọi trạng thái và không có cách bật lại; UI admin hiện "Kích hoạt lại" cho mọi trạng thái khác "Hoạt động".

**Files changed:**
- Backend: `admin-hotels.service.ts` (viết lại gọn, có state machine), `admin-hotels.controller.ts`, `admin-hotels.routes.ts` (thêm `POST /admin/hotels/:id/approve` và `/reject`), `owner-hotels.service.ts` / `.repository.ts` / `.controller.ts` / `.routes.ts` (`POST /owner/hotels/:id/reactivate`, `deactivate` chỉ từ "Hoạt động"), `common/constants/hotel-status.ts` (`REJECTED = 'Từ chối'`), `config/openapi.ts`, `test/factories.ts` (khách sạn ACTIVE có `NgayDuyet`), `admin-hotels.test.ts`.
- Frontend: `features/admin/hotels/api.ts`, `pages/admin/AdminHotelDetailPage.tsx`, `pages/admin/AdminHotelsPage.tsx`, `components/domain/StatusBadge.tsx`, `features/owner/api.ts`, `features/owner/hooks.ts`, `pages/owner/OwnerHotelManagePage.tsx`, `pages/owner/OwnerDashboardPage.tsx`, `pages/admin/AdminHotelDetailPage.test.tsx` (mới).

**Solution:** mọi chuyển trạng thái là một `UPDATE … WHERE TrangThai = <trạng thái nguồn>` duy nhất (atomic, hai admin cùng bấm thì chỉ một thành công).
`Chờ duyệt → Hoạt động` (approve, ghi `MaTaiKhoanDuyet` + `NgayDuyet`) · `Chờ duyệt → Từ chối` (reject) · `Hoạt động → Đình chỉ` (admin) · `Đình chỉ → Hoạt động` (admin) · `Hoạt động → Ngừng hoạt động` (owner) · `Ngừng hoạt động → Hoạt động` (owner, chỉ khi `NgayDuyet` khác null, tức đã từng được admin duyệt). `reject` không ghi `MaTaiKhoanDuyet`/`NgayDuyet` để hai cột này chỉ mang nghĩa "đã duyệt". "Từ chối" là giá trị mới của cột `TrangThai` (open domain, không có CHECK) nên không đổi schema.
UI admin: bộ lọc có Chờ duyệt / Từ chối / Ngừng hoạt động; Chờ duyệt → Duyệt/Từ chối; Hoạt động → Đình chỉ; Đình chỉ → Kích hoạt lại; trạng thái khác → không có nút. UI owner: "Bật lại hoạt động" khi đã ngừng và từng được duyệt; mọi khách sạn đều có link vào chi tiết.

**Tests (backend, 12 test mới):** owner tạo → Chờ duyệt, không public (404) · approve → Hoạt động, ghi `MaTaiKhoanDuyet`/`NgayDuyet`, public (200) · approve lần hai/không tồn tại · reject → không public và không hành động admin nào đưa đi tiếp được · reactivate/suspend không dùng làm đường tắt cho khách sạn chờ duyệt · hai approve đồng thời (một 200, một 400) · suspend/reactivate · owner deactivate/reactivate · owner không bật được khách sạn chờ duyệt/bị từ chối/INACTIVE không có dấu vết duyệt · owner không đụng được khách sạn đình chỉ · customer/owner bị 403 trên API admin · lọc hàng đợi "Chờ duyệt". **Frontend (6 test mới)** cho nút theo trạng thái và việc approve gọi đúng endpoint (không gọi reactivate).

**Result: PASS**

## Bug #3 — Validate ngày lưu trú
**Root cause:** 4 schema chỉ kiểm tra `checkOut > checkIn`: không chặn ngày quá khứ, số đêm, hay quá xa; `enumerateNights` chạy trên khoảng bất kỳ; "hôm nay" nếu tính sẽ theo UTC. Frontend cho ngày quá khứ ở biến thể `stay` và ẩn lỗi server sau chuỗi "Validation failed".

**Files changed:**
- Backend: `common/utils/stay-dates.ts` (mới), `bookings.schemas.ts`, `quotes.schemas.ts`, `hotels.schemas.ts` (search + rooms), test helper `addDays` của `bookings.test.ts`, `concurrency.test.ts`, `quotes.test.ts`, `hotels.test.ts` chuyển sang ngày giờ VN; test mới `stay-dates.test.ts`, `stay-dates.api.test.ts`.
- Frontend: `lib/stayDates.ts` (mới), `features/hotels/schemas.ts`, `components/common/DateRangePicker.tsx`, `components/hotels/TravelSearchBar.tsx`, `components/hotels/detail/RoomList.tsx`, `services/apiClient.ts`, test: `stayDates.test.ts`, `DateRangePicker.test.tsx`, `TravelSearchBar.test.tsx`, `apiClient.test.ts`.

**Solution:** một helper dùng chung `refineStayDates` cho cả 4 endpoint. "Hôm nay" = ngày theo `Asia/Ho_Chi_Minh` (Intl), không phải ngày UTC. Quy tắc: `checkIn >= hôm nay`, `checkOut > checkIn`, 1–30 đêm, `checkIn <= hôm nay + 365`. Tính theo số ngày (O(1)), nên khoảng nhiều năm bị từ chối ngay, không lặp qua từng đêm. Frontend: cùng quy tắc và cùng thông điệp, lịch chặn ngày quá khứ / quá 365 ngày / check-out quá 30 đêm, không còn miễn trừ cho biến thể `stay`, `apiClient` hiển thị thông điệp validation thật của server, panel phòng hiện lỗi 400 của server.

**Tests:** ma trận 9 trường hợp × 4 endpoint (search, rooms, quote, booking) = 36 test API + khoảng nhiều năm bị 400 nhanh; 15 test đơn vị gồm biên 00:00 giờ VN (16:59:59Z còn "hôm nay", 17:00:00Z đã sang ngày mới) và biên 365 ngày theo ngày VN; frontend 9 + 3 + 3 test mới/cập nhật. Booking quá khứ không tạo bản ghi nào.

**Result: PASS**

## Bug #2 — Tổng thanh toán = 0
**Root cause:** mọi booking luôn khởi tạo ở "Chờ thanh toán", nhưng `createVnpayPayment` từ chối tổng 0 và THANH_TOAN có `CHECK (SoTien > 0)` → đơn không có đường nào để xác nhận, tự hủy sau 15 phút.

**Files changed:** `bookings.service.ts`, `bookings.repository.ts` (trạng thái khởi tạo là tham số), `config/openapi.ts`, `bookings-zero-total.test.ts` (mới). Frontend: `HotelDetailPage.tsx`, `BookingPanel.tsx`, `PaymentResultPage.tsx`, `BookingSummary.tsx` + test.

**Solution:** trong transaction tạo booking, nếu `TongTienThanhToan === 0` (khuyến mãi hoặc giá phòng 0) thì chèn thẳng `Đã xác nhận`: không tạo THANH_TOAN, không gọi cổng thanh toán, `HanThanhToan`/`SoGiayConLai` là `null`, `TongTienPhong`/`SoTienGiam`/`TongTienThanhToan = 0` vẫn lưu đầy đủ. Vì booking không bao giờ ở "Chờ thanh toán" nên không bị sweep hết hạn; mã khuyến mãi tính là đã dùng ngay (khóa KHUYEN_MAI giữ nguyên), nên giới hạn lượt dùng đúng cả khi song song. Hủy đơn 0đ dùng đường hủy bình thường (không có payment thành công ⇒ không sinh HOAN_TIEN, trả lại lượt dùng mã). Frontend: tạo xong đơn đã xác nhận thì chuyển thẳng `/payment/result`, nút "Xác nhận đặt phòng" + ghi chú, trang kết quả nói "Đặt phòng thành công" (không phải "Thanh toán thành công"), chi tiết đơn ghi "Đơn 0 đ — không phát sinh giao dịch thanh toán".

**Tests (backend 10, frontend 5):** % làm tổng 0 · số tiền cố định lớn hơn tiền phòng · giá phòng 0 · quote báo 0 · không có outbound call tới VNPAY và thanh toán thủ công bị 400 không tạo dòng · đơn không bị hủy sau khi ngày tạo lùi 6 giờ · lịch sử/chi tiết hiển thị tổng 0 · lượt dùng mã đúng (giới hạn 1; 5 request song song với giới hạn 2 chỉ 2 thành công) · hủy đơn 0đ không có HOAN_TIEN/THANH_TOAN và trả lại lượt mã · đơn có tiền phải trả vẫn "Chờ thanh toán". Chạy trên code cũ: 5/10 FAIL; trên code mới: 10/10 PASS.

**Result: PASS**

## Bug #8 — Gọi cổng hoàn tiền khi transaction DB còn mở

**Root cause:**
Previous flow: ba nơi gọi cổng hoàn tiền bên trong `$transaction` đang giữ khóa:
- `BookingsService.cancelBooking`: `UPDATE DAT_PHONG → INSERT HOAN_TIEN → gọi gateway → UPDATE HOAN_TIEN` trong cùng một transaction.
- `PaymentsService.handleCallback` (hoàn 100% khi thanh toán đến sau khi booking đã hết hạn/hủy): giữ `UPDLOCK, HOLDLOCK` trên THANH_TOAN trong lúc chờ gateway.
- `PaymentsService.retryRefund`: giữ khóa dòng HOAN_TIEN suốt lúc gọi gateway.
Hệ quả: gateway chậm (timeout 8 giây) giữ khóa DAT_PHONG/THANH_TOAN/HOAN_TIEN và chặn mọi request khác; nếu transaction rollback sau khi gateway đã hoàn tiền thì tiền đã đi mà DB không có dấu vết. Không có giới hạn cộng dồn: refund mới không bị chặn bởi tổng đã hoàn của payment.

**New flow:** hoàn tiền gồm 3 bước, cổng chỉ được gọi ở bước 2.
1. *Ghi nhận (transaction ngắn, COMMIT):* cancel → khóa/đọc lại booking và payment thành công, tính `SoTienHoan`, `UPDATE DAT_PHONG` sang "Đã hủy" (guarded), và nếu `SoTienHoan > 0` thì `INSERT HOAN_TIEN` "Chờ xử lý" (`NgayHoanTien = NULL`, `MaGiaoDichDoiTac = refundRef`). Retry → khóa dòng HOAN_TIEN và chuyển cùng dòng đó "Thất bại/Chờ xử lý cũ" → "Chờ xử lý" (claim). Callback muộn → ghi HOAN_TIEN "Chờ xử lý" trong transaction callback.
2. *Gọi gateway:* không có transaction nào mở, không giữ khóa.
3. *Chốt (một câu lệnh `UPDATE … WHERE TrangThai = 'Chờ xử lý'`, tự là transaction ngắn):* thành công → "Thành công" + `NgayHoanTien = now`; mọi trường hợp còn lại (từ chối, timeout, lỗi mạng, gateway ném lỗi) → "Thất bại", `NgayHoanTien` NULL, dòng vẫn retry được. Booking không bao giờ bị hoàn tác vì refund lỗi.
Quy tắc: mỗi payment chỉ có một dòng HOAN_TIEN cho lần hủy; retry dùng lại đúng `MaHoanTien`, `SoTienHoan` và `MaGiaoDichDoiTac` (gateway nhận cùng một refund id, nên có thể nhận ra refund đã xử lý); tổng `SoTienHoan` của một payment bị chặn ≤ `THANH_TOAN.SoTien` (mọi dòng, kể cả "Thất bại", đều giữ chỗ). **Ý nghĩa các cột:** `NgayYeuCau` chỉ được ghi MỘT lần, lúc tạo dòng HOAN_TIEN (`refunds.repository.ts` → `openPendingRefund` là nơi duy nhất ghi nó); retry không bao giờ ghi đè. `NgayHoanTien` chỉ được ghi khi refund chuyển sang "Thành công" (bởi `settle`). Retry: "Thành công" → no-op không gọi gateway; "Thất bại" → claim (chỉ đổi `TrangThai` sang "Chờ xử lý") rồi gửi lại; "Chờ xử lý" → luôn 409 "đang được xử lý". Chính trạng thái "Chờ xử lý" là dấu "đang có một lần thử".
Cổng VNPAY sandbox hiện tại chỉ có lệnh `refund`; adapter chưa có lệnh truy vấn giao dịch (`querydr`), nên không kiểm tra trạng thái trước khi gửi lại; thay vào đó dùng lại cùng refund id và giữ một dòng HOAN_TIEN duy nhất, không dựng queue/outbox.

**Transaction boundaries:**
| Bước | Có transaction? | Khóa giữ | Gọi gateway? |
|---|---|---|---|
| cancel – ghi nhận (booking + HOAN_TIEN "Chờ xử lý") | có, ngắn, COMMIT trước bước sau | DAT_PHONG, THANH_TOAN (success), HOAN_TIEN mới | không |
| retry – claim | có, ngắn, COMMIT | dòng HOAN_TIEN | không |
| callback muộn – ghi nhận | có (cùng transaction callback), COMMIT | THANH_TOAN, DAT_PHONG | không |
| gọi gateway | **không** | **không** | có |
| chốt kết quả | một `UPDATE` có điều kiện | dòng HOAN_TIEN, chỉ trong câu lệnh | không |

**Files changed:**
- Mới: `backend/src/modules/payments/refunds.repository.ts` (khóa, tổng đã giữ chỗ, mở refund "Chờ xử lý" có chặn trần, claim retry, chốt có điều kiện), `refund-processor.ts` (bước 2–3), `refund-lifecycle.test.ts`.
- Sửa: `bookings/bookings.service.ts` (cancel 2 pha), `payments/payments.service.ts` (`handleCallback`, `retryRefund`), `payments/refund-helper.ts`, `bookings/bookings.repository.ts` và `payments/payments.repository.ts` (xóa các hàm refund không còn dùng), `bookings/bookings-cancel.test.ts` (cập nhật một test đồng thời, xem dưới).
- Frontend: `components/bookings/BookingSummary.tsx`, `pages/customer/BookingDetailPage.tsx` (nút "Thử lại" khóa khi đang gửi, hiện lý do server từ chối, ví dụ 409), `pages/customer/BookingDetailPage.test.tsx`.

**Tests added:** `refund-lifecycle.test.ts` (20 test, SQL Server thật; gồm 3 test về NgayYeuCau và "Chờ xử lý" không bị tiếp quản) + 3 test frontend.
- 1 không hoàn (tier 0%): booking "Đã hủy", không có HOAN_TIEN, gateway không bị gọi.
- 2 hoàn: đúng 1 HOAN_TIEN; lúc gateway chạy, từ một kết nối khác thấy refund "Chờ xử lý" (`NgayHoanTien` NULL) và booking "Đã hủy"; xong → "Thành công" có `NgayHoanTien ≥ NgayYeuCau`.
- 3 gateway từ chối: booking vẫn "Đã hủy", HOAN_TIEN "Thất bại", không có `NgayHoanTien`; gateway ném lỗi ⇒ hủy giữ nguyên, refund ở "Chờ xử lý" (không mất, không nhân đôi).
- 4 retry lỗi: cùng `MaHoanTien`, không INSERT, cùng `SoTienHoan`/`MaGiaoDichDoiTac`, gateway nhận cùng `refundRef`. 5 retry thành công: cùng dòng sang "Thành công" + `NgayHoanTien`. 6 retry refund đã thành công: no-op, gateway không bị gọi.
- Chỉ chủ đơn retry được (403), refund không tồn tại (404); "Chờ xử lý" ⇒ luôn 409, không gọi gateway, kể cả khi `NgayYeuCau` đã cũ 24 giờ (không tiếp quản); gateway không trả lời/ném lỗi ⇒ "Thất bại" trên cùng dòng, retry sau gửi lại đúng refund id đó.
- **`NgayYeuCau` bất biến:** cancel với gateway lỗi, đẩy `NgayYeuCau` về 3 giờ trước, retry thất bại 3 lần (mỗi lần kiểm tra lại `NgayYeuCau` giữ nguyên và `NgayHoanTien` NULL), rồi retry thành công: `NgayYeuCau` vẫn là giá trị ban đầu, `NgayHoanTien` được ghi (lớn hơn `NgayYeuCau`). Kiểm chứng bằng cách tạm cho claim ghi `NgayYeuCau = now` — test này FAIL — rồi khôi phục.
- 7 hai cancel đồng thời: 1 thành công, 1 bị từ chối (400/409), 1 HOAN_TIEN, 1 lần gọi gateway. 8 ba retry đồng thời: gateway chỉ được gọi 1 lần, 1 dòng "Thành công". Cancel + retry chạy sát nhau: 1 dòng, tối đa 1 refund thành công, 1 lần gọi gateway.
- 9 không vượt payment gốc: tier 50% làm tròn đúng (500.001 trên 1.000.001); payment đã hoàn 700.000 thì hủy 100% chỉ thêm 300.000 (tổng = 1.000.000); đã hoàn đủ thì hủy vẫn thành công, không thêm dòng, không gọi gateway.
- 10 booking 0đ: không có THANH_TOAN, hủy không tạo HOAN_TIEN, không gọi gateway.
- **Chứng minh không giữ khóa khi gọi gateway** (cancel, retry và callback thanh toán muộn): bên trong lời gọi gateway, từ kết nối khác đọc DAT_PHONG, THANH_TOAN, HOAN_TIEN bằng `WITH (NOWAIT)` — không lỗi khóa 1222 — và thấy dòng HOAN_TIEN đã commit ở trạng thái "Chờ xử lý". Callback muộn: refund 100% được ghi trước, gateway chạy sau, rồi chốt; callback lặp lại trả mã 02 và không tạo thêm refund.
- Đối chứng: trên code cũ (stash 6 file triển khai) 8 test FAIL (trên bản 19 test lúc đó) — 3 test "không giữ khóa" (cancel, retry, callback muộn), test 2 ("Chờ xử lý" phải nhìn thấy được từ kết nối khác), test 9 (trần hoàn tiền), "đang xử lý ⇒ 409", "không rõ ⇒ giữ Chờ xử lý" và "gateway ném lỗi"; các test 1, 3–8, 10, "tiếp quản" PASS trên code cũ vì cách giữ khóa cũ cũng tuần tự hóa được, chỉ khác là phải giữ khóa suốt lời gọi mạng.
- Test cũ phải đổi: `serializes simultaneous retries so the gateway is called only once` trước đây kỳ vọng cả hai retry cùng trả "Thành công"; nay một retry làm việc, retry còn lại trả "Thành công" (đến sau) hoặc 409 (gặp lúc đang chạy), gateway vẫn đúng 1 lần.

**SQL Server verification:** (sqlcmd trên `HotelBooking_DB0_Test`; dựng 5 kịch bản thật: hoàn thành công, hoàn bị từ chối, booking 0đ, hoàn lỗi rồi retry thành công, tier 0%; kiểm tra rồi dọn)
- 7915 hoàn 1.000.000 "Thành công" có `NgayHoanTien` · 7916 "Thất bại" `NgayHoanTien` NULL, booking vẫn "Đã hủy" · 7917 (0đ) không có THANH_TOAN/HOAN_TIEN · 7918 lỗi rồi retry ⇒ cùng 1 dòng (615) "Thành công" · 7919 tier 0% không có HOAN_TIEN.
- Toàn DB, mọi truy vấn đều 0: payment có nhiều hơn 1 dòng refund · refund cộng dồn vượt `SoTien` · payment có nhiều hơn 1 refund thành công · refund "Thành công" thiếu `NgayHoanTien` · refund "Thất bại"/"Chờ xử lý" có `NgayHoanTien` · `NgayHoanTien < NgayYeuCau` · refund trên booking chưa hủy · booking 0đ có payment/refund · refund "Chờ xử lý" kẹt hơn 5 phút.

**Regression result:** backend `eslint` sạch, `tsc --noEmit` sạch, `npm run build` thành công, **43 file / 522 test PASS** (trước bug #8: 42 / 502); `refund-lifecycle.test.ts` 20/20. Nhóm refund/cancel/payment đã chạy lặp 3 lần liên tiếp trước đó, 65/65 mỗi lần, không flaky. Frontend `tsc -b --noEmit` sạch, build thành công, 384 test: 382 PASS, 2 FAIL vốn có từ trước (`HomePage`/`HotelListPage` guest count); `eslint` vẫn 3 lỗi `<main>` có sẵn, không lỗi mới.

**Schema changes:** NONE (không bảng/cột/FK/trạng thái mới; chỉ dùng "Chờ xử lý", "Thành công", "Thất bại" sẵn có).

**Result: PASS**

### Ghi chú hành vi cần biết (bug #8)
- Một yêu cầu hủy giờ trả về sau khi gateway trả lời (vẫn như trước), nhưng gateway không còn nằm trong transaction.
- Khi gateway không trả lời (timeout, lỗi mạng), refund được ghi "Thất bại" và retry được với cùng refund id; nếu gateway thực ra đã xử lý, việc nhận ra phụ thuộc vào việc VNPAY nhận diện lại refund id đó (adapter chưa có lệnh truy vấn giao dịch).
- **Limitation / Change Gate candidate — "Chờ xử lý" bị kẹt:** HOAN_TIEN không có timestamp cho "lần thử này bắt đầu lúc nào", và `NgayYeuCau` không được dùng thay thế (nó là ngày yêu cầu hoàn tiền, ghi một lần). Vì vậy DB không phân biệt được "đang chạy" với "bị kẹt". Một dòng "Chờ xử lý" do tiến trình chết giữa commit (bước 1) và chốt (bước 3) sẽ ở đó mãi: retry luôn trả 409 và không có job nền tự xử lý; cần can thiệp tay (đưa về "Thất bại" bằng SQL). Cách xử lý đúng cần schema: thêm một cột thời điểm cho lần thử (ví dụ `NgayCapNhat`/`NgayBatDauXuLy` trên HOAN_TIEN) hoặc trạng thái "Đang xử lý" cùng hạn thuê (lease). **Đề xuất Change Gate, chưa thực hiện.** Cửa sổ rủi ro chỉ là khoảng giữa hai lệnh DB liên tiếp quanh một lời gọi gateway (tối đa ~8 giây nếu tiến trình chết đúng lúc đó).
- Thông tin giao dịch hoàn của VNPAY (ví dụ `vnp_TransactionNo` của lệnh refund) không được lưu riêng: adapter không trả về và HOAN_TIEN không có cột cho nó; `MaGiaoDichDoiTac` giữ refund id của hệ thống, được ghi lúc tạo dòng.

## Regression
**Backend:** `eslint .` sạch · `tsc --noEmit` sạch · `npm run build` (prisma generate + tsc) exit 0 · `vitest run`: **43 file, 522 test, tất cả PASS** (sau bug #8; sau bug #2: 42 file / 502 test; trước khi sửa: 39 file / 417 test). Gồm concurrency đặt phòng, khuyến mãi, callback idempotency, hủy/hoàn tiền, lịch sử đặt phòng, cô lập owner, phân quyền admin, analytics, search/hotel detail.

**Frontend:** `tsc -b --noEmit` sạch · `npm run build` thành công · `vitest run`: 60 file, 384 test: **382 PASS, 2 FAIL — đã FAIL từ trước khi sửa** (xác nhận bằng `git stash` trên cùng 3 file test): `HomePage guest count` và `HotelListPage guest count` (`getByText('2 khách')` gặp nhiều phần tử). · `eslint .`: **3 lỗi có sẵn từ trước** (`<main>` trong `LoginPage.tsx`, `HotelDetailPage.tsx`, `HotelListPage.tsx`; HEAD đã có sẵn thẻ này), không có lỗi mới.

**Database** (kiểm tra bằng sqlcmd trên DB test sau khi chạy test):
- khách sạn có hơn một payment `Chờ xử lý`: 0 · payment `SoTien <= 0`: 0
- booking tổng 0 còn "Chờ thanh toán": 0 · booking tổng 0 có dòng THANH_TOAN: 0
- khách sạn "Chờ duyệt"/"Từ chối" có `NgayDuyet`/`MaTaiKhoanDuyet`: 0 (chưa duyệt thì không có dấu vết duyệt; chỉ "Hoạt động" mới public)
- booking tạo cho kỳ lưu trú đã ở quá khứ: 0 · booking trên 30 đêm: 0
- Không do thay đổi này: 1 khách sạn "Hoạt động" không có `NgayDuyet` (id 84, dữ liệu test cũ còn sót từ 2026-09-26, tạo trước khi factory được sửa) — không xóa; 1 khách sạn demo "Chờ duyệt" (id 819, Sơn Trà Green Retreat) — giờ đã duyệt được.

**E2E:** chưa chạy E2E trên trình duyệt. Các luồng bắt buộc được chạy qua HTTP thật vào ứng dụng Express với DB thật (supertest): Owner tạo hotel → Admin duyệt → hotel public; Search → ngày hợp lệ → quote → booking → tạo payment mô phỏng; khuyến mãi 100% → total 0 → confirmed ngay; double-click payment → đúng 1 pending. Giao diện được kiểm bằng component/integration test (Testing Library), không bằng thao tác thủ công.

## Schema changes
NONE (bug #4, #1, #3, #2 và #8)
(`KHACH_SAN.TrangThai` nhận thêm giá trị "Từ chối" — cột là open domain không có CHECK nên không phải thay đổi schema. Không thêm bảng/cột/FK, không sửa migration.)

## Ghi chú hành vi cần biết
- Tạo payment khi đã có pending trả lại payment đó với HTTP 201 (không đổi status code để không phá client hiện có).
- `reject` khách sạn không lưu lý do (không có cột phù hợp).
- Khách sạn "Từ chối" hiện không có đường nộp lại; cần use case riêng nếu muốn.
- Trang `/payment/result` của đơn 0đ đã "Hoàn tất" mở lại sau khi lưu trú sẽ hiện "Đang xử lý" (hành vi cũ của `resolvePaymentResult` với đơn Hoàn tất không có payment, có test khóa sẵn); không ảnh hưởng luồng vừa đặt xong.
- Test cũ dùng ngày năm 2099 và ngày UTC nay chuyển sang ngày giờ VN/tương đối, nếu không sẽ lệch quy tắc mới hoặc fail theo giờ chạy.

## Kết luận
#4 PASS
#1 PASS
#3 PASS
#2 PASS
#8 PASS
Regression PASS (backend toàn bộ; frontend trừ 2 test và 3 lỗi lint đã có từ trước, ghi ở trên)
