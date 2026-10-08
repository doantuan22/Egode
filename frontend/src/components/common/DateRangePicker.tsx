import { useState } from 'react';

import { DayPicker } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';

import 'react-day-picker/style.css';

import {
  fromDateInputValue,
  toDateInputValue,
} from '../../lib/utils';

import { useMediaQuery } from '../../hooks/useMediaQuery';

export interface DateRangeValue {
  /** YYYY-MM-DD */
  from: string;

  /** YYYY-MM-DD */
  to: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;

  onChange: (
    value: DateRangeValue
  ) => void;

  /** YYYY-MM-DD */
  min?: string;
}

/* =========================================================
   HELPERS
========================================================= */

function isSameDay(
  a?: Date,
  b?: Date
) {
  if (
    !a ||
    !b
  ) {
    return false;
  }

  return (
    a.getFullYear() ===
      b.getFullYear() &&
    a.getMonth() ===
      b.getMonth() &&
    a.getDate() ===
      b.getDate()
  );
}

function isAfterDay(
  date: Date,
  target: Date
) {
  return (
    date.getTime() >
    target.getTime()
  );
}

function isBeforeDay(
  date: Date,
  target: Date
) {
  return (
    date.getTime() <
    target.getTime()
  );
}

function isBetween(
  date: Date,
  start?: Date,
  end?: Date
) {
  if (
    !start ||
    !end
  ) {
    return false;
  }

  return (
    date.getTime() >
      start.getTime() &&
    date.getTime() <
      end.getTime()
  );
}

/* =========================================================
   DATE RANGE PICKER
========================================================= */

