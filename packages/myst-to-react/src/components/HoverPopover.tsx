import React, { useState } from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';

export function HoverPopover({
  children,
  openDelay = 400,
  card,
  side,
  arrowClass = 'fill-white',
}: {
  children: React.ReactNode;
  openDelay?: number;
  arrowClass?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  card: React.ReactNode | ((args: { load: boolean }) => React.ReactNode);
}) {
  const [load, setLoad] = useState(false);
  return (
    <HoverCard.Root openDelay={openDelay}>
      <HoverCard.Trigger asChild onMouseEnter={() => setLoad(true)}>
        {children}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="exclude-from-outline hover-card-content"
          sideOffset={5}
          side={side}
        >
          {typeof card === 'function' ? load && card({ load }) : card}
          <HoverCard.Arrow className={arrowClass} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
