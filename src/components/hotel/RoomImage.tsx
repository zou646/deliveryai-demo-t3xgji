import { HOTEL_IMAGES } from '@/data/hotel'
import { cn } from '@/lib/utils'

interface RoomImageProps {
  imageKey: string
  className?: string
  emojiClassName?: string
}

// 无外部图片依赖：用 emoji + 渐变背景作为占位图（遵守仓库"不引入外部图片服务"约定）
export function RoomImage({ imageKey, className, emojiClassName }: RoomImageProps) {
  const seed = HOTEL_IMAGES[imageKey] ?? HOTEL_IMAGES.deluxe
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden bg-gradient-to-br', seed.from, seed.to, className)}>
      <span className={cn('text-5xl', emojiClassName)}>{seed.emoji}</span>
    </div>
  )
}
