# FIX VERIFICATION REPORT

Ngày: 2026-10-04 · Nhánh: `tuntun` · Phạm vi: bug #4 → #1 → #3 → #2 → #8, rồi #6 → #7 → #5 → #9 → #10 → #11 → #13 trong `docs/LOGIC_AUDIT.md`.
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

## Bug #6 — Token còn hạn sau khi khóa tài khoản / đổi vai trò
**Root cause:** `authenticate` chỉ kiểm tra chữ ký JWT; `req.user.role` lấy từ token. Tài khoản bị khóa vẫn gọi API tới 15 phút, vai trò cũ còn hiệu lực. `resetPassword` không xét tài khoản khóa.

**Files changed:** `backend/src/middleware/auth.middleware.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/auth.test.ts` (test cũ đổi 403 → 401), test mới `backend/src/middleware/auth-live-state.test.ts`. Frontend: không đổi (401 → thử refresh → refresh bị từ chối với tài khoản khóa → phiên kết thúc).

**Solution:** sau khi xác minh chữ ký, middleware đọc `TAI_KHOAN` (trạng thái + `VAI_TRO.TenVaiTro`) trong DB cho mỗi request: không tồn tại hoặc "Khóa" → 401 "Tài khoản không khả dụng"; vai trò là vai trò HIỆN TẠI trong DB, bỏ qua `role` trong token. Chi phí: một truy vấn khóa chính mỗi request đã xác thực. `forgotPassword` không gửi mail cho tài khoản khóa; `resetPassword` từ chối token (kể cả token cấp trước khi khóa), không đổi mật khẩu và không đổi trạng thái.

**Tests added:** 11 test (SQL Server thật): khóa khi token còn hạn → 401, mở khóa thì cùng token dùng lại được; owner/admin bị khóa mất endpoint; token của tài khoản không còn tồn tại → 401; token hỏng/thiếu → 401; customer thăng owner (token cũ vào endpoint owner, mất endpoint customer); admin hạ customer (mất toàn bộ endpoint admin ngay); token tự nhận role admin nhưng DB là customer → 403; ma trận quyền customer/owner/admin trước và sau khi hoán đổi vai trò; reset sau khi khóa → 400, vẫn khóa, mật khẩu không đổi, đăng nhập mật khẩu mới không được; forgot-password không gửi mail cho tài khoản khóa nhưng gửi cho tài khoản hoạt động; reset bình thường vẫn chạy và giữ trạng thái hoạt động.
**SQL verification:** mục A1/A7 (còn quản trị viên hoạt động) — xem bảng cuối.
**Regression:** auth, profile, accounts, partners, middleware: 126 test PASS.
**Schema changes:** NONE · **Result: PASS**

## Bug #7 — Admin tự khóa / xóa / hạ quyền; mất admin cuối
**Root cause:** `accounts.service` (`lock`, `safeDelete`, `update` với `MaVaiTro`) không biết ai đang thao tác và không đếm quản trị viên còn lại.

**Files changed:** `modules/accounts/accounts.service.ts`, `accounts.repository.ts` (thao tác nhận transaction, khóa tập admin), `accounts.controller.ts` (truyền `req.user`), test mới `accounts-admin-guard.test.ts`. Frontend: `pages/admin/AdminAccountDetailPage.tsx` (ẩn nút khóa/xóa tài khoản của chính mình, hiện lý do server từ chối), test mới `AdminAccountDetailPage.test.tsx`.

**Solution:** khóa/xóa/đổi vai trò chạy trong một transaction: (1) tự thao tác lên chính mình → 400; (2) `SELECT … WITH (UPDLOCK, HOLDLOCK)` toàn bộ tài khoản có vai trò admin (khóa cả dải khóa), (3) nếu đích là admin đang hoạt động mà không còn admin hoạt động nào khác → 409; (4) ghi thay đổi trong cùng transaction. Hai admin thao tác cùng lúc xếp hàng ở bước 2 nên người đến sau thấy kết quả đã commit. Xóa admin có lịch sử (vốn chỉ khóa) cũng đi qua cùng kiểm tra.

