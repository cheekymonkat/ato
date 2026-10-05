import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { exhaustedAbilities } from '../../domain/ability-state';
import { hasExhaustCost } from '../../domain/ability-costs';
import type { CardFace } from '../../domain/cards';
import type { JsonValue } from '../../domain/json';
import type { CardInstance } from '../../domain/party';
import { theme } from '../../theme/tokens';
import { SwipeGuard } from '../SwipeSurface';
import { CardColours, useCardColours } from './CardColours';
import { CardIcon } from './CardIcon';

const Context = createContext<{ ids: string[]; discarded: boolean; toggle?: (id: string, exhausted: boolean) => void } | null>(null);
const AbilityContext = createContext<{ id: string; label: string; exhausted: boolean; editable: boolean } | null>(null);
export function AbilityState({ instance, face, onExhausted, children }: {
  instance?: CardInstance; face: CardFace; onExhausted?: (id: string, exhausted: boolean) => void; children: ReactNode;
}) {
  return <Context.Provider value={instance ? { ids: exhaustedAbilities(instance, face), discarded: Boolean(instance.discarded), toggle: onExhausted } : null}>{children}</Context.Provider>;
}
/** A paid ability owns its own control and colour context; the card's other abilities remain ready. */
export function AbilityPanel({ id, heading, label, children }: { id: string; heading: JsonValue; label: string; children: ReactNode }) {
  const state = useContext(Context), paint = useCardColours(), exhausted = Boolean(state?.ids.includes(id));
  const editable = Boolean(state?.toggle && hasExhaustCost(heading));
  return <AbilityContext.Provider value={{ id, label, exhausted, editable }}><View testID={`ability-${id}`} style={styles.panel}>
    <View style={exhausted && styles.exhausted}><CardColours exhausted={paint.inactive || exhausted}>{children}</CardColours></View>
  </View></AbilityContext.Provider>;
}
/** Reuses the printed cost symbol; outside an editable paid ability it remains a normal icon. */
export function AbilityCostIcon(props: Parameters<typeof CardIcon>[0]) {
  const state = useContext(Context), ability = useContext(AbilityContext);
  if (props.name !== 'Exhaust' || !ability?.editable || !state?.toggle) return <CardIcon {...props} />;
  return <SwipeGuard><Pressable accessibilityRole="button" accessibilityLabel={`${ability.exhausted ? 'Ready' : 'Exhaust'} ${ability.label}`}
    accessibilityState={{ disabled: state.discarded, selected: ability.exhausted }} disabled={state.discarded}
    accessibilityHint="Toggles exhaustion for this ability only" hitSlop={10}
    onPress={event => { event.stopPropagation(); state.toggle!(ability.id, !ability.exhausted); }}
    style={({ pressed }) => [styles.action, state.discarded && { opacity: 0.35 }, pressed && { opacity: 0.65 }]}>
    <CardColours exhausted={false}><CardIcon {...props} tint={ability.exhausted ? '#B42332' : theme.ink} /></CardColours>
  </Pressable></SwipeGuard>;
}
const styles = StyleSheet.create({
  panel: { gap: 6 }, exhausted: { opacity: 0.5 },
  action: { minHeight: 24, minWidth: 24, justifyContent: 'center', alignItems: 'center' },
});
