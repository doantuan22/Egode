import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import {
  useHotelDetail,
  useHotelRooms,
} from '../../features/hotels/hooks';

import {
  defaultSearchDates,
  parseGuests,
} from '../../features/hotels/schemas';

import { useQuote } from '../../features/quotes/hooks';
import { quoteMatchesRequest } from '../../features/quotes/match';

import { useCreateBooking } from '../../features/bookings/hooks';
import { BOOKING_STATUS } from '../../features/bookings/status';

import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';

import { ApiError } from '../../services/apiClient';

import {
  cn,
  formatCurrencyVND,
} from '../../lib/utils';

import { HotelHeader } from '../../components/hotels/detail/HotelHeader';
import { HotelGallery } from '../../components/hotels/detail/HotelGallery';
import { HotelSectionNav } from '../../components/hotels/detail/HotelSectionNav';
import { RoomList } from '../../components/hotels/detail/RoomList';

import {
  HotelAmenities,
  HotelOverview,
} from '../../components/hotels/detail/HotelAbout';

import { HotelReviews } from '../../components/hotels/detail/HotelReviews';
import { BookingPanel } from '../../components/hotels/detail/BookingPanel';
import { MobileBookingBar } from '../../components/hotels/detail/MobileBookingBar';

import { HotelGalleryDialog } from '../../components/hotels/HotelGalleryDialog';

import { useToast } from '../../components/common/FeedbackProvider';
import { PageSpinner } from '../../components/common/PageSpinner';

import { shareUrl } from '../../lib/share';
import { useActiveSection } from '../../hooks/useActiveSection';

/* =========================================================
   PAGE SECTIONS
========================================================= */

const PAGE_SECTIONS = [
  {
    id: 'loai-phong',
    label: 'Loại phòng & Giá',
  },
  {
    id: 'tong-quan',
    label: 'Tổng quan',
  },
  {
    id: 'tien-nghi',
    label: 'Tiện nghi',
  },
  {
    id: 'danh-gia-khach',
    label: 'Đánh giá',
  },
] as const;

const SECTION_IDS =
  PAGE_SECTIONS.map(
    (section) =>
      section.id
  );

