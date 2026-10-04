# Báo cáo kiểm tra logic Backend và kết nối Frontend ↔ Backend

> Ngày kiểm tra: 2026-10-04 · Nhánh: `tuntun`
> Phương pháp: đọc code tĩnh (backend: bookings, payments, quotes, auth, promotions, reviews, owner, admin, analytics; frontend: lớp gọi API, route, các trang đặt phòng/thanh toán/owner/admin) rồi đối chiếu hai phía.
> **Chưa sửa code, chưa chạy test hay chạy ứng dụng** — mọi kết luận cần được xác nhận khi sửa.

## Tổng hợp

| # | Mức | Vấn đề | Vị trí chính |
|---|-----|--------|--------------|
| 1 | Nghiêm trọng | Không có luồng duyệt khách sạn; khách sạn mới không bao giờ hiển thị | `admin-hotels.service.ts`, `AdminHotelDetailPage.tsx` |
| 2 | Nghiêm trọng | Đơn tổng thanh toán 0đ không thể xác nhận | `payments.service.ts`, `promotion-pricing.ts` |
| 3 | Nghiêm trọng | Backend không chặn ngày nhận phòng trong quá khứ / khoảng ngày quá dài | `bookings.schemas.ts`, `quotes.schemas.ts`, `hotels.schemas.ts` |
| 4 | Nghiêm trọng | Nhiều giao dịch "Chờ xử lý" cho một đơn → có thể thu tiền hai lần | `payments.service.ts` |
| 5 | Trung bình | Tìm kiếm/rooms/quote/analytics không dọn đơn hết hạn | `hotels.service.ts`, `quotes.service.ts`, analytics |
| 6 | Trung bình | Token vẫn dùng được sau khi khóa tài khoản/đổi vai trò | `auth.middleware.ts` |
| 7 | Trung bình | Admin tự khóa/xóa/đổi vai trò chính mình, không bảo vệ admin cuối | `accounts.service.ts` |
| 8 | Trung bình | Gọi cổng VNPAY hoàn tiền bên trong transaction DB | `bookings.service.ts`, `payments.service.ts` |
| 9 | Trung bình | Owner ngừng khách sạn/loại phòng hoặc giảm quỹ phòng mà không xét đơn đang có | `owner-*.service.ts` |
| 10 | Trung bình | Đánh giá không có endpoint hiển thị công khai | module `reviews`, `hotels` |
| 11 | Trung bình | Lỗi validate từ server không tới được giao diện | `error.middleware.ts`, `apiClient.ts` |
| 12–20 | Nhỏ | Xem mục "Lỗi nhỏ và rủi ro" | — |

---

## Lỗi nghiêm trọng

### 1. Quy trình duyệt khách sạn không hoàn chỉnh
- Chủ khách sạn tạo khách sạn ở trạng thái `Chờ duyệt` (`owner-hotels.repository.ts`, `hotelStatusDefault`). Chỉ khách sạn `Hoạt động` mới xuất hiện ở tìm kiếm công khai.
- Backend **không có endpoint duyệt**. `admin-hotels.service.ts` chỉ có `suspend` và `reactivate`; `reactivate` chỉ chấp nhận trạng thái `Đình chỉ` (các trạng thái khác trả 400 "Chỉ có thể kích hoạt lại khách sạn đang bị đình chỉ").
- Giao diện `AdminHotelDetailPage.tsx` hiện nút "Kích hoạt lại cơ sở" cho **mọi** khách sạn không `Hoạt động` → admin bấm chỉ thấy "Thao tác thất bại". Bộ lọc ở `AdminHotelsPage.tsx` không có "Chờ duyệt".
- `MaTaiKhoanDuyet`, `NgayDuyet` không bao giờ được ghi.
- `Ngừng hoạt động` (owner bấm deactivate) là trạng thái cụt: owner không có endpoint bật lại, admin cũng không reactivate được.
- Giao diện owner (`OwnerHotelFormPage.tsx`) hứa "quản trị viên sẽ thẩm định hồ sơ" nhưng không có chức năng nào thực hiện việc đó.

