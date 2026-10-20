import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useSearchHotels } from '../../features/hotels/hooks';
import { useLocations } from '../../features/locations/hooks';

import {
  DEFAULT_GUESTS,
  defaultSearchDates,
} from '../../features/hotels/schemas';

import type {
  HotelSearchItem,
  LocationSummary,
} from '../../features/hotels/types';

import { TravelSearchBar } from '../../components/hotels/TravelSearchBar';
import { Reveal } from '../../components/common/Reveal';

import {
  formatCurrencyVND,
  formatDateRangeVi,
} from '../../lib/utils';

import { PageSpinner } from '../../components/common/PageSpinner';

export default function HomePage() {
  const navigate = useNavigate();

  const defaults = useMemo(
    () => defaultSearchDates(),
    []
  );

  /* Khách sạn nổi bật */

  const featured = useSearchHotels({
    checkIn: defaults.checkIn,
    checkOut: defaults.checkOut,
    guests: DEFAULT_GUESTS,
    page: 1,
    limit: 4,
    sort: 'star_desc',
  });

  /* Địa điểm */

  const locations = useLocations();

  const destinations = (locations.data ?? [])
    .filter(
      (location) =>
        location.SoKhachSan > 0
    )
    .sort(
      (a, b) =>
        b.SoKhachSan -
        a.SoKhachSan
    );

  const totalHotels =
    featured.data?.pagination.total;

  /* Tìm kiếm */

  const handleSearch = (values: {
    location?: string;
    checkIn: string;
    checkOut: string;
    guests: number;
  }) => {
    const params = new URLSearchParams({
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests: String(values.guests),
    });

    if (values.location?.trim()) {
      params.set(
        'location',
        values.location.trim()
      );
    }

    navigate(
      `/hotels?${params.toString()}`
    );
  };

  const searchParams =
    `checkIn=${defaults.checkIn}` +
    `&checkOut=${defaults.checkOut}` +
    `&guests=${DEFAULT_GUESTS}`;

  return (
    <div className="booking-flow egode-home">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="egode-home-hero">

        {/* Ảnh và lớp phủ nằm sau nội dung */}
        <div className="egode-home-hero__backdrop" aria-hidden="true">
          <div className="egode-home-hero__bg" />
        </div>

        <div className="egode-home-hero__inner">

          {/* =================================================
              HERO CONTENT
          ================================================= */}

          <div className="egode-home-hero__copy">

            <div className="egode-home-hero__badge">
              <i className="ph ph-buildings" />

              <span>
                EGODE · KHÁM PHÁ CHỖ NGHỈ
              </span>
            </div>

            <h1>
              Đi đâu cũng được,

              <span>
                Egode lo chỗ nghỉ.
              </span>
            </h1>

            <p className="egode-home-hero__description">
              Tìm kiếm khách sạn phù hợp với điểm đến,
              ngày lưu trú và số lượng khách chỉ trong
              vài thao tác.
            </p>

            {/* =================================================
                HERO STATS
            ================================================= */}

            <div className="egode-home-hero__stats">

              {totalHotels !== undefined && (
                <div>
                  <i className="ph ph-buildings" />

                  <span>
                    <strong>
                      {totalHotels}
                    </strong>{' '}
                    khách sạn
                  </span>
                </div>
              )}

              {destinations.length > 0 && (
                <div>
                  <i className="ph ph-map-pin" />

                  <span>
                    <strong>
                      {destinations.length}
                    </strong>{' '}
                    điểm đến
                  </span>
                </div>
              )}

              <div>
                <i className="ph ph-magnifying-glass" />

                <span>
                  Tìm kiếm nhanh chóng
                </span>
              </div>

            </div>
          </div>

          {/* =================================================
              SEARCH BOX
          ================================================= */}

          <div className="egode-home-search">

            <div className="egode-home-search__heading">

              <div>
                <span>
                  TÌM CHỖ NGHỈ
                </span>

                <h2>
                  Bạn muốn đi đâu?
                </h2>
              </div>

              <div className="egode-home-search__hint">
                <i className="ph ph-shield-check" />

                Đặt phòng dễ dàng
              </div>

            </div>

            <TravelSearchBar
              variant="expanded"
              currentSearch={{
                checkIn: defaults.checkIn,
                checkOut: defaults.checkOut,
                guests: DEFAULT_GUESTS,
              }}
              onSearch={handleSearch}
            />

          </div>

        </div>
      </section>

      {/* =====================================================
          BENEFITS
      ===================================================== */}

      <Reveal as="section" className="egode-benefits">

        <div className="egode-home-container">

          <div className="egode-benefits__grid">

            <BenefitCard
              icon="ph-magnifying-glass"
              title="Tìm kiếm dễ dàng"
              description="Tìm khách sạn theo địa điểm, ngày lưu trú và số khách."
            />

            <BenefitCard
              icon="ph-wallet"
              title="Giá rõ ràng"
              description="Xem mức giá phòng trước khi chọn khách sạn phù hợp."
            />

            <BenefitCard
              icon="ph-shield-check"
              title="Đặt phòng an tâm"
              description="Thông tin đặt phòng được quản lý ngay trong tài khoản Egode."
            />

            <BenefitCard
              icon="ph-headset"
              title="Luôn có hỗ trợ"
              description="Truy cập mục hỗ trợ khi cần giải đáp trong quá trình đặt phòng."
            />

          </div>

        </div>

      </Reveal>

      {/* =====================================================
          POPULAR DESTINATIONS
      ===================================================== */}

      <Reveal as="section"
        className="egode-home-section"
        aria-labelledby="home-destinations-title"
      >
        <div className="egode-home-container">

          <SectionHeader
            eyebrow="KHÁM PHÁ"
            title="Điểm đến phổ biến"
            description="Những địa phương đang có nhiều khách sạn trên Egode."
          />

          {locations.isLoading ? (
            <PageSpinner
              label="Đang tải điểm đến..."
              className="py-12"
            />
          ) : locations.isError ? (
            <p
              role="alert"
              className="egode-home-message"
            >
              Không thể tải danh sách điểm đến.
            </p>
          ) : destinations.length === 0 ? (
            <p className="egode-home-message">
              Chưa có điểm đến nào có khách sạn đang hoạt động.
            </p>
          ) : (
            <div className="egode-destination-grid">

              {destinations
                .slice(0, 4)
                .map((destination) => (
                  <DestinationCard
                    key={
                      destination.MaDiaPhuong
                    }
                    destination={
                      destination
                    }
                  />
                ))}

            </div>
          )}

        </div>
      </Reveal>

      {/* =====================================================
          FEATURED HOTELS
      ===================================================== */}

      <Reveal as="section"
        id="deals"
        className="
          egode-home-section
          egode-home-section--soft
        "
        aria-labelledby="home-featured-title"
      >
        <div className="egode-home-container">

          <div className="egode-section-heading egode-section-heading--row">

            <div>

              <span className="egode-section-heading__eyebrow">
                GỢI Ý CHO BẠN
              </span>

              <h2 id="home-featured-title">
                Khách sạn nổi bật
              </h2>

              <p>
                Những khách sạn có hạng sao cao cho ngày{' '}

                {formatDateRangeVi(
                  defaults.checkIn,
                  defaults.checkOut,
                  ' → '
                )}
              </p>

            </div>

            <Link
              to="/hotels"
              className="egode-section-heading__link"
            >
              Xem tất cả

              <i className="ph ph-arrow-right" />
            </Link>

          </div>

          {featured.isLoading ? (
            <PageSpinner
              label="Đang tải khách sạn nổi bật..."
              className="py-12"
            />
          ) : featured.isError ? (
            <p
              role="alert"
              className="egode-home-message"
            >
              Không thể tải danh sách khách sạn.
            </p>
          ) : !featured.data?.items.length ? (
            <p className="egode-home-message">
              Chưa có khách sạn nào đang nhận đặt phòng.
            </p>
          ) : (
            <div className="egode-featured-grid">

              {featured.data.items.map(
                (hotel) => (
                  <FeaturedHotelCard
                    key={
                      hotel.MaKhachSan
                    }
                    hotel={hotel}
                    search={searchParams}
                  />
                )
              )}

            </div>
          )}

        </div>
      </Reveal>

      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <Reveal as="section" className="egode-home-cta">
        <div className="egode-home-container">
          <div
            className="relative overflow-hidden rounded-[24px] border border-[#C7DCF5] px-6 py-8 sm:px-8 md:px-10 lg:px-12 lg:py-10"
            style={{
              minHeight: '290px',
              backgroundColor: '#F5F9FF',
              backgroundImage: `
                linear-gradient(
                  90deg,
                  rgba(248, 251, 255, 0.99) 0%,
                  rgba(248, 251, 255, 0.97) 36%,
                  rgba(248, 251, 255, 0.88) 48%,
                  rgba(248, 251, 255, 0.48) 60%,
                  rgba(248, 251, 255, 0.10) 72%,
                  rgba(248, 251, 255, 0) 100%
                ),
                url('/egode-travel-cta.png')
              `,
              backgroundSize: '100% 100%, auto 100%',
              backgroundPosition: 'center, right center',
              backgroundRepeat: 'no-repeat, no-repeat',
              boxShadow: '0 12px 30px rgba(67, 105, 150, 0.08)',
            }}
          >
            <div className="relative z-10 flex min-h-[210px] max-w-[590px] flex-col justify-center">
              <h2 className="m-0 text-[26px] font-extrabold leading-[1.2] text-[#173B63] sm:text-[28px] md:text-[30px]">
                Sẵn sàng cho chuyến đi tiếp theo?
              </h2>

              <p className="mt-2.5 max-w-[560px] text-[15px] leading-6 text-[#526B84] sm:text-[16px]">
                Chọn điểm đến, ngày lưu trú và bắt đầu tìm khách sạn phù hợp trên Egode.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] font-semibold text-[#49627B]">
                <span className="inline-flex items-center gap-2">
                  <i className="ph-fill ph-tag text-[16px] text-[#3478F6]" aria-hidden="true" />
                  Ưu đãi tốt
                </span>

                <span className="inline-flex items-center gap-2">
                  <i className="ph-fill ph-lightning text-[16px] text-[#18A957]" aria-hidden="true" />
                  Đặt nhanh
                </span>

                <span className="inline-flex items-center gap-2">
                  <i className="ph-fill ph-map-pin text-[16px] text-[#8B5CF6]" aria-hidden="true" />
                  Điểm đến đa dạng
                </span>
              </div>

              <Link
                to="/hotels"
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-[12px] bg-[#2F6FE4] px-6 py-3 text-[15px] font-bold !text-white no-underline shadow-[0_8px_20px_rgba(47,111,228,0.22)] transition hover:bg-[#245FC8] hover:!text-white"
                style={{
                  color: '#FFFFFF',
                  WebkitTextFillColor: '#FFFFFF',
                }}
              >
                <span
                  style={{
                    color: '#FFFFFF',
                    WebkitTextFillColor: '#FFFFFF',
                  }}
                >
                  Khám phá khách sạn
                </span>
                <i
                  className="ph ph-arrow-right text-[17px] !text-white"
                  aria-hidden="true"
                  style={{
                    color: '#FFFFFF',
                    WebkitTextFillColor: '#FFFFFF',
                  }}
                />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

    </div>
  );
}

/* Tiêu đề mục */

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="egode-section-heading">

      <span className="egode-section-heading__eyebrow">
        {eyebrow}
      </span>

      <h2>
        {title}
      </h2>

      <p>
        {description}
      </p>

    </div>
  );
}

