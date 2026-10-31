import { Link } from 'react-router-dom';

export function Brand({ light = false, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' }) {
  const isSmall = size === 'sm';

  return (
    <Link to="/" className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center bg-[#101828] text-white font-['Manrope',sans-serif] font-extrabold leading-none ${
          isSmall ? 'h-6 w-6 rounded text-[13px]' : 'h-7 w-7 rounded-[6px] text-[15px]'
        }`}
      >
        G
      </span>
      <span
        className={`font-['Manrope',sans-serif] font-extrabold leading-none ${
          isSmall ? 'text-base' : 'text-lg'
        } ${light ? 'text-white' : 'text-[#101828]'}`}
      >
        GOTCHA
      </span>
    </Link>
  );
}
