import { Fragment, type ReactNode } from 'react';

export type NodeParams = Record<string, ReactNode>;

/** "+1" / "−1" in literal text: kept left-to-right inside Hebrew sentences. */
const SIGNED_NUMBER = /([+−]\d+)/;

/**
 * Like `format`, but returns React nodes so names can be bidi-isolated:
 * - a string value (a player name, a typed guess…) is wrapped in `<bdi>`;
 * - a number is inserted as text;
 * - any other node (e.g. a list of `<bdi>` names) is inserted as it is;
 * - "+1" / "−1" in the template text are wrapped in `<span dir="ltr">`.
 */
export function formatNode(template: string, params: NodeParams = {}): ReactNode {
  const out: ReactNode[] = [];
  let key = 0;
  const pushText = (text: string) => {
    for (const part of text.split(SIGNED_NUMBER)) {
      if (!part) continue;
      if (SIGNED_NUMBER.test(part)) {
        out.push(
          <span dir="ltr" key={key++}>
            {part}
          </span>,
        );
      } else {
        out.push(part);
      }
    }
  };
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    pushText(template.slice(last, m.index));
    const name = m[1]!;
    if (name in params) {
      const value = params[name];
      if (typeof value === 'string') out.push(<bdi key={key++}>{value}</bdi>);
      else if (typeof value === 'number') out.push(String(value));
      else out.push(<Fragment key={key++}>{value}</Fragment>);
    } else {
      out.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  pushText(template.slice(last));
  return <>{out}</>;
}

/** "Bob, Carol": each name in its own `<bdi>`. */
export function nameList(names: readonly string[], separator = ', '): ReactNode {
  return (
    <>
      {names.map((name, i) => (
        <Fragment key={`${i}-${name}`}>
          {i > 0 && separator}
          <bdi>{name}</bdi>
        </Fragment>
      ))}
    </>
  );
}
