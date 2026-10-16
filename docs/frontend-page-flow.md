# Sơ đồ luân chuyển trang frontend Egode

Mã Mermaid thuần nằm trong [frontend-page-flow.mmd](frontend-page-flow.mmd), bắt đầu bằng `graph TD;` và dùng dấu `;` sau mỗi câu lệnh. Để tạo sơ đồ trong draw.io, sao chép toàn bộ nội dung file `.mmd` vào **Arrange → Insert → Mermaid**, rồi chọn **Insert**. File `.drawio` dùng định dạng XML và lưu mã Mermaid bên trong từng nhóm sơ đồ.

Tài liệu này mô tả route và các luồng điều hướng/ xử lý chính theo mã nguồn hiện tại trong `frontend/src/routes`, `frontend/src/pages` và các component điều hướng liên quan.

## Phạm vi đếm trang

Route chính có **51 mục**: 50 path cụ thể trong bốn nhóm và route `*` cho trang không tìm thấy. Mục `/owner` là route chuyển hướng tới `/owner/overview`. Một component có thể phục vụ nhiều path hoặc nhiều chế độ hiển thị; các URL cũ trong `aliases.tsx` và `OwnerRouteRedirects.tsx` cũng chuyển về route chuẩn nên không tạo màn hình nghiệp vụ mới.

| Khu vực | Số mục | Route |
|---|---:|---|
| Công khai / xác thực | 7 | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/hotels`, `/hotels/:id` |
| Khách hàng | 7 | `/profile`, `/partner/apply`, `/bookings`, `/bookings/:id`, `/payment/result`, `/support`, `/support/:id` |
| Chủ khách sạn | 14 | `/owner`, `/owner/overview`, `/owner/hotels`, `/owner/hotels/new`, `/owner/hotels/:hotelId`, `/owner/hotels/:hotelId/reviews`, `/owner/room-types`, `/owner/room-types/:roomTypeId`, `/owner/inventory-pricing`, `/owner/bookings`, `/owner/bookings/:bookingId`, `/owner/revenue`, `/owner/reports`, `/owner/profile` |
| Quản trị viên | 22 | `/admin`, `/admin/profile`, `/admin/accounts`, `/admin/accounts/new`, `/admin/accounts/:id`, `/admin/hotels`, `/admin/hotels/amenities`, `/admin/hotels/:id`, `/admin/bookings`, `/admin/bookings/:id`, `/admin/payments`, `/admin/payments/:id`, `/admin/reviews`, `/admin/reviews/:id`, `/admin/support`, `/admin/support/:id`, `/admin/partner-applications`, `/admin/partner-applications/:id`, `/admin/analytics`, `/admin/promotions`, `/admin/promotions/new`, `/admin/promotions/:id` |
| Không tìm thấy | 1 | `*` |
| **Tổng** | **51** | |

## Điều hướng chung và xác thực

```mermaid
graph TD;

  A["Mở ứng dụng hoặc truy cập trang"];
  B["Khôi phục phiên từ refresh cookie"];
  C{"Loại trang được yêu cầu?"};
  PUB["Trang công khai được yêu cầu"];
  AUTH{"Đã có phiên hợp lệ?"};
  LOGIN["Đăng nhập"];
  BACK["Trở lại trang ban đầu"];
  ROLE{"Vai trò trong phiên mới"};
  HOME["Trang chủ"];
  OWNER["Tổng quan chủ khách sạn"];
  ADMIN["Trung tâm điều hành"];
  ALLOW["Hiển thị trang được yêu cầu"];
  GUEST{"Đã đăng nhập trước khi mở trang?"};
  REGISTER["Đăng ký"];
  FORGOT["Quên mật khẩu"];
  PARTNERAPPLY["Đăng ký đối tác"];
  RESET["Đặt lại mật khẩu"];
  NF["Không tìm thấy trang"];

  A-->B;
  B-->C;
  C-->|"Trang công khai"|PUB;
  C-->|"Cần đăng nhập"|AUTH;
  AUTH-->|"Chưa"|LOGIN;
  LOGIN-->|"Có trang đích được lưu"|BACK;
  LOGIN-->|"Không có trang đích"|ROLE;
  ROLE-->|"Khách hàng"|HOME;
  ROLE-->|"Chủ khách sạn"|OWNER;
  ROLE-->|"Quản trị viên"|ADMIN;
  AUTH-->|"Có, đúng vai trò"|ALLOW;
  AUTH-->|"Có, sai vai trò"|HOME;
  C-->|"Trang đăng nhập, đăng ký hoặc quên mật khẩu"|GUEST;
  GUEST-->|"Chưa, chọn đăng nhập"|LOGIN;
  GUEST-->|"Chưa, chọn đăng ký"|REGISTER;
  GUEST-->|"Chưa, chọn quên mật khẩu"|FORGOT;
  GUEST-->|"Rồi"|ROLE;
  REGISTER-->|"Đăng ký khách hàng"|HOME;
  REGISTER-->|"Ý định đối tác"|PARTNERAPPLY;
  LOGIN-->|"Quên mật khẩu"|FORGOT;
  FORGOT-->|"Mở liên kết email có token"|RESET;
  C-->|"Liên kết đặt lại mật khẩu"|RESET;
  RESET-->|"Thành công"|LOGIN;
  C-->|"Địa chỉ không tồn tại"|NF;