### 2. Đơn tổng thanh toán 0đ không thể xác nhận
- `evaluatePromotion` giới hạn giảm ≤ tiền phòng, nên mã giảm 100% (hợp lệ, vì ≤ 100) hoặc giảm cố định ≥ tiền phòng cho `TongTienThanhToan = 0`; DB cho phép (`CK_DAT_PHONG_TongTienThanhToan: >= 0`).
- `createBooking` vẫn tạo đơn "Chờ thanh toán", nhưng `createVnpayPayment` từ chối "tổng bằng 0, không cần thanh toán qua cổng", và bảng THANH_TOAN có `CHECK (SoTien > 0)`.
- Không có đường nào khác để chuyển đơn sang "Đã xác nhận" → đơn tự hủy sau 15 phút, mã khuyến mãi bị "đốt" tạm thời.

### 3. Backend không chặn ngày quá khứ và khoảng ngày dài
- `createBookingSchema`, `quoteRequestSchema`, `searchHotelsQuerySchema`, `hotelRoomsQuerySchema` chỉ kiểm tra `checkOut > checkIn`. Frontend có chặn ngày quá khứ ở UI (`TravelSearchBar`) nhưng gọi API trực tiếp thì đặt được.
- Đơn ngày quá khứ sau khi thanh toán sẽ bị `completeFinishedBookings` chuyển ngay sang `Hoàn tất` → có thể đánh giá khách sạn chưa từng ở.
- Không có giới hạn số đêm tối đa; `enumerateNights` lặp theo từng ngày nên khoảng ngày rất dài (nhiều năm) làm nặng server (cả tìm kiếm, báo giá và đặt phòng).

### 4. Nhiều giao dịch "Chờ xử lý" cho một đơn
- Mỗi lần gọi `createVnpayPayment` (`POST /bookings/:id/payments/vnpay`) chèn thêm một bản ghi THANH_TOAN `Chờ xử lý`, không kiểm tra bản ghi đang chờ của cùng đơn.
- Nếu khách mở hai tab / bấm hai lần rồi trả cả hai: lần trả thứ hai thấy `confirmBookingIfPending = 0` và bị hoàn 100% với lý do sai ("sau khi đặt phòng đã hết hạn/hủy").
- Đơn khi đó có **hai** khoản `Thành công`, trong khi code giả định chỉ có một (`findSuccessfulPayment` dùng `findFirst`). Khi khách hủy, chỉ một khoản được hoàn, khoản kia bị bỏ sót.
- Không có UNIQUE hay lock nào ngăn việc này (`THANH_TOAN.MaGiaoDichDoiTac` chỉ có index).

---

## Lỗi trung bình

### 5. Đơn "Chờ thanh toán" hết hạn không được dọn ở nhiều điểm đọc
- Chỉ đặt phòng, thanh toán, danh sách/chi tiết/hủy đơn và owner bookings gọi `expireStalePendingBookings`. Tìm kiếm khách sạn (`hotels.service.ts: search`, `getRooms`) và báo giá (`quotes.service.ts: createQuote`) thì không — chúng vẫn tính đơn hết hạn là đang chiếm phòng.
- Hệ quả: tìm kiếm/báo giá báo "hết phòng", `KhaDung = false`, trong khi bấm đặt phòng thì thành công (vì `createBooking` có dọn).
- Analytics của owner và admin (`owner-analytics.service.ts`, `admin-analytics.service.ts`) cũng đếm đơn đã hết hạn như đang "Chờ thanh toán", và không chuyển "Đã xác nhận" quá hạn sang "Hoàn tất" trước khi đếm.