**Tests added:** 12 test + 3 test frontend. HTTP: tự khóa/xóa/hạ quyền → 400 và không đổi gì; vẫn sửa được hồ sơ của mình; khóa/hạ quyền/xóa admin KHÁC khi còn admin khác → 200. Service (repository chỉ đếm "admin còn lại" trong nhóm tài khoản test, vì DB test dùng chung có admin thật — phần khóa, transaction, kiểm tra, ghi là code thật): admin duy nhất bị khóa/xóa/hạ quyền → 409 không đổi gì; hai admin: một người bị khóa được, người còn lại thành admin cuối được bảo vệ; admin đã bị khóa không tính là "còn lại"; khóa người không phải admin không bị ảnh hưởng. Đồng thời (3 vòng mỗi loại): hai admin cùng khóa nhau, cùng xóa nhau, và một khóa + một hạ quyền → đúng 1 thành công, 1 bị 409, còn đúng 1 admin hoạt động. Kiểm chứng bằng đột biến: bỏ khóa `UPDLOCK/HOLDLOCK` → 3 test đồng thời FAIL; khôi phục → PASS.
**SQL verification:** A1 = 3 quản trị viên hoạt động, A7 = 0.
**Regression:** accounts (32 test) PASS. **Schema changes:** NONE · **Result: PASS**

## Bug #5 — Booking "Chờ thanh toán" hết hạn vẫn chiếm phòng ở search/rooms/quote/analytics
**Root cause:** chỉ đặt phòng, thanh toán, danh sách đơn và owner bookings gọi `expireStalePendingBookings`; search, rooms, quote và analytics đọc thẳng DB nên vẫn tính đơn quá 15 phút là đang chiếm phòng / đang chờ thanh toán.

**Files changed:** `modules/bookings/booking-lifecycle.ts` (mới: `releaseExpiredHolds`, `reconcileBookingLifecycle`), `hotels/hotels.service.ts` (search, rooms), `quotes/quotes.service.ts`, `owner/owner-analytics.service.ts`, `analytics/admin-analytics.service.ts`, `owner/owner-bookings.service.ts` (dùng hàm chung), test mới `bookings/hold-consistency.test.ts`.

**Solution:** TTL giữ nguyên (`PAYMENT_TIMEOUT_MINUTES` = 15). Mọi nơi mà câu trả lời phụ thuộc vào tồn kho hoặc trạng thái booking gọi cùng một hàm lazy-expire trước khi đọc (không có job nền): search, rooms, quote, tạo booking (đã có), analytics owner/admin, owner bookings. Một quy tắc, một nơi.

**Tests added:** 7 test: trong TTL (14 phút) search/rooms/quote/đặt phòng đều báo "hết phòng" (409) và analytics vẫn đếm đơn chờ; quá TTL (16 phút) search, rooms, quote đều thấy phòng trống và đơn bị chuyển "Đã hủy", đặt phòng ngay sau quote thành công (201), analytics owner không còn đếm "Chờ thanh toán" và không còn đơn pending quá hạn nào; một kịch bản: cả search/rooms/quote cùng "hết" rồi cùng "còn" sau khi đơn già đi 16 phút. Đột biến: biến `releaseExpiredHolds` thành no-op → 4 test FAIL; khôi phục → PASS.
**SQL verification:** A3 = 0 (không còn đơn "Chờ thanh toán" quá 15 phút sau các lần đọc), A2 = 0.
**Regression:** bookings, hotels, quotes, owner, analytics: 242 test PASS. **Schema changes:** NONE · **Result: PASS**

## Bug #9 — Owner sửa quỹ phòng / khách sạn
**Root cause:** `bulkUpsert` ghi thẳng không kiểm tra số phòng đã đặt, không chặn ngày quá khứ, không xét khách sạn bị đình chỉ; `update` hồ sơ khách sạn cho sửa mọi trường khi bị đình chỉ.

**Files changed:** `owner/owner-rates.repository.ts` (khóa → kiểm tra → ghi trong một transaction), `owner/owner-rates.service.ts`, `owner/owner-hotels.service.ts`, `common/errors/app-error.ts` (`conflict` mang `details`), test mới `owner/owner-inventory-guard.test.ts`. Frontend: `pages/owner/OwnerInventoryPricingPage.tsx`, `components/owner/InventoryCalendar.tsx` ("quá khứ" theo ngày Việt Nam; ô ngày bắt đầu `min=hôm nay`).