```

`ProtectedRoute` giữ URL đích trong `state.from` để trang đăng nhập quay lại sau khi xác thực. Nếu không có URL đích, trang đích sau đăng nhập dựa trên vai trò. Các route admin chỉ cho vai trò quản trị viên; các route owner chỉ cho vai trò chủ khách sạn. Backend tiếp tục xác thực quyền trên từng API.

## Luồng tìm kiếm, đặt phòng và hỗ trợ khách hàng

```mermaid
graph TD;

  HOME["Trang chủ"];
  LIST["Danh sách khách sạn"];
  HOTEL["Chi tiết khách sạn"];
  SEARCH["Chọn ngày, số khách, loại phòng"];
  QUOTE["Lấy báo giá và kiểm tra sức chứa / tồn phòng"];
  PROMO["Báo giá lại với mã khuyến mãi"];
  SIGNED{"Đã đăng nhập?"};
  LOGIN["Đăng nhập"];
  DISABLED["Không thể xác nhận đặt phòng"];
  CREATE["Tạo đặt phòng"];
  FREE{"Tổng thanh toán bằng 0?"};
  RESULT["Kết quả thanh toán"];
  BOOKING["Chi tiết đặt phòng"];
  PROVIDER{"Cấu hình cổng thanh toán"};
  SIM["Xử lý thanh toán trong ứng dụng"];
  VNPAY["Chuyển tới cổng VNPAY"];
  RETRY["Thử thanh toán lại"];
  SUPPORT["Hỗ trợ và khiếu nại"];
  BOOKINGS["Đơn đặt phòng của tôi"];
  REVIEW["Đánh giá sau lưu trú (trong chi tiết đặt phòng)"];
  TICKET["Chi tiết yêu cầu hỗ trợ"];
  PROFILE["Hồ sơ cá nhân"];

  HOME-->|"Tìm theo điểm đến, ngày, khách"|LIST;
  LIST-->|"Chọn khách sạn"|HOTEL;
  HOTEL-->SEARCH;
  SEARCH-->QUOTE;
  QUOTE-->|"Thiếu phòng hoặc không đủ sức chứa"|SEARCH;
  QUOTE-->|"Nhập mã, bấm Áp dụng"|PROMO;
  PROMO-->|"Mã không hợp lệ"|SEARCH;
  PROMO-->|"Báo giá hợp lệ"|SIGNED;
  QUOTE-->|"Đủ điều kiện đặt"|SIGNED;
  SIGNED-->|"Chưa"|LOGIN;
  LOGIN-->|"Quay lại chi tiết khách sạn, giữ lựa chọn tìm kiếm"|HOTEL;
  SIGNED-->|"Có nhưng không phải khách hàng"|DISABLED;
  SIGNED-->|"Khách hàng"|CREATE;
  CREATE-->FREE;
  FREE-->|"Có, máy chủ xác nhận ngay"|RESULT;
  FREE-->|"Không"|BOOKING;
  BOOKING-->|"Thanh toán"|PROVIDER;
  PROVIDER-->|"Mô phỏng"|SIM;
  SIM-->RESULT;
  PROVIDER-->|"VNPAY"|VNPAY;
  VNPAY-->|"Quay về frontend"|RESULT;
  RESULT-->|"Đã xác nhận"|BOOKING;
  RESULT-->|"Đã xác nhận"|HOME;
  RESULT-->|"Thanh toán lỗi, đơn còn chờ: thử lại ngay tại trang kết quả"|RETRY;
  RETRY-->PROVIDER;
  RESULT-->|"Đang xử lý"|BOOKING;
  RESULT-->|"Đơn đã hủy nhưng đã thu tiền"|BOOKING;
  RESULT-->|"Đơn đã hủy nhưng đã thu tiền"|SUPPORT;
  RESULT-->|"Thiếu mã đặt phòng"|BOOKINGS;
  RESULT-->|"Thiếu mã đặt phòng"|SUPPORT;
  BOOKINGS-->|"Xem một đơn"|BOOKING;
  BOOKINGS-->|"Đơn hoàn tất: viết đánh giá"|REVIEW;
  REVIEW-->BOOKING;
  BOOKING-->|"Xem khách sạn"|HOTEL;
  BOOKING-->|"Hủy đơn / xem hoàn tiền"|BOOKING;
  SUPPORT-->|"Mở yêu cầu"|TICKET;
  TICKET-->SUPPORT;
  HOME-->|"Menu tài khoản"|PROFILE;
  HOME-->|"Menu đặt phòng"|BOOKINGS;
  HOME-->|"Menu hỗ trợ"|SUPPORT;
