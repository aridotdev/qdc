import { format, parseISO } from 'date-fns'

type DateInput = Date | string

function toDate(value: DateInput): Date {
  if (value instanceof Date) {
    return value
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : new Date(value)
}

export function formatIndonesianDate(value: DateInput): string {
  return format(toDate(value), 'dd-MM-yyyy')
}

export function formatIndonesianDateTime(value: DateInput): string {
  return format(toDate(value), 'dd-MM-yyyy')
}

export function formatIndonesianTime(value: DateInput): string {
  return format(toDate(value), 'HH:mm')
}