**Solution:** transaction lấy CHÍNH khóa mà đặt phòng lấy (`QUY_PHONG_GIA WITH (UPDLOCK, HOLDLOCK)` trên loại phòng + dải ngày, gồm cả ngày chưa có dòng), dọn đơn pending quá hạn, tính số phòng đang chiếm mỗi đêm (mọi đơn không hủy), rồi từ chối cả yêu cầu bằng 409 nếu bất kỳ đêm nào bị đặt `SoLuongPhong` thấp hơn số phòng đã đặt (thông báo nêu ngày và số phòng, `details` liệt kê mọi ngày vi phạm); chỉ khi qua hết mới upsert, cùng transaction. Thứ tự khóa trùng thứ tự của đặt phòng (quỹ phòng trước) nên không deadlock. Ngày trước hôm nay (giờ VN) → 400 và không ghi gì. Khách sạn "Đình chỉ" → 403 với quỹ phòng/giá; hồ sơ khi đình chỉ chỉ sửa được tên, địa chỉ, mô tả (trường khác → 403 nêu tên trường). Đóng bán một đêm (không đổi số phòng) vẫn được và không đụng booking. Ngừng khách sạn / loại phòng vốn chỉ đổi `TrangThai` và chỉ chặn booking mới — test chứng minh đơn đã xác nhận vẫn xem được, hủy được.

**Tests added:** 11 test: cập nhật nhiều ngày hợp lệ (ngày không booking giảm về 0, ngày đúng bằng số đã đặt, đơn đã hủy không tính, đơn giữ chỗ còn hạn tính); một ngày vi phạm → 409 và KHÔNG lưu gì (kể cả ngày hợp lệ khác trong cùng yêu cầu); đơn giữ chỗ quá hạn không chặn giảm; đóng bán giữ nguyên booking nhưng đóng bán cũng không cho phép giảm; ngày quá khứ → 400 và không lưu phần còn lại; hôm nay vẫn sửa được; khách sạn đình chỉ → 403 cho quỹ phòng, hồ sơ chỉ sửa tên/mô tả; khách sạn hoạt động sửa mọi trường; ngừng khách sạn → đơn xác nhận còn nguyên/xem được/hủy được, đặt mới 404; ngừng loại phòng → đơn còn nguyên, đặt mới 400; đua giữa 6 yêu cầu đặt phòng và một lần giảm số phòng (4 vòng): tồn kho cuối luôn ≥ số phòng đã đặt. Đột biến: bỏ khóa → test đua FAIL trong 1/3 lần chạy (mang tính xác suất); các test logic còn lại là xác định.
**SQL verification:** A2 = 0 (không đêm nào có số phòng bán vượt quỹ phòng).
**Regression:** owner, bookings, hotels, quotes (244 test) + frontend owner/admin (30) PASS. **Schema changes:** NONE · **Result: PASS**

## Bug #10 — Review công khai
**Root cause:** không có endpoint công khai nào trả review hay điểm trung bình; kiểm duyệt (Hiển thị / Ẩn / Vi phạm) không ảnh hưởng gì tới người dùng cuối.

**Files changed:** Backend: `reviews/reviews.repository.ts`, `reviews.service.ts`, `reviews.controller.ts`, `reviews.routes.ts`, `reviews.schemas.ts`, `reviews/reviewer-name.ts` (mới), `routes/index.ts`, `hotels/hotels.service.ts`, `config/openapi.ts`, test mới `reviews/public-reviews.test.ts`. Frontend: `features/reviews/{api,hooks,types,rating}.ts`, `features/hotels/types.ts`, `components/hotels/detail/HotelReviews.tsx` (mới), `HotelHeader.tsx`, `HotelCard.tsx`, `pages/public/HotelDetailPage.tsx`, CSS thẻ khách sạn, test `HotelReviews.test.tsx` + cập nhật `HotelDetailPage.test.tsx`.

