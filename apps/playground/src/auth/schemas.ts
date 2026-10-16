import { z } from 'zod';
import type { BackendMenuItem } from '@niubu/types';

export const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
export type LoginInput = z.infer<typeof loginSchema>;
export const tokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().finite().positive(),
});
export type TokenPair = z.infer<typeof tokenSchema>;
export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  roles: z.array(z.string().min(1)),
  workspaces: z.array(
    z.object({ kind: z.literal('workspace'), id: z.enum(['north', 'south']), name: z.string().optional() }),
  ),
});
export type PlaygroundUser = z.infer<typeof userSchema>;
const presentation = z.object({
  title: z.string().optional(),
  icon: z.string().optional(),
  badge: z.union([z.string(), z.number()]).optional(),
  order: z.number().finite().optional(),
  hidden: z.boolean().optional(),
  openInNewWindow: z.boolean().optional(),
});
export const menuItemSchema: z.ZodType<BackendMenuItem> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    presentation.extend({ kind: z.literal('page'), id: z.string().min(1), pageId: z.string().min(1) }),
    presentation.extend({
      kind: z.literal('group'),
      id: z.string().min(1),
      title: z.string(),
      children: z.array(menuItemSchema),
    }),
    presentation.extend({ kind: z.literal('external'), id: z.string().min(1), title: z.string(), href: z.string() }),
    presentation.extend({ kind: z.literal('iframe'), id: z.string().min(1), title: z.string(), src: z.string() }),
  ]),
);
export const menuSchema = z.array(menuItemSchema);
export const codesSchema = z.array(z.string().min(1));
