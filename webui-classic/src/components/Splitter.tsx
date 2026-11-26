import { useRef, useState, type ReactNode } from 'react';
import { load, save } from '../lib/storage';

interface Props {
  id: string;
  direction: 'row' | 'column';
  /** The pane that keeps its size in pixels; the other one gets the rest */
  fixed?: 'first' | 'second';
  initial: number;
  min?: number;
  first: ReactNode;
  /** null hides the pane and the divider */
  second: ReactNode | null;
}

/** Two panes with a draggable divider */
export const Splitter = ({ id, direction, fixed = 'second', initial, min = 80, first, second }: Props) => {
  const [size, setSize] = useState(() => load(`split.${id}`, initial));
  const container = useRef<HTMLDivElement>(null);
  const row = direction === 'row';
  const sized = row ? { width: size } : { height: size };
  const sizeFirst = fixed === 'first';

  const resize = (value: number) => {
    const box = container.current?.getBoundingClientRect();
    const max = box ? (row ? box.width : box.height) - min : value;
    const next = Math.round(Math.max(min, Math.min(max, value)));
    setSize(next);
    save(`split.${id}`, next);
  };

  return (
    <div ref={container} className={`split ${direction}`}>
      <div className={sizeFirst ? 'split-fixed' : 'split-flexible'} style={sizeFirst ? sized : undefined}>
        {first}
      </div>
      {second !== null && (
        <>
          <div
            className="split-handle"
            role="separator"
            aria-orientation={row ? 'vertical' : 'horizontal'}
            tabIndex={0}
            onKeyDown={(e) => {
              const back = row ? 'ArrowLeft' : 'ArrowUp';
              const forward = row ? 'ArrowRight' : 'ArrowDown';
              if (e.key === back || e.key === forward) {
                e.preventDefault();
                resize(size + ((e.key === forward) === sizeFirst ? 20 : -20));
              }
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                const box = container.current!.getBoundingClientRect();
                const position = row ? e.clientX : e.clientY;
                resize(
                  sizeFirst ? position - (row ? box.left : box.top) : (row ? box.right : box.bottom) - position,
                );
              }
            }}
          />
          <div className={sizeFirst ? 'split-flexible' : 'split-fixed'} style={sizeFirst ? undefined : sized}>
            {second}
          </div>
        </>
      )}
    </div>
  );
};
