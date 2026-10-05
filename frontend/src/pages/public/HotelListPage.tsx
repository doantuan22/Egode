import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useSearchHotels } from '../../features/hotels/hooks';
import { useAmenities } from '../../features/amenities/hooks';

import {
  defaultSearchDates,
  parseGuests,
} from '../../features/hotels/schemas';

import type {
  HotelSearchParams,
  SortOption,
} from '../../features/hotels/types';

import { ApiError } from '../../services/apiClient';
import { formatDateRangeVi } from '../../lib/utils';

import { TravelSearchBar } from '../../components/hotels/TravelSearchBar';
import { HotelCard } from '../../components/hotels/HotelCard';
import { HotelFilterBar } from '../../components/hotels/HotelFilterBar';

import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Icon } from '../../components/common/Icon';
import { Select } from '../../components/common/Select';
import { Skeleton } from '../../components/common/Skeleton';

const PAGE_SIZE = 12;

function parseParams(
  searchParams: URLSearchParams
): HotelSearchParams {
  const defaults = defaultSearchDates();

  const amenitiesParam =
    searchParams.get('amenities');

  return {
    location:
      searchParams.get('location') ||
      undefined,

    checkIn:
      searchParams.get('checkIn') ||
      defaults.checkIn,

    checkOut:
      searchParams.get('checkOut') ||
      defaults.checkOut,

    guests:
      parseGuests(
        searchParams.get('guests')
      ),

    minPrice:
      searchParams.get('minPrice')
        ? Number(
            searchParams.get('minPrice')
          )
        : undefined,

    maxPrice:
      searchParams.get('maxPrice')
        ? Number(
            searchParams.get('maxPrice')
          )
        : undefined,

    starRating:
      searchParams.get('starRating')
        ? Number(
            searchParams.get('starRating')
          )
        : undefined,

    amenities:
      amenitiesParam
        ? amenitiesParam
            .split(',')
            .map(Number)
        : undefined,

    page:
      Number(
        searchParams.get('page')
      ) || 1,

    limit: PAGE_SIZE,

    sort:
      (searchParams.get(
        'sort'
      ) as SortOption) ||
      'price_asc',
  };
}

