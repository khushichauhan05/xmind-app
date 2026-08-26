import {
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
} from "date-fns";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Format a number to a shorter format (e.g., 1000 -> 1K, 1000000 -> 1M, 1000000000 -> 1B)
export const formatNumber = (num: number): string => {
  if (num < 0) return num.toString(); // Handle negative numbers
  if (num < 1000) return num.toString(); // Numbers less than 1000 remain as is

  if (num >= 1000 && num < 1000000) {
    const value = num / 1000;
    // If the value is a whole number, show as integer (e.g., 1K, 2K)
    if (value % 1 === 0) return `${Math.floor(value)}K`;
    // Otherwise, show one decimal place (e.g., 1.2K, 3.5K)
    return `${value.toFixed(1).replace(/\.0$/, "")}K`;
  }

  if (num >= 1000000 && num < 1000000000) {
    const value = num / 1000000;
    // If the value is a whole number, show as integer (e.g., 1M, 2M)
    if (value % 1 === 0) return `${Math.floor(value)}M`;
    // Otherwise, show one decimal place (e.g., 1.2M, 3.5M)
    return `${value.toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (num >= 1000000000) {
    const value = num / 1000000000;
    // If the value is a whole number, show as integer (e.g., 1B, 2B)
    if (value % 1 === 0) return `${Math.floor(value)}B`;
    // Otherwise, show one decimal place (e.g., 1.2B, 3.5B)
    return `${value.toFixed(1).replace(/\.0$/, "")}B`;
  }

  return num.toString(); // Fallback for any unexpected cases
};

// Format a date to a short relative format + month/year for older dates
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  if (isNaN(date.getTime())) {
    return "Invalid date";
  }

  const minutes = differenceInMinutes(now, date);
  const hours = differenceInHours(now, date);
  const days = differenceInDays(now, date);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;

  // For dates older than ~1 month, return "MMM YYYY"
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};