export default function HotelDetailPage() {
  const { id } =
    useParams<{
      id: string;
    }>();

  const hotelId =
    Number(id);

  const navigate =
    useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [
    selectedRooms,
    setSelectedRooms,
  ] = useState<
    Record<number, number>
  >({});

  /*
   * Mã đang gõ trong ô nhập — CHƯA có hiệu lực.
   * Chỉ nút "Áp dụng" mới biến nó thành appliedPromo.
   */
  const [
    promoInput,
    setPromoInput,
  ] = useState('');

  /*
   * Mã đã áp dụng: duy nhất mã này được gửi lên backend để báo giá / đặt phòng.
   * Mỗi lần đổi phòng / ngày / số khách, báo giá chạy lại với mã này và backend
   * quyết định nó còn hợp lệ hay không.
   */
  const [
    appliedPromo,
    setAppliedPromo,
  ] = useState('');

  /* Lý do mã đã bị gỡ (backend báo không hợp lệ / hết hợp lệ). */
  const [
    promoNotice,
    setPromoNotice,
  ] = useState<string | null>(null);

  const [
    ghiChu,
    setGhiChu,
  ] = useState('');

  const [
    galleryIndex,
    setGalleryIndex,
  ] = useState<
    number | null
  >(null);

  const notify =
    useToast();

  const bookingMutation =
    useCreateBooking(
      hotelId
    );

  const accessToken =
    useAuthStore(
      (state) =>
        state.accessToken
    );

  const role =
    useAuthStore(
      (state) =>
        state.role
    );

  /* =========================================================
     SEARCH PARAMS
  ========================================================= */

  const defaults =
    defaultSearchDates();

  const checkIn =
    searchParams.get(
      'checkIn'
    ) ||
    defaults.checkIn;

  const checkOut =
    searchParams.get(
      'checkOut'
    ) ||
    defaults.checkOut;

  const guests =
    parseGuests(
      searchParams.get(
        'guests'
      )
    );

  /* =========================================================
     SELECTED ROOMS
  ========================================================= */

  const selectedRoomLines =
    Object.entries(
      selectedRooms
    )
      .map(
        ([
          maLoaiPhong,
          soLuong,
        ]) => ({
          maLoaiPhong:
            Number(
              maLoaiPhong
            ),

          soLuong,
        })
      )
      .filter(
        (line) =>
          line.soLuong > 0
      );

  const selectedRoomCount =
    selectedRoomLines.reduce(
      (
        sum,
        line
      ) =>
        sum +
        line.soLuong,
      0
    );

  /* =========================================================
     QUOTE
  ========================================================= */

  const quoteQuery =
    useQuote(
      hotelId,

      selectedRoomLines.length >
        0
        ? {
            checkIn,
            checkOut,
            guests,

            rooms:
              selectedRoomLines,

            promoCode:
              appliedPromo ||
              undefined,
          }
        : null
    );

  /* =========================================================
     HOTEL DATA
  ========================================================= */

  const hotelQuery =
    useHotelDetail(
      hotelId
    );

  const hotelLoaded =
    Boolean(
      hotelQuery.data
    );

  const [
    activeSection,
    selectSection,
  ] =
    useActiveSection(
      SECTION_IDS,
      hotelLoaded
    );

  /* =========================================================
     BOOKING PANEL VISIBILITY
  ========================================================= */

  const [
    bookingPanelVisible,
    setBookingPanelVisible,
  ] = useState(false);

  useEffect(() => {
    const panel =
      document.getElementById(
        'dat-phong'
      );

    if (
      !panel ||
      typeof IntersectionObserver ===
        'undefined'
    ) {
      return;
    }

    const observer =
      new IntersectionObserver(
        ([entry]) =>
          setBookingPanelVisible(
            entry.isIntersecting
          )
      );

    observer.observe(
      panel
    );

    return () =>
      observer.disconnect();
  }, [hotelLoaded]);

  /* =========================================================
     ROOMS
  ========================================================= */

  const roomsQuery =
    useHotelRooms(
      hotelId,
      {
        checkIn,
        checkOut,
        guests,
      }
    );

  /* =========================================================
     CAPACITY OF THE ROOMS CHOSEN (a hint — the server decides)
  ========================================================= */

  const selectedCapacity = selectedRoomLines.reduce(
    (sum, line) =>
      sum +
      line.soLuong *
        (roomsQuery.data?.find((room) => room.MaLoaiPhong === line.maLoaiPhong)?.SucChua ?? 0),
    0
  );

  /* =========================================================
     DATE SEARCH
  ========================================================= */

  const onDatesSubmit = (
    values: {
      checkIn: string;
      checkOut: string;
      guests: number;
    }
  ) => {
    setSelectedRooms(
      {}
    );

    bookingMutation.reset();

    setSearchParams({
      checkIn:
        values.checkIn,

      checkOut:
        values.checkOut,

      guests:
        String(
          values.guests
        ),
    });
  };

  /* =========================================================
     ROOM QUANTITY
  ========================================================= */

  const setRoomQuantity = (
    maLoaiPhong: number,
    quantity: number,
    available: number
  ) => {
    bookingMutation.reset();

    const safeQuantity =
      Math.min(
        available,

        Math.max(
          0,

          Math.floor(
            Number.isFinite(
              quantity
            )
              ? quantity
              : 0
          )
        )
      );

    setSelectedRooms(
      (current) => {
        const next = {
          ...current,
        };

        if (
          safeQuantity ===
          0
        ) {
          delete next[
            maLoaiPhong
          ];
        } else {
          next[
            maLoaiPhong
          ] =
            safeQuantity;
        }

        return next;
      }
    );
  };

  /* =========================================================
     PROMO
  ========================================================= */

  const changePromoInput = (
    value: string
  ) => {
    setPromoInput(
      value
    );

    setPromoNotice(
      null
    );

    if (
      !value.trim()
    ) {
      setAppliedPromo(
        ''
      );
    }
  };

  const applyPromo = () => {
    bookingMutation.reset();

    setPromoNotice(
      null
    );

    const code =
      promoInput.trim();

    // Same code again: the query key does not change, so ask the backend again explicitly.
    if (
      code ===
        appliedPromo &&
      code
    ) {
      void quoteQuery.refetch();
    }

    setAppliedPromo(
      code
    );
  };

  /* =========================================================
     QUOTE MATCH
  ========================================================= */

  const quoteMatchesSelection =
    quoteMatchesRequest(
      quoteQuery.data,

      {
        checkIn,
        checkOut,
        rooms:
          selectedRoomLines,
      }
    );

  const quoteMatchesPromo =
    appliedPromo ===
    promoInput.trim();

  /*
   * Backend là nguồn quyết định: nếu báo giá cho mã đã áp dụng trả về "không hợp lệ"
   * (sai mã, hết hạn, không đủ điều kiện sau khi đổi phòng/ngày...), gỡ mã và báo rõ lý do.
   */
  const quoteData =
    quoteQuery.data;

  const quoteFetching =
    quoteQuery.isFetching;

  useEffect(() => {
    if (
      !appliedPromo ||
      !quoteData ||
      quoteFetching ||
      !quoteMatchesSelection ||
      quoteData.PromoHopLe
    ) {
      return;
    }

    setPromoNotice(
      `Mã khuyến mãi ${appliedPromo}: ${
        quoteData.PromoThongBao ??
        'không hợp lệ'
      }`
    );

    setAppliedPromo(
      ''
    );

    setPromoInput(
      ''
    );
  }, [
    appliedPromo,
    quoteData,
    quoteFetching,
    quoteMatchesSelection,
  ]);

  /* =========================================================
     CONFIRM BOOKING
  ========================================================= */

  const confirmBooking = () => {
    if (
      selectedRoomLines.length ===
        0 ||
      !quoteMatchesSelection ||
      !quoteQuery.data
        ?.KhaDung
    ) {
      return;
    }

    bookingMutation.mutate(
      {
        checkIn,
        checkOut,
        guests,

        rooms:
          selectedRoomLines,

        promoCode:
          quoteQuery.data
            .PromoHopLe
            ? appliedPromo
            : undefined,

        ghiChu:
          ghiChu.trim() ||
          undefined,
      },
      {
        onSuccess: (
          booking
        ) => {
          // Nothing to pay (total 0): the server confirmed it on the spot, so there is no payment step.
          if (booking.TrangThai === BOOKING_STATUS.CONFIRMED) {
            navigate(`/payment/result?bookingId=${booking.MaDatPhong}&status=success`);
            return;
          }
          navigate(
            `/bookings/${booking.MaDatPhong}`,
            {
              state: {
                justBooked:
                  true,
              },
            }
          );
        },
      }
    );
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    hotelQuery.isLoading
  ) {
    return (
      <div className="booking-flow min-h-[70vh] bg-surface-secondary">

        <div
          className="
            page-container
            flex
            min-h-[60vh]
            items-center
            justify-center
          "
        >
          <PageSpinner />
        </div>

      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (
    hotelQuery.isError ||
    !hotelQuery.data
  ) {
    return (
      <div className="booking-flow min-h-[70vh] bg-surface-secondary px-4 py-12">

        <div
          role="alert"
          className="
            mx-auto
            max-w-md
            rounded-[22px]
            border
            border-danger/30
            bg-danger-light
            px-6
            py-10
            text-center
            text-sm
            text-danger-ink
            shadow-sm
          "
        >
          <div
            className="
              mx-auto
              mb-4
              grid
              h-12
              w-12
              place-items-center
              rounded-full
              bg-white
            "
          >
            <i className="ph ph-warning-circle text-2xl" />
          </div>

          {hotelQuery.error instanceof
          ApiError
            ? hotelQuery
                .error.message
            : 'Không tìm thấy khách sạn'}
        </div>

      </div>
    );
  }

  const hotel =
    hotelQuery.data;

  /* =========================================================
     MOBILE BOOKING
  ========================================================= */

  const goToBookingPanel =
    () =>
      document
        .getElementById(
          'dat-phong'
        )
        ?.scrollIntoView({
          block: 'start',
          behavior:
            'smooth',
        });

  /* =========================================================
     SUMMARY TOTAL
  ========================================================= */

  const summaryTotal =
    quoteQuery.isError
      ? 'Không thể báo giá'
      : quoteMatchesSelection &&
          quoteQuery.data
        ? quoteQuery.data
            .KhaDung
          ? formatCurrencyVND(
              quoteQuery.data
                .TongTienThanhToan
            )
          : 'Cần điều chỉnh lựa chọn'
        : 'Đang cập nhật báo giá…';

  /* =========================================================
     SHARE
  ========================================================= */

  const shareHotel =
    async () => {
      try {
        const result =
          await shareUrl({
            title:
              hotel.TenKhachSan,

            url:
              window.location
                .href,
          });

        if (
          result ===
          'copied'
        ) {
          notify({
            title:
              'Đã sao chép liên kết',

            tone:
              'success',
          });
        }
      } catch {
        notify({
          title:
            'Không thể chia sẻ',

          description:
            'Hãy sao chép liên kết từ thanh địa chỉ của trình duyệt.',

          tone:
            'error',
        });
      }
    };

  return (
    <div
      className={cn(
        `
          booking-flow
          min-h-screen
          w-full
          bg-surface-secondary
          text-ink
        `,

        selectedRoomLines.length >
          0 &&
          'pb-24 lg:pb-0'
      )}
    >

      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <section
        className="
          border-b
          border-primary/10
          bg-gradient-to-r
          from-[#062f4f]
          via-[#075985]
          to-[#0284c7]
          text-white
        "
      >

        <div
          className="
            page-container
            flex
            min-h-14
            items-center
            justify-between
            gap-4
            py-2
          "
        >

          <button
            type="button"
            onClick={() =>
              navigate(
                '/hotels'
              )
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              px-3
              py-2
              text-sm
              font-semibold
              text-white/90
              transition
              hover:bg-white/10
              hover:text-white
            "
          >
            <i className="ph ph-arrow-left text-lg" />

            Danh sách khách sạn
          </button>

          <div
            className="
              hidden
              items-center
              gap-2
              rounded-full
              border
              border-white/15
              bg-white/10
              px-3
              py-1.5
              text-xs
              font-semibold
              text-white/85
              sm:flex
            "
          >
            <i className="ph ph-shield-check text-base text-cyan-200" />

            Đặt phòng an tâm
          </div>

        </div>

      </section>

      {/* =====================================================
          HEADER + GALLERY
      ===================================================== */}

      <div className="bg-white">

        <HotelHeader
          hotel={hotel}
          onShare={
            shareHotel
          }
        />

        <HotelGallery
          hotelName={
            hotel.TenKhachSan
          }
          images={
            hotel.HinhAnh
          }
          onOpen={
            setGalleryIndex
          }
        />

      </div>

      {/* =====================================================
          GALLERY DIALOG
      ===================================================== */}

      <HotelGalleryDialog
        hotelName={
          hotel.TenKhachSan
        }
        images={
          hotel.HinhAnh
        }
        startIndex={
          galleryIndex
        }
        onClose={() =>
          setGalleryIndex(
            null
          )
        }
      />

      {/* =====================================================
          MOBILE BOOKING BAR
      ===================================================== */}

      {selectedRoomLines.length >
        0 &&
        !bookingPanelVisible && (

          <MobileBookingBar
            roomCount={
              selectedRoomCount
            }
            total={
              summaryTotal
            }
            onOpenPanel={
              goToBookingPanel
            }
          />
        )}

      {/* =====================================================
          TRUST STRIP
      ===================================================== */}

      <div
        className="
          border-y
          border-border
          bg-white
        "
      >

        <div
          className="
            page-container
            grid
            grid-cols-1
            gap-3
            py-4
            sm:grid-cols-3
          "
        >

          <HotelBenefit
            icon="ph-currency-circle-dollar"
            title="Giá rõ ràng"
            description="Kiểm tra báo giá trước khi xác nhận."
          />

          <HotelBenefit
            icon="ph-shield-check"
            title="Đặt phòng an tâm"
            description="Thông tin được quản lý trong tài khoản."
          />

          <HotelBenefit
            icon="ph-headset"
            title="Luôn có hỗ trợ"
            description="Dễ dàng liên hệ khi cần trợ giúp."
          />

        </div>

      </div>

      {/* =====================================================
          SECTION NAV
      ===================================================== */}

      <HotelSectionNav
        sections={
          PAGE_SECTIONS
        }
        activeId={
          activeSection
        }
        onSelect={
          selectSection
        }
      />

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div className="page-container py-8 lg:py-10">

        <div
          className="
            grid
            grid-cols-1
            items-start
            gap-7
            lg:grid-cols-12
            lg:gap-8
          "
        >

          {/* =================================================
              LEFT CONTENT
          ================================================= */}

          <div
            className="
              hotel-detail-content
              flex
              flex-col
              gap-6
              lg:col-span-8
            "
          >

            {/* Rooms */}

            <div
              className="
                overflow-hidden
                rounded-[24px]
                border
                border-border
                bg-white
                p-4
                shadow-sm
                sm:p-5
              "
            >
              <RoomList
                search={{
                  checkIn,
                  checkOut,
                  guests,
                }}
                onSearch={
                  onDatesSubmit
                }
                roomsQuery={
                  roomsQuery
                }
                selectedRooms={
                  selectedRooms
                }
                onQuantityChange={
                  setRoomQuantity
                }
              />
            </div>

            {/* Overview */}

            <div
              className="
                overflow-hidden
                rounded-[24px]
                border
                border-border
                bg-white
                p-5
                shadow-sm
                sm:p-6
              "
            >
              <HotelOverview
                hotel={
                  hotel
                }
              />
            </div>

            {/* Amenities */}

            <div
              className="
                overflow-hidden
                rounded-[24px]
                border
                border-border
                bg-white
                p-5
                shadow-sm
                sm:p-6
              "
            >
              <HotelAmenities
                hotel={
                  hotel
                }
              />
            </div>

            {/* Guest reviews */}

            <HotelReviews
              hotelId={
                hotelId
              }
            />

          </div>

          {/* =================================================
              BOOKING PANEL
          ================================================= */}

          <aside
            className="
              relative
              lg:col-span-4
            "
          >

            <div
              className="
                overflow-hidden
                rounded-[24px]
                border
                border-border
                bg-white
                shadow-lg
              "
            >

              {/* Panel heading */}

              <div
                className="
                  border-b
                  border-border
                  bg-gradient-to-r
                  from-[#eef9ff]
                  to-white
                  px-5
                  py-4
                "
              >

                <div className="flex items-center gap-3">

                  <div
                    className="
                      grid
                      h-10
                      w-10
                      place-items-center
                      rounded-xl
                      bg-primary
                      text-white
                      shadow-sm
                    "
                  >
                    <i className="ph ph-calendar-check text-xl" />
                  </div>

                  <div>

                    <span
                      className="
                        block
                        text-[10px]
                        font-extrabold
                        uppercase
                        tracking-[0.12em]
                        text-primary
                      "
                    >
                      EGODE
                    </span>

                    <h2
                      className="
                        m-0
                        text-base
                        font-extrabold
                        text-ink
                      "
                    >
                      Thông tin đặt phòng
                    </h2>

                  </div>

                </div>

              </div>

              <div className="p-1">

                <BookingPanel
                  guests={
                    guests
                  }
                  selectedCapacity={
                    selectedCapacity
                  }
                  roomTypeCount={
                    selectedRoomLines.length
                  }
                  roomCount={
                    selectedRoomCount
                  }
                  quoteQuery={
                    quoteQuery
                  }
                  quoteMatchesSelection={
                    quoteMatchesSelection
                  }
                  quoteMatchesPromo={
                    quoteMatchesPromo
                  }
                  promoInput={
                    promoInput
                  }
                  promoNotice={
                    promoNotice
                  }
                  onPromoInputChange={
                    changePromoInput
                  }
                  onApplyPromo={
                    applyPromo
                  }
                  note={
                    ghiChu
                  }
                  onNoteChange={
                    setGhiChu
                  }
                  bookingError={
                    bookingMutation.isError
                      ? bookingMutation.error
                      : null
                  }
                  isBooking={
                    bookingMutation.isPending
                  }
                  isSignedIn={
                    Boolean(
                      accessToken
                    )
                  }
                  isCustomer={
                    role ===
                    ROLE_NAMES.CUSTOMER
                  }
                  onSignIn={() =>
                    navigate(
                      '/login',
                      {
                        state: {
                          from: {
                            pathname:
                              `/hotels/${hotelId}`,

                            search:
                              window.location.search,
                          },
                        },
                      }
                    )
                  }
                  onBook={
                    confirmBooking
                  }
                />

              </div>

            </div>

          </aside>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   BENEFIT
========================================================= */

function HotelBenefit({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-3
        rounded-2xl
        px-3
        py-2
      "
    >

      <div
        className="
          grid
          h-10
          w-10
          shrink-0
          place-items-center
          rounded-xl
          bg-primary-50
          text-primary
        "
      >
        <i
          className={`ph ${icon} text-xl`}
        />
      </div>

      <div>

        <h3
          className="
            m-0
            text-sm
            font-bold
            text-ink
          "
        >
          {title}
        </h3>

        <p
          className="
            m-0
            mt-0.5
            text-xs
            leading-5
            text-ink-muted
          "
        >
          {description}
        </p>

      </div>

    </div>
  );
}