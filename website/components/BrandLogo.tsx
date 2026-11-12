import Image from "next/image";

type BrandLogoProps = {
  priority?: boolean;
};

export function BrandLogo({ priority = false }: BrandLogoProps) {
  return (
    <>
      <Image
        className="brand-symbol"
        src="/assets/aura-logo-black.png"
        alt=""
        width={44}
        height={44}
        priority={priority}
      />
      <span className="brand-name">AURA</span>
      <sup>®</sup>
    </>
  );
}