**Solution:** `GET /api/hotels/:id/reviews?page&limit` (công khai — khách vãng lai và khách đăng nhập nhận cùng kết quả): chỉ review "Hiển thị" của khách sạn đang công khai (khách sạn không công khai → 404), mới nhất trước (DANH_GIA không có cột ngày nên sắp theo id), phân trang (`limit` ≤ 50), kèm `summary`. Mỗi review chỉ gồm `MaDanhGia`, `DiemDanhGia`, `NoiDung`, `TenNguoiDanhGia` (viết tắt: "Nguyễn Văn An" → "Nguyễn V. A.") và URL ảnh — không email, id tài khoản/đặt phòng, số điện thoại, trạng thái. Chi tiết khách sạn trả `DanhGia: { DiemTrungBinh, SoLuongDanhGia }` và mỗi item tìm kiếm trả `DiemTrungBinh`, `SoLuongDanhGia` (tính một truy vấn `GROUP BY` cho các khách sạn của trang đang trả). Điểm trung bình làm tròn 1 chữ số, `null` khi chưa có; chỉ tính review "Hiển thị" nên "Chờ duyệt", "Ẩn", "Vi phạm" không vào tổng. Tên trường dùng tiếng Việt theo quy ước hiện có (tương ứng averageRating / reviewCount). Frontend: mục "Đánh giá của khách" (có tab) với phân trang, điểm ở đầu trang và trên thẻ kết quả tìm kiếm.

**Tests added:** Backend 16: viết tắt tên (6 ca); review chờ duyệt vô hình/không tính tới khi admin duyệt; hiển thị 3 review + ẩn/vi phạm/chờ không lọt vào danh sách hoặc điểm (trung bình 4, đếm 3); kiểm duyệt đổi danh sách và tổng ở cả hai chiều (kể cả xóa an toàn UC37); review khách sạn này không tính cho khách sạn khác; khách vãng lai = khách đăng nhập; không lộ email/tên đầy đủ/id/trạng thái; phân trang 5 review limit 2 (3 trang, thứ tự, tổng); limit/page sai → 400, khách sạn không tồn tại hoặc bị đình chỉ → 404; search có điểm/đếm chỉ của review Hiển thị và đi theo kiểm duyệt. Frontend 6: điểm + đếm + tên viết tắt; không có review; chuyển trang; lỗi server; thẻ khách sạn có/không có điểm.
**SQL verification:** A6 = 0 (mọi review có trạng thái hợp lệ). A5 = 3: 3 review "Hiển thị" thuộc khách sạn không công khai (dữ liệu demo có sẵn) — endpoint công khai trả 404 cho các khách sạn đó nên không lộ.
**Regression:** reviews, hotels, quotes (cùng nhóm) và frontend `pages/public`, `components/hotels`, `features` PASS (trừ 2 test có sẵn). **Schema changes:** NONE · **Result: PASS**

## Bug #11 — Hợp đồng lỗi FE ↔ BE
**Root cause:** backend trả lỗi validate ở khóa `errors` và lỗi nghiệp vụ ở `details`, không có `code`; frontend đọc `data.error` (không tồn tại) nên field error mất và hiện chuỗi chung "Validation failed".

**Files changed:** Backend: `common/errors/error-codes.ts` (mới), `common/errors/app-error.ts`, `middleware/error.middleware.ts` (viết lại), `notFound.middleware.ts`, `security.middleware.ts`, `common/types/api-response.ts`, `common/utils/response.ts`, `auth.service.ts` & `accounts.service.ts` (trùng email/tên đăng nhập mang `details`), các test cũ đọc `errors`, test mới `middleware/error-contract.test.ts`. Frontend: `services/apiClient.ts`, `types/api.ts`, `lib/apiErrors.ts` (mới), `features/auth/schemas.ts`, các form `RegisterPage`, `OwnerHotelFormPage`, `OwnerHotelManagePage`, `OwnerRoomTypeManagePage`, `PartnerApplyPage`, `ProfilePage`; test mới `apiErrors.test.ts`, `RegisterPage.test.tsx`, `schemas.test.ts`, cập nhật `apiClient.test.ts`.