export default function HotelListPage() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const params = useMemo(
    () => parseParams(searchParams),
    [searchParams]
  );

  const query =
    useSearchHotels(params);

  const amenitiesQuery =
    useAmenities();

  const updateParams = (
    patch: Record<
      string,
      string | undefined
    >,
    resetPage = true
  ) => {
    const next =
      new URLSearchParams(
        searchParams
      );

    Object.entries(
      patch
    ).forEach(
      ([key, value]) => {
        if (
          value === undefined ||
          value === ''
        ) {
          next.delete(key);
        } else {
          next.set(
            key,
            value
          );
        }
      }
    );

    if (resetPage) {
      next.delete('page');
    }

    setSearchParams(next);
  };

  const toggleAmenity = (
    id: number
  ) => {
    const current =
      params.amenities ?? [];

    const next =
      current.includes(id)
        ? current.filter(
            (item) =>
              item !== id
          )
        : [
            ...current,
            id,
          ];

    updateParams({
      amenities:
        next.length > 0
          ? next.join(',')
          : undefined,
    });
  };

  const resetFilters = () => {
    updateParams({
      minPrice: undefined,
      maxPrice: undefined,
      starRating: undefined,
      amenities: undefined,
    });
  };

  const totalHotels =
    query.data?.pagination
      .total ?? 0;

  return (
    <div
      className="
        booking-flow
        min-h-screen
        w-full
        bg-[#f6f8fb]
        text-ink
      "
    >

      {/* =====================================================
          HERO
      ===================================================== */}

      <section
        className="
          relative
          min-h-[450px]
          overflow-visible
        "
      >

        {/* BACKGROUND */}

        <div
          className="
            absolute
            inset-0
            overflow-hidden
          "
        >

          <img
            src="/search_hotel.jpg"
            alt=""
            aria-hidden="true"
            className="
              h-full
              w-full
              object-cover
              object-center
            "
          />

          <div
            aria-hidden="true"
            className="
              absolute
              inset-0
              bg-gradient-to-r
              from-[#061a2d]/95
              via-[#073552]/67
              to-[#0c5678]/18
            "
          />

          <div
            aria-hidden="true"
            className="
              absolute
              inset-0
              bg-gradient-to-t
              from-[#061a2d]/45
              via-transparent
              to-black/10
            "
          />

        </div>

        {/* HERO TEXT */}

        <div
          className="
            page-container
            relative
            z-10
            pt-16
          "
        >

          <div className="max-w-[650px]">

            {/* BADGE */}

            <div
              className="
                mb-5
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-white/25
                bg-white/10
                px-4
                py-2
                text-[11px]
                font-extrabold
                tracking-[0.08em]
                text-white
                backdrop-blur-md
              "
            >
              <i
                className="
                  ph
                  ph-buildings
                  text-base
                  text-cyan-200
                "
              />

              EGODE · KHÁCH SẠN
            </div>

            {/* TITLE */}

            <h1
              className="
                m-0
                text-[40px]
                font-extrabold
                leading-[1.08]
                tracking-[-0.045em]
                md:text-[52px]
              "
              style={{
                color: '#ffffff',
                textShadow:
                  '0 4px 18px rgba(0,0,0,0.3)',
              }}
            >
              Tìm nơi nghỉ phù hợp

              <span
                className="
                  mt-1
                  block
                  text-cyan-200
                "
              >
                cho chuyến đi của bạn.
              </span>
            </h1>

            {/* DESCRIPTION */}

            <p
              className="
                mt-4
                max-w-[560px]
                text-[15px]
                font-medium
                leading-7
                md:text-base
              "
              style={{
                color:
                  'rgba(255,255,255,0.9)',
              }}
            >
              Chọn điểm đến, ngày lưu trú và số khách.
              Egode giúp bạn tìm khách sạn phù hợp
              nhanh chóng và dễ dàng.
            </p>

            {/* BENEFITS */}

            <div
              className="
                mt-5
                flex
                flex-wrap
                gap-2.5
              "
            >

              <HeroChip
                icon="ph-magnifying-glass"
                text="Tìm kiếm nhanh"
              />

              <HeroChip
                icon="ph-shield-check"
                text="Đặt phòng an tâm"
              />

              <HeroChip
                icon="ph-wallet"
                text="Giá rõ ràng"
              />

            </div>

          </div>

        </div>

        {/* =================================================
            SEARCH CARD
        ================================================= */}

        <div
          className="
            page-container
            absolute
            bottom-[-66px]
            left-1/2
            z-20
            w-full
            -translate-x-1/2
          "
        >

          <div
            className="
              rounded-[24px]
              border
              border-white/80
              bg-white/95
              p-4
              shadow-[0_20px_55px_rgba(7,38,61,0.24)]
              backdrop-blur-xl
            "
          >

            {/* SEARCH HEADING */}

            <div
              className="
                mb-3
                flex
                items-end
                justify-between
                gap-4
                px-1
              "
            >

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
                  TÌM CHỖ NGHỈ
                </span>

                <h2
                  className="
                    m-0
                    mt-1
                    text-[18px]
                    font-extrabold
                    text-slate-900
                  "
                >
                  Bạn muốn đi đâu?
                </h2>

              </div>

              <div
                className="
                  hidden
                  items-center
                  gap-2
                  text-xs
                  font-semibold
                  text-slate-500
                  md:flex
                "
              >
                <i
                  className="
                    ph
                    ph-shield-check
                    text-lg
                    text-emerald-500
                  "
                />

                Đặt phòng dễ dàng
              </div>

            </div>

            <TravelSearchBar
              variant="compact"
              currentSearch={{
                location:
                  params.location,

                checkIn:
                  params.checkIn,

                checkOut:
                  params.checkOut,

                guests:
                  params.guests,
              }}
              loading={
                query.isFetching
              }
              onSearch={(
                values
              ) =>
                updateParams({
                  location:
                    values.location ||
                    undefined,

                  checkIn:
                    values.checkIn,

                  checkOut:
                    values.checkOut,

                  guests:
                    String(
                      values.guests
                    ),
                })
              }
            />

          </div>

        </div>

      </section>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div
        className="
          page-container
          pb-14
          pt-[105px]
        "
      >

        {/* =================================================
            FILTER
        ================================================= */}

        <section
          className="
            overflow-hidden
            rounded-[22px]
            border
            border-slate-200
            bg-white
            shadow-[0_7px_25px_rgba(15,23,42,0.05)]
          "
        >

          {/* FILTER HEADER */}

          <div
            className="
              flex
              flex-col
              gap-4
              border-b
              border-slate-100
              px-6
              py-5
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >

            <div
              className="
                flex
                items-center
                gap-3
              "
            >

              <div
                className="
                  grid
                  h-11
                  w-11
                  shrink-0
                  place-items-center
                  rounded-[14px]
                  bg-[#edf7ff]
                  text-[#1687d9]
                "
              >
                <i
                  className="
                    ph
                    ph-sliders-horizontal
                    text-xl
                  "
                />
              </div>

              <div>

                <h2
                  className="
                    m-0
                    text-[15px]
                    font-extrabold
                    text-slate-900
                  "
                >
                  Bộ lọc tìm kiếm
                </h2>

                <p
                  className="
                    m-0
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  Chọn mức giá, hạng sao và tiện nghi phù hợp.
                </p>

              </div>

            </div>

            <Button
              type="button"
              variant="outline"
              onClick={
                resetFilters
              }
            >
              Xóa bộ lọc
            </Button>

          </div>

          {/* FILTER BODY */}

          <div
            className="
              bg-white
              px-5
              py-5
              md:px-6
            "
          >

            <HotelFilterBar
              values={
                params
              }
              amenities={
                amenitiesQuery.data
              }
              onPriceChange={(
                key,
                value
              ) =>
                updateParams({
                  [key]:
                    value,
                })
              }
              onStarChange={(
                star
              ) =>
                updateParams({
                  starRating:
                    star ===
                    undefined
                      ? undefined
                      : String(
                          star
                        ),
                })
              }
              onAmenityToggle={
                toggleAmenity
              }
              onReset={
                resetFilters
              }
            />

          </div>

        </section>

        {/* =================================================
            RESULTS AREA
        ================================================= */}

        <section
          className="
            mt-6
            space-y-5
          "
        >

          {/* RESULT TOOLBAR */}

          <div
            className="
              flex
              flex-col
              gap-5
              rounded-[22px]
              border
              border-slate-200
              bg-white
              px-6
              py-5
              shadow-[0_7px_25px_rgba(15,23,42,0.05)]
              md:flex-row
              md:items-center
              md:justify-between
            "
          >

            {/* LEFT */}

            <div>

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >

                <h2
                  className="
                    m-0
                    text-[21px]
                    font-extrabold
                    tracking-[-0.02em]
                    text-slate-900
                  "
                  aria-live="polite"
                >
                  Tìm thấy{' '}

                  <span
                    className="
                      text-primary
                    "
                  >
                    {totalHotels}
                  </span>{' '}

                  khách sạn
                </h2>

                {query.isFetching &&
                  !query.isLoading && (
                    <span
                      className="
                        rounded-full
                        bg-blue-50
                        px-2.5
                        py-1
                        text-[11px]
                        font-semibold
                        text-primary
                      "
                    >
                      Đang cập nhật...
                    </span>
                  )}

              </div>

              {/* CHIPS */}

              <div
                className="
                  mt-3
                  flex
                  flex-wrap
                  gap-2
                "
              >

                {params.location && (
                  <ResultChip
                    icon="ph-map-pin"
                    text={
                      params.location
                    }
                    primary
                  />
                )}

                <ResultChip
                  icon="ph-calendar"
                  text={
                    formatDateRangeVi(
                      params.checkIn,
                      params.checkOut,
                      ' - '
                    )
                  }
                />

                <ResultChip
                  icon="ph-users"
                  text={`${params.guests} khách`}
                />

              </div>

            </div>

            {/* SORT */}

            <div
              className="
                w-full
                shrink-0
                md:w-[245px]
              "
            >

              <Select
                label="Sắp xếp theo"
                value={
                  params.sort
                }
                onChange={(
                  event
                ) =>
                  updateParams({
                    sort:
                      event.target
                        .value,
                  })
                }
              >

                <option value="price_asc">
                  Giá thấp đến cao
                </option>

                <option value="price_desc">
                  Giá cao đến thấp
                </option>

                <option value="star_desc">
                  Hạng sao cao nhất
                </option>

                <option value="newest">
                  Mới nhất
                </option>

              </Select>

            </div>

          </div>

          {/* =================================================
              LOADING
          ================================================= */}

          {query.isLoading ? (

            <HotelCardSkeletons />

          ) : query.isError ? (

            /* ===============================================
                ERROR
            =============================================== */

            <div
              role="alert"
              className="
                rounded-[22px]
                border
                border-danger/30
                bg-danger-light
                px-6
                py-14
                text-center
                text-sm
                text-danger-ink
              "
            >

              <div
                className="
                  mx-auto
                  mb-3
                  grid
                  h-12
                  w-12
                  place-items-center
                  rounded-full
                  bg-white
                  shadow-sm
                "
              >
                <i
                  className="
                    ph
                    ph-warning-circle
                    text-2xl
                  "
                />
              </div>

              {query.error instanceof
              ApiError
                ? query.error
                    .message
                : 'Không thể tải danh sách khách sạn'}

            </div>

          ) : query.data &&
            query.data.items.length ===
              0 ? (

            /* ===============================================
                EMPTY
            =============================================== */

            <div
              className="
                overflow-hidden
                rounded-[22px]
                border
                border-slate-200
                bg-white
                shadow-sm
              "
            >

              <EmptyState
                icon="magnifying-glass-minus"
                title="Không tìm thấy khách sạn phù hợp"
                description="Hãy thử thay đổi tiêu chí tìm kiếm hoặc xóa các bộ lọc để xem thêm kết quả."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      resetFilters
                    }
                  >
                    Xóa bộ lọc
                  </Button>
                }
              />

            </div>

          ) : (

            /* ===============================================
                HOTEL LIST
            =============================================== */

            <div className="space-y-4">

              {query.data?.items.map(
                (hotel) => (
                  <HotelCard
                    key={
                      hotel.MaKhachSan
                    }
                    hotel={
                      hotel
                    }
                    search={
                      `checkIn=${params.checkIn}` +
                      `&checkOut=${params.checkOut}` +
                      `&guests=${params.guests}`
                    }
                  />
                )
              )}

            </div>

          )}

          {/* =================================================
              PAGINATION
          ================================================= */}

          {query.data &&
            query.data.pagination
              .totalPages > 1 && (

              <div
                className="
                  flex
                  justify-center
                  pb-6
                  pt-4
                "
              >

                <nav
                  aria-label="Phân trang kết quả"
                  className="
                    inline-flex
                    items-center
                    gap-1
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    p-1.5
                    shadow-sm
                  "
                >

                  {/* PREVIOUS */}

                  <button
                    type="button"
                    aria-label="Trang trước"
                    disabled={
                      params.page <=
                      1
                    }
                    onClick={() =>
                      updateParams(
                        {
                          page:
                            String(
                              params.page -
                                1
                            ),
                        },
                        false
                      )
                    }
                    className="
                      grid
                      h-9
                      w-9
                      place-items-center
                      rounded-xl
                      text-slate-600
                      transition
                      hover:bg-slate-100
                      disabled:cursor-not-allowed
                      disabled:opacity-30
                    "
                  >
                    <Icon
                      name="caret-left"
                      weight="bold"
                    />
                  </button>

                  {/* CURRENT */}

                  <span
                    aria-current="page"
                    className="
                      grid
                      h-9
                      min-w-9
                      place-items-center
                      rounded-xl
                      bg-primary
                      px-3
                      text-sm
                      font-bold
                      text-white
                    "
                  >
                    {params.page}
                  </span>

                  {/* TOTAL */}

                  <span
                    className="
                      px-2
                      text-xs
                      font-medium
                      text-slate-400
                    "
                  >
                    /{' '}
                    {
                      query.data
                        .pagination
                        .totalPages
                    }
                  </span>

                  {/* NEXT */}

                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={
                      params.page >=
                      query.data
                        .pagination
                        .totalPages
                    }
                    onClick={() =>
                      updateParams(
                        {
                          page:
                            String(
                              params.page +
                                1
                            ),
                        },
                        false
                      )
                    }
                    className="
                      grid
                      h-9
                      w-9
                      place-items-center
                      rounded-xl
                      text-slate-600
                      transition
                      hover:bg-slate-100
                      disabled:cursor-not-allowed
                      disabled:opacity-30
                    "
                  >
                    <Icon
                      name="caret-right"
                      weight="bold"
                    />
                  </button>

                </nav>

              </div>

            )}

        </section>

      </div>

    </div>
  );
}

/* =========================================================
   HERO CHIP
========================================================= */

function HeroChip({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <div
      className="
        inline-flex
        items-center
        gap-2
        rounded-full
        border
        border-white/15
        bg-[#061a2d]/35
        px-3
        py-2
        text-[11px]
        font-semibold
        text-white/90
        backdrop-blur-md
      "
    >

      <i
        className={`
          ph
          ${icon}
          text-cyan-200
        `}
      />

      {text}

    </div>
  );
}

/* =========================================================
   RESULT CHIP
========================================================= */

function ResultChip({
  icon,
  text,
  primary = false,
}: {
  icon: string;
  text: string;
  primary?: boolean;
}) {
  return (
    <span
      className={`
        inline-flex
        items-center
        gap-1.5
        rounded-full
        px-3
        py-1.5
        text-xs
        font-semibold

        ${
          primary
            ? 'bg-blue-50 text-primary'
            : 'bg-slate-100 text-slate-600'
        }
      `}
    >

      <i
        className={`
          ph
          ${icon}
        `}
      />

      {text}

    </span>
  );
}

/* =========================================================
   SKELETON
========================================================= */

function HotelCardSkeletons() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="space-y-4"
    >

      <span className="sr-only">
        Đang tải danh sách khách sạn...
      </span>

      {Array.from(
        {
          length: 4,
        },
        (_, index) => (
          <Skeleton
            key={index}
            className="
              h-44
              w-full
              rounded-[22px]
            "
          />
        )
      )}

    </div>
  );
}