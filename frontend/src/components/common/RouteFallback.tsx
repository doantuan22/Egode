/** Màn hình chờ khi mã trang đang tải ở lần truy cập đầu */
export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="route-fallback">
      <span className="sr-only">Đang tải trang...</span>
      <div className="route-fallback__body" aria-hidden="true">
        <div className="route-fallback__title" />
        <div className="route-fallback__line" />
        <div className="route-fallback__line route-fallback__line--short" />
        <div className="route-fallback__grid">
          <div /><div /><div />
        </div>
      </div>
    </div>
  );
}
