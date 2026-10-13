import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';

/**
 * Format date string 'YYYY-MM-DD' to 'DD/MM/YYYY'
 */
export function formatDateToDMY(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return dateStr;
}

/**
 * Helper to get YYYY-MM-DD from a Date object in local time
 */
function toLocalISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  isDarkMode = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Local draft state for custom dates before applying
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');

  useEffect(() => {
    setCustomStart(startDate || '');
    setCustomEnd(endDate || '');
  }, [startDate, endDate]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const setPreset = (presetKey) => {
    const now = new Date();
    let s = '';
    let e = '';

    if (presetKey === 'today') {
      s = toLocalISODate(now);
      e = toLocalISODate(now);
    } else if (presetKey === 'yesterday') {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      s = toLocalISODate(y);
      e = toLocalISODate(y);
    } else if (presetKey === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      s = toLocalISODate(past);
      e = toLocalISODate(now);
    } else if (presetKey === '30days') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      s = toLocalISODate(past);
      e = toLocalISODate(now);
    } else if (presetKey === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      s = toLocalISODate(start);
      e = toLocalISODate(now);
    } else if (presetKey === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      s = toLocalISODate(start);
      e = toLocalISODate(end);
    } else if (presetKey === 'all') {
      s = '';
      e = '';
    }

    setCustomStart(s);
    setCustomEnd(e);
    onChange({ startDate: s, endDate: e });
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    onChange({ startDate: customStart, endDate: customEnd });
    setIsOpen(false);
  };

  const handleClear = () => {
    setCustomStart('');
    setCustomEnd('');
    onChange({ startDate: '', endDate: '' });
    setIsOpen(false);
  };

  // Trigger label formatting
  let displayLabel = 'Date Range: All Time';
  if (startDate && endDate) {
    displayLabel = `Date Range: ${formatDateToDMY(startDate)} - ${formatDateToDMY(endDate)}`;
  } else if (startDate) {
    displayLabel = `Date Range: From ${formatDateToDMY(startDate)}`;
  } else if (endDate) {
    displayLabel = `Date Range: Until ${formatDateToDMY(endDate)}`;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button - styled cleanly like screenshot */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-xs ${
          isDarkMode
            ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
        } ${isOpen ? (isDarkMode ? 'ring-2 ring-indigo-500/30 border-indigo-500' : 'ring-2 ring-indigo-500/20 border-indigo-500') : ''}`}
      >
        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-72 sm:w-80 rounded-2xl border shadow-xl z-50 p-3.5 animate-in fade-in slide-in-from-top-1 duration-150 ${
            isDarkMode
              ? 'bg-slate-900 border-slate-800 text-slate-200'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Date Range</span>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-2 gap-1.5 mb-3 text-xs">
            <button
              type="button"
              onClick={() => setPreset('all')}
              className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition cursor-pointer ${
                !startDate && !endDate
                  ? (isDarkMode ? 'bg-indigo-950/60 text-indigo-400 font-bold' : 'bg-indigo-50 text-indigo-700 font-bold')
                  : (isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600')
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setPreset('today')}
              className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPreset('7days')}
              className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setPreset('30days')}
              className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setPreset('thisMonth')}
              className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setPreset('lastMonth')}
              className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Last Month
            </button>
          </div>

          {/* Custom Date Range Inputs */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Custom Date Range</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">From:</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200'
                      : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">To:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200'
                      : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyCustom}
              className="w-full mt-2 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-xs"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
