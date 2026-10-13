/**
 * What shows inside the layout when a page's code is still being fetched and there is no page on screen yet (the first
 * visit). Later navigations keep the old page until the next one is ready, so they never come through here.
 */
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