```

Các bước báo giá, chọn phòng, nhập khuyến mãi, tạo đơn, thanh toán và đánh giá được xử lý ngay trong các trang hiện có; frontend không có route riêng cho từng bước checkout hay trang viết đánh giá. Kết quả thanh toán được xác định lại bằng trạng thái đơn và giao dịch tải từ API. Chỉ đơn đang chờ thanh toán mới hiện thao tác thử thanh toán lại; đánh giá chỉ mở khi đơn hoàn tất. Hủy đơn/hoàn tiền giữ người dùng ở trang chi tiết đơn.

`/support` vừa chứa lịch sử vừa mở form tạo yêu cầu. Khi gửi thành công, form đóng và danh sách được cập nhật; chọn một yêu cầu sẽ mở `/support/:id`. Phản hồi xử lý của admin hiển thị ở trang chi tiết này.

## Đăng ký đối tác và khu vực chủ khách sạn

```mermaid
graph TD;

  REGISTER["Đăng ký"];
  APPLY["Đăng ký đối tác"];
  HOME["Trang chủ"];
  PENDING["Trạng thái chờ duyệt"];
  REAPPLY["Sửa thông tin và nộp lại"];
  ADMINLIST["Hồ sơ đăng ký"];
  ADMINDETAIL["Chi tiết hồ sơ đối tác"];
  APPROVED["Hồ sơ được duyệt"];
  OWNERROOT["Khu vực chủ khách sạn"];
  OWNERHOME["Tổng quan"];
  HOTELLIST["Khách sạn của tôi"];
  HOTELNEW["Đăng ký khách sạn"];
  HOTELMANAGE["Quản lý hồ sơ khách sạn"];
  HOTELREVIEWS["Đánh giá của khách"];
  ROOMLIST["Loại phòng"];
  ROOMDETAIL["Quản lý loại phòng"];
  INVENTORY["Quỹ phòng và giá bán"];
  OWNERBOOKINGS["Danh sách đặt phòng"];
  OWNERBOOKINGDETAIL["Chi tiết đặt phòng"];
  REVENUE["Doanh thu"];
  REPORTS["Báo cáo thống kê"];
  OWNERPROFILE["Hồ sơ cá nhân"];

  REGISTER-->|"Đăng ký đối tác"|APPLY;
  REGISTER-->|"Đăng ký khách hàng"|HOME;
  APPLY-->|"Hồ sơ mới"|PENDING;
  APPLY-->|"Hồ sơ bị từ chối"|REAPPLY;
  REAPPLY-->PENDING;
  PENDING-->ADMINLIST;
  ADMINLIST-->ADMINDETAIL;
  ADMINDETAIL-->|"Từ chối, cần ghi lý do"|REAPPLY;
  ADMINDETAIL-->|"Phê duyệt, cấp vai trò chủ khách sạn"|APPROVED;
  APPROVED-->OWNERROOT;
  OWNERROOT-->OWNERHOME;
  OWNERHOME-->HOTELLIST;
  OWNERHOME-->HOTELNEW;
  HOTELNEW-->HOTELMANAGE;
  HOTELLIST-->HOTELMANAGE;
  HOTELMANAGE-->HOTELREVIEWS;
  HOTELMANAGE-->ROOMLIST;
  ROOMLIST-->ROOMDETAIL;
  ROOMDETAIL-->INVENTORY;
  HOTELMANAGE-->OWNERBOOKINGS;
  OWNERBOOKINGS-->OWNERBOOKINGDETAIL;
  OWNERHOME-->REVENUE;
  OWNERHOME-->REPORTS;
  OWNERHOME-->OWNERPROFILE;
