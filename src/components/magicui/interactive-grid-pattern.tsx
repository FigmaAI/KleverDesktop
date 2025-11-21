import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface GridPatternProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: any;
  numSquares?: number;
  className?: string;
  maxOpacity?: number;
  duration?: number;
  repeatDelay?: number;
}

export function InteractiveGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  className,
  maxOpacity = 0.5,
  duration = 4,
  repeatDelay = 0.5,
  ...props
}: GridPatternProps) {
  const [squares, setSquares] = useState<{ id: number; pos: [number, number] }[]>([]);

  const getPos = () => {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    return [
      Math.floor((Math.random() * screenWidth) / width),
      Math.floor((Math.random() * screenHeight) / height),
    ];
  };

  useEffect(() => {
    const squaresData: { id: number; pos: [number, number] }[] = [];
    for (let i = 0; i < numSquares; i++) {
      squaresData.push({
        id: i,
        pos: getPos() as [number, number],
      });
    }
    setSquares(squaresData);

    const updateSquares = () => {
      setSquares((currentSquares) =>
        currentSquares.map((sq) => ({
          ...sq,
          pos: getPos() as [number, number],
        }))
      );
    };

    const interval = setInterval(updateSquares, (duration + repeatDelay) * 1000);

    return () => clearInterval(interval);
  }, [numSquares, duration, repeatDelay]);

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30",
        className
      )}
      {...props}
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [x, y], id }, index) => (
          <motion.rect
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{
              duration,
              repeat: Infinity,
              delay: index * 0.1,
              repeatType: "reverse",
            }}
            key={`${id}-${x}-${y}`}
            width={width - 1}
            height={height - 1}
            x={x * width + 1}
            y={y * height + 1}
            fill="currentColor"
            strokeWidth="0"
          />
        ))}
      </svg>
    </svg>
  );
}

export default InteractiveGridPattern;
