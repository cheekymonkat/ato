import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { PanResponder, View } from 'react-native';
import { swipeDirection } from '../dashboard/model';

const GuardContext = createContext<() => void>(() => {});

/** Interactive descendants mark their touch sequence so horizontal drags stay local. */
export function SwipeGuard({ children }: { children: ReactNode }) {
  const block = useContext(GuardContext);
  return <View onStartShouldSetResponderCapture={() => { block(); return false; }}>{children}</View>;
}

function createSwipeController(onNavigate: (direction: -1 | 1) => void) {
  // Gesture bookkeeping belongs to this responder's event closures, not React state.
  let blocked = false, vertical = false, touchCount = 0;
  const responder = PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      blocked = false; vertical = false; touchCount = gesture.numberActiveTouches;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      touchCount = gesture.numberActiveTouches;
      if (Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) vertical = true;
      return !blocked && !vertical && gesture.numberActiveTouches === 1 && Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.7;
    },
    onPanResponderRelease: (_, gesture) => {
      const direction = swipeDirection(gesture.dx, gesture.dy, touchCount);
      if (!blocked && !vertical && direction) onNavigate(direction);
    },
    onPanResponderTerminationRequest: () => true,
  });
  return { panHandlers: responder.panHandlers, block: () => { blocked = true; } };
}

export function SwipeSurface({ children, onNavigate }: { children: ReactNode; onNavigate: (direction: -1 | 1) => void }) {
  const controller = useMemo(() => createSwipeController(onNavigate), [onNavigate]);
  return <GuardContext.Provider value={controller.block}>
    <View style={{ flex: 1 }} {...controller.panHandlers}>{children}</View>
  </GuardContext.Provider>;
}
