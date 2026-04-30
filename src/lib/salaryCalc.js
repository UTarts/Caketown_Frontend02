// src/lib/salaryCalc.js
// Pure-JS salary calculation engine — mirrors the PHP backend logic.
// Used for instant client-side preview before saving to DB.

/**
 * Given an employee's attendance record and contract, calculate their salary.
 *
 * @param {object} p
 * @param {number} p.monthlySalary        - Fixed monthly CTC
 * @param {number} p.daysPresent          - Full-day attendance count
 * @param {number} p.halfDays             - Half-day attendance count (counts as 0.5)
 * @param {number} p.maxPaidLeavesCap     - 2 or 4 (admin-set per employee)
 * @param {number} p.totalDaysInMonth     - e.g. 30 for April
 * @param {number} p.preAdvance           - Pre-month advance received
 * @param {number} p.finalAdvance         - In-month final advance
 * @param {number} p.shopAdvance          - Shop advance (emergency)
 * @param {number} p.shopBill             - Shop bills deducted
 * @param {number} p.otherDeductions      - Fines / penalties
 * @param {number} p.alreadyPaid          - Amount already paid this month
 * @returns {object} Full breakdown matching the spreadsheet columns
 */
export const calculateSalary = (p) => {
  const totalDays    = p.totalDaysInMonth || 30;
  const fullDays     = p.daysPresent      || 0;
  const halfDayCount = p.halfDays         || 0;

  // Total duty = full days + half-days counted as 0.5
  const totalDuty = fullDays + halfDayCount * 0.5;

  // Paid holidays based on tiered rule
  const paidHolidays = getPaidHolidays(fullDays, p.maxPaidLeavesCap);

  // Paid duty = worked days + granted paid holidays
  const paidDuty = totalDuty + paidHolidays;

  // Per-day salary
  const perDay = p.monthlySalary / totalDays;

  // Gross earnings
  const grossSalary = parseFloat((perDay * paidDuty).toFixed(2));

  // 30% advance eligibility cap
  const advanceCap = parseFloat((p.monthlySalary * 0.3).toFixed(2));

  // Total advances / deductions
  const totalAdvance = (p.preAdvance || 0) + (p.finalAdvance || 0) +
                       (p.shopAdvance || 0) + (p.shopBill || 0) +
                       (p.otherDeductions || 0);

  // Salary to pay
  const salaryToPay = parseFloat(Math.max(0, grossSalary - totalAdvance).toFixed(2));

  // Advance / Due (net after already-paid)
  const advanceDue = parseFloat((salaryToPay - (p.alreadyPaid || 0)).toFixed(2));

  return {
    totalDuty,
    paidHolidays,
    paidDuty,
    perDay: parseFloat(perDay.toFixed(2)),
    grossSalary,
    advanceCap,
    preAdvance:    p.preAdvance    || 0,
    finalAdvance:  p.finalAdvance  || 0,
    shopAdvance:   p.shopAdvance   || 0,
    shopBill:      p.shopBill      || 0,
    otherDeductions: p.otherDeductions || 0,
    totalAdvance,
    salaryToPay,
    alreadyPaid:   p.alreadyPaid   || 0,
    advanceDue,
  };
};

/**
 * Tiered paid-holiday rule.
 * cap=4: 0-9→0, 10-13→1, 14-19→2, 20-23→3, 24+→4
 * cap=2: 0-13→0, 14-23→1, 24+→2
 */
export const getPaidHolidays = (daysPresent, cap) => {
  if (cap === 4) {
    if (daysPresent >= 24) return 4;
    if (daysPresent >= 20) return 3;
    if (daysPresent >= 14) return 2;
    if (daysPresent >= 10) return 1;
    return 0;
  }
  if (cap === 2) {
    if (daysPresent >= 24) return 2;
    if (daysPresent >= 14) return 1;
    return 0;
  }
  return 0;
};

/** Format a number as Indian currency string */
export const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
