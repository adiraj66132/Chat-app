import { animate, createTimeline, stagger, utils } from 'animejs';

// Springy "pop" used for buttons / badges when they appear or are tapped.
export function pop(target: Element | Element[] | string) {
  return animate(target, {
    scale: [
      { to: 1.15, duration: 140, ease: 'outQuad' },
      { to: 1, duration: 260, ease: 'outElastic(1, 0.5)' },
    ],
  });
}

// Quick tactile bounce for the send button on click.
export function tapBounce(target: Element | Element[] | string) {
  animate(target, {
    scale: [
      { to: 0.88, duration: 90, ease: 'outQuad' },
      { to: 1, duration: 220, ease: 'outElastic(1, 0.6)' },
    ],
  });
}

// Horizontal shake used for validation errors.
export function shake(target: Element | Element[] | string) {
  utils.set(target, { transformOrigin: 'center' });
  animate(target, {
    translateX: [
      { to: -8, duration: 60 },
      { to: 8, duration: 60 },
      { to: -5, duration: 60 },
      { to: 0, duration: 80 },
    ],
    ease: 'inOutQuad',
  });
}

// Staggered entrance for a list of nodes (e.g. conversation rows).
export function staggerIn(
  targets: Element | Element[] | string,
  opts: { delay?: number; y?: number } = {},
) {
  const { delay = 0, y = 16 } = opts;
  return animate(targets, {
    opacity: [0, 1],
    translateY: [y, 0],
    duration: 360,
    delay: stagger(40, { start: delay }),
    ease: 'outCubic',
  });
}

export { createTimeline, stagger, utils };
