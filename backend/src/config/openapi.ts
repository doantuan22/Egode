export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Hotel Booking Platform API',
    version: '1.0.0',
    description: 'REST API for the Online Hotel Booking Platform (Nền tảng đặt phòng khách sạn trực tuyến).',
  },
  servers: [
    {
      url: '/api',
      description: 'API base path',
    },
  ],
  paths: {
    '/hotels': {
      get: {
        summary: 'Search/list active hotels with price + availability (M2 — public, no auth)',
        tags: ['Discovery'],
        parameters: [
          { name: 'location', in: 'query', schema: { type: 'string' }, description: 'Matches city or province (contains)' },
          { name: 'checkIn', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'checkOut', in: 'query', required: true, schema: { type: 'string', format: 'date' }, description: 'Exclusive — checkout night is not counted' },
          { name: 'guests', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          { name: 'starRating', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 }, description: 'Minimum star rating' },
          { name: 'amenities', in: 'query', schema: { type: 'string' }, description: 'Comma-separated MaTienNghi ids' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['price_asc', 'price_desc', 'star_desc', 'newest'] } },
        ],
        responses: {
          '200': { description: 'Paginated hotel search results' },
          '400': { description: 'Invalid query (e.g. checkOut <= checkIn)' },
        },
      },
    },
    '/hotels/{id}': {
      get: {
        summary: 'Hotel detail — info, images, amenities (no dates required)',
        tags: ['Discovery'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Hotel detail' }, '404': { description: 'Not found or not active' } },
      },
    },
    '/hotels/{id}/rooms': {
      get: {
        summary: 'Room types for a hotel with price + availability for a date range (BE-4, read-only)',
        tags: ['Discovery'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'checkIn', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'checkOut', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'guests', in: 'query', schema: { type: 'integer' }, description: 'Filters out room types with SucChua < guests' },
        ],
        responses: {
          '200': { description: 'Room types with GiaTheoDem/TongTien/SoPhongConLai/ConHang' },
          '400': { description: 'Invalid date range' },
          '404': { description: 'Hotel not found or not active' },
        },
      },
    },
    '/hotels/{id}/quote': {
      post: {
        summary: 'Compute a booking quote (M4, public, read-only — no DAT_PHONG is created)',
        tags: ['Commercial'],
        description:
          'Backend computes everything: per-night availability/price from QUY_PHONG_GIA (checkout night excluded), promotion validity/discount, and the applicable system-wide cancellation policy. The client cannot influence TongTienThanhToan/SoTienGiam — any such fields in the body are ignored.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['checkIn', 'checkOut', 'rooms'],
                properties: {
                  checkIn: { type: 'string', format: 'date' },
                  checkOut: { type: 'string', format: 'date', description: 'Exclusive — checkout night not counted' },
                  rooms: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['maLoaiPhong', 'soLuong'],
                      properties: { maLoaiPhong: { type: 'integer' }, soLuong: { type: 'integer', minimum: 1 } },
                    },
                  },
                  promoCode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Quote — always 200 even for an invalid/expired promo (PromoHopLe=false explains why); KhaDung=false when any room line is sold out or unpriced' },
          '400': { description: 'Invalid date range, empty/duplicate room lines, or a room id not belonging to this hotel' },
          '404': { description: 'Hotel not found or not active' },
        },
      },
    },
    '/hotels/{id}/reviews': {
      get: {
        summary: 'Public reviews of a hotel (no sign-in needed), paginated, newest first',
        description: 'Only reviews in the "Hiển thị" state are returned and counted. The reviewer is shown as an abbreviated name ("Nguyễn V. A."); no account, e-mail or booking data is exposed. "summary" is the average score (1 decimal, null when none) and count of ALL visible reviews of the hotel, not just the page. Hotel detail (GET /hotels/{id}) and every search item carry the same summary as DanhGia / DiemTrungBinh + SoLuongDanhGia.',
        tags: ['Reviews'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
        ],
        responses: { '200': { description: 'Page of visible reviews + summary + pagination' }, '400': { description: 'Invalid page/limit' }, '404': { description: 'Hotel not found or not public' } },
      },
    },
    '/hotels/{id}/bookings': {
      post: {
        summary: 'Create a real booking (M5, authenticated customer only)',
        tags: ['Booking'],
        security: [{ BearerAuth: [] }],
        description:
          'Everything (availability, per-night price, promotion, cancellation policy) is recomputed server-side inside a locked SQL Server transaction — a prior Quote is never trusted. Rows in QUY_PHONG_GIA for the requested room types/date range are locked WITH (UPDLOCK, ROWLOCK, HOLDLOCK) so two concurrent requests contending for the last room can never both commit. A booking starts at TrangThai="Chờ thanh toán" (payment is a separate step) — except when the payable total is 0 (a promotion or a free rate), which is confirmed immediately (TrangThai="Đã xác nhận") with no THANH_TOAN row. Stay dates are validated for every stay endpoint (search, rooms, quote, booking): checkIn >= today in Asia/Ho_Chi_Minh, checkOut > checkIn, 1..30 nights, checkIn at most 365 days ahead. Body field `guests` (1..50, default 1, not stored) is checked on the server: Σ(SucChua × rooms) must be >= guests, else 400 with code CAPACITY_EXCEEDED. The same check is applied by POST /hotels/{id}/quote, which also echoes SoKhach and TongSucChua.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['checkIn', 'checkOut', 'rooms'],
                properties: {
                  checkIn: { type: 'string', format: 'date' },
                  checkOut: { type: 'string', format: 'date', description: 'Exclusive — checkout night not counted' },
                  rooms: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['maLoaiPhong', 'soLuong'],
                      properties: { maLoaiPhong: { type: 'integer' }, soLuong: { type: 'integer', minimum: 1 } },
                    },
                  },
                  promoCode: { type: 'string' },
                  ghiChu: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Booking created with MaXacNhanDatPhong, server-computed totals, the applicable cancellation policy, and the payment hold (HanThanhToan = NgayTao + PAYMENT_TIMEOUT_MINUTES, SoGiayConLai = seconds left by the server clock)' },
          '400': { description: 'Invalid date range/room lines, room id not belonging to this hotel, or an invalid/expired/ineligible promo code' },
          '401': { description: 'Not authenticated' },
          '403': { description: 'Authenticated but not a Khách hàng account' },
          '404': { description: 'Hotel not found or not active' },
          '409': { description: 'Not enough rooms left (or a night became unpriced) by the time this request acquired the lock' },
        },
      },
    },
    '/bookings': {
      get: {
        summary: "List the authenticated customer's own bookings, newest first (M6)",
        tags: ['Booking'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Own bookings' }, '401': { description: 'Not authenticated' } },
      },
    },
    '/bookings/{id}': {
      get: {
        summary: "Booking detail — includes THANH_TOAN/HOAN_TIEN history (M6, owner only). While TrangThai is 'Chờ thanh toán', HanThanhToan (ISO instant the booking is auto-cancelled) and SoGiayConLai (seconds left by the server clock, at least 0) tell the client how long the room is held; both are null in any other status.",
        tags: ['Booking'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '403': { description: 'Not the owning customer' }, '404': { description: 'Not found' } },
      },
    },
    '/bookings/{id}/cancel': {
      post: {
        summary: 'Cancel own booking — refund tier/amount computed server-side from the CHINH_SACH_HUY saved on the booking (M6 §3/§4)',
        tags: ['Booking'],
        security: [{ BearerAuth: [] }],
        description:
          'The refund percentage is never taken from the client — it is resolved by comparing the cancellation instant to NgayNhanPhong against the CHI_TIET_CHINH_SACH_HUY tiers stored on the booking at creation time. A booking never paid (still "Chờ thanh toán") is cancelled with no HOAN_TIEN created at all.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Cancelled — response includes any HOAN_TIEN created and its outcome' },
          '400': { description: 'Not in a cancellable state (already "Đã hủy"/"Hoàn tất")' },
          '403': { description: 'Not the owning customer' },
          '404': { description: 'Not found' },
          '409': { description: 'Status changed concurrently (e.g. expired) between read and the guarded update' },
        },
      },
    },
    '/bookings/{id}/payments/vnpay': {
      post: {
        summary: 'Create a VNPAY Sandbox payment request for own booking (M6 §1)',
        tags: ['Payment'],
        security: [{ BearerAuth: [] }],
        description:
          'The charged amount is always DAT_PHONG.TongTienThanhToan re-read server-side — the request body carries no amount field. Returns a paymentUrl to redirect the browser to (VNPAY-hosted page).',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '201': { description: 'THANH_TOAN created ("Chờ xử lý") + paymentUrl' },
          '400': { description: 'Booking not in "Chờ thanh toán" (already paid/cancelled/completed)' },
          '403': { description: 'Not the owning customer' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/bookings/{id}/payments/status': {
      get: {
        summary: 'Payment + refund status for own booking (M6 §1)',
        tags: ['Payment'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'THANH_TOAN rows with nested HOAN_TIEN' }, '403': { description: 'Not the owning customer' } },
      },
    },
    '/payments/vnpay-return': {
      get: {
        summary: "Browser redirect target after paying on VNPAY's hosted page (public — authenticated via vnp_SecureHash, not a session)",
        tags: ['Payment'],
        description: 'Display-only — verifies the signature, applies the same idempotent outcome as the IPN below if it has not landed yet, then 302-redirects to FRONTEND_URL/payment/result.',
        responses: { '302': { description: 'Redirect to the frontend result page' } },
      },
    },
    '/payments/vnpay-ipn': {
      get: {
        summary: 'Server-to-server IPN from VNPAY — the authoritative confirmation (public — authenticated via vnp_SecureHash)',
        tags: ['Payment'],
        description:
          'Idempotent: a repeat IPN for an already-finalized THANH_TOAN returns RspCode 02 without re-mutating anything. On success, confirms the booking; if the booking is no longer "Chờ thanh toán" (expired/cancelled while payment was in flight), auto-creates a 100% HOAN_TIEN instead of confirming a dead booking or keeping the money.',
        responses: { '200': { description: '{ RspCode, Message } — always 200, per VNPAY IPN contract' } },
      },
    },
    '/payments/refunds/{id}/retry': {
      post: {
        summary: 'Retry a "Chờ xử lý"/"Thất bại" refund against the gateway (M6 §4/§6)',
        tags: ['Payment'],
        security: [{ BearerAuth: [] }],
        description: 'Idempotent — a refund already "Thành công" is returned unchanged, never re-sent to the gateway.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Current HOAN_TIEN state' }, '403': { description: 'Not the owning customer' }, '404': { description: 'Not found' } },
      },
    },
    '/bookings/{id}/review': {
      post: {
        summary: 'Review own completed booking (M7 §1, RB9/RB26)',
        tags: ['Review'],
        security: [{ BearerAuth: [] }],
        description:
          'MaKhachHang/MaKhachSan are derived server-side from the booking, never from the client. Only allowed once DAT_PHONG.TrangThai is actually "Hoàn tất" (lazily swept from "Đã xác nhận" once NgayTraPhong has passed — see bookings/booking-completion.ts). At most one review per booking (UQ_DANH_GIA_MaDatPhong). New reviews always start "Chờ duyệt" — a customer cannot set TrangThai.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['diemDanhGia'],
                properties: {
                  diemDanhGia: { type: 'integer', minimum: 1, maximum: 5 },
                  noiDung: { type: 'string' },
                  hinhAnh: { type: 'array', items: { type: 'string', description: 'base64 data URI, image/*, ≤5MB, ≤6 per review' } },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created, TrangThai="Chờ duyệt"' },
          '400': { description: 'Booking not yet "Hoàn tất", score outside 1–5, or an invalid image' },
          '403': { description: 'Not the owning customer' },
          '404': { description: 'Not found' },
          '409': { description: 'Booking already reviewed' },
        },
      },
      get: {
        summary: "Get the caller's own review for a booking (M7 §1)",
        tags: ['Review'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'The review, or null if not submitted yet' }, '403': { description: 'Not the owning customer' } },
      },
    },
    '/admin/reviews': {
      get: {
        summary: 'List reviews for moderation, filter by TrangThai / star score / search (M7 §1, admin only)',
        tags: ['Review'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'trangThai', in: 'query', schema: { type: 'string' } },
          { name: 'diemDanhGia', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated reviews' }, '403': { description: 'Not an admin' } },
      },
    },
    '/admin/reviews/{id}': {
      get: {
        summary: 'Review detail with images + customer/hotel/booking info (admin only)',
        tags: ['Review'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '403': { description: 'Not an admin' }, '404': { description: 'Not found' } },
      },
      delete: {
        summary: 'Safely remove a flagged review from public visibility (UC37, admin only)',
        description: 'This soft-removal endpoint accepts no body. It changes only a review marked `Vi phạm` to the existing `Ẩn` state while retaining the DANH_GIA row and HINH_ANH_DANH_GIA relations for audit. Repeating an already-hidden removal is idempotent.',
        tags: ['Review'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Review hidden with history retained' }, '403': { description: 'Admin role required' }, '404': { description: 'Review not found' }, '409': { description: 'Review has not been marked as a violation' } },
      },
    },
    '/admin/reviews/{id}/moderate': {
      patch: {
        summary: 'Approve / hide / flag a review (admin only)',
        tags: ['Review'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['trangThai'], properties: { trangThai: { type: 'string', enum: ['Hiển thị', 'Ẩn', 'Vi phạm'] } } } } },
        },
        responses: { '200': { description: 'Updated' }, '403': { description: 'Not an admin' }, '404': { description: 'Not found' } },
      },
    },
    '/support': {
      post: {
        summary: 'Create a support/complaint request (M7 §3)',
        tags: ['Support'],
        security: [{ BearerAuth: [] }],
        description: 'MaTaiKhoanKhachHang always comes from the authenticated customer. If MaDatPhong is given it must belong to that same customer (RB10) — the override from M0/G0-09 means there is no MaKhachSan column to also check.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['loaiYeuCau', 'tieuDe', 'noiDung'],
                properties: {
                  loaiYeuCau: { type: 'string', enum: ['Hỗ trợ', 'Khiếu nại'] },
                  tieuDe: { type: 'string' },
                  noiDung: { type: 'string' },
                  maDatPhong: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created, TrangThai="Mới"' }, '400': { description: 'Invalid LoaiYeuCau, or MaDatPhong does not exist' }, '403': { description: 'MaDatPhong belongs to a different customer' } },
      },
      get: {
        summary: "List the caller's own support/complaint requests (M7 §3)",
        tags: ['Support'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Own requests, newest first' } },
      },
    },
    '/support/{id}': {
      get: {
        summary: "Get one of the caller's own requests (M7 §3)",
        tags: ['Support'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '403': { description: 'Not the requesting customer' }, '404': { description: 'Not found' } },
      },
    },
    '/admin/support': {
      get: {
        summary: 'List all support/complaint requests, filter by TrangThai/LoaiYeuCau/search (admin only)',
        tags: ['Support'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'trangThai', in: 'query', schema: { type: 'string' } },
          { name: 'loaiYeuCau', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated requests' }, '403': { description: 'Not an admin' } },
      },
    },
    '/admin/support/{id}': {
      get: {
        summary: 'Support request detail (admin only)',
        tags: ['Support'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '403': { description: 'Not an admin' }, '404': { description: 'Not found' } },
      },
      patch: {
        summary: 'Claim ("Đang xử lý") or resolve ("Đã xử lý") a request (admin only)',
        tags: ['Support'],
        security: [{ BearerAuth: [] }],
        description: 'MaTaiKhoanXuLy always comes from the authenticated admin, never the request body. NgayXuLy is set only when transitioning into "Đã xử lý". Once "Đã xử lý", the request is immutable.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['trangThai'],
                properties: { trangThai: { type: 'string', enum: ['Đang xử lý', 'Đã xử lý'] }, ketQuaXuLy: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Updated' }, '400': { description: '"Đã xử lý" requires ketQuaXuLy, or the request is already resolved' }, '403': { description: 'Not an admin' }, '404': { description: 'Not found' } },
      },
    },
    '/admin/promotions': {
      get: {
        summary: 'List promotions, filter by TrangThai/LoaiGiamGia, search by MaCode (M8 §1, admin only)',
        tags: ['Promotion'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'TrangThai', in: 'query', schema: { type: 'string', enum: ['Hoạt động', 'Ngừng'] } },
          { name: 'LoaiGiamGia', in: 'query', schema: { type: 'string', enum: ['Phần trăm', 'Số tiền cố định'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated promotions' }, '403': { description: 'Not an admin' } },
      },
      post: {
        summary: 'Create a promotion — always system-wide, always starts "Hoạt động" (M8 §1)',
        tags: ['Promotion'],
        security: [{ BearerAuth: [] }],
        description:
          'PhamViApDung is always "Toàn hệ thống" and is not even an accepted field — Gate 0 (G0-01) forbids KHUYEN_MAI_KHACH_SAN, so a "Theo phạm vi" promotion would have no data to actually scope it. TrangThai is likewise not accepted — every new promotion starts "Hoạt động".',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['MaCode', 'LoaiGiamGia', 'GiaTriGiam', 'NgayBatDau', 'NgayKetThuc'],
                properties: {
                  MaCode: { type: 'string' },
                  LoaiGiamGia: { type: 'string', enum: ['Phần trăm', 'Số tiền cố định'] },
                  GiaTriGiam: { type: 'number', description: '<= 100 when LoaiGiamGia is "Phần trăm"' },
                  GiaTriDonToiThieu: { type: 'number', default: 0 },
                  MucGiamToiDa: { type: 'number', default: 0, description: '0 = no cap' },
                  SoLuongGioiHan: { type: 'integer', default: 0, description: '0 = unlimited' },
                  NgayBatDau: { type: 'string', format: 'date' },
                  NgayKetThuc: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'NgayKetThuc before NgayBatDau, percent > 100, or an out-of-range field' },
          '403': { description: 'Not an admin' },
          '409': { description: 'MaCode already exists' },
        },
      },
    },
    '/admin/promotions/{id}': {
      get: {
        summary: 'Promotion detail, including SoLuongDaSuDung (usage count) (M8 §1)',
        tags: ['Promotion'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '403': { description: 'Not an admin' }, '404': { description: 'Not found' } },
      },
      patch: {
        summary: 'Update a promotion — cross-field checks (date order, percent cap) re-validated against the merged result (M8 §1)',
        tags: ['Promotion'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Updated' }, '400': { description: 'Merged fields fail validation' }, '403': { description: 'Not an admin' }, '404': { description: 'Not found' }, '409': { description: 'MaCode already exists' } },
      },
    },
    '/admin/promotions/{id}/activate': {
      post: { summary: 'Bật mã khuyến mãi (TrangThai → "Hoạt động")', tags: ['Promotion'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } } },
    },
    '/admin/promotions/{id}/deactivate': {
      post: { summary: 'Tắt mã khuyến mãi (TrangThai → "Ngừng")', tags: ['Promotion'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } } },
    },
    '/owner/hotels/{id}/analytics': {
      get: {
        summary: "Owner-scoped analytics for one owned hotel (M8 §2)",
        tags: ['Analytics'],
        security: [{ BearerAuth: [] }],
        description:
          'Ownership checked before any query runs (404 unknown hotel, 403 someone else\'s). Revenue/refund figures are computed from THANH_TOAN/HOAN_TIEN status directly (never from booking status), so a cancelled or never-paid booking contributes nothing and a failed payment is excluded automatically. `to` is inclusive on the wire; TyLeLapDay is null (not 0) when there is no QUY_PHONG_GIA data at all in range.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Inclusive' },
        ],
        responses: { '200': { description: 'OwnerAnalytics' }, '403': { description: "Not this owner's hotel" }, '404': { description: 'Hotel not found' } },
      },
    },
    '/admin/analytics': {
      get: {
        summary: 'System-wide analytics/reports dashboard (M8 §3, admin only)',
        tags: ['Analytics'],
        security: [{ BearerAuth: [] }],
        description:
          'from/to apply to booking/payment/refund/support counts (all have a date column to filter on). Account/hotel totals and DanhGiaTheoTrangThai are always all-time — DANH_GIA has no created-date column, so there is nothing accurate to range-filter there (see M8 report §3).',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Inclusive' },
        ],
        responses: { '200': { description: 'AdminAnalytics' }, '403': { description: 'Not an admin' } },
      },
    },
    '/cancellation-policies': {
      get: {
        summary: 'List active cancellation policies (public) — system-level data, no MaKhachSan/MaDatPhong',
        tags: ['Commercial'],
        responses: { '200': { description: 'Policies with their CHI_TIET_CHINH_SACH_HUY tiers' } },
      },
    },
    '/cancellation-policies/{id}': {
      get: {
        summary: 'Get one cancellation policy with its tiers',
        tags: ['Commercial'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } },
      },
    },
    '/owner/hotels': {
      get: {
        summary: "List the authenticated owner's hotels (M3)",
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Own hotels' }, '403': { description: 'Not a Chủ khách sạn account' } },
      },
      post: {
        summary: 'Register a new hotel — always starts at "Chờ duyệt", owner cannot self-approve',
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Created, pending admin approval' }, '400': { description: 'Invalid MaDiaPhuong or body' } },
      },
    },
    '/owner/hotels/{id}': {
      get: { summary: 'Get an owned hotel', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '403': { description: "Not this owner's hotel" }, '404': { description: 'Not found' } } },
      patch: { summary: 'Update an owned hotel (TrangThai/MaTaiKhoanDuyet/MaTaiKhoanSoHuu cannot be set here)', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Updated' }, '403': { description: 'Forbidden' } } },
    },
    '/owner/hotels/{id}/deactivate': {
      post: {
        summary: 'Deactivate an owned hotel (UC19 — soft "Ngừng hoạt động", booking/review history preserved)',
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Deactivated (idempotent)' }, '403': { description: "Not this owner's hotel" }, '404': { description: 'Not found' } },
      },
    },
    '/owner/hotels/{id}/reactivate': {
      post: {
        summary: 'Reactivate an owned hotel that the owner switched off ("Ngừng hoạt động" → "Hoạt động")',
        description: 'Only for a hotel an admin has already approved. A hotel that is pending, rejected or suspended cannot be activated by its owner.',
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Reactivated (idempotent when already active)' }, '400': { description: 'Hotel was never approved or is not inactive' }, '403': { description: "Not this owner's hotel" }, '404': { description: 'Not found' }, '409': { description: 'Status changed concurrently' } },
      },
    },
    '/owner/hotels/{hotelId}/bookings': {
      get: {
        summary: 'List bookings for an owned hotel (UC24), paginated/filterable',
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'hotelId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'trangThai', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated booking list' }, '403': { description: "Not this owner's hotel" }, '404': { description: 'Hotel not found' } },
      },
    },
    '/owner/hotels/{hotelId}/bookings/{bookingId}': {
      get: {
        summary: 'Get one booking under an owned hotel (UC24) — read-only',
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'hotelId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'bookingId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Booking detail' }, '403': { description: "Not this owner's hotel" }, '404': { description: 'Not found' } },
      },
    },
    '/owner/hotels/{id}/amenities': {
      put: { summary: 'Replace the full amenity set for a hotel', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Updated' } } },
    },
    '/owner/hotels/{id}/images': {
      post: { summary: 'Upload a hotel image (base64 data URI, via the existing Cloudinary integration)', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '201': { description: 'Created' } } },
    },
    '/owner/hotels/{id}/images/{imageId}': {
      patch: { summary: 'Set as the primary hotel image', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'imageId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Updated' } } },
      delete: { summary: 'Remove a hotel image (best-effort Cloudinary delete + DB row removal)', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'imageId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/owner/hotels/{hotelId}/room-types': {
      get: { summary: 'List room types for an owned hotel', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'hotelId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } },
      post: { summary: 'Create a room type for an owned hotel', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'hotelId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '201': { description: 'Created' } } },
    },
    '/owner/room-types/{id}': {
      get: { summary: 'Get an owned room type', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' } } },
      patch: { summary: 'Update an owned room type (including TrangThai — open/close for sale)', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Updated' } } },
    },
    '/owner/room-types/{id}/deactivate': {
      post: {
        summary: 'Deactivate an owned room type (UC23 — soft "Ngừng bán", rate/booking history preserved)',
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Deactivated (idempotent)' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' } },
      },
    },
    '/owner/room-types/{id}/amenities': {
      put: { summary: 'Replace the full amenity set for a room type', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Updated' } } },
    },
    '/owner/room-types/{id}/images': {
      post: { summary: 'Upload a room-type image (base64 data URI)', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '201': { description: 'Created' } } },
    },
    '/owner/room-types/{id}/images/{imageId}': {
      patch: { summary: 'Set as the primary room-type image', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'imageId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Updated' } } },
      delete: { summary: 'Remove a room-type image', tags: ['Owner'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'imageId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Deleted' } } },
    },
    '/owner/room-types/{id}/rates': {
      get: {
        summary: 'View QUY_PHONG_GIA for an owned room type over a date range',
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'from', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { description: 'Rate rows in range' } },
      },
      put: {
        summary: 'Bulk create/update price + inventory per day (upsert on (MaLoaiPhong, NgayApDung) — never duplicates)',
        tags: ['Owner'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Upserted rows' },
          '400': { description: 'Duplicate date within the same request, or GiaPhong/SoLuongPhong < 0' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/amenities': {
      get: {
        summary: 'List all amenities (public) — supports the search filter UI',
        tags: ['Discovery'],
        responses: { '200': { description: 'List of amenities' } },
      },
    },
    '/locations': {
      get: {
        summary: 'List all DIA_PHUONG (public) — supports search location field and owner hotel-registration form',
        tags: ['Discovery'],
        responses: { '200': { description: 'List of locations' } },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register a new customer account',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '400': { description: 'Validation failed' },
          '409': { description: 'Email or TenDangNhap already in use' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login with email/TenDangNhap and password',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '401': { description: 'Invalid credentials' },
          '403': { description: 'Account is locked' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Exchange the httpOnly refresh-token cookie for a new access token',
        tags: ['Auth'],
        responses: {
          '200': { description: 'New access token issued' },
          '401': { description: 'Missing/invalid/expired refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Clear the refresh-token cookie (stateless — no server-side revocation list)',
        tags: ['Auth'],
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/auth/forgot-password': {
      post: {
        summary: 'Request a password-reset email (UC04).',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } } },
        },
        responses: {
          '200': {
            description:
              'Always returns a generic success message regardless of whether the account exists (prevents enumeration). A configured SMTP service sends the signed, expiring reset link; neither the token nor SMTP credentials appear in the response or logs.',
          },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        summary: 'Complete a password reset using the token issued by /auth/forgot-password',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } },
        },
        responses: {
          '200': { description: 'Password updated' },
          '400': { description: 'Token invalid, expired, or already used' },
        },
      },
    },
    '/auth/change-password': {
      post: {
        summary: 'Change the password of the signed-in account (requires the current password)',
        tags: ['Auth'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } },
        },
        responses: {
          '200': {
            description:
              'Password updated. Returns a new accessToken and replaces the refresh cookie; refresh tokens issued before the change (other devices) stop working.',
          },
          '400': { description: 'Current password wrong, new password invalid, or same as the current one' },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Account locked' },
          '429': { description: 'Too many attempts' },
        },
      },
    },
    '/profile/me': {
      get: {
        summary: "Get the caller's own account profile",
        tags: ['Profile'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Own profile',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } },
          },
          '401': { description: 'Unauthenticated' },
        },
      },
      patch: {
        summary: "Update whitelisted fields of the caller's own profile (role/status cannot be changed here)",
        tags: ['Profile'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } } },
        },
        responses: {
          '200': { description: 'Updated profile' },
          '401': { description: 'Unauthenticated' },
        },
      },
    },
    '/admin/accounts': {
      get: {
        summary: 'List/search/filter accounts (admin only)',
        tags: ['Admin Accounts'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'TrangThai', in: 'query', schema: { type: 'string' } },
          { name: 'MaVaiTro', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Paginated account list' },
          '403': { description: 'Caller is not an admin' },
        },
      },
      post: {
        summary: 'Create an account with an explicit role (admin only)',
        tags: ['Admin Accounts'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAccountRequest' } } },
        },
        responses: { '201': { description: 'Account created' }, '403': { description: 'Not an admin' } },
      },
    },
    '/admin/accounts/roles': {
      get: {
        summary: 'List VAI_TRO rows (MaVaiTro, TenVaiTro, MoTa) for the create/edit account forms — ids are IDENTITY values and differ between databases, so clients must never hardcode them',
        tags: ['Admin Accounts'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Role list' }, '403': { description: 'Not an admin' } },
      },
    },
    '/admin/accounts/{id}': {
      get: {
        summary: 'Get account detail (admin only)',
        tags: ['Admin Accounts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Account detail' }, '404': { description: 'Not found' } },
      },
      patch: {
        summary: 'Update an account, including role reassignment (admin only)',
        tags: ['Admin Accounts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Updated account' } },
      },
      delete: {
        summary:
          'Delete-safe: hard-deletes only if the account has no related history (booking/review/support/hotel ownership/partner application); otherwise locks it (G0-10)',
        tags: ['Admin Accounts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: '{ hardDeleted: boolean }' } },
      },
    },
    '/admin/accounts/{id}/lock': {
      post: {
        summary: 'Lock an account (locked accounts cannot log in)',
        tags: ['Admin Accounts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Account locked' } },
      },
    },
    '/admin/accounts/{id}/unlock': {
      post: {
        summary: 'Unlock an account',
        tags: ['Admin Accounts'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Account unlocked' } },
      },
    },
    '/admin/hotels': {
      get: {
        summary: 'List/search hotels for system administration (UC33, admin only)',
        tags: ['Admin Hotels'], security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'TrangThai', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated hotel administration list' }, '401': { description: 'Not authenticated' }, '403': { description: 'Admin role required' } },
      },
    },
    '/admin/hotels/{id}': {
      get: {
        summary: 'Get hotel administration detail (UC33, admin only)', tags: ['Admin Hotels'], security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Hotel detail including images and amenities' }, '403': { description: 'Admin role required' }, '404': { description: 'Hotel not found' } },
      },
      patch: {
        summary: 'Update whitelisted hotel operational information (UC33, admin only)',
        description: 'Only hotel name, address, stars, description, check-in/check-out time and location may be changed. Owner, approval and state fields are not accepted.',
        tags: ['Admin Hotels'], security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  TenKhachSan: { type: 'string' }, DiaChiChiTiet: { type: 'string' }, HangSao: { type: 'integer', minimum: 1, maximum: 5 }, MoTa: { type: 'string', nullable: true }, GioNhanPhong: { type: 'string', format: 'date-time' }, GioTraPhong: { type: 'string', format: 'date-time' }, MaDiaPhuong: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Hotel updated' }, '400': { description: 'Invalid editable data' }, '403': { description: 'Admin role required' }, '404': { description: 'Hotel not found' } },
      },
    },
    '/admin/hotels/{id}/approve': {
      post: {
        summary: 'Approve a pending hotel ("Chờ duyệt" → "Hoạt động", admin only)',
        description: 'Atomically sets TrangThai, MaTaiKhoanDuyet (the calling admin) and NgayDuyet. Only valid from "Chờ duyệt".', tags: ['Admin Hotels'], security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Hotel approved' }, '400': { description: 'Hotel is not pending approval' }, '403': { description: 'Admin role required' }, '404': { description: 'Hotel not found' } },
      },
    },
    '/admin/hotels/{id}/reject': {
      post: {
        summary: 'Reject a pending hotel ("Chờ duyệt" → "Từ chối", admin only)',
        description: 'Only valid from "Chờ duyệt". A rejected hotel never appears publicly.', tags: ['Admin Hotels'], security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Hotel rejected' }, '400': { description: 'Hotel is not pending approval' }, '403': { description: 'Admin role required' }, '404': { description: 'Hotel not found' } },
      },
    },
    '/admin/hotels/{id}/suspend': {
      post: {
        summary: 'Suspend a hotel from public sellable inventory (UC34, admin only)',
        description: 'Idempotent. Only an active hotel can be suspended. A suspended hotel no longer appears in public discovery or booking flows.', tags: ['Admin Hotels'], security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Hotel state changed to Đình chỉ' }, '403': { description: 'Admin role required' }, '404': { description: 'Hotel not found' } },
      },
    },
    '/admin/hotels/{id}/reactivate': {
      post: {
        summary: 'Reactivate a suspended hotel (UC34, admin only)',
        description: 'Only a currently suspended hotel can be reactivated to Hoạt động.', tags: ['Admin Hotels'], security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Hotel reactivated' }, '400': { description: 'Hotel is not suspended' }, '403': { description: 'Admin role required' }, '404': { description: 'Hotel not found' } },
      },
    },
    '/admin/payments': {
      get: {
        summary: 'List payment and refund operations data (UC35, admin only, read-only)',
        description: 'Response excludes account credentials, email and payment-provider secret/signature data.', tags: ['Admin Payments'], security: [{ BearerAuth: [] }],
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }, { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Booking confirmation or partner transaction reference' }, { name: 'TrangThai', in: 'query', schema: { type: 'string' } }, { name: 'PhuongThucThanhToan', in: 'query', schema: { type: 'string' } }, { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } }],
        responses: { '200': { description: 'Paginated read-only payment list' }, '403': { description: 'Admin role required' } },
      },
    },
    '/admin/payments/{id}': {
      get: {
        summary: 'Get a read-only payment with booking and refund data (UC35, admin only)',
        tags: ['Admin Payments'], security: [{ BearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Payment detail without sensitive fields' }, '403': { description: 'Admin role required' }, '404': { description: 'Payment not found' } },
      },
    },
    '/partners/apply': {
      post: {
        summary: 'Submit a partner (hotel owner) application — creates a pending dossier; role is not upgraded automatically.',
        tags: ['Partners'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApplyPartnerRequest' } } },
        },
        responses: {
          '201': { description: 'Application submitted, TrangThaiDuyet = "Chờ duyệt"' },
          '409': { description: 'A pending or already-approved application exists' },
        },
      },
    },
    '/partners/me': {
      get: {
        summary: "Get the caller's latest partner application status",
        tags: ['Partners'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Latest application, or null if none submitted' } },
      },
    },
    '/admin/partner-applications': {
      get: {
        summary: 'List partner applications for admin moderation (UC32)',
        tags: ['Admin Partner Applications'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'trangThaiDuyet', in: 'query', schema: { type: 'string', enum: ['Chờ duyệt', 'Đã duyệt', 'Từ chối'] } },
        ],
        responses: { '200': { description: 'Partner application queue' }, '401': { description: 'Not authenticated' }, '403': { description: 'Admin role required' } },
      },
    },
    '/admin/partner-applications/{id}': {
      get: {
        summary: 'Get a partner application for admin moderation',
        tags: ['Admin Partner Applications'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Partner application detail' }, '403': { description: 'Admin role required' }, '404': { description: 'Application not found' } },
      },
    },
    '/admin/partner-applications/{id}/approve': {
      post: {
        summary: 'Approve a pending partner application and assign Chủ khách sạn role',
        description: 'Only a pending application can be approved. MaTaiKhoanDuyet is taken from the authenticated admin token, never from the request body. Approval and role assignment are transactional; no hotel is created.',
        tags: ['Admin Partner Applications'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: { '200': { description: 'Application approved and applicant role changed to Chủ khách sạn' }, '403': { description: 'Admin role required' }, '404': { description: 'Application not found' }, '409': { description: 'Application is no longer pending' } },
      },
    },
    '/admin/partner-applications/{id}/reject': {
      post: {
        summary: 'Reject a pending partner application',
        description: 'Only a pending application can be rejected. LyDoTuChoi is required and MaTaiKhoanDuyet is taken from the authenticated admin token. Rejection does not change the applicant role.',
        tags: ['Admin Partner Applications'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RejectPartnerApplicationRequest' } } } },
        responses: { '200': { description: 'Application rejected' }, '400': { description: 'Rejection reason is required' }, '403': { description: 'Admin role required' }, '404': { description: 'Application not found' }, '409': { description: 'Application is no longer pending' } },
      },
    },
    '/health': {
      get: {
        summary: 'Check API and system health status',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'API is running and healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Hotel Booking API is running' },
                    data: {
                      type: 'object',
                      properties: {
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number' },
                        environment: { type: 'string', example: 'development' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          error: { type: 'object' },
        },
      },
      Account: {
        type: 'object',
        description: 'MatKhau (password hash) is never included in any API response.',
        properties: {
          MaTaiKhoan: { type: 'integer' },
          MaVaiTro: { type: 'integer' },
          TenDangNhap: { type: 'string' },
          Email: { type: 'string', format: 'email' },
          HoTen: { type: 'string' },
          SoDienThoai: { type: 'string' },
          NgaySinh: { type: 'string', format: 'date', nullable: true },
          GioiTinh: { type: 'string', enum: ['Nam', 'Nữ', 'Khác'], nullable: true },
          AnhDaiDien: { type: 'string', nullable: true },
          TrangThai: { type: 'string', example: 'Hoạt động' },
          NgayTao: { type: 'string', format: 'date-time' },
          NgayCapNhat: { type: 'string', format: 'date-time' },
        },
      },
      RegisterRequest: {
        type: 'object',
        description:
          'NgaySinh/GioiTinh are optional (DDI-01 resolved: nullable in the baseline) — registration does not require them.',
        required: ['TenDangNhap', 'Email', 'MatKhau', 'HoTen', 'SoDienThoai'],
        properties: {
          TenDangNhap: { type: 'string' },
          Email: { type: 'string', format: 'email' },
          MatKhau: { type: 'string', minLength: 6 },
          HoTen: { type: 'string' },
          SoDienThoai: { type: 'string' },
          NgaySinh: { type: 'string', format: 'date', nullable: true },
          GioiTinh: { type: 'string', enum: ['Nam', 'Nữ', 'Khác'], nullable: true },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['identifier', 'MatKhau'],
        properties: {
          identifier: { type: 'string', description: 'Email or TenDangNhap' },
          MatKhau: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              account: { $ref: '#/components/schemas/Account' },
              accessToken: { type: 'string', description: 'Short-lived JWT (15m), sent in the body' },
            },
          },
        },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['Email'],
        properties: { Email: { type: 'string', format: 'email' } },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'MatKhauMoi'],
        properties: { token: { type: 'string' }, MatKhauMoi: { type: 'string', minLength: 6 } },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['MatKhauCu', 'MatKhauMoi'],
        properties: {
          MatKhauCu: { type: 'string', description: 'Current password' },
          MatKhauMoi: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        description: 'Whitelist only — MaVaiTro/TrangThai/NgayTao/TenDangNhap/Email/MatKhau cannot be set here.',
        properties: {
          HoTen: { type: 'string' },
          SoDienThoai: { type: 'string' },
          NgaySinh: { type: 'string', format: 'date' },
          GioiTinh: { type: 'string', enum: ['Nam', 'Nữ', 'Khác'] },
          AnhDaiDien: { type: 'string' },
        },
      },
      CreateAccountRequest: {
        allOf: [
          { $ref: '#/components/schemas/RegisterRequest' },
          { type: 'object', required: ['MaVaiTro'], properties: { MaVaiTro: { type: 'integer' } } },
        ],
      },
      ApplyPartnerRequest: {
        type: 'object',
        required: ['SoCCCD', 'SoGiayPhepKinhDoanh', 'MaSoThue', 'TepGiayTo'],
        properties: {
          SoCCCD: { type: 'string' },
          SoGiayPhepKinhDoanh: { type: 'string' },
          MaSoThue: { type: 'string' },
          TepGiayTo: {
            type: 'string',
            description: 'M1 foundation: URL/reference string, not a real file upload yet',
          },
        },
      },
      RejectPartnerApplicationRequest: {
        type: 'object',
        required: ['LyDoTuChoi'],
        properties: { LyDoTuChoi: { type: 'string', minLength: 1, maxLength: 500 } },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
