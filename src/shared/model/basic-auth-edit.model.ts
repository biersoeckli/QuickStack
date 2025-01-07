import { stringToNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";

export const basicAuthEditZodModel = z.object({
  id: z.string().nullish(),
  username: z.string().trim().min(1),
  password: z.string().trim().min(1),
  appId: z.string().min(1),
});

export type BasicAuthEditModel = z.infer<typeof basicAuthEditZodModel>;