**Solution:** mọi lỗi trả cùng một dạng `{ success:false, message, code, details? }`. `code` ổn định: `VALIDATION_ERROR`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`. Validate: `message` "Dữ liệu không hợp lệ", `details: [{ field, message }]` (đường dẫn lồng nhau nối bằng dấu chấm). Lỗi 5xx và lỗi không xác định chỉ trả "Internal server error" + `INTERNAL_ERROR` — không stack, SQL hay thông điệp nội bộ (ghi log phía server). Khóa `errors` cũ bị bỏ. Frontend: `ApiError` có `message`, `statusCode`, `code`, `details`, `fieldErrors`; với `VALIDATION_ERROR` nội dung banner là các thông điệp field đã loại trùng; `applyServerFieldErrors` đặt lỗi lên đúng input (chỉ các trường form có, input đầu tiên được focus), phần còn lại vẫn nằm ở banner; lỗi không phải ApiError chỉ hiện câu dự phòng, không bao giờ hiện đối tượng thô. Luồng refresh/hết phiên không đổi. Tìm ra và sửa kèm một lỗi có sẵn: bỏ trống giới tính ở form đăng ký làm RHF trả `null`, schema từ chối ngầm nên form không gửi đi và không báo gì — nay `GioiTinh` chấp nhận `null`.

**Tests added:** Backend 17: validate (body, query/param) đúng dạng và không còn `errors`; 401 / 403 / 404 (route và tài nguyên) / 400 JSON hỏng / 413 / 429 đều theo hợp đồng; unit của error handler (AppError giữ message/details/status, mã theo status, ZodError lồng nhau, lỗi lạ không rò rỉ thông điệp/stack, AppError 5xx ẩn chi tiết, `codeForStatus`). Frontend 17: `ApiError` (validate, nghiệp vụ, không có details, thân phản hồi không đọc được), `apiErrors` helpers (6), form đăng ký (lỗi trùng email gắn vào ô Email, nhiều ô cùng lúc, lỗi không có field vẫn qua banner), schema giới tính (7).
**SQL verification:** không áp dụng (không đụng dữ liệu).
**Regression:** auth, accounts, middleware, analytics, owner-analytics, stay-dates API (157 test) + frontend lib/services/pages/components PASS (trừ 2 test có sẵn). **Schema changes:** NONE · **Result: PASS**

## Bug #13 — Múi giờ nghiệp vụ Asia/Ho_Chi_Minh
**Root cause:** hạn hủy tính từ 00:00 UTC của ngày nhận phòng (= 07:00 giờ VN, bỏ qua `GioNhanPhong` của khách sạn); `Hoàn tất` chuyển ở 00:00 UTC của ngày trả phòng (5 giờ trước giờ trả phòng thực); khuyến mãi xét theo ngày UTC; báo cáo/bộ lọc ngày so sánh mốc 00:00 UTC với timestamp UTC; frontend tính "hôm nay" theo múi giờ trình duyệt.

**Files changed:** Backend: `common/utils/business-time.ts` (mới — tiện ích duy nhất), `stay-dates.ts` (dùng lại), `bookings/bookings.service.ts` (hạn hủy, `BookingDetail` thêm `GioNhanPhong`, `GioTraPhong`, `ThoiDiemNhanPhong`, `ThoiDiemTraPhong`, clock inject cho test), `bookings.repository.ts`, `booking-completion.ts`, `quotes/promotion-pricing.ts`, `analytics/date-range.ts`, `analytics.repository.ts`, `admin-analytics.repository.ts`, `admin-payments/admin-payments.service.ts`; test: `business-time.test.ts`, `bookings/timezone-rules.test.ts`, `promotion-pricing.test.ts`, `bookings-cancel.test.ts` và `refund-lifecycle.test.ts` (không còn phụ thuộc giờ chạy). Frontend: `features/bookings/refund-preview.ts`, `types.ts`, `BookingDetailPage.tsx`, `features/analytics/kpi.ts`, `OwnerDashboardPage.tsx`, `OwnerInventoryPricingPage.tsx`; test `refund-preview.test.ts`, `kpi.test.ts`.

**Solution:** quy ước lưu trữ: cột DATE là ngày lịch (UTC 00:00 của ngày đó), cột TIME là giờ treo tường của khách sạn, timestamp là thời điểm UTC; mọi quy tắc nghiệp vụ đổi sang giờ Việt Nam (UTC+7, không có DST) qua `business-time.ts`. Hạn hủy đo đến **thời điểm nhận phòng = `NgayNhanPhong` + `GioNhanPhong`**; `Hoàn tất` khi **thời điểm trả phòng = `NgayTraPhong` + `GioTraPhong`** đã qua (SQL Server tính trực tiếp). Khuyến mãi chạy từ 00:00 ngày bắt đầu đến 23:59:59 ngày kết thúc giờ VN. Báo cáo owner/admin: "từ ngày – đến ngày" là ngày lịch VN, đổi thành mốc UTC (17:00 UTC hôm trước) khi so với timestamp; cột vốn là ngày (`NgayApDung`, `NgayNhanPhong`) giữ so sánh theo ngày. Bộ lọc `to` của danh sách thanh toán admin nay bao trọn ngày cuối (trước đây loại cả ngày đó). Server gửi sẵn `ThoiDiemNhanPhong` (ISO) cho chi tiết đơn nên bản xem trước hoàn tiền ở trình duyệt dùng đúng mốc đó, không tự tính múi giờ; các trang owner dùng ngày VN cho "hôm nay".

**Tests added:** Backend 14 + 10 + 3: hạn hủy — một phút hai bên mốc 72 giờ (07:00 UTC ba ngày trước) lật 100% ↔ 50%, mốc 24 giờ lật 50% ↔ 0% (không có HOAN_TIEN), đúng mốc tính là đạt (≥), ca chứng minh khác kết quả cách tính cũ (06:00 UTC ba ngày trước vẫn 100%), theo `GioNhanPhong` riêng của khách sạn (14:00 vs 22:00); chi tiết đơn trả đúng giờ và thời điểm; hoàn tất — 04:59 UTC chưa, 05:01 UTC rồi với giờ trả 12:00, 03:00 UTC (mốc cũ) chưa, giờ trả 18:00 → 11:00 UTC, đơn đã hủy không bị hoàn tất; báo cáo — 4 mốc quanh hai lần nửa đêm VN (23:59:59 / 00:00:00) vào đúng ngày; analytics admin cùng ranh giới; danh sách thanh toán admin `to` bao ngày cuối; khuyến mãi bắt đầu/kết thúc đúng nửa đêm VN, ngày duy nhất; tiện ích (đọc cột DATE/TIME, nhận/trả phòng, `hoursUntil`, đổi ngày, qua tháng/năm). Frontend 4: xem trước hoàn tiền chính xác đến phút, mốc 72 giờ tại 07:00 UTC, sau giờ nhận phòng hoàn 0.
**SQL verification:** A4 = 0 (không có đơn "Hoàn tất" mà thời điểm trả phòng còn ở tương lai).
**Regression:** bookings, payments, reviews, owner, analytics, quotes, promotions, admin-payments (316 test) và frontend features/customer/owner (131) PASS. **Schema changes:** NONE · **Result: PASS**

## Regression
**Backend (sau cả 7 bug mới):** `eslint .` sạch · `tsc --noEmit` sạch · `npm run build` (prisma generate + tsc) thành công · `vitest run --no-file-parallelism` trên SQL Server thật: **51 file, 623 test, tất cả PASS** (mốc trước: bug #8 — 43 file / 522 test; trước mọi bug — 39 file / 417 test). Các file có tranh chấp khóa/đồng thời (admin guard, inventory guard, refund lifecycle, payments, concurrency đặt phòng, hold consistency) chạy lặp 3 lần liên tiếp: 90/90 mỗi lần, không flaky. Regression của #1/#2/#3/#4/#8 nằm trong cùng lần chạy đó (admin-hotels, bookings-zero-total, stay-dates.api, payments, refund-lifecycle: tất cả PASS).

**Frontend (sau cả 7 bug mới):** `tsc -b --noEmit` sạch · `npm run build` thành công · `vitest run`: 66 file, 415 test: **413 PASS, 2 FAIL — đã FAIL từ trước mọi thay đổi** (đối chứng bằng `git stash` ở lượt #1–#4): `HomePage guest count` và `HotelListPage guest count` (`getByText('2 khách')` gặp nhiều phần tử) — không phải suite PASS toàn bộ. `eslint .`: **3 lỗi có sẵn từ trước** (`<main>` trong `LoginPage.tsx`, `HotelDetailPage.tsx`, `HotelListPage.tsx`; HEAD đã có sẵn thẻ này), không có lỗi mới.

**Database** (sqlcmd trên `HotelBooking_DB0_Test` sau khi chạy toàn bộ test; mọi dòng "expect 0" đều ra 0):
- Bất biến mới: còn 3 quản trị viên hoạt động (A1), không đêm nào bán vượt quỹ phòng (A2), không đơn "Chờ thanh toán" quá 15 phút còn sót (A3), không đơn "Hoàn tất" mà thời điểm trả phòng còn ở tương lai (A4), không review ngoài 4 trạng thái hợp lệ (A6).
- Lấy từ các bug trước (cùng lần chạy): payment trùng pending 0 · payment `SoTien <= 0` 0 · booking 0đ chờ thanh toán hoặc có payment 0 · khách sạn chờ duyệt/từ chối mang dấu vết duyệt 0 · booking > 30 đêm 0 · payment có nhiều hơn 1 refund 0 · hoàn vượt payment 0 · refund thành công thiếu `NgayHoanTien` hoặc thất bại/chờ có `NgayHoanTien` 0 · refund trên booking chưa hủy 0 · refund kẹt "Chờ xử lý" quá 5 phút 0.
- Thông tin (không phải lỗi): 3 review "Hiển thị" thuộc khách sạn không công khai (dữ liệu demo có sẵn) — endpoint công khai trả 404 cho các khách sạn đó. Khách sạn id 84 (dữ liệu test cũ) và id 819 (demo "Chờ duyệt") đã ghi ở lượt trước.
- khách sạn có hơn một payment `Chờ xử lý`: 0 · payment `SoTien <= 0`: 0
- booking tổng 0 còn "Chờ thanh toán": 0 · booking tổng 0 có dòng THANH_TOAN: 0
- khách sạn "Chờ duyệt"/"Từ chối" có `NgayDuyet`/`MaTaiKhoanDuyet`: 0 (chưa duyệt thì không có dấu vết duyệt; chỉ "Hoạt động" mới public)
- booking tạo cho kỳ lưu trú đã ở quá khứ: 0 · booking trên 30 đêm: 0
- Không do thay đổi này: 1 khách sạn "Hoạt động" không có `NgayDuyet` (id 84, dữ liệu test cũ còn sót từ 2026-09-26, tạo trước khi factory được sửa) — không xóa; 1 khách sạn demo "Chờ duyệt" (id 819, Sơn Trà Green Retreat) — giờ đã duyệt được.

**E2E:** chưa chạy E2E trên trình duyệt. Các luồng bắt buộc được chạy qua HTTP thật vào ứng dụng Express với DB thật (supertest): Owner tạo hotel → Admin duyệt → hotel public; Search → ngày hợp lệ → quote → booking → tạo payment mô phỏng; khuyến mãi 100% → total 0 → confirmed ngay; double-click payment → đúng 1 pending. Giao diện được kiểm bằng component/integration test (Testing Library), không bằng thao tác thủ công.

## Schema changes
NONE (bug #4, #1, #3, #2, #8, #6, #7, #5, #9, #10, #11 và #13)
(`KHACH_SAN.TrangThai` nhận thêm giá trị "Từ chối" — cột là open domain không có CHECK nên không phải thay đổi schema. Không thêm bảng/cột/FK, không sửa migration.)

## Ghi chú hành vi cần biết
- (#6) Tài khoản bị khóa nhận 401 (không phải 403) ở mọi endpoint cần đăng nhập; mỗi request đã xác thực tốn thêm một truy vấn theo khóa chính.
- (#5) Lazy-expire nghĩa là các GET công khai (search, rooms, quote) có thể ghi (UPDATE đơn quá hạn thành "Đã hủy"); không có job nền.
- (#9) Test đua giữa đặt phòng và giảm quỹ phòng mang tính xác suất khi bỏ khóa (bắt được 1/3 lần); các kiểm tra logic khác là xác định.
- (#10) DANH_GIA không có cột ngày nên review công khai sắp theo id và không hiện ngày đánh giá.
- (#11) Khóa `errors` cũ của lỗi validate bị bỏ (thay bằng `details`); trong repo không còn client nào đọc nó, client bên ngoài (nếu có) phải đổi.
- (#13) Hoàn tất đơn nay xảy ra ở giờ trả phòng của khách sạn (ví dụ 12:00 giờ VN) thay vì 07:00 giờ VN, nên "Hoàn tất" và quyền đánh giá đến muộn hơn tối đa vài giờ so với trước. Bộ lọc `to` của danh sách thanh toán admin giờ bao trọn ngày cuối.
- Vẫn còn nguyên (ngoài phạm vi các lượt này): #17 (cookie refresh/SameSite), các lỗi nhỏ #12, #14–#16, #18–#20 trong `LOGIC_AUDIT.md`.
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
#6 PASS
#7 PASS
#5 PASS
#9 PASS
#10 PASS
#11 PASS
#13 PASS
Regression PASS: backend 51 file / 623 test PASS, lint/typecheck/build sạch; frontend typecheck/build sạch, 413/415 test PASS — 2 test và 3 lỗi lint là có sẵn từ baseline, đã đối chứng, không phải do thay đổi này. Chưa chạy E2E trên trình duyệt.