```

Sau đăng ký với ý định đối tác, tài khoản được tạo trước ở vai trò khách hàng rồi chuyển tới form hồ sơ. Frontend bật khóa điều hướng trong phiên này cho tới khi nộp hồ sơ hoặc đăng xuất; hồ sơ đang chờ duyệt bị giới hạn một số tính năng khách hàng. Hồ sơ bị từ chối có thể nộp lại. Phê duyệt hồ sơ cấp quyền chủ khách sạn; chủ khách sạn sau đó có thể đăng ký khách sạn và quản lý phòng, giá/tồn phòng, đặt phòng và báo cáo.

Owner sidebar giữ `hotelId` trong query string cho các module cần ngữ cảnh khách sạn. Các trang quản lý khách sạn, loại phòng và chi tiết đặt phòng cũng nối trực tiếp tới những module liên quan. `/owner` là lối vào tương thích và chuyển về `/owner/overview`.

## Khu vực quản trị viên

```mermaid
graph TD;

  DASH["Trung tâm điều hành"];
  ANALYTICS["Báo cáo và thống kê hệ thống"];
  APPS["Hồ sơ đăng ký"];
  APPDETAIL["Chi tiết hồ sơ đối tác"];
  HOTELS["Quản lý khách sạn"];
  HOTELDETAIL["Chi tiết khách sạn"];
  AMENITIES["Quản lý tiện nghi"];
  ACCDETAIL["Chi tiết tài khoản"];
  ACCOUNTS["Quản lý tài khoản"];
  ACCNEW["Tạo tài khoản"];
  BOOKINGS["Danh sách đặt phòng"];
  BOOKINGDETAIL["Chi tiết đặt phòng"];
  PAYMENTDETAIL["Chi tiết giao dịch"];
  PAYMENTS["Thanh toán và giao dịch"];
  REVIEWS["Quản lý đánh giá"];
  REVIEWDETAIL["Chi tiết đánh giá"];
  SUPPORT["Hỗ trợ và khiếu nại"];
  SUPPORTDETAIL["Chi tiết yêu cầu hỗ trợ"];
  PROMOS["Quản lý khuyến mãi"];
  PROMONEW["Tạo khuyến mãi"];
  PROMOEDIT["Chỉnh sửa khuyến mãi"];
  ADMINPROFILE["Hồ sơ cá nhân"];

  DASH-->ANALYTICS;
  DASH-->APPS;
  APPS-->APPDETAIL;
  DASH-->HOTELS;
  HOTELS-->HOTELDETAIL;
  HOTELS-->AMENITIES;
  HOTELDETAIL-->ACCDETAIL;
  HOTELDETAIL-->|"Cập nhật / duyệt / từ chối / đình chỉ / kích hoạt lại"|HOTELDETAIL;
  HOTELDETAIL-->|"Quay lại danh sách"|HOTELS;
  DASH-->ACCOUNTS;
  ACCOUNTS-->ACCNEW;
  ACCNEW-->|"Tạo xong"|ACCOUNTS;
  ACCOUNTS-->ACCDETAIL;
  ACCDETAIL-->|"Cập nhật / khóa / mở khóa; vẫn ở chi tiết"|ACCDETAIL;
  ACCDETAIL-->|"Xóa hẳn"|ACCOUNTS;
  ACCDETAIL-->|"Quay lại danh sách"|ACCOUNTS;
  DASH-->BOOKINGS;
  BOOKINGS-->BOOKINGDETAIL;
  BOOKINGDETAIL-->HOTELDETAIL;
  BOOKINGDETAIL-->ACCDETAIL;
  BOOKINGDETAIL-->PAYMENTDETAIL;
  DASH-->PAYMENTS;
  PAYMENTS-->PAYMENTDETAIL;
  DASH-->REVIEWS;
  REVIEWS-->REVIEWDETAIL;
  REVIEWDETAIL-->|"Kiểm duyệt / gỡ đánh giá vi phạm; vẫn ở chi tiết"|REVIEWDETAIL;
  REVIEWDETAIL-->|"Quay lại danh sách"|REVIEWS;
  DASH-->SUPPORT;
  SUPPORT-->SUPPORTDETAIL;
  SUPPORTDETAIL-->|"Tiếp nhận hoặc lưu kết quả; vẫn ở chi tiết"|SUPPORTDETAIL;
  SUPPORTDETAIL-->|"Quay lại danh sách"|SUPPORT;
  DASH-->PROMOS;
  PROMOS-->PROMONEW;
  PROMOS-->PROMOEDIT;
  PROMONEW-->|"Tạo xong, mở chi tiết khuyến mãi"|PROMOEDIT;
  PROMOEDIT-->|"Lưu hoặc bật/tắt khuyến mãi"|PROMOS;
  DASH-->ADMINPROFILE;
