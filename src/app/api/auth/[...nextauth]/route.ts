import NextAuth from "next-auth";
import { buildAuthOptions } from "@/server/utils/auth-options";

async function handler(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> },
) {
  return NextAuth(await buildAuthOptions())(req, { params: await ctx.params });
}

export { handler as GET, handler as POST };
