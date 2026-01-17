import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from './button';

function Calendar({
  mode = 'single',
  selected,
  onSelect,
  disabled,
  className,
  classNames = {},
}) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date());

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          className="h-7 w-7"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          className="h-7 w-7"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-slate-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const isSelected = selected && isSameDay(day, selected);
        const isDisabled = disabled ? disabled(day) : false;
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isTodayDate = isToday(day);

        days.push(
          <button
            key={day.toString()}
            onClick={() => {
              if (!isDisabled && onSelect) {
                onSelect(cloneDay);
              }
            }}
            disabled={isDisabled}
            className={cn(
              'h-9 w-9 p-0 font-normal text-sm rounded-md transition-colors',
              !isCurrentMonth && 'text-slate-300',
              isCurrentMonth && !isSelected && 'hover:bg-slate-100',
              isSelected && (classNames.day_selected || 'bg-halo-pink text-white hover:bg-halo-pink'),
              isTodayDate && !isSelected && (classNames.day_today || 'bg-slate-100 text-slate-900'),
              isDisabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
            )}
          >
            {format(day, 'd')}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-1">
          {days}
        </div>
      );
      days = [];
    }
    return <div className="space-y-1">{rows}</div>;
  };

  return (
    <div className={cn('p-3', className)}>
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
}

export { Calendar };
