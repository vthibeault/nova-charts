export interface PointerPos {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

/**
 * Single pointer listener on the svg root. The viewBox matches the measured
 * CSS size, so client coordinates map to chart coordinates with one scale
 * factor (covers the case where the element is fluidly resized by CSS).
 */
export class PointerTracker {
  private detach: Array<() => void> = [];

  constructor(
    private svg: SVGSVGElement,
    onMove: (p: PointerPos | null) => void,
    onClick?: (p: PointerPos) => void,
  ) {
    const toLocal = (e: PointerEvent): PointerPos => {
      const rect = this.svg.getBoundingClientRect();
      const vb = this.svg.viewBox.baseVal;
      const sx = rect.width > 0 && vb && vb.width > 0 ? vb.width / rect.width : 1;
      const sy = rect.height > 0 && vb && vb.height > 0 ? vb.height / rect.height : 1;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
        clientX: e.clientX,
        clientY: e.clientY,
      };
    };

    const move = (e: PointerEvent): void => onMove(toLocal(e));
    const leave = (): void => onMove(null);
    const click = (e: PointerEvent): void => onClick?.(toLocal(e));

    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', leave);
    svg.addEventListener('pointerdown', click);
    this.detach.push(
      () => svg.removeEventListener('pointermove', move),
      () => svg.removeEventListener('pointerleave', leave),
      () => svg.removeEventListener('pointerdown', click),
    );
  }

  destroy(): void {
    for (const fn of this.detach) fn();
    this.detach = [];
  }
}
