import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { SOOT } from '../palette';
import { CHAR_MS, type Line } from '../content/lines';


/** Ink with a glowing paper outline: a wide soft halo underneath,
 *  four offset paper copies forming a true outline, and the soot
 *  glyph on top. Shadows alone were not enough against the paintings
 *  (Simon, b50 and b51). Font scaling is capped: at Simon's max text
 *  size the uncapped lines ran off the page - these are painted
 *  words on art, not body text, so they grow a little and no more. */
const OUTLINE = [
  { x: -1.5, y: 0 }, { x: 1.5, y: 0 }, { x: 0, y: -1.5 }, { x: 0, y: 1.5 },
];
function GlowText({ text, base, cap }: { text: string; base: object; cap: number }) {
  return (
    <View>
      <Text style={[base, styles.glowWide]} maxFontSizeMultiplier={cap}>
        {text}
      </Text>
      {OUTLINE.map((o) => (
        <Text
          key={`${o.x},${o.y}`}
          style={[base, styles.outline, styles.stacked,
            { transform: [{ translateX: o.x }, { translateY: o.y }] }]}
          maxFontSizeMultiplier={cap}
        >
          {text}
        </Text>
      ))}
      <Text style={[base, styles.inkTop, styles.stacked]} maxFontSizeMultiplier={cap}>
        {text}
      </Text>
    </View>
  );
}

/** A spoken line: the characters settle one by one like a brush
 *  laying them down, then the English breathes in beneath. */
export function LineView({ line, top }: { line: Line; top: number }) {
  const chars = line.zh.split('');
  return (
    <Animated.View
      key={line.id}
      exiting={FadeOut.duration(400)}
      style={[styles.line, { top }]}
      pointerEvents="none"
    >
      <View style={styles.lineZhRow}>
        {chars.map((ch, i) => (
          <Animated.View
            key={`${line.id}-${i}`}
            entering={FadeIn.delay(i * CHAR_MS).duration(560)}
          >
            <GlowText text={ch} base={styles.lineZh} cap={1.2} />
          </Animated.View>
        ))}
      </View>
      <Animated.View
        entering={FadeIn.delay(chars.length * CHAR_MS + 320).duration(800)}
      >
        <GlowText text={line.en} base={styles.lineEn} cap={1.35} />
      </Animated.View>
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  line: { position: 'absolute', left: 26, right: 26, alignItems: 'center' },
  lineZhRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    maxWidth: 340,
  },
  lineZh: { fontSize: 23, lineHeight: 34, letterSpacing: 3 },
  lineEn: {
    fontSize: 14, lineHeight: 21, textAlign: 'center',
    maxWidth: 330, marginTop: 7,
  },
  stacked: { position: 'absolute', top: 0, left: 0, right: 0 },
  glowWide: {
    color: 'rgba(248,243,231,0.95)',
    textShadowColor: 'rgba(248,243,231,0.95)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },
  outline: {
    color: 'rgba(248,243,231,1)',
    textShadowColor: 'rgba(248,243,231,0.9)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2,
  },
  inkTop: { color: SOOT },
});
