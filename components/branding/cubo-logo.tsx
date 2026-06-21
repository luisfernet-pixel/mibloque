import Image from "next/image";

type CuboLogoProps = {
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  alt?: string;
};

export default function CuboLogo({
  className,
  priority = false,
  width = 520,
  height = 96,
  alt = "KUBO",
}: CuboLogoProps) {
  return (
    <Image
      src="/LOGO.svg?v=20260522b"
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
