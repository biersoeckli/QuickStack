import { z } from 'zod';

export const ProjectTypeModel = z.enum(['APP', 'AGENT']);

export type ProjectType = z.infer<typeof ProjectTypeModel>;