/* Thẻ lợi ích */

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <article className="egode-benefit-card">

      <div className="egode-benefit-card__icon">
        <i
          className={`ph ${icon}`}
        />
      </div>

      <div>

        <h3>
          {title}
        </h3>

        <p>
          {description}
        </p>

      </div>

    </article>
  );
}

/* Thẻ điểm đến */

function DestinationCard({
  destination,
}: {
  destination: LocationSummary;
}) {
  return (
    <Link
      to={`/hotels?location=${encodeURIComponent(
        destination.TenThanhPho
      )}`}
      className="egode-destination-card"
    >

      {destination.AnhDaiDien ? (
        <img
          src={
            destination.AnhDaiDien
          }
          alt={
            destination.TenThanhPho
          }
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="egode-destination-card__fallback">

          <i className="ph ph-map-pin" />

        </div>
      )}

      <div className="egode-destination-card__overlay" />

      <div className="egode-destination-card__content">

        <span>
          ĐIỂM ĐẾN
        </span>

        <h3>
          {destination.TenThanhPho}
        </h3>

        <p>
          {destination.SoKhachSan}{' '}
          khách sạn
        </p>

        <div className="egode-destination-card__arrow">

          <i className="ph ph-arrow-up-right" />

        </div>

      </div>

    </Link>
  );
}

