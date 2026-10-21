/**
 * The product mark: a route that turns one corner, with a stop at each end and
 * a school-bus amber bead at the origin. Drawn rather than set in the icon font
 * so the brand never depends on a font subset.
 */
export function ProductMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="28" height="28" rx="7" fill="#15181b" />
      <path
        d="M7 19h7.4a4.6 4.6 0 0 0 4.6-4.6V9"
        stroke="#f7f8f4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="7" cy="19" r="2.4" fill="#e7a51b" />
      <circle cx="19" cy="9" r="2.2" fill="#f7f8f4" />
    </svg>
  );
}
