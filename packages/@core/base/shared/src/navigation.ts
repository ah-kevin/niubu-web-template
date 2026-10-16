export function sameAppHref(href: string): boolean {
  return (
    href.length > 0 &&
    href.length <= 8192 &&
    href.startsWith('/') &&
    !href.startsWith('//') &&
    ![...href].some(
      character => character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    ) &&
    !/%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(href) &&
    !/^\/(?:%2f|%25(?:2f|5c))/i.test(href)
  );
}
