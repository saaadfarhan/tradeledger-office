const KARACHI_TIME_ZONE = 'Asia/Karachi'

export function karachiHour(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: KARACHI_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date))
}

export function karachiGreeting(date: Date): string {
  const hour = karachiHour(date)
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 22) return 'Good evening'
  return 'Welcome back'
}
