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

  /* =========================================================
     FEATURED HOTELS
  ========================================================= */

  const featured = useSearchHotels({
    checkIn: defaults.checkIn,
    checkOut: defaults.checkOut,
    guests: DEFAULT_GUESTS,
    page: 1,
    limit: 4,
    sort: 'star_desc',
  });

  /* =========================================================
     LOCATIONS
  ========================================================= */

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

  /* =========================================================
     SEARCH
  ========================================================= */

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

      <section
        className="egode-home-hero"
        style={{
          backgroundImage: `
            linear-gradient(
              90deg,
              rgba(7, 22, 42, 0.88) 0%,
              rgba(8, 39, 67, 0.62) 45%,
              rgba(8, 39, 67, 0.18) 100%
            ),
            url('/home.jpg')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
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

      <section className="egode-benefits">

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

      </section>

      {/* =====================================================
          POPULAR DESTINATIONS
      ===================================================== */}

      <section
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
      </section>

      {/* =====================================================
          FEATURED HOTELS
      ===================================================== */}

      <section
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
      </section>

      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <section className="egode-home-cta">
        <div className="egode-home-container">
          <div className="egode-home-cta__content">
            <div className="egode-home-cta__copy">
              <h2>Sẵn sàng cho chuyến đi tiếp theo?</h2>
              <p>Chọn điểm đến, ngày lưu trú và bắt đầu tìm khách sạn trên Egode.</p>
            </div>
            <Link to="/hotels" className="egode-home-cta__button">
              Khám phá khách sạn
              <i className="ph ph-arrow-right" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

/* =========================================================
   SECTION HEADER
========================================================= */

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

/* =========================================================
   BENEFIT CARD
========================================================= */

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

/* =========================================================
   DESTINATION CARD
========================================================= */

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

/* =========================================================
   FEATURED HOTEL CARD
========================================================= */

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

      {/* IMAGE */}

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

        {/* STAR */}

        {hotel.HangSao > 0 && (
          <div className="egode-stay-card__rating">

            <i className="ph-fill ph-star" />

            {hotel.HangSao} sao

          </div>
        )}

      </Link>

      {/* BODY */}

      <div className="egode-stay-card__body">

        {/* LOCATION */}

        <div className="egode-stay-card__location">

          <i className="ph ph-map-pin" />

          {
            hotel.DiaPhuong
              .TenThanhPho
          }

        </div>

        {/* NAME */}

        <h3>

          <Link to={detailUrl}>
            {
              hotel.TenKhachSan
            }
          </Link>

        </h3>

        {/* PRICE */}

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

        {/* AVAILABILITY */}

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