/* Thẻ khách sạn nổi bật */

function FeaturedHotelCard({
  hotel,
  search,
}: {
  hotel: HotelSearchItem;
  search: string;
}) {
  const detailUrl =
    `/hotels/${hotel.MaKhachSan}?${search}`;

  return (
    <article className="egode-stay-card">

      {/* Ảnh */}

      <Link
        to={detailUrl}
        className="egode-stay-card__media"
        aria-label={`Xem phòng tại ${hotel.TenKhachSan}`}
      >

        {hotel.AnhDaiDien ? (
          <img
            src={
              hotel.AnhDaiDien
            }
            alt={
              hotel.TenKhachSan
            }
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="egode-stay-card__fallback">

            <i className="ph ph-image" />

          </div>
        )}

        {/* Số sao */}

        {hotel.HangSao > 0 && (
          <div className="egode-stay-card__rating">

            <i className="ph-fill ph-star" />

            {hotel.HangSao} sao

          </div>
        )}

      </Link>

      {/* Nội dung */}

      <div className="egode-stay-card__body">

        {/* Vị trí */}

        <div className="egode-stay-card__location">

          <i className="ph ph-map-pin" />

          {
            hotel.DiaPhuong
              .TenThanhPho
          }

        </div>

        {/* Tên */}

        <h3>

          <Link to={detailUrl}>
            {
              hotel.TenKhachSan
            }
          </Link>

        </h3>

        {/* Giá */}

        <div className="egode-stay-card__footer">

          <div>

            <span>
              Giá từ / đêm
            </span>

            {hotel.GiaTuDauTu !== null ? (
              <strong>
                {formatCurrencyVND(
                  hotel.GiaTuDauTu
                )}
              </strong>
            ) : (
              <strong>
                Liên hệ
              </strong>
            )}

          </div>

          <Link
            to={detailUrl}
            className="egode-stay-card__action"
            aria-label={`Xem phòng tại ${hotel.TenKhachSan}`}
          >

            <i className="ph ph-arrow-right" />

          </Link>

        </div>

        {/* Tình trạng còn phòng */}

        <div
          className={`
            egode-stay-card__availability

            ${
              hotel.ConPhong
                ? 'is-available'
                : 'is-unavailable'
            }
          `}
        >

          <span />

          {hotel.ConPhong
            ? 'Còn phòng'
            : 'Hết phòng theo ngày đã chọn'}

        </div>

      </div>

    </article>
  );
}