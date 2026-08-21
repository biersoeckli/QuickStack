import Image from "next/image";
import { SsoProviderType } from "@/shared/model/sso-provider.model";

const logoByType: Partial<Record<SsoProviderType, string>> = {
  GOOGLE: "/sso-provider-logos/google.png",
  AZURE_AD: "/sso-provider-logos/entra.svg",
  GITHUB: "/sso-provider-logos/github.svg",
};

export function SsoProviderLogo({
  type,
  className,
}: {
  type: SsoProviderType;
  className?: string;
}) {
  const src = logoByType[type];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
      className={className}
    />
  );
}
