// app/components/chat/ChatUnreadBadge.tsx

interface ChatUnreadBadgeProps {
  count: number
}

export function ChatUnreadBadge({ count }: ChatUnreadBadgeProps) {
  if (count <= 0) return null

  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}
