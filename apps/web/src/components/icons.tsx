import { HugeiconsIcon } from '@hugeicons/react';
import type { ComponentProps } from 'react';
import {
  ArrowUpRight01Icon,
  Cancel01Icon,
  ArrowDown01Icon,
  Tick02Icon,
  Alert02Icon,
  MinusSignIcon,
  Menu01Icon,
  Sun03Icon,
  Moon02Icon,
} from '@hugeicons/core-free-icons';

type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, 'icon'>;

export function ArrowUpRightIcon({
  size = 16,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={ArrowUpRight01Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function CloseIcon({
  size = 18,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={Cancel01Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function ArrowDownIcon({
  size = 16,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function CheckIcon({
  size = 22,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={Tick02Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function AlertIcon({
  size = 22,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={Alert02Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function MinusIcon({
  size = 22,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={MinusSignIcon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function MenuIcon({
  size = 18,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={Menu01Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SunIcon({ size = 16, strokeWidth = 1.8, className = 'icon', ...props }: IconProps) {
  return (
    <HugeiconsIcon
      icon={Sun03Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function MoonIcon({
  size = 16,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={Moon02Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export function ChevronDownIcon({
  size = 16,
  strokeWidth = 1.8,
  className = 'icon',
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}
