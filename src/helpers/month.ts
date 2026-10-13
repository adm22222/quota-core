import { ValidationError } from '../shared/errors.ts';

export type ParsedMonth = {
  year: number;
  month: number;
};

export const parseMonth = (value: string): ParsedMonth => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);

  if (!match) {
    throw new ValidationError('Invalid month format. Expected YYYY-MM');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (year < 1000) {
    throw new ValidationError('Invalid year');
  }

  return { year, month };
};

export const getMonthStart = (value: string): Date => {
  const { year, month } = parseMonth(value);

  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
};

export const formatMonth = (date: Date): string => {
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid date');
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
};

export const rejectFutureMonths = (
  value: string,
  now: Date = new Date(),
): void => {
  const { year, month } = parseMonth(value);

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    throw new ValidationError('Future months are not allowed');
  }
};
