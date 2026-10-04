# FIX VERIFICATION REPORT

Ngày: 2026-10-04 · Nhánh: `tuntun` · Phạm vi: bug #4 → #1 → #3 → #2 trong `docs/LOGIC_AUDIT.md`. Bug #8 không sửa.
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

## Regression
**Backend:** `eslint .` sạch · `tsc --noEmit` sạch · `npm run build` (prisma generate + tsc) exit 0 · `vitest run`: **42 file, 502 test, tất cả PASS** (trước khi sửa: 39 file, 417 test). Gồm concurrency đặt phòng, khuyến mãi, callback idempotency, hủy/hoàn tiền, lịch sử đặt phòng, cô lập owner, phân quyền admin, analytics, search/hotel detail.

**Frontend:** `tsc -b --noEmit` sạch · `npm run build` thành công · `vitest run`: 60 file, 381 test: **379 PASS, 2 FAIL — đã FAIL từ trước khi sửa** (xác nhận bằng `git stash` trên cùng 3 file test): `HomePage guest count` và `HotelListPage guest count` (`getByText('2 khách')` gặp nhiều phần tử). · `eslint .`: **3 lỗi có sẵn từ trước** (`<main>` trong `LoginPage.tsx`, `HotelDetailPage.tsx`, `HotelListPage.tsx`; HEAD đã có sẵn thẻ này), không có lỗi mới.

**Database** (kiểm tra bằng sqlcmd trên DB test sau khi chạy test):
- khách sạn có hơn một payment `Chờ xử lý`: 0 · payment `SoTien <= 0`: 0
- booking tổng 0 còn "Chờ thanh toán": 0 · booking tổng 0 có dòng THANH_TOAN: 0
- khách sạn "Chờ duyệt"/"Từ chối" có `NgayDuyet`/`MaTaiKhoanDuyet`: 0 (chưa duyệt thì không có dấu vết duyệt; chỉ "Hoạt động" mới public)
- booking tạo cho kỳ lưu trú đã ở quá khứ: 0 · booking trên 30 đêm: 0
- Không do thay đổi này: 1 khách sạn "Hoạt động" không có `NgayDuyet` (id 84, dữ liệu test cũ còn sót từ 2026-09-26, tạo trước khi factory được sửa) — không xóa; 1 khách sạn demo "Chờ duyệt" (id 819, Sơn Trà Green Retreat) — giờ đã duyệt được.

**E2E:** chưa chạy E2E trên trình duyệt. Các luồng bắt buộc được chạy qua HTTP thật vào ứng dụng Express với DB thật (supertest): Owner tạo hotel → Admin duyệt → hotel public; Search → ngày hợp lệ → quote → booking → tạo payment mô phỏng; khuyến mãi 100% → total 0 → confirmed ngay; double-click payment → đúng 1 pending. Giao diện được kiểm bằng component/integration test (Testing Library), không bằng thao tác thủ công.

## Schema changes
NONE
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
Regression PASS (backend toàn bộ; frontend trừ 2 test và 3 lỗi lint đã có từ trước, ghi ở trên)
