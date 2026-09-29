type StockeaLogoProps = {
  variant?: 'login' | 'brand';
  className?: string;
};

export default function StockeaLogo({ variant = 'brand', className = '' }: StockeaLogoProps) {
  const classes = ['stockea-logo', `stockea-logo--${variant}`, className].filter(Boolean).join(' ');
  return (
    <img
      src="/stockea-logo.png"
      alt="Stockea by Hildra"
      className={classes}
    />
  );
}