### 6. Token truy cập vẫn dùng được sau khi tài khoản bị khóa hoặc đổi vai trò
- `authenticate` (`auth.middleware.ts`) chỉ xác minh chữ ký JWT, không đọc DB. Access token sống 15 phút → tài khoản bị khóa vẫn gọi API được trong thời gian đó; vai trò trong token là vai trò lúc đăng nhập.
- Sau khi admin duyệt hồ sơ đối tác, vai trò trong DB đổi nhưng token cũ vẫn là "Khách hàng". `PartnerApplyPage.tsx` có tự `refreshSession`, nhưng chỉ khi người dùng đang mở đúng trang đó; nếu không, họ bị `ProtectedRoute` chặn khỏi `/owner` cho tới lần refresh sau.
- `resetPassword` (`auth.service.ts`) không kiểm tra tài khoản bị khóa.

### 7. Admin có thể tự phá tài khoản quản trị
- `accounts.service.ts` (`lock`, `safeDelete`, `update` với `MaVaiTro`) không kiểm tra `id` trùng với admin đang đăng nhập, cũng không bảo vệ admin cuối cùng. Admin có thể tự khóa, xóa hoặc hạ vai trò → hệ thống mất toàn bộ admin.

### 8. Gọi cổng VNPAY hoàn tiền khi đang giữ transaction/lock DB
- `bookings.service.ts` (`cancelBooking`, dòng ~371) và `payments.service.ts` (`handleCallback`, `retryRefund`) gọi API hoàn tiền (timeout 8 giây) bên trong `$transaction`, khi đang giữ `UPDLOCK/HOLDLOCK` trên THANH_TOAN/HOAN_TIEN.
- Nếu transaction rollback sau khi VNPAY đã hoàn tiền → tiền đã đi nhưng DB không có bản ghi. Nếu VNPAY chậm → các request khác bị chặn lâu.
- Khi hoàn tiền thất bại, đơn vẫn bị hủy; chỉ có cơ chế khách tự bấm "thử lại". `retryRefund` dùng lại `refundRef` cũ nên nếu VNPAY đã xử lý nhưng timeout, lần thử lại có thể bị từ chối hoặc xử lý trùng tùy phía VNPAY.

### 9. Owner thay đổi khách sạn/quỹ phòng mà không xét đơn đang có
- `deactivate` khách sạn và loại phòng không kiểm tra đơn tương lai đã thanh toán.
- `bulkUpsert` giá/số phòng (`owner-rates.service.ts`) cho phép đặt `SoLuongPhong` thấp hơn số phòng đã đặt, và cho sửa giá/ngày trong quá khứ → overbooking; `computeRoomTypeAvailability` che lại bằng `Math.max(0, …)` nên không ai nhận ra.
- Owner vẫn sửa được thông tin khách sạn đang `Đình chỉ` (`OwnerHotelsService.update` không kiểm tra trạng thái).

### 10. Đánh giá không có nơi hiển thị công khai
- Không có endpoint công khai nào trả danh sách đánh giá hay điểm trung bình của khách sạn; frontend chỉ dùng đánh giá ở trang khách (`ReviewSection`) và admin.
- Toàn bộ luồng kiểm duyệt (`Chờ duyệt` → `Hiển thị`/`Ẩn`/`Vi phạm`) vì vậy không có tác dụng với người dùng cuối, và `HotelSearchItem` không có điểm đánh giá.

### 11. Lỗi validate từ server không tới được giao diện
- Backend trả lỗi Zod ở khóa `errors` (mảng `{field, message}`) và lỗi nghiệp vụ ở `details` (`error.middleware.ts`).
- Frontend đọc `data.error` (`apiClient.ts`, ~dòng 98) và không có chỗ nào dùng `ApiError.details`. Người dùng chỉ thấy thông báo tiếng Anh "Validation failed", không biết trường nào sai.
- Kiểu `ApiResponse` ở cả hai phía đều khai báo `error?: unknown`, nhưng backend không bao giờ gửi `error`.

---

## Lỗi nhỏ và rủi ro

