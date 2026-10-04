import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../common/Icon';
import { searchFormSchema, type SearchFormValues } from '../../features/hotels/schemas';
import { useLocations } from '../../features/locations/hooks';
import { formatDateRangeVi, formatDateVi } from '../../lib/utils';
import { businessToday, latestCheckIn, MAX_NIGHTS } from '../../lib/stayDates';
import { DateRangePicker } from '../common/DateRangePicker';
import { Combobox } from '../common/Combobox';
import { GuestPicker } from '../common/GuestPicker';

export type TravelSearchCriteria = SearchFormValues;
export type TravelSearchEditor = 'destination' | 'dates' | 'guests' | null;

interface TravelSearchBarProps {
  currentSearch: TravelSearchCriteria;
  onSearch: (values: TravelSearchCriteria) => void;
  variant?: 'expanded' | 'compact' | 'stay';
  loading?: boolean;
}

const editorLabels: Record<Exclude<TravelSearchEditor, null>, string> = {
  destination: 'Điểm đến',
  dates: 'Ngày lưu trú',
  guests: 'Số khách',
};

export function TravelSearchBar({ currentSearch, onSearch, variant = 'compact', loading = false }: TravelSearchBarProps) {
  const [draftSearch, setDraftSearch] = useState<TravelSearchCriteria>(currentSearch);
  const [activeEditor, setActiveEditor] = useState<TravelSearchEditor>(null);
  const [dateError, setDateError] = useState('');
  const rootRef = useRef<HTMLFormElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const id = useId();
  const isStay = variant === 'stay';
  const locations = useLocations(!isStay);
  const today = businessToday();
  const destinationOptions = (locations.data ?? []).map((item) => ({ value: item.TenThanhPho, label: item.TenThanhPho }));
  if (draftSearch.location && !destinationOptions.some((item) => item.value === draftSearch.location)) {
    destinationOptions.unshift({ value: draftSearch.location, label: draftSearch.location });
  }

  const { location: currentLocation, checkIn: currentCheckIn, checkOut: currentCheckOut, guests: currentGuests } = currentSearch;

  useEffect(() => {
    setDraftSearch({ location: currentLocation, checkIn: currentCheckIn, checkOut: currentCheckOut, guests: currentGuests });
    setDateError('');
    setActiveEditor(null);
  }, [currentLocation, currentCheckIn, currentCheckOut, currentGuests]);

  useEffect(() => {
    if (!activeEditor) return;
    requestAnimationFrame(() => {
      if (activeEditor === 'destination') rootRef.current?.querySelector<HTMLInputElement>('.ui-combobox input')?.focus();
      if (activeEditor === 'dates') rootRef.current?.querySelector<HTMLButtonElement>('.travel-search__date-fields .rdp-day button:not(:disabled)')?.focus();
    });
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setActiveEditor(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        const trigger = triggerRefs.current[activeEditor];
        setActiveEditor(null);
        trigger?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [activeEditor]);

  const openEditor = (editor: Exclude<TravelSearchEditor, null>) => {
    setDateError('');
    setActiveEditor((current) => current === editor ? null : editor);
  };

  const updateDraft = (patch: Partial<TravelSearchCriteria>) => {
    setDraftSearch((current) => ({ ...current, ...patch }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = searchFormSchema.safeParse(draftSearch);
    if (!parsed.success) {
      const dateIssue = parsed.error.issues.find((issue) => issue.path.includes('checkIn') || issue.path.includes('checkOut'));
      setDateError(dateIssue?.message ?? 'Vui lòng kiểm tra ngày lưu trú.');
      setActiveEditor(dateIssue ? 'dates' : 'guests');
      return;
    }
    setActiveEditor(null);
    setDateError('');
    onSearch({ ...parsed.data, location: parsed.data.location?.trim() || undefined });
  };

  const dateSummary = draftSearch.checkIn && draftSearch.checkOut
    ? formatDateRangeVi(draftSearch.checkIn, draftSearch.checkOut)
    : 'Chọn ngày';
  const editor = activeEditor && <div className={`travel-search__editor travel-search__editor--${activeEditor}`} role="dialog" aria-label={`Chỉnh sửa ${editorLabels[activeEditor]}`}>
    <div className="travel-search__editor-heading">
      <strong>{editorLabels[activeEditor]}</strong>
      <button type="button" className="travel-search__close" aria-label="Đóng" onClick={() => { setActiveEditor(null); triggerRefs.current[activeEditor]?.focus(); }}>×</button>
    </div>
    {activeEditor === 'destination' && <Combobox
      id={`${id}-destination`}
      label="Điểm đến"
      value={draftSearch.location ?? ''}
      options={destinationOptions}
      placeholder="Thành phố, tỉnh..."
      allowCustomValue
      onValueChange={(location) => updateDraft({ location })}
      onInputChange={(location) => updateDraft({ location })}
      onSelect={() => {
        setActiveEditor(null);
        requestAnimationFrame(() => triggerRefs.current.destination?.focus());
      }}
    />}
    {activeEditor === 'dates' && <div className="travel-search__date-fields">
      <DateRangePicker
        value={{ from: draftSearch.checkIn, to: draftSearch.checkOut }}
        min={today}
        maxCheckIn={latestCheckIn()}
        maxNights={MAX_NIGHTS}
        onChange={({ from, to }) => { updateDraft({ checkIn: from, checkOut: to }); setDateError(''); }}
      />
      <p className="travel-search__hint" aria-live="polite">
        Nhận phòng: <strong>{draftSearch.checkIn ? formatDateVi(draftSearch.checkIn) : 'chưa chọn'}</strong>
        {' · '}Trả phòng: <strong>{draftSearch.checkOut ? formatDateVi(draftSearch.checkOut) : 'chưa chọn'}</strong>
        {' · '}Tối đa {MAX_NIGHTS} đêm
      </p>
      {dateError && <p className="travel-search__error" role="alert">{dateError}</p>}
    </div>}
    {activeEditor === 'guests' && <div className="travel-search__guest-editor">
      <GuestPicker variant="panel" label="Số khách" value={Number(draftSearch.guests) || 1} open onOpenChange={(open) => { if (!open) setActiveEditor(null); }} onChange={(guests) => updateDraft({ guests })} />
      <p className="travel-search__hint">Từ 1 đến 50 khách</p>
    </div>}
    <button type="button" className="travel-search__done" onClick={() => { setActiveEditor(null); triggerRefs.current[activeEditor]?.focus(); }}>Xong</button>
  </div>;

  return <form ref={rootRef} className={`travel-search travel-search--${variant}`} onSubmit={submit} noValidate aria-busy={loading}>
    <div className="travel-search__segments">
      {!isStay && <div className="travel-search__segment-wrap">
        <button ref={(node) => { triggerRefs.current.destination = node; }} type="button" className={`travel-search__segment ${activeEditor === 'destination' ? 'is-active' : ''}`} aria-expanded={activeEditor === 'destination'} aria-controls={`${id}-destination-editor`} onClick={() => openEditor('destination')}>
          <span className="travel-search__segment-label">Điểm đến</span><span className="travel-search__segment-value">{draftSearch.location?.trim() || 'Tất cả địa điểm'}</span>
        </button>
        {activeEditor === 'destination' && <div id={`${id}-destination-editor`}>{editor}</div>}
      </div>}
      <div className="travel-search__segment-wrap">
        <button ref={(node) => { triggerRefs.current.dates = node; }} type="button" className={`travel-search__segment ${activeEditor === 'dates' ? 'is-active' : ''}`} aria-expanded={activeEditor === 'dates'} aria-controls={`${id}-dates-editor`} onClick={() => openEditor('dates')}>
          <span className="travel-search__segment-label">{isStay ? 'Nhận & trả phòng' : 'Ngày lưu trú'}</span><span className="travel-search__segment-value">{dateSummary}</span>
        </button>
        {activeEditor === 'dates' && <div id={`${id}-dates-editor`}>{editor}</div>}
      </div>
      <div className="travel-search__segment-wrap">
        <button ref={(node) => { triggerRefs.current.guests = node; }} type="button" className={`travel-search__segment ${activeEditor === 'guests' ? 'is-active' : ''}`} aria-expanded={activeEditor === 'guests'} aria-controls={`${id}-guests-editor`} onClick={() => openEditor('guests')}>
          <span className="travel-search__segment-label">Số khách</span><span className="travel-search__segment-value">{draftSearch.guests} khách</span>
        </button>
        {activeEditor === 'guests' && <div id={`${id}-guests-editor`}>{editor}</div>}
      </div>
    </div>
    <button type="submit" className="travel-search__submit" disabled={loading}>
      <Icon name="magnifying-glass" size={18} />
      <span>{loading ? 'Đang tìm...' : isStay ? 'Kiểm tra phòng' : 'Tìm kiếm'}</span>
    </button>
    {activeEditor && <button type="button" className="travel-search__backdrop" aria-label="Đóng trình chỉnh sửa" onClick={() => setActiveEditor(null)} />}
  </form>;
}
