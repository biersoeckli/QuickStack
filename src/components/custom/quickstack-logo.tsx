import { cn } from "@/frontend/utils/utils";
import Image from "next/image";

export default function QuickStackLogo({ className }: { className?: string }) {
  return (
    <>
      <Image
        src="/quickstack-icon.png"
        alt=""
        width={2488}
        height={2627}
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/quickstack-icon-dark.png"
        alt=""
        width={2488}
        height={2627}
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}
