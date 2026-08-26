/**
 * Notification grouping.
 *
 * Architectural role:
 *  Folds same-day, same-type, same-target notifications into a single
 *  group. Cuts inbox visual volume and matches the pattern every major
 *  social network ships. Pure function — easy to swap, easy to test.
 *
 * Grouping key:
 *   - like / comment   → `<type>:<postId>:<yyyy-mm-dd>`
 *   - follow           → `follow:<yyyy-mm-dd>`
 *  Within a key, the most recent timestamp drives sort order.
 */
import type { Notification } from "@/types";

import type { NotificationGroup } from "@/components/GroupedNotificationCard";

function dayBucket(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function groupNotifications(
  notifications: Notification[]
): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();

  for (const n of notifications) {
    const day = dayBucket(n.createdAt);
    const key =
      n.type === "follow"
        ? `follow:${day}`
        : `${n.type}:${n.post?._id ?? "none"}:${day}`;

    const existing = groups.get(key);
    if (existing) {
      existing.notifications.push(n);
      if (new Date(n.createdAt) > new Date(existing.latestAt)) {
        existing.latestAt = n.createdAt;
      }
    } else {
      groups.set(key, {
        id: key,
        type: n.type,
        notifications: [n],
        latestAt: n.createdAt,
        post: n.post,
      });
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  );
}
