import React from "react"

type BaseIconProps = React.SVGProps<SVGSVGElement> & {
  title?: string
}

type VolumeIconProps = BaseIconProps & {
  muted?: boolean
}

const SvgIcon = ({ title, children, ...rest }: BaseIconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden={title ? undefined : true}
    {...rest}
  >
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
)

export const VolumeIcon = ({ muted, ...rest }: VolumeIconProps) =>
  muted ? (
    <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </SvgIcon>
  ) : (
    <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19 5a8 8 0 0 1 0 14" />
      <path d="M15 9a4 4 0 0 1 0 6" />
    </SvgIcon>
  )

export const HeartIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.8 4.6c-1.7-1.6-4.3-1.6-6 0L12 7.3 9.2 4.6c-1.7-1.6-4.3-1.6-6 0-1.9 1.7-1.9 4.6 0 6.3L12 19l8.8-8.1c1.9-1.7 1.9-4.6 0-6.3z" />
  </SvgIcon>
)

export const ThumbIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 9V5a3 3 0 0 0-3-3L7 12v9h10.4a2 2 0 0 0 2-1.7l1.3-7a2 2 0 0 0-2-2H14z" />
    <path d="M7 12H3v9h4" />
  </SvgIcon>
)

export const CommentIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 11.5a8.5 8.5 0 0 0-8.5-8.5h-1A8.5 8.5 0 0 0 3 11.5c0 4.4 3.6 8 8 8h1l5 4v-4.5c2.1-1.5 4-3.6 4-7.5z" />
  </SvgIcon>
)

export const BookmarkIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </SvgIcon>
)

export const ShareIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 7H7a4 4 0 0 0 0 8h2" />
    <path d="M15 7h2a4 4 0 0 1 0 8h-2" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </SvgIcon>
)

export const DonateIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 7h-4l-2-3H10L8 7H4l-1 5h18z" />
    <path d="M4 12v7h16v-7" />
    <path d="M12 15c2.5-1.6 3-4.4 1.2-5.1-1.2-.5-2.1.6-1.2 1.6.9-1.1 0-2.2-1.2-1.6C9 10.6 9.5 13.4 12 15z" />
  </SvgIcon>
)

export const SearchIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </SvgIcon>
)

export const PlusCircleIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <line x1="12" y1="8.5" x2="12" y2="15.5" />
    <line x1="8.5" y1="12" x2="15.5" y2="12" />
  </SvgIcon>
)

export const UploadIcon = (props: BaseIconProps) => <PlusCircleIcon {...props} />

export const MessageIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 7h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4l-4 3-4-3H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
  </SvgIcon>
)

export const HomeIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </SvgIcon>
)

export const UserIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 19c1.5-3 4.5-4.5 7-4.5s5.5 1.5 7 4.5" />
  </SvgIcon>
)

export const PlusIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="7" x2="12" y2="17" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </SvgIcon>
)
