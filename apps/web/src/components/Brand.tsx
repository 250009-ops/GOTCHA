import { Link } from 'react-router-dom';

export function Brand({ light = false, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' }) {
  const isSmall = size === 'sm';
  
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <span
        className={`inline-flex items-center justify-center bg-[#2107aa] text-white font-['Bagel_Fat_One',cursive] leading-none ${
          isSmall ? 'w-7 h-7 rounded-lg text-base' : 'w-8 h-8 rounded-[10px] text-lg'
        }`}
      >
        G
      </span>
      <span
        className={`font-['Bagel_Fat_One',cursive] tracking-[-0.45px] leading-7 ${
          isSmall ? 'text-base' : 'text-lg'
        } ${light ? 'text-white' : 'text-[#101828]'}`}
      >
        GOTCHA
      </span>
    </Link>
  );
}
