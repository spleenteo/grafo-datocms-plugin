import type { RenderPageCtx } from 'datocms-plugin-sdk';

type CreatorCtx = Pick<
  RenderPageCtx,
  'users' | 'ssoUsers' | 'owner' | 'loadUsers' | 'loadSsoUsers'
>;
export type Creator = { readonly type: string; readonly id: string };

const joinName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(' ') || null;

/**
 * Resolves a record creator to a display name. Each loader runs at most once
 * per resolver; a failed load is remembered (the name falls back to null).
 */
export function createCreatorResolver(getCtx: () => CreatorCtx) {
  let usersLoad: Promise<void> | null = null;
  let ssoLoad: Promise<void> | null = null;

  const once = (current: Promise<void> | null, load: () => Promise<unknown>) =>
    current ?? Promise.resolve().then(load).then(
      () => undefined,
      () => undefined,
    );

  const userName = (id: string) => {
    const u = getCtx().users[id]?.attributes;
    return u ? u.full_name || u.email || null : null;
  };
  const ssoName = (id: string) => {
    const u = getCtx().ssoUsers[id]?.attributes;
    return u ? joinName(u.first_name, u.last_name) || u.username || null : null;
  };

  return async function resolveCreatorName(creator: Creator | null): Promise<string | null> {
    if (!creator) return null;
    const ctx = getCtx();
    switch (creator.type) {
      case 'user': {
        const known = userName(creator.id);
        if (known) return known;
        usersLoad = once(usersLoad, () => ctx.loadUsers());
        await usersLoad;
        return userName(creator.id);
      }
      case 'sso_user': {
        const known = ssoName(creator.id);
        if (known) return known;
        ssoLoad = once(ssoLoad, () => ctx.loadSsoUsers());
        await ssoLoad;
        return ssoName(creator.id);
      }
      case 'account': {
        const o = ctx.owner;
        if (o.id !== creator.id || o.type !== 'account') return null;
        const a = (o as { attributes: { first_name?: string | null; last_name?: string | null; email?: string } }).attributes;
        return joinName(a.first_name, a.last_name) || a.email || null;
      }
      case 'organization': {
        const o = ctx.owner;
        if (o.id !== creator.id || o.type !== 'organization') return null;
        return (o as { attributes: { name?: string } }).attributes.name || null;
      }
      case 'access_token':
        return 'API token';
      default:
        return null;
    }
  };
}
