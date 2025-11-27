"use client";

import React, { PropsWithChildren, useRef, useState, useEffect } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

import { cn } from "@/lib/utils";

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string;
  iconSize?: number;
  iconMagnification?: number;
  iconDistance?: number;
  direction?: "top" | "middle" | "bottom";
  children: React.ReactNode;
}



const dockVariants = cva(
  "supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 mx-auto mt-8 flex h-[58px] w-max gap-2 rounded-2xl border p-2 backdrop-blur-md",
);

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = 40,
      iconMagnification = 60,
      iconDistance = 140,
      direction = "bottom",
      ...props
    },
    ref,
  ) => {
    const mouseX = useMotionValue(Infinity);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dockElement, setDockElement] = useState<HTMLDivElement | null>(null);

    // Get all focusable dock items (buttons)
    const getDockItems = React.useCallback(() => {
      if (!dockElement) return [];
      return Array.from(dockElement.querySelectorAll('button')) as HTMLButtonElement[];
    }, [dockElement]);

    // Keyboard navigation for dock (left/right arrows)
    useEffect(() => {
      const handleKeyDown = (e: globalThis.KeyboardEvent) => {
        const items = getDockItems();
        if (items.length === 0) return;

        // Only handle if no dialog is open and not typing in input
        if (
          (e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'TEXTAREA' ||
          (e.target as HTMLElement).closest('[role="dialog"]')
        ) {
          return;
        }

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setSelectedIndex((prev) => {
            const newIndex = Math.max(prev - 1, 0);
            items[newIndex]?.focus();
            return newIndex;
          });
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setSelectedIndex((prev) => {
            const newIndex = Math.min(prev + 1, items.length - 1);
            items[newIndex]?.focus();
            return newIndex;
          });
        } else if (e.key === 'Enter' || e.key === ' ') {
          // Execute the focused dock item
          const activeElement = document.activeElement as HTMLButtonElement;
          if (activeElement && items.includes(activeElement)) {
            e.preventDefault();
            activeElement.click();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dockElement, getDockItems]);

    // Update selected index when an item receives focus (e.g. via Tab)
    const handleFocus = (e: React.FocusEvent) => {
      const items = getDockItems();
      const target = e.target as HTMLElement;
      // Find the closest button if the target itself isn't one (though it should be)
      const button = target.tagName === 'BUTTON' ? target as HTMLButtonElement : target.closest('button');

      if (button) {
        const index = items.indexOf(button);
        if (index !== -1) {
          setSelectedIndex(index);
        }
      }
    };

    const renderChildren = () => {
      let iconIndex = 0;
      return React.Children.map(children, (child) => {
        // Only pass dock-specific props to DockIcon components
        // Other components (like Separator) should not receive these props
        if (React.isValidElement(child) && child.type === DockIcon) {
          const currentIndex = iconIndex;
          iconIndex++;
          return React.cloneElement(child as React.ReactElement<DockIconProps>, {
            mouseX: mouseX,
            size: iconSize,
            magnification: iconMagnification,
            distance: iconDistance,
            isSelected: currentIndex === selectedIndex,
          } as Partial<DockIconProps>);
        }
        return child;
      });
    };

    // Filter out custom props that shouldn't be passed to DOM
    const { ...domProps } = props;

    return (
      <motion.div
        ref={(node) => {
          // Handle forwarded ref
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref && 'current' in ref) {
            (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
          // Set our own ref
          setDockElement(node);
        }}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        onFocusCapture={handleFocus}
        {...domProps}
        className={cn(dockVariants({ className }), {
          "items-start": direction === "top",
          "items-center": direction === "middle",
          "items-end": direction === "bottom",
        })}
      >
        {renderChildren()}
      </motion.div>
    );
  },
);

Dock.displayName = "Dock";

export interface DockIconProps {
  size?: number;
  magnification?: number;
  distance?: number;
  mouseX?: ReturnType<typeof useMotionValue<number>>;
  className?: string;
  children?: React.ReactNode;
  props?: PropsWithChildren;
  isSelected?: boolean;
}

const DockIcon = ({
  size: _size,
  magnification = 60,
  distance = 140,
  mouseX,
  className,
  children,
  isSelected = false,
  ...props
}: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const defaultMouseX = useMotionValue(Infinity);
  const activeMouseX = mouseX || defaultMouseX;

  const distanceCalc = useTransform(activeMouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };

    return val - bounds.x - bounds.width / 2;
  });

  let widthSync = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [40, magnification, 40],
  );

  let width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      className={cn(
        "flex aspect-square cursor-pointer items-center justify-center rounded-full transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

DockIcon.displayName = "DockIcon";

// eslint-disable-next-line react-refresh/only-export-components
export { Dock, DockIcon, dockVariants };