export function DateRangePicker({
  value,
  onChange,
  min,
}: DateRangePickerProps) {
  /* =======================================================
     RESPONSIVE
  ======================================================= */

  const showTwoMonths =
    useMediaQuery(
      '(min-width: 768px)'
    );

  /* =======================================================
     STATE
  ======================================================= */

  const [
    hoveredDate,
    setHoveredDate,
  ] =
    useState<Date | undefined>(
      undefined
    );

  /* =======================================================
     VALUES
  ======================================================= */

  const checkInDate =
    fromDateInputValue(
      value.from
    );

  const checkOutDate =
    fromDateInputValue(
      value.to
    );

  const minDate =
    fromDateInputValue(
      min
    );

  /*
   * true:
   * đã có check-in,
   * đang chờ chọn checkout.
   */
  const selectingCheckOut =
    Boolean(
      checkInDate &&
      !checkOutDate
    );

  /*
   * Hover preview chỉ xuất hiện
   * khi đang chọn checkout và
   * hover vào ngày sau check-in.
   */
  const previewEnd =
    selectingCheckOut &&
    checkInDate &&
    hoveredDate &&
    isAfterDay(
      hoveredDate,
      checkInDate
    )
      ? hoveredDate
      : undefined;

  /* =======================================================
     SELECT DATE
  ======================================================= */

  const selectDay = (
    day: Date
  ) => {
    /*
     * Extra guard:
     * không cho ngày trước min.
     */
    if (
      minDate &&
      isBeforeDay(
        day,
        minDate
      )
    ) {
      return;
    }

    const iso =
      toDateInputValue(
        day
      );

    /* -------------------------------------------------------
       CASE 1

       Chưa có check-in
       hoặc đã chọn đủ range trước đó.

       => ngày vừa click là check-in mới.
    ------------------------------------------------------- */

    if (
      !checkInDate ||
      checkOutDate
    ) {
      onChange({
        from: iso,
        to: '',
      });

      setHoveredDate(
        undefined
      );

      return;
    }

    /* -------------------------------------------------------
       CASE 2

       Đang chờ checkout.
    ------------------------------------------------------- */

    /*
     * Bấm chính ngày check-in:
     * giữ nguyên.
     */
    if (
      isSameDay(
        day,
        checkInDate
      )
    ) {
      return;
    }

    /*
     * Bấm ngày trước check-in:
     *
     * không bỏ qua click.
     * ngày đó trở thành check-in mới.
     */
    if (
      isBeforeDay(
        day,
        checkInDate
      )
    ) {
      onChange({
        from: iso,
        to: '',
      });

      setHoveredDate(
        undefined
      );

      return;
    }

    /*
     * Bấm ngày sau check-in:
     * hoàn thành range.
     */
    onChange({
      from:
        value.from,

      to:
        iso,
    });

    setHoveredDate(
      undefined
    );
  };

  /* =======================================================
     MODIFIERS

     Không dùng mode="range".

     Ta tự đánh dấu từng trạng thái
     để tránh xung đột với logic
     range mặc định của DayPicker.
  ======================================================= */

  const modifiers = {
    checkIn: (
      day: Date
    ) =>
      isSameDay(
        day,
        checkInDate
      ),

    checkOut: (
      day: Date
    ) =>
      isSameDay(
        day,
        checkOutDate
      ),

    rangeMiddle: (
      day: Date
    ) =>
      isBetween(
        day,
        checkInDate,
        checkOutDate
      ),

    previewMiddle: (
      day: Date
    ) =>
      Boolean(
        selectingCheckOut &&
        previewEnd &&
        isBetween(
          day,
          checkInDate,
          previewEnd
        )
      ),

    previewEnd: (
      day: Date
    ) =>
      Boolean(
        previewEnd &&
        isSameDay(
          day,
          previewEnd
        )
      ),
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className="
        w-full

        select-none

        bg-white
      "
      onMouseLeave={() =>
        setHoveredDate(
          undefined
        )
      }
    >
      <DayPicker
        locale={
          vi
        }

        weekStartsOn={
          1
        }

        numberOfMonths={
          showTwoMonths
            ? 2
            : 1
        }

        pagedNavigation={
          showTwoMonths
        }

        /*
         * Không dùng mode="range".
         *
         * Selection được xử lý hoàn toàn
         * bằng selectDay().
         */
        onDayClick={
          selectDay
        }

        onDayMouseEnter={(
          day
        ) =>
          setHoveredDate(
            day
          )
        }

        modifiers={
          modifiers
        }

        disabled={
          minDate
            ? {
                before:
                  minDate,
              }
            : undefined
        }

        startMonth={
          minDate ??
          undefined
        }

        defaultMonth={
          checkInDate ??
          minDate ??
          new Date()
        }

        showOutsideDays={
          false
        }

        fixedWeeks

        animate

        className="egode-date-range !m-0 !w-full"

        /* =================================================
           CUSTOM MODIFIERS
        ================================================= */

        modifiersClassNames={{
          checkIn: 'egode-date-range__check-in',
          checkOut: 'egode-date-range__check-out',
          rangeMiddle: 'egode-date-range__middle',
          previewMiddle: 'egode-date-range__preview-middle',
          previewEnd: 'egode-date-range__preview-end',
        }}

        /* =================================================
           DAYPICKER CLASSES
        ================================================= */

        classNames={{
          /* ===============================================
             ROOT
          =============================================== */

          root: `
            relative

            !m-0

            w-full
          `,

          months: `
            flex
            flex-col

            gap-6

            md:flex-row
            md:gap-10
          `,

          month: `
            min-w-0

            flex-1
          `,

          /* ===============================================
             MONTH HEADER
          =============================================== */

          month_caption: `
            relative

            mb-3

            flex
            h-11

            items-center
            justify-center
          `,

          caption_label: `
            text-[15px]
            font-bold

            capitalize

            tracking-[-0.01em]

            text-slate-900
          `,

          /* ===============================================
             NAVIGATION
          =============================================== */

          nav: `
            absolute

            inset-x-0
            top-0

            z-20

            flex
            h-11

            items-center
            justify-between

            pointer-events-none
          `,

          button_previous: `
            pointer-events-auto

            grid

            h-9
            w-9

            place-items-center

            rounded-full

            border
            border-slate-200

            bg-white

            text-slate-600

            shadow-[0_2px_7px_rgba(15,23,42,0.08)]

            transition-all
            duration-200

            hover:
            border-blue-200

            hover:
            bg-blue-50

            hover:
            text-blue-600

            active:
            scale-95
          `,

          button_next: `
            pointer-events-auto

            ml-auto

            grid

            h-9
            w-9

            place-items-center

            rounded-full

            border
            border-slate-200

            bg-white

            text-slate-600

            shadow-[0_2px_7px_rgba(15,23,42,0.08)]

            transition-all
            duration-200

            hover:
            border-blue-200

            hover:
            bg-blue-50

            hover:
            text-blue-600

            active:
            scale-95
          `,

          chevron: `
            h-4
            w-4

            fill-current
          `,

          /* ===============================================
             TABLE
          =============================================== */

          month_grid: `
            w-full

            border-collapse
          `,

          weekdays: `
            grid
            grid-cols-7

            mb-1
          `,

          weekday: `
            flex

            h-8

            items-center
            justify-center

            text-[11px]
            font-semibold

            uppercase

            text-slate-400
          `,

          weeks: `
            block
          `,

          week: `
            grid
            grid-cols-7
          `,

          /* ===============================================
             DAY
          =============================================== */

          day: `
            relative

            flex

            h-[42px]

            items-center
            justify-center

            p-0
          `,

          day_button: `
            relative z-10 grid h-10 w-10 place-items-center
            rounded-full border-0 bg-transparent
            text-[13px] font-medium text-slate-700 outline-none
            transition-colors duration-150
            hover:bg-blue-50 hover:text-blue-700
            focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
          `,

          /* ===============================================
             TODAY
          =============================================== */

          today: `
            [&>button]:font-bold
            [&>button]:text-blue-600
          `,

          /* ===============================================
             DISABLED
          =============================================== */

          disabled: `
            opacity-25

            [&>button]:
            cursor-not-allowed

            [&>button]:
            text-slate-400

            [&>button:hover]:
            bg-transparent

            [&>button:hover]:
            text-slate-400

            [&>button:active]:
            scale-100
          `,

          outside: `
            opacity-25
          `,

          hidden: `
            invisible
          `,
        }}
      />
    </div>
  );
}