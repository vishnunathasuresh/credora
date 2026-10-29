'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ArrowDownIcon } from './icons';

type Motion = {
  frame: number;
  lastFrame: number;
  pointerX: number;
  pointerY: number;
  active: boolean;
  x: number;
  y: number;
  rotateX: number;
  rotateY: number;
  velocityX: number;
  velocityY: number;
  velocityRotateX: number;
  velocityRotateY: number;
  targetX: number;
  targetY: number;
  targetRotateX: number;
  targetRotateY: number;
};
const initialMotion = (): Motion => ({
  frame: 0,
  lastFrame: 0,
  pointerX: 0,
  pointerY: 0,
  active: false,
  x: 0,
  y: 0,
  rotateX: 0,
  rotateY: 0,
  velocityX: 0,
  velocityY: 0,
  velocityRotateX: 0,
  velocityRotateY: 0,
  targetX: 0,
  targetY: 0,
  targetRotateX: 0,
  targetRotateY: 0,
});
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function CredentialLanyard({
  front,
  back,
  label,
}: {
  front: ReactNode;
  back: ReactNode;
  label: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<Motion>(initialMotion());
  const [flipped, setFlipped] = useState(false);

  useEffect(() => () => cancelAnimationFrame(motionRef.current.frame), []);

  function animate(timestamp: number) {
    const motion = motionRef.current;
    const card = cardRef.current;
    if (!card) return;
    const delta = Math.min(2, Math.max(0.5, (timestamp - (motion.lastFrame || timestamp)) / 16.67));
    motion.lastFrame = timestamp;
    const spring = (value: number, velocity: number, target: number) => {
      velocity += (target - value) * 0.115 * delta;
      velocity *= Math.pow(0.79, delta);
      value += velocity * delta;
      return [value, velocity] as const;
    };
    [motion.x, motion.velocityX] = spring(motion.x, motion.velocityX, motion.targetX);
    [motion.y, motion.velocityY] = spring(motion.y, motion.velocityY, motion.targetY);
    [motion.rotateX, motion.velocityRotateX] = spring(
      motion.rotateX,
      motion.velocityRotateX,
      motion.targetRotateX,
    );
    [motion.rotateY, motion.velocityRotateY] = spring(
      motion.rotateY,
      motion.velocityRotateY,
      motion.targetRotateY,
    );
    card.style.setProperty('--lanyard-x', `${motion.x.toFixed(2)}px`);
    card.style.setProperty('--lanyard-y', `${motion.y.toFixed(2)}px`);
    card.style.setProperty('--lanyard-rotate-x', `${motion.rotateX.toFixed(2)}deg`);
    card.style.setProperty('--lanyard-rotate-y', `${motion.rotateY.toFixed(2)}deg`);

    const settled =
      !motion.active &&
      Math.abs(motion.x) +
        Math.abs(motion.y) +
        Math.abs(motion.rotateX) +
        Math.abs(motion.rotateY) <
        0.12 &&
      Math.abs(motion.velocityX) +
        Math.abs(motion.velocityY) +
        Math.abs(motion.velocityRotateX) +
        Math.abs(motion.velocityRotateY) <
        0.12;
    if (settled) {
      motion.frame = 0;
      motion.lastFrame = 0;
      card.style.setProperty('--lanyard-x', '0px');
      card.style.setProperty('--lanyard-y', '0px');
      card.style.setProperty('--lanyard-rotate-x', '0deg');
      card.style.setProperty('--lanyard-rotate-y', '0deg');
      return;
    }
    motion.frame = requestAnimationFrame(animate);
  }

  function startAnimation() {
    const motion = motionRef.current;
    if (!motion.frame) motion.frame = requestAnimationFrame(animate);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (
      event.target instanceof Element &&
      event.target.closest(
        'a, button, input, textarea, select, summary, [role="button"], [contenteditable="true"], [data-no-drag]',
      )
    )
      return;
    const motion = motionRef.current;
    motion.active = true;
    motion.pointerX = event.clientX;
    motion.pointerY = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('is-dragging');
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const motion = motionRef.current;
    if (!motion.active) return;
    const dx = event.clientX - motion.pointerX;
    const dy = event.clientY - motion.pointerY;
    motion.targetX = clamp(dx * 0.12, -34, 34);
    motion.targetY = clamp(dy * 0.08, -24, 24);
    motion.targetRotateY = clamp(dx * 0.48, -36, 36);
    motion.targetRotateX = clamp(-dy * 0.18, -16, 16);
    startAnimation();
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const motion = motionRef.current;
    if (!motion.active) return;
    motion.active = false;
    motion.targetX = motion.targetY = motion.targetRotateX = motion.targetRotateY = 0;
    event.currentTarget.classList.remove('is-dragging');
    startAnimation();
  }

  return (
    <div className="lanyard-scene">
      <div className="lanyard-cord" aria-hidden="true" />
      <div
        ref={cardRef}
        className={`lanyard-card${flipped ? ' is-flipped' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            setFlipped((value) => !value);
          }
        }}
        role="group"
        aria-label={`${label}. Drag to swing the credential.`}
        tabIndex={0}
      >
        <div className="lanyard-face lanyard-front" aria-hidden={flipped} inert={flipped}>
          {front}
        </div>
        <div className="lanyard-face lanyard-back" aria-hidden={!flipped} inert={!flipped}>
          {back}
        </div>
      </div>
      <button
        className="lanyard-flip"
        type="button"
        onClick={() => setFlipped((value) => !value)}
        aria-pressed={flipped}
      >
        <ArrowDownIcon /> {flipped ? 'Show front' : 'Show details'}
      </button>
    </div>
  );
}