```

Dashboard admin là điểm vào các nhóm vận hành và các hàng đợi hồ sơ đối tác, hỗ trợ và đánh giá. Danh sách dẫn tới trang chi tiết; chi tiết booking có liên kết chéo sang khách sạn, tài khoản và giao dịch. Tạo khuyến mãi chuyển sang URL `:id` sau khi tạo. Tiện nghi được mở từ danh sách khách sạn.

## Alias tương thích

Các URL cũ được giữ để bookmark/liên kết cũ vẫn hoạt động, sau đó chuyển tới route chuẩn bằng replace. Ví dụ: `/home` → `/`, `/search-results` → `/hotels`, `/hotel-detail/:id` → `/hotels/:id`, `/my-bookings` → `/bookings`, `/payment-result` → `/payment/result`, `/admin/operations` → `/admin`. Các URL cũ cho bước phòng/xác nhận/thanh toán của booking chuyển tới `/bookings/:id`; URL viết đánh giá chuyển tới `/bookings/:id#danh-gia`. Alias owner/partner giữ ID khách sạn và tham số ngữ cảnh khi điều hướng về `/owner/...`.

## File nguồn chính

- Route tổng và route nhóm: `frontend/src/routes/AppRoutes.tsx`, `publicRoutes.tsx`, `customerRoutes.tsx`, `ownerRoutes.tsx`, `adminRoutes.tsx`.
- Kiểm soát đăng nhập và vai trò: `frontend/src/components/auth/ProtectedRoute.tsx`, `GuestOnlyRoute.tsx`, `frontend/src/lib/roles.ts`.
- Điều hướng theo vai trò: `frontend/src/components/common/Navbar.tsx`, `frontend/src/components/layouts/DashboardNavigation.tsx`.
- Đặt phòng/thanh toán: `frontend/src/pages/public/HotelDetailPage.tsx`, `frontend/src/pages/customer/BookingDetailPage.tsx`, `PaymentResultPage.tsx`, `frontend/src/features/payments/usePaymentFlow.tsx`.
- Đăng ký đối tác: `frontend/src/pages/customer/PartnerApplyPage.tsx`, `frontend/src/pages/admin/AdminPartnerApplicationDetailPage.tsx`.