| # | Vấn đề | Chi tiết |
|---|--------|----------|
| 12 | `/auth/change-password` không dùng được từ frontend | Endpoint tồn tại ở backend nhưng `ProfilePage.tsx` chỉ gửi email "quên mật khẩu". Ngoài ra `apiClient` bỏ qua refresh với mọi đường dẫn bắt đầu `/auth/` → gọi `change-password` bằng access token hết hạn sẽ trả 401 mà không tự refresh. |
| 13 | Múi giờ dùng UTC thay vì giờ Việt Nam | Tiền hoàn lấy mốc 00:00 UTC của ngày nhận phòng (= 07:00 VN), bỏ qua `GioNhanPhong` của khách sạn (`bookings.service.ts` ~dòng 338; `refund-preview.ts` lặp lại cùng giả định). Khuyến mãi xét theo ngày UTC nên 00:00–07:00 VN bị lệch một ngày. Đơn chuyển `Hoàn tất` từ 00:00 UTC ngày trả phòng, trước giờ trả phòng thực tế. |
| 14 | Tỷ lệ lấp đầy có thể vượt 100% | `occupancy` (`analytics.repository.ts`) lấy mẫu số chỉ từ quỹ phòng `Mở bán`, tử số từ mọi đơn không hủy kể cả ngày không có quỹ hoặc đã đóng bán. Sửa `SoLuongPhong` sau này cũng làm thay đổi số liệu quá khứ. |
| 15 | Mã khuyến mãi tự áp khi đổi số phòng | `setRoomQuantity` trong `HotelDetailPage.tsx` gọi `setAppliedPromo(promoCode.trim())`: đổi số lượng phòng sẽ áp luôn mã khách mới gõ mà chưa bấm "Áp dụng". |
| 16 | Checkbox xác nhận ở đăng ký đối tác vô tác dụng | Checkbox trong `PartnerApplyPage.tsx` không gắn vào react-hook-form, form lại để `noValidate` nên thuộc tính `required` không được kiểm tra. |
| 17 | Cookie refresh có thể không gửi được khi triển khai | Cookie là `SameSite=lax`, `path=/api/auth`. Nếu frontend và API ở hai domain khác *site* thì trình duyệt không gửi cookie, mỗi lần tải lại trang đều mất phiên. Ngoài ra `apiClient` mặc định `/api` nhưng `vite.config.ts` không có proxy → thiếu `.env` thì mọi request trả HTML và báo "Failed to parse response JSON". |
| 18 | Số khách không được lưu | `guests` chỉ dùng để lọc loại phòng khi tìm kiếm; báo giá và đặt phòng không nhận, không lưu số khách nên không thể kiểm tra sức chứa tổng. |
| 19 | Hợp đồng PATCH khách sạn của admin không khớp owner | Schema admin dùng `z.coerce.date()` cho `GioNhanPhong/GioTraPhong` còn owner dùng chuỗi "HH:MM". UI admin hiện không gửi hai trường này nên chưa lỗi. |
| 20 | Bộ lọc `starRating` là "từ N sao trở lên" | Backend dùng `HangSao >= starRating`; nếu UI hiểu là "đúng N sao" thì kết quả không khớp (cần xác nhận với thiết kế). |

---

## Những phần đã kiểm tra và khớp nhau
Các route, tên tham số và payload sau khớp giữa frontend và backend: auth (register/login/refresh/logout/forgot/reset), profile, bookings (create/list/detail/cancel), payments (create/status/vnpay-return/IPN/refund retry), quotes, hotels (search/detail/rooms), reviews, support, partners, promotions, analytics, owner (hotels/room-types/rates/bookings/images), admin (accounts/hotels/payments/reviews/support/partner-applications). Các điểm tốt đã thấy: khóa `UPDLOCK` khi đặt phòng và khuyến mãi, chống callback trùng, tự hoàn tiền khi thanh toán đến muộn, kiểm tra chữ ký VNPAY, refresh token gắn với dấu vân tay mật khẩu.

## Thứ tự sửa đề xuất
1. #1 (thêm endpoint duyệt khách sạn và sửa UI admin), #3 (chặn ngày quá khứ, giới hạn số đêm), #4 (chặn/tái sử dụng giao dịch đang chờ), #2 (cho phép xác nhận đơn 0đ hoặc cấm mã làm tổng về 0).
2. #6, #7, #5, #9.
3. #8, #10, #11, rồi các mục nhỏ.
