import z from "zod";


export const zodWorkloadType = z.enum(['app', 'agent']);
export type WorkloadType = z.infer<typeof zodWorkloadType>;