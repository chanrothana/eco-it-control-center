import React from "react";

type CalendarGridDay = {
  ymd: string;
  day: number;
  weekday: number;
  inMonth: boolean;
  hasItems: boolean;
  holidayName?: string;
  holidayType?: string;
  itemCount?: number;
};

type CalendarGridTemplateProps = {
  weekdayLabels: string[];
  days: CalendarGridDay[];
  selectedDate: string;
  todayYmd: string;
  isPhoneView?: boolean;
  onSelectDate: (ymd: string) => void;
  renderHolidayTag?: (day: CalendarGridDay) => React.ReactNode;
  headKeyPrefix?: string;
  dayKeyPrefix?: string;
};

export default function CalendarGridTemplate({
  weekdayLabels,
  days,
  selectedDate,
  todayYmd,
  isPhoneView = false,
  onSelectDate,
  renderHolidayTag,
  headKeyPrefix = "calendar-head",
  dayKeyPrefix = "calendar-day",
}: CalendarGridTemplateProps) {
  return (
    <div className={`calendar-grid ${isPhoneView ? "calendar-mobile-fit" : ""}`}>
      {weekdayLabels.map((label, idx) => (
        <div
          key={`${headKeyPrefix}-${label}-${idx}`}
          className={`calendar-day calendar-head ${idx === 0 || idx === 6 ? "calendar-head-weekend" : ""}`}
        >
          {label}
        </div>
      ))}
      {days.map((day) => (
        <button
          key={`${dayKeyPrefix}-${day.ymd}`}
          className={`calendar-day ${day.inMonth ? "" : "calendar-out"} ${day.hasItems ? "calendar-has" : ""} ${selectedDate === day.ymd ? "calendar-selected" : ""} ${day.ymd === todayYmd ? "calendar-today" : ""} ${day.weekday === 0 || day.weekday === 6 ? "calendar-weekend" : ""} ${day.holidayName ? "calendar-holiday" : ""} ${day.holidayType ? `calendar-holiday-${day.holidayType}` : ""} ${day.weekday <= 1 ? "calendar-popup-left" : day.weekday >= 5 ? "calendar-popup-right" : ""}`}
          onClick={() => onSelectDate(day.ymd)}
        >
          <span>{day.day}</span>
          {renderHolidayTag ? renderHolidayTag(day) : null}
          {day.hasItems ? <small>{Number(day.itemCount || 0)}</small> : null}
          {day.holidayName ? <div className="calendar-hover-popup">{day.holidayName}</div> : null}
        </button>
      ))}
    </div>
  );